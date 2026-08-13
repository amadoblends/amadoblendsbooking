-- ============================================================
-- migration_26_appointment_notifications.sql
-- La campanita del barbero se llena sola, desde la base de datos.
-- ============================================================
--
-- El problema: la app intentaba insertar en `notifications` desde el lado del
-- cliente y fallaba en silencio por dos razones a la vez:
--
--   1. RLS. La tabla solo tiene la política notifications_admin_all, con
--      is_admin(). La sesión de un cliente no es admin, así que el INSERT se
--      rechazaba.
--   2. Columnas. El código mandaba `type` y `appointment_id`, que no existían.
--
-- La solución no es aflojar la seguridad ni repetir la lógica en cada app: un
-- trigger en `appointments`. Corre con los permisos del dueño de la tabla, así
-- que RLS no lo bloquea, y se dispara pase lo que pase — reserva del cliente,
-- cita creada en el panel, o un INSERT hecho a mano en SQL.

-- ── 1. Las columnas que faltaban ────────────────────────────
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS type           text,
  ADD COLUMN IF NOT EXISTS appointment_id uuid;

-- Si se borra la cita, el aviso deja de apuntar a algo que no existe
DO $$
BEGIN
  ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_appointment_fk
    FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON public.notifications (read, created_at DESC);

-- ── 2. Texto legible, en la hora de la barbería ─────────────
-- to_char sobre un timestamptz usa la zona de la sesión, que en Supabase es
-- UTC. El AT TIME ZONE explícito es lo que evita el "9:00 AM sale 1:00 PM".
CREATE OR REPLACE FUNCTION public.fmt_shop_when(p_at timestamptz)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT to_char(p_at AT TIME ZONE 'America/Puerto_Rico', 'DD/MM')
      || ' · '
      || ltrim(to_char(p_at AT TIME ZONE 'America/Puerto_Rico', 'HH12:MI AM'), '0');
$$;

-- ── 3. El trigger ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_barber_on_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER            -- por esto RLS no lo bloquea
SET search_path = public
AS $$
DECLARE
  v_client  text;
  v_service text;
BEGIN
  SELECT COALESCE(NEW.guest_name, c.full_name, 'Cliente')
    INTO v_client
    FROM public.clients c
   WHERE c.id = NEW.client_id;

  SELECT s.name INTO v_service
    FROM public.services s
   WHERE s.id = NEW.service_id;

  v_client  := COALESCE(v_client,  'Cliente');
  v_service := COALESCE(v_service, 'Servicio');

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (title, body, type, appointment_id, read)
    VALUES (
      'Nueva cita',
      v_client || ' · ' || v_service || ' · ' || public.fmt_shop_when(NEW.starts_at),
      'cita', NEW.id, false
    );
    RETURN NEW;
  END IF;

  -- A partir de aquí es UPDATE

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status::text IN ('cancelada', 'no_show') THEN
    INSERT INTO public.notifications (title, body, type, appointment_id, read)
    VALUES (
      CASE WHEN NEW.status::text = 'cancelada' THEN 'Cita cancelada' ELSE 'No asistió' END,
      v_client || ' · ' || public.fmt_shop_when(NEW.starts_at),
      'cita', NEW.id, false
    );
    RETURN NEW;
  END IF;

  IF NEW.starts_at IS DISTINCT FROM OLD.starts_at THEN
    INSERT INTO public.notifications (title, body, type, appointment_id, read)
    VALUES (
      'Cita reprogramada',
      v_client || ' · ahora ' || public.fmt_shop_when(NEW.starts_at),
      'cita', NEW.id, false
    );
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_barber_insert ON public.appointments;
CREATE TRIGGER trg_notify_barber_insert
  AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.notify_barber_on_appointment();

DROP TRIGGER IF EXISTS trg_notify_barber_update ON public.appointments;
CREATE TRIGGER trg_notify_barber_update
  AFTER UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.notify_barber_on_appointment();

-- ── 4. Que la campanita se actualice sin recargar ───────────
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

SELECT 'migración 26 lista' AS resultado;
