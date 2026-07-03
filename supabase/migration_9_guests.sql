-- ============================================================
-- migration_9_guests.sql
-- Run in Supabase SQL Editor
-- Guests attached to an appointment (client can invite a friend)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.appointment_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text NOT NULL,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.appointment_guests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guests_admin_all" ON public.appointment_guests;
CREATE POLICY "guests_admin_all" ON public.appointment_guests
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "guests_client_select" ON public.appointment_guests;
CREATE POLICY "guests_client_select" ON public.appointment_guests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.clients c ON c.id = a.client_id
      WHERE a.id = appointment_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "guests_client_insert" ON public.appointment_guests;
CREATE POLICY "guests_client_insert" ON public.appointment_guests
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.clients c ON c.id = a.client_id
      WHERE a.id = appointment_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "guests_client_delete" ON public.appointment_guests;
CREATE POLICY "guests_client_delete" ON public.appointment_guests
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.clients c ON c.id = a.client_id
      WHERE a.id = appointment_id AND c.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS appointment_guests_apt_idx
  ON public.appointment_guests (appointment_id);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.appointment_guests;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

SELECT 'appointment_guests lista' AS resultado;
