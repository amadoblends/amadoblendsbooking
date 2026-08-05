-- ============================================================
-- migration_19_product_link.sql
-- Run in Supabase SQL Editor
-- Descripción y enlace de compra externo para productos
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS purchase_url text;

-- Solo se aceptan enlaces http(s); NULL significa "sin enlace"
DO $$
BEGIN
  ALTER TABLE public.products ADD CONSTRAINT products_purchase_url_check
    CHECK (purchase_url IS NULL OR purchase_url ~* '^https?://');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

SELECT 'migración 19 lista' AS resultado;
