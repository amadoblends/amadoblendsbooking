-- ============================================================
-- migration_32_feedback_categories.sql
-- Categorías dentro de cada tipo de comentario.
--
-- El área ya distingue app de servicio. La categoría dice QUÉ es dentro de
-- esa área, que es lo que decide si algo se arregla hoy o entra en una lista.
--   App:     bug | improvement | suggestion | other
--   Servicio: service | experience | suggestion | other
-- ============================================================

ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'other';

-- Las combinaciones válidas: cada categoría pertenece a un área
DO $$ BEGIN
  ALTER TABLE public.feedback ADD CONSTRAINT feedback_category_matches_area CHECK (
    (area = 'app'     AND category IN ('bug', 'improvement', 'suggestion', 'other'))
    OR
    (area = 'service' AND category IN ('service', 'experience', 'suggestion', 'other'))
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Para filtrar la bandeja por categoría sin recorrerla entera
CREATE INDEX IF NOT EXISTS feedback_category_idx ON public.feedback (area, category);

-- Cuándo se leyó, para que "abrir = leído" quede registrado y no dependa
-- de que la pantalla se acuerde
ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

SELECT 'migración 32 lista' AS resultado;
