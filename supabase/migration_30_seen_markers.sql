-- ============================================================
-- migration_30_seen_markers.sql
-- Marcadores de "ya lo vi" para el panel del barbero: el badge de citas
-- nuevas y el buzón de feedback.
-- ============================================================

-- ── 1. Cuándo miró el barbero cada bandeja ──────────────────
-- Va en profiles y no en business_settings porque es de cada persona:
-- si mañana hay dos barberos, cada uno tiene su propio "visto".
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS citas_seen_at    timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS feedback_seen_at timestamptz NOT NULL DEFAULT now();

-- Contar citas nuevas exige mirar por fecha de creación, no de comienzo
CREATE INDEX IF NOT EXISTS appointments_created_at_idx
  ON public.appointments (created_at DESC);

-- Saber quién creó la cita: el badge cuenta lo que llega de fuera, no lo que
-- el barbero acaba de escribir a mano.
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS created_by_barber boolean NOT NULL DEFAULT false;

/*
 * Los dos contadores del panel en una sola llamada.
 *
 * Se hace en la base y no en el cliente para que el badge no dependa de
 * traerse las filas: son dos count() con índice, y el navegador recibe
 * dos números.
 */
CREATE OR REPLACE FUNCTION public.unseen_counts()
RETURNS TABLE (citas bigint, feedback bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE
  v_citas    timestamptz;
  v_feedback timestamptz;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN QUERY SELECT 0::bigint, 0::bigint;
    RETURN;
  END IF;

  SELECT p.citas_seen_at, p.feedback_seen_at
    INTO v_citas, v_feedback
    FROM public.profiles p
   WHERE p.id = auth.uid();

  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.appointments a
      WHERE a.created_at > COALESCE(v_citas, '-infinity'::timestamptz)
      -- Una cita que el propio barbero acaba de crear no es "nueva" para él
        AND COALESCE(a.created_by_barber, false) = false
        AND a.status <> 'cancelled'),
    (SELECT count(*) FROM public.feedback f
      WHERE f.created_at > COALESCE(v_feedback, '-infinity'::timestamptz)
        AND f.status = 'new');
END $$;

GRANT EXECUTE ON FUNCTION public.unseen_counts() TO authenticated;

/*
 * Marca una bandeja como vista. Un solo punto de entrada para las dos, para
 * que el panel no tenga que saber en qué columna vive cada marcador.
 */
CREATE OR REPLACE FUNCTION public.mark_seen(p_inbox text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RETURN; END IF;

  IF p_inbox = 'citas' THEN
    UPDATE public.profiles SET citas_seen_at = now() WHERE id = auth.uid();
  ELSIF p_inbox = 'feedback' THEN
    UPDATE public.profiles SET feedback_seen_at = now() WHERE id = auth.uid();
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.mark_seen(text) TO authenticated;

SELECT 'migración 30 lista' AS resultado;
