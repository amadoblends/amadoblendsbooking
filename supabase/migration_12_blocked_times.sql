-- ============================================================
-- migration_12_blocked_times.sql
-- Run in Supabase SQL Editor
-- Admin can block one or more hours; blocked hours disappear
-- from client booking automatically.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.blocked_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blocked_times ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blocked_admin_all" ON public.blocked_times;
CREATE POLICY "blocked_admin_all" ON public.blocked_times
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE INDEX IF NOT EXISTS blocked_times_range_idx
  ON public.blocked_times (starts_at, ends_at);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.blocked_times;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- get_busy_times now also includes blocked hours (clients can't book them)
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
    AND h.starts_at < p_end AND h.ends_at > p_start
  UNION ALL
  SELECT b.starts_at, b.ends_at
  FROM blocked_times b
  WHERE b.starts_at < p_end AND b.ends_at > p_start;
$$;

SELECT 'migración 12 lista' AS resultado;
