-- ============================================================
-- migration_35_reminder_rules.sql
-- Recordatorios configurables, con su ciclo de vida completo.
--
-- Se apoya en la arquitectura de la migración 28 en vez de abrir otra:
--
--   Cita → Regla de recordatorio → Momento calculado → Canales activos
--        → notification_events → email / sms / push → resultado registrado
--
-- Los tiempos NO están en el código. Están aquí, y se editan desde el panel.
-- ============================================================

-- ── 1. Las reglas ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reminder_rules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Cuánto antes de la cita. 1440 = 24 h, 30 = media hora.
  minutes_before int NOT NULL CHECK (minutes_before > 0 AND minutes_before <= 43200),
  -- Cada canal se enciende por separado
  email         boolean NOT NULL DEFAULT true,
  sms           boolean NOT NULL DEFAULT false,
  push          boolean NOT NULL DEFAULT true,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Dos reglas al mismo tiempo mandarían dos recordatorios iguales
CREATE UNIQUE INDEX IF NOT EXISTS reminder_rules_minutes_key
  ON public.reminder_rules (minutes_before);

ALTER TABLE public.reminder_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reminder_rules_admin" ON public.reminder_rules;
CREATE POLICY "reminder_rules_admin" ON public.reminder_rules
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Un punto de partida razonable; todo esto se cambia desde el panel
INSERT INTO public.reminder_rules (minutes_before, email, sms, push)
VALUES (1440, true,  false, true),   -- 24 horas antes
       (120,  false, false, true),   -- 2 horas antes
       (30,   false, false, true)    -- 30 minutos antes
ON CONFLICT (minutes_before) DO NOTHING;

