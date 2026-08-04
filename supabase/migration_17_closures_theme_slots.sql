-- ============================================================
-- migration_17_closures_theme_slots.sql
-- Run in Supabase SQL Editor
-- 1) Cierres por rango de fechas con motivo
-- 2) Tema (claro/oscuro) del panel del barbero
-- 3) Intervalo de turnos global + optimización de huecos
-- 4) Estado "no asistió" en citas
-- ============================================================

-- ── 1. Cierres (vacaciones, feriados, días personales) ──────
CREATE TABLE IF NOT EXISTS public.closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  all_day boolean NOT NULL DEFAULT true,
  start_time time,              -- solo si all_day = false
  end_time time,
  reason text NOT NULL DEFAULT 'otro'
    CHECK (reason IN ('vacaciones','personal','enfermedad','feriado','evento','capacitacion','mantenimiento','otro')),
  description text,
  carousel_post_id uuid REFERENCES public.carousel_posts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on)
);

ALTER TABLE public.closures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "closures_public_read" ON public.closures;
CREATE POLICY "closures_public_read" ON public.closures
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "closures_admin_all" ON public.closures;
CREATE POLICY "closures_admin_all" ON public.closures
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE INDEX IF NOT EXISTS closures_range_idx ON public.closures (starts_on, ends_on);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.closures;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Los cierres también ocupan horario: se suman a get_busy_times
CREATE OR REPLACE FUNCTION public.get_busy_times(p_start timestamptz, p_end timestamptz)
RETURNS TABLE(starts_at timestamptz, ends_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.starts_at, a.ends_at
  FROM appointments a
  WHERE a.status NOT IN ('cancelada','no_show')
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
  WHERE b.starts_at < p_end AND b.ends_at > p_start
  UNION ALL
  -- Cierre de día completo: bloquea las 24 horas de cada día del rango
  SELECT
    (d::date)::timestamptz,
    ((d::date) + interval '1 day')::timestamptz
  FROM closures c
  CROSS JOIN LATERAL generate_series(c.starts_on, c.ends_on, interval '1 day') AS d
  WHERE c.all_day
    AND (d::date)::timestamptz < p_end
    AND ((d::date) + interval '1 day')::timestamptz > p_start
  UNION ALL
  -- Cierre parcial: solo la franja indicada de cada día
  SELECT
    ((d::date) + c.start_time)::timestamptz,
    ((d::date) + c.end_time)::timestamptz
  FROM closures c
  CROSS JOIN LATERAL generate_series(c.starts_on, c.ends_on, interval '1 day') AS d
  WHERE NOT c.all_day AND c.start_time IS NOT NULL AND c.end_time IS NOT NULL
    AND ((d::date) + c.start_time)::timestamptz < p_end
    AND ((d::date) + c.end_time)::timestamptz > p_start;
$$;

-- ── 2. Tema del panel ───────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'dark'
    CHECK (theme IN ('dark', 'light'));

-- ── 3. Intervalo de turnos y optimización ───────────────────
ALTER TABLE public.booking_settings
  ADD COLUMN IF NOT EXISTS slot_interval_minutes int NOT NULL DEFAULT 30
    CHECK (slot_interval_minutes BETWEEN 5 AND 240),
  ADD COLUMN IF NOT EXISTS optimize_gaps boolean NOT NULL DEFAULT false;

-- ── 4. "No asistió" como estado propio ──────────────────────
DO $$
BEGIN
  ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
  ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_status_check
    CHECK (status IN ('pendiente','confirmada','completada','cancelada','no_show'));
EXCEPTION WHEN others THEN NULL;
END $$;

-- La restricción de solapamiento debe ignorar también las ausencias
DO $$
BEGIN
  ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_no_overlap;
  ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_no_overlap
    EXCLUDE USING gist (tstzrange(starts_at, ends_at) WITH &&)
    WHERE (status NOT IN ('cancelada','no_show'));
EXCEPTION WHEN others THEN NULL;
END $$;

SELECT 'migración 17 lista' AS resultado;
