-- ============================================================
-- migration_14_products_guests_profile.sql
-- Run in Supabase SQL Editor
-- 1) Productos: categoría dry/wet + doble visibilidad
-- 2) Servicios ↔ productos (qué productos ofrece cada servicio)
-- 3) Productos elegidos por el cliente para su cita
-- 4) Perfil: nombre/apellido, idioma, última actividad
-- 5) Invitados: cita propia ligada a la cuenta del titular
-- ============================================================

-- ── 1. Productos ────────────────────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category text CHECK (category IN ('dry', 'wet')),
  ADD COLUMN IF NOT EXISTS is_visible_for_sale boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS available_for_services boolean NOT NULL DEFAULT true;

-- ── 2. Productos disponibles por servicio ───────────────────
CREATE TABLE IF NOT EXISTS public.service_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_id, product_id)
);

ALTER TABLE public.service_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sp_public_read" ON public.service_products;
CREATE POLICY "sp_public_read" ON public.service_products
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "sp_admin_all" ON public.service_products;
CREATE POLICY "sp_admin_all" ON public.service_products
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE INDEX IF NOT EXISTS service_products_service_idx
  ON public.service_products (service_id);

-- ── 3. Productos que el cliente pide usar durante su cita ───
--    (distinto de appointment_products, que son para comprar)
CREATE TABLE IF NOT EXISTS public.appointment_service_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id, product_id)
);

ALTER TABLE public.appointment_service_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asp_admin_all" ON public.appointment_service_products;
CREATE POLICY "asp_admin_all" ON public.appointment_service_products
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "asp_client_select" ON public.appointment_service_products;
CREATE POLICY "asp_client_select" ON public.appointment_service_products
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.clients c ON c.id = a.client_id
      WHERE a.id = appointment_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "asp_client_insert" ON public.appointment_service_products;
CREATE POLICY "asp_client_insert" ON public.appointment_service_products
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.clients c ON c.id = a.client_id
      WHERE a.id = appointment_id AND c.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS asp_appointment_idx
  ON public.appointment_service_products (appointment_id);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.appointment_service_products;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 4. Perfil del cliente ───────────────────────────────────
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'es' CHECK (language IN ('es', 'en')),
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();

-- Rellena nombre/apellido desde full_name para los clientes existentes
UPDATE public.clients
SET
  first_name = COALESCE(first_name, split_part(full_name, ' ', 1)),
  last_name = COALESCE(
    last_name,
    NULLIF(substring(full_name from position(' ' in full_name) + 1), full_name)
  )
WHERE first_name IS NULL;

-- ── 5. Invitados con cita propia ────────────────────────────
--    guest_name NULL  → la cita es del titular de la cuenta
--    guest_name lleno → la cita es de un invitado que él agregó
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS guest_name text,
  ADD COLUMN IF NOT EXISTS guest_relationship text;

CREATE INDEX IF NOT EXISTS appointments_guest_idx
  ON public.appointments (client_id) WHERE guest_name IS NOT NULL;

-- ── 6. Verificar ────────────────────────────────────────────
SELECT 'migración 14 lista' AS resultado;
