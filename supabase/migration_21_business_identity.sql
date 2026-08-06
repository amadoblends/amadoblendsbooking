-- Migración 21 · Identidad del negocio en la app del cliente
--
-- La app del cliente debe sentirse como la barbería, no como una app genérica:
-- portada, descripción y horario visible junto al logo y el nombre.
--
-- Requiere que la migración 20 ya haya creado business_settings.

ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS cover_url    text,
  ADD COLUMN IF NOT EXISTS description  text,
  ADD COLUMN IF NOT EXISTS instagram    text;

-- La app del cliente lee estos campos sin sesión de administrador; la política
-- pública de lectura ya existe desde la migración 20, pero la recreamos por si
-- esa migración se corrió antes de añadir las columnas nuevas.
DROP POLICY IF EXISTS "business_public_read" ON public.business_settings;
CREATE POLICY "business_public_read" ON public.business_settings
  FOR SELECT USING (true);

SELECT 'migración 21 lista' AS resultado;
