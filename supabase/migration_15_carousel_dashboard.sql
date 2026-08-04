-- ============================================================
-- migration_15_carousel_dashboard.sql
-- Run in Supabase SQL Editor
-- 1) Carrusel informativo del cliente, programable por fechas
-- 2) Layout del dashboard guardado en la cuenta del barbero
-- ============================================================

-- ── 1. Publicaciones del carrusel ───────────────────────────
CREATE TABLE IF NOT EXISTS public.carousel_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text,
  type text NOT NULL DEFAULT 'aviso'
    CHECK (type IN ('promocion','oferta','vacaciones','cerrado','holiday','aviso','servicio','info')),
  button_label text,
  button_href text,
  starts_on date,          -- NULL = visible desde ya
  ends_on date,            -- NULL = sin fecha de fin
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.carousel_posts ENABLE ROW LEVEL SECURITY;

-- Los clientes solo ven las publicaciones vigentes
DROP POLICY IF EXISTS "carousel_public_read" ON public.carousel_posts;
CREATE POLICY "carousel_public_read" ON public.carousel_posts
  FOR SELECT USING (
    is_active
    AND (starts_on IS NULL OR starts_on <= CURRENT_DATE)
    AND (ends_on IS NULL OR ends_on >= CURRENT_DATE)
  );

DROP POLICY IF EXISTS "carousel_admin_all" ON public.carousel_posts;
CREATE POLICY "carousel_admin_all" ON public.carousel_posts
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE INDEX IF NOT EXISTS carousel_active_idx
  ON public.carousel_posts (is_active, sort_order);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.carousel_posts;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Layout del dashboard por administrador ───────────────
CREATE TABLE IF NOT EXISTS public.dashboard_layout (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_order text[] NOT NULL DEFAULT '{}',
  hidden_cards text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (admin_id)
);

-- La tabla puede existir de antes sin la columna de ocultos
ALTER TABLE public.dashboard_layout
  ADD COLUMN IF NOT EXISTS hidden_cards text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.dashboard_layout ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "layout_self_all" ON public.dashboard_layout;
CREATE POLICY "layout_self_all" ON public.dashboard_layout
  FOR ALL USING (admin_id = auth.uid()) WITH CHECK (admin_id = auth.uid());

SELECT 'migración 15 lista' AS resultado;
