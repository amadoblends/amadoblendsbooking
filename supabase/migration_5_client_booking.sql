-- ============================================================
-- migration_5_client_booking.sql
-- Run this in Supabase SQL Editor (same project as admin app)
-- Adds client auth linking + RLS for public booking access
-- ============================================================

-- 1. Add user_id column to clients so auth users can link to their record
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS clients_user_id_idx
  ON public.clients(user_id) WHERE user_id IS NOT NULL;

-- 2. Enable RLS on booking-related tables (safe to run if already enabled)
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- 3. Services: public read (any visitor can browse services)
DROP POLICY IF EXISTS "services_public_read" ON public.services;
CREATE POLICY "services_public_read" ON public.services
  FOR SELECT USING (true);

-- Services: admin can manage
DROP POLICY IF EXISTS "services_admin_all" ON public.services;
CREATE POLICY "services_admin_all" ON public.services
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- 4. Availability: public read
DROP POLICY IF EXISTS "availability_public_read" ON public.availability;
CREATE POLICY "availability_public_read" ON public.availability
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "availability_admin_all" ON public.availability;
CREATE POLICY "availability_admin_all" ON public.availability
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- 5. Booking settings: public read
DROP POLICY IF EXISTS "booking_settings_public_read" ON public.booking_settings;
CREATE POLICY "booking_settings_public_read" ON public.booking_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "booking_settings_admin_all" ON public.booking_settings;
CREATE POLICY "booking_settings_admin_all" ON public.booking_settings
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- 6. Clients: admin full access + client can manage own record
DROP POLICY IF EXISTS "clients_admin_all" ON public.clients;
CREATE POLICY "clients_admin_all" ON public.clients
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "clients_self_select" ON public.clients;
CREATE POLICY "clients_self_select" ON public.clients
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "clients_self_insert" ON public.clients;
CREATE POLICY "clients_self_insert" ON public.clients
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "clients_self_update" ON public.clients;
CREATE POLICY "clients_self_update" ON public.clients
  FOR UPDATE USING (user_id = auth.uid());

-- 7. Appointments: admin full access + client can create/read/cancel their own
DROP POLICY IF EXISTS "appointments_admin_all" ON public.appointments;
CREATE POLICY "appointments_admin_all" ON public.appointments
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "appointments_client_select" ON public.appointments;
CREATE POLICY "appointments_client_select" ON public.appointments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE id = appointments.client_id AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "appointments_client_insert" ON public.appointments;
CREATE POLICY "appointments_client_insert" ON public.appointments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE id = appointments.client_id AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "appointments_client_update" ON public.appointments;
CREATE POLICY "appointments_client_update" ON public.appointments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE id = appointments.client_id AND user_id = auth.uid()
    )
  );

-- 8. Verify
SELECT tablename, policyname FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