-- ── 2. Los recordatorios programados ────────────────────────
DO $$ BEGIN
  CREATE TYPE public.reminder_status AS ENUM
    ('scheduled', 'sent', 'failed', 'cancelled', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.scheduled_reminders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  rule_id        uuid REFERENCES public.reminder_rules(id) ON DELETE SET NULL,
  -- Se guarda copiado: si mañana cambias la regla, lo ya programado no muta
  minutes_before int NOT NULL,
  send_at        timestamptz NOT NULL,
  status         public.reminder_status NOT NULL DEFAULT 'scheduled',
  -- Qué canales pedía la regla, y cómo fue cada uno
  channels       jsonb NOT NULL DEFAULT '{}'::jsonb,
  result         jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts       int NOT NULL DEFAULT 0,
  last_error     text,
  sent_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Una cita no puede tener dos veces el mismo recordatorio
CREATE UNIQUE INDEX IF NOT EXISTS scheduled_reminders_unique
  ON public.scheduled_reminders (appointment_id, minutes_before);

-- La consulta del worker: "qué toca mandar ahora"
CREATE INDEX IF NOT EXISTS scheduled_reminders_due_idx
  ON public.scheduled_reminders (status, send_at)
  WHERE status = 'scheduled';

ALTER TABLE public.scheduled_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scheduled_reminders_admin" ON public.scheduled_reminders;
CREATE POLICY "scheduled_reminders_admin" ON public.scheduled_reminders
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ── 3. Programar, cancelar y recalcular ─────────────────────
/*
 * Rehace los recordatorios de una cita desde cero.
 *
 * Lo pendiente se cancela y se vuelve a calcular con la hora actual de la
 * cita. Lo ya enviado no se toca: pasó de verdad, y borrarlo sería mentir
 * sobre lo que el cliente recibió.
 */
CREATE OR REPLACE FUNCTION public.reschedule_reminders(p_appointment_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_starts timestamptz;
  v_status text;
  r RECORD;
  v_send timestamptz;
BEGIN
  SELECT a.starts_at, a.status::text INTO v_starts, v_status
    FROM public.appointments a WHERE a.id = p_appointment_id;

  IF v_starts IS NULL THEN RETURN; END IF;

  -- Lo que no se ha mandado deja de estar en cola
  UPDATE public.scheduled_reminders
     SET status = 'cancelled'
   WHERE appointment_id = p_appointment_id AND status = 'scheduled';

  -- Una cita cancelada o ya cerrada no vuelve a programar nada
  /*
   * Comparado como texto a propósito. `status` es un enum, y 'no_show' solo
   * existe en él si se corrió la migración 18a. Nombrarlo como valor de enum
   * rompe la migración entera en una base donde no está; comparar el texto
   * funciona en las dos, y sigue funcionando si mañana se añade otro estado.
   */
  IF v_status IN ('cancelada', 'completada', 'no_show') THEN RETURN; END IF;

  FOR r IN
    SELECT * FROM public.reminder_rules WHERE is_active
  LOOP
    v_send := v_starts - (r.minutes_before || ' minutes')::interval;

    -- Un recordatorio cuyo momento ya pasó no se manda tarde: se marca
    -- omitido, para que quede claro por qué no llegó.
    INSERT INTO public.scheduled_reminders
      (appointment_id, rule_id, minutes_before, send_at, status, channels)
    VALUES (
      p_appointment_id, r.id, r.minutes_before, v_send,
      CASE WHEN v_send <= now() THEN 'skipped'::public.reminder_status
           ELSE 'scheduled'::public.reminder_status END,
      jsonb_build_object('email', r.email, 'sms', r.sms, 'push', r.push)
    )
    ON CONFLICT (appointment_id, minutes_before) DO UPDATE
      SET send_at  = EXCLUDED.send_at,
          rule_id  = EXCLUDED.rule_id,
          channels = EXCLUDED.channels,
          status   = EXCLUDED.status,
          -- Un reintento limpio tras reagendar
          attempts = 0,
          last_error = NULL
      -- Salvo que ya se hubiera mandado: eso ocurrió y se respeta
      WHERE public.scheduled_reminders.status <> 'sent';
  END LOOP;
END $$;

/*
 * Cualquier cambio en la hora o el estado de una cita rehace su cola.
 * Va por trigger y no desde la app para que valga igual si la cita se toca
 * desde el panel, desde la app del cliente o desde el editor SQL.
 */
CREATE OR REPLACE FUNCTION public.appointments_sync_reminders()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.reschedule_reminders(NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_appointments_sync_reminders ON public.appointments;
CREATE TRIGGER trg_appointments_sync_reminders
  AFTER INSERT OR UPDATE OF starts_at, status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.appointments_sync_reminders();

-- Cambiar las reglas reprograma las citas futuras que aún no han pasado
CREATE OR REPLACE FUNCTION public.reminder_rules_resync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a RECORD;
BEGIN
  FOR a IN
    SELECT id FROM public.appointments
     WHERE starts_at > now()
       AND status::text NOT IN ('cancelada', 'completada', 'no_show')
  LOOP
    PERFORM public.reschedule_reminders(a.id);
  END LOOP;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_reminder_rules_resync ON public.reminder_rules;
CREATE TRIGGER trg_reminder_rules_resync
  AFTER INSERT OR UPDATE OR DELETE ON public.reminder_rules
  FOR EACH STATEMENT EXECUTE FUNCTION public.reminder_rules_resync();

-- ── 4. Lo que el worker consume ─────────────────────────────
/*
 * Los recordatorios que toca mandar, con todo lo necesario para armarlos.
 *
 * Los marca como 'sent' provisionalmente al entregarlos — así dos ejecuciones
 * simultáneas del cron no mandan el mismo dos veces. Si el envío falla, el
 * worker lo devuelve a 'failed' con el motivo.
 */
CREATE OR REPLACE FUNCTION public.claim_due_reminders(p_limit int DEFAULT 50)
RETURNS TABLE (
  id             uuid,
  appointment_id uuid,
  minutes_before int,
  channels       jsonb,
  starts_at      timestamptz,
  client_id      uuid,
  client_name    text,
  client_email   text,
  client_phone   text,
  service_name   text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT s.id
      FROM public.scheduled_reminders s
      JOIN public.appointments a ON a.id = s.appointment_id
     WHERE s.status = 'scheduled'
       AND s.send_at <= now()
       -- Nunca un recordatorio de algo que ya ocurrió
       AND a.starts_at > now()
       AND a.status::text NOT IN ('cancelada', 'completada', 'no_show')
     ORDER BY s.send_at
     LIMIT p_limit
     -- Dos ejecuciones a la vez no se pisan
     FOR UPDATE OF s SKIP LOCKED
  ),
  taken AS (
    UPDATE public.scheduled_reminders s
       SET status   = 'sent',
           attempts = s.attempts + 1,
           sent_at  = now()
      FROM due
     WHERE s.id = due.id
     RETURNING s.*
  )
  SELECT t.id, t.appointment_id, t.minutes_before, t.channels,
         a.starts_at, c.id, c.full_name, c.email, c.phone, sv.name
    FROM taken t
    JOIN public.appointments a ON a.id = t.appointment_id
    LEFT JOIN public.clients  c ON c.id = a.client_id
    LEFT JOIN public.services sv ON sv.id = a.service_id;
END $$;

REVOKE ALL ON FUNCTION public.claim_due_reminders(int) FROM public, anon, authenticated;

/** Cómo fue cada canal, o por qué no salió. */
CREATE OR REPLACE FUNCTION public.record_reminder_result(
  p_id uuid, p_result jsonb, p_failed boolean DEFAULT false, p_error text DEFAULT NULL
) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.scheduled_reminders
     SET result     = p_result,
         status     = CASE WHEN p_failed THEN 'failed'::public.reminder_status
                           ELSE 'sent'::public.reminder_status END,
         last_error = p_error
   WHERE id = p_id;
$$;

REVOKE ALL ON FUNCTION public.record_reminder_result(uuid, jsonb, boolean, text)
  FROM public, anon, authenticated;

-- ── 5. Las citas que ya existen ─────────────────────────────
DO $$
DECLARE a RECORD;
BEGIN
  FOR a IN
    SELECT id FROM public.appointments
     WHERE starts_at > now()
       AND status::text NOT IN ('cancelada', 'completada', 'no_show')
  LOOP
    PERFORM public.reschedule_reminders(a.id);
  END LOOP;
END $$;

SELECT
  (SELECT count(*) FROM public.reminder_rules WHERE is_active)              AS reglas,
  (SELECT count(*) FROM public.scheduled_reminders WHERE status='scheduled') AS en_cola,
  'migración 35 lista'                                                       AS resultado;
