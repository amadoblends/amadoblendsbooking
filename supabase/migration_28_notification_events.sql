-- ============================================================
-- migration_28_notification_events.sql
-- Un solo evento → varios canales, sin sistemas paralelos.
-- ============================================================
--
-- El problema que resuelve: había tres caminos independientes (la campanita,
-- el correo, y más adelante las push). Cada uno podía decir algo distinto, o
-- duplicarse, o no enviarse sin que quedara rastro.
--
-- A partir de aquí hay UN evento. Los canales son consecuencias suyas, y cada
-- uno queda registrado en el propio evento: qué se mandó, cuándo, y si falló.

-- ── 1. El evento ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 'booking_created' | 'booking_cancelled' | 'booking_rescheduled' | 'reminder'
  kind           text NOT NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE CASCADE,
  client_id      uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  -- Quién lo provocó: 'client' | 'barber' | 'system'
  actor          text NOT NULL DEFAULT 'system',
  title          text NOT NULL,
  body           text NOT NULL,
  -- Dónde debe abrir al tocarla
  href           text,
  -- Datos que los canales necesitan (hora anterior, servicio, etc.)
  payload        jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- {"in_app":"sent","push":"sent","email":"failed: ...","sms":"skipped"}
  channels       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_events_client_idx
  ON public.notification_events (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notification_events_apt_idx
  ON public.notification_events (appointment_id);

ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

-- El cliente ve su propio historial
DROP POLICY IF EXISTS "nevents_client_read" ON public.notification_events;
CREATE POLICY "nevents_client_read" ON public.notification_events
  FOR SELECT USING (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "nevents_admin_all" ON public.notification_events;
CREATE POLICY "nevents_admin_all" ON public.notification_events
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Insertar lo hace el servidor en nombre de quien actúa
DROP POLICY IF EXISTS "nevents_insert" ON public.notification_events;
CREATE POLICY "nevents_insert" ON public.notification_events
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ── 2. Suscripciones push ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Un usuario puede tener varios dispositivos
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id   uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  -- true = es el barbero, para separar los envíos
  is_admin    boolean NOT NULL DEFAULT false,
  endpoint    text NOT NULL UNIQUE,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS push_subs_client_idx ON public.push_subscriptions (client_id);
CREATE INDEX IF NOT EXISTS push_subs_admin_idx  ON public.push_subscriptions (is_admin);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Cada quien gestiona las suyas
DROP POLICY IF EXISTS "push_self_all" ON public.push_subscriptions;
CREATE POLICY "push_self_all" ON public.push_subscriptions
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "push_admin_read" ON public.push_subscriptions;
CREATE POLICY "push_admin_read" ON public.push_subscriptions
  FOR SELECT USING (is_admin());

-- ── 3. Preferencias por canal ───────────────────────────────
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS notify_push  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_email boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_sms   boolean NOT NULL DEFAULT false;

COMMENT ON TABLE public.notification_events IS
  'Fuente única de cada aviso. Los canales (campanita, push, correo, SMS) se derivan de aquí y se registran en channels.';

SELECT 'migración 28 lista' AS resultado;
