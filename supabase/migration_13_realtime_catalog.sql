-- ============================================================
-- migration_13_realtime_catalog.sql
-- Run in Supabase SQL Editor
-- Realtime for catalog tables: services, products, promotions
-- Changes made in the admin appear instantly in the client app.
-- ============================================================

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.services;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.promotions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

SELECT 'migración 13 lista' AS resultado;
