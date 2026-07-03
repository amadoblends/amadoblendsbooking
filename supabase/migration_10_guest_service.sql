-- ============================================================
-- migration_10_guest_service.sql
-- Run in Supabase SQL Editor
-- Guests can pick the service they want (they come for a cut too)
-- ============================================================

ALTER TABLE public.appointment_guests
  ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.services(id) ON DELETE SET NULL;

-- Verify
SELECT column_name FROM information_schema.columns
WHERE table_name = 'appointment_guests' ORDER BY ordinal_position;
