-- ============================================================
-- migration_18b_no_show_rules.sql
-- PASO 2 de 2 — corre este DESPUÉS de que la 18a haya terminado.
-- Ahora que 'no_show' existe, se puede usar en funciones y reglas.
-- ============================================================

-- Las ausencias liberan el horario igual que las cancelaciones
CREATE OR REPLACE FUNCTION public.get_busy_times(p_start timestamptz, p_end timestamptz)
RETURNS TABLE(starts_at timestamptz, ends_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.starts_at, a.ends_at
  FROM appointments a
  WHERE a.status NOT IN ('cancelada', 'no_show')
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
  SELECT
    (d::date)::timestamptz,
    ((d::date) + interval '1 day')::timestamptz
  FROM closures c
  CROSS JOIN LATERAL generate_series(c.starts_on, c.ends_on, interval '1 day') AS d
  WHERE c.all_day
    AND (d::date)::timestamptz < p_end
    AND ((d::date) + interval '1 day')::timestamptz > p_start
  UNION ALL
  SELECT
    ((d::date) + c.start_time)::timestamptz,
    ((d::date) + c.end_time)::timestamptz
  FROM closures c
  CROSS JOIN LATERAL generate_series(c.starts_on, c.ends_on, interval '1 day') AS d
  WHERE NOT c.all_day AND c.start_time IS NOT NULL AND c.end_time IS NOT NULL
    AND ((d::date) + c.start_time)::timestamptz < p_end
    AND ((d::date) + c.end_time)::timestamptz > p_start;
$$;

-- El horario de una ausencia vuelve a quedar libre para reservar
DO $$
BEGIN
  ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_no_overlap;
  ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_no_overlap
    EXCLUDE USING gist (tstzrange(starts_at, ends_at) WITH &&)
    WHERE (status NOT IN ('cancelada', 'no_show'));
EXCEPTION WHEN others THEN
  RAISE NOTICE 'No se pudo recrear appointments_no_overlap: %', SQLERRM;
END $$;

SELECT 'migración 18b lista' AS resultado;
