-- ============================================================
-- migration_8_service_visibility.sql
-- Run in Supabase SQL Editor
-- Allows hiding a service from public client booking while
-- keeping it usable inside packages and the admin app.
-- ============================================================

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

-- Verify
SELECT id, name, kind, is_public FROM public.services ORDER BY name;
