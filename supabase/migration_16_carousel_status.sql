-- ============================================================
-- migration_16_carousel_status.sql
-- Run AFTER migration_15. Seguro de correr aunque la 15 ya haya pasado.
-- 1) Crea carousel_posts si falta (por si la 15 no llegó a correr)
-- 2) Agrega borradores y el tipo "horario especial"
-- ============================================================

-- ── 1. Tabla base (idéntica a la 15, por si acaso) ──────────
CREATE TABLE IF NOT EXISTS public.carousel_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text,
  type text NOT NULL DEFAULT 'aviso',
  button_label text,
  button_href text,
  starts_on date,
  ends_on date,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Borrador: no se publica hasta que el barbero lo decida ──
ALTER TABLE public.carousel_posts
  ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false;

-- ── 3. Ampliar los tipos permitidos ─────────────────────────
ALTER TABLE public.carousel_posts DROP CONSTRAINT IF EXISTS carousel_posts_type_check;
ALTER TABLE public.carousel_posts
  ADD CONSTRAINT carousel_posts_type_check CHECK (type IN (
    'promocion','oferta','vacaciones','cerrado','holiday',
    'horario','servicio','aviso','info'
  ));

-- ── 4. RLS ──────────────────────────────────────────────────
ALTER TABLE public.carousel_posts ENABLE ROW LEVEL SECURITY;

-- El cliente solo ve lo publicado, activo y dentro de fechas
DROP POLICY IF EXISTS "carousel_public_read" ON public.carousel_posts;
CREATE POLICY "carousel_public_read" ON public.carousel_posts
  FOR SELECT USING (
    is_active
    AND NOT is_draft
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

-- ── 5. Layout del dashboard (por si la 15 no corrió) ────────
CREATE TABLE IF NOT EXISTS public.dashboard_layout (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_order text[] NOT NULL DEFAULT '{}',
  hidden_cards text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (admin_id)
);

ALTER TABLE public.dashboard_layout
  ADD COLUMN IF NOT EXISTS hidden_cards text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.dashboard_layout ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "layout_self_all" ON public.dashboard_layout;
CREATE POLICY "layout_self_all" ON public.dashboard_layout
  FOR ALL USING (admin_id = auth.uid()) WITH CHECK (admin_id = auth.uid());

SELECT 'migración 16 lista' AS resultado;
