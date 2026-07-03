-- ============================================================
-- migration_7_holds_products_realtime.sql
-- Run in Supabase SQL Editor (same project as admin app)
-- 1) Temporary slot holds (60s) while a client confirms
-- 2) Products attached to an appointment
-- 3) Realtime publication so both apps update instantly
-- ============================================================

-- ── 1. Slot holds ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.slot_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '60 seconds'),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.slot_holds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "holds_self_all" ON public.slot_holds;
CREATE POLICY "holds_self_all" ON public.slot_holds
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS slot_holds_expires_idx ON public.slot_holds (expires_at);
CREATE INDEX IF NOT EXISTS slot_holds_range_idx ON public.slot_holds (starts_at, ends_at);

-- Atomically try to hold a slot. Returns the hold id, or NULL if taken.
CREATE OR REPLACE FUNCTION public.hold_slot(p_starts timestamptz, p_ends timestamptz)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Each user keeps at most one active hold
  DELETE FROM slot_holds WHERE user_id = auth.uid();
  -- Opportunistic cleanup of expired holds
  DELETE FROM slot_holds WHERE expires_at < now();

  IF EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.status <> 'cancelada' AND a.starts_at < p_ends AND a.ends_at > p_starts
  ) OR EXISTS (
    SELECT 1 FROM slot_holds h
    WHERE h.expires_at > now() AND h.user_id <> auth.uid()
      AND h.starts_at < p_ends AND h.ends_at > p_starts
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO slot_holds (user_id, starts_at, ends_at)
  VALUES (auth.uid(), p_starts, p_ends)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.hold_slot(timestamptz, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.hold_slot(timestamptz, timestamptz) TO authenticated;

-- Release the caller's holds (on cancel / back / confirm)
CREATE OR REPLACE FUNCTION public.release_my_holds()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM slot_holds WHERE user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.release_my_holds() FROM public;
GRANT EXECUTE ON FUNCTION public.release_my_holds() TO authenticated;

-- get_busy_times now also includes OTHER users' active holds
CREATE OR REPLACE FUNCTION public.get_busy_times(p_start timestamptz, p_end timestamptz)
RETURNS TABLE(starts_at timestamptz, ends_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.starts_at, a.ends_at
  FROM appointments a
  WHERE a.status <> 'cancelada'
    AND a.starts_at < p_end AND a.ends_at > p_start
  UNION ALL
  SELECT h.starts_at, h.ends_at
  FROM slot_holds h
  WHERE h.expires_at > now()
    AND h.user_id IS DISTINCT FROM auth.uid()
    AND h.starts_at < p_end AND h.ends_at > p_start;
$$;

-- ── 2. Products attached to appointments ────────────────────

CREATE TABLE IF NOT EXISTS public.appointment_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id, product_id)
);

ALTER TABLE public.appointment_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ap_admin_all" ON public.appointment_products;
CREATE POLICY "ap_admin_all" ON public.appointment_products
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "ap_client_select" ON public.appointment_products;
CREATE POLICY "ap_client_select" ON public.appointment_products
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.clients c ON c.id = a.client_id
      WHERE a.id = appointment_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ap_client_insert" ON public.appointment_products;
CREATE POLICY "ap_client_insert" ON public.appointment_products
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.clients c ON c.id = a.client_id
      WHERE a.id = appointment_id AND c.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS appointment_products_apt_idx
  ON public.appointment_products (appointment_id);

-- ── 3. Realtime ─────────────────────────────────────────────

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.appointment_products;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 4. Verify ───────────────────────────────────────────────
SELECT 'holds' AS t, count(*) FROM slot_holds
UNION ALL
SELECT 'appointment_products', count(*) FROM appointment_products;
