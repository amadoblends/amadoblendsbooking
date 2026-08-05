-- ============================================================
-- migration_20_branding.sql
-- Run in Supabase SQL Editor
-- El logo del negocio y la foto del barbero son cosas distintas
-- y se guardan por separado.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.business_settings (
  id int PRIMARY KEY DEFAULT 1,
  name text NOT NULL DEFAULT 'Amado Blends',
  logo_url text,
  address text,
  phone text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_settings_singleton CHECK (id = 1)
);

INSERT INTO public.business_settings (id, name)
VALUES (1, 'Amado Blends')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

-- El logo se muestra también en la app del cliente
DROP POLICY IF EXISTS "business_public_read" ON public.business_settings;
CREATE POLICY "business_public_read" ON public.business_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "business_admin_write" ON public.business_settings;
CREATE POLICY "business_admin_write" ON public.business_settings
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.business_settings;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

SELECT 'migración 20 lista' AS resultado;
