-- ============================================================
-- migration_11_notifications_promos.sql
-- Run in Supabase SQL Editor
-- 1) services.description
-- 2) In-app notifications for clients
-- 3) Promotions (discounts by day/hour) + notify-all RPC
-- ============================================================

-- ── 1. Service description ──────────────────────────────────
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS description text;

-- ── 2. Notifications ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  type text NOT NULL DEFAULT 'info', -- info | cita | promo
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_admin_all" ON public.notifications;
CREATE POLICY "notif_admin_all" ON public.notifications
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "notif_client_select" ON public.notifications;
CREATE POLICY "notif_client_select" ON public.notifications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "notif_client_update" ON public.notifications;
CREATE POLICY "notif_client_update" ON public.notifications
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS notifications_client_idx
  ON public.notifications (client_id, read, created_at DESC);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 3. Promotions ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  discount_percent int NOT NULL CHECK (discount_percent BETWEEN 1 AND 100),
  service_id uuid REFERENCES public.services(id) ON DELETE CASCADE, -- NULL = all services
  weekdays int[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  start_time time,  -- NULL = all day
  end_time time,
  starts_on date,   -- NULL = starts now
  ends_on date,     -- NULL = no end
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promos_public_read" ON public.promotions;
CREATE POLICY "promos_public_read" ON public.promotions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "promos_admin_all" ON public.promotions;
CREATE POLICY "promos_admin_all" ON public.promotions
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ── 4. Notify every client at once (used for new promotions) ─
CREATE OR REPLACE FUNCTION public.notify_all_clients(p_title text, p_body text, p_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  INSERT INTO notifications (client_id, title, body, type)
  SELECT id, p_title, p_body, p_type FROM clients;
END $$;

REVOKE ALL ON FUNCTION public.notify_all_clients(text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.notify_all_clients(text, text, text) TO authenticated;

SELECT 'migración 11 lista' AS resultado;
