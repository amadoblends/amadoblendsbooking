-- ============================================================
-- migration_6_performance.sql
-- Run this in Supabase SQL Editor (same project as admin app)
-- 1) Busy-times RPC so clients see occupied slots (no double booking)
-- 2) Public read for products (Tienda page)
-- 3) Indexes for scale (3000+ clients)
-- ============================================================

-- 1. RPC: expose ONLY busy time ranges (no client data) to authenticated users.
--    Used by the booking flow to hide occupied slots.
CREATE OR REPLACE FUNCTION public.get_busy_times(p_start timestamptz, p_end timestamptz)
RETURNS TABLE(starts_at timestamptz, ends_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.starts_at, a.ends_at
  FROM appointments a
  WHERE a.status <> 'cancelada'
    AND a.starts_at < p_end
    AND a.ends_at > p_start;
$$;

REVOKE ALL ON FUNCTION public.get_busy_times(timestamptz, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.get_busy_times(timestamptz, timestamptz) TO authenticated;

-- 2. Products: public read so the client Tienda can browse the catalog
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_public_read" ON public.products;
CREATE POLICY "products_public_read" ON public.products
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "products_admin_all" ON public.products;
CREATE POLICY "products_admin_all" ON public.products
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- 3. Indexes for performance at scale
CREATE INDEX IF NOT EXISTS appointments_starts_at_idx
  ON public.appointments (starts_at);

CREATE INDEX IF NOT EXISTS appointments_client_starts_idx
  ON public.appointments (client_id, starts_at DESC);

CREATE INDEX IF NOT EXISTS appointments_status_idx
  ON public.appointments (status);

CREATE INDEX IF NOT EXISTS clients_phone_idx
  ON public.clients (phone);

CREATE INDEX IF NOT EXISTS clients_full_name_idx
  ON public.clients (full_name);

-- 4. Prevent double bookings at the database level (if not already present).
--    Requires btree_gist; ignores cancelled appointments.
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointments_no_overlap'
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_no_overlap
      EXCLUDE USING gist (
        tstzrange(starts_at, ends_at) WITH &&
      ) WHERE (status <> 'cancelada');
  END IF;
END $$;

-- 5. Verify
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public' AND tablename IN ('appointments', 'clients')
ORDER BY indexname;
