-- ============================================================
-- migration_29_clients_birthday_feedback.sql
-- Fecha de nacimiento, clientes walk-in vinculables, estado "nuevo"
-- que caduca, descuento de cumpleaños y buzón de feedback.
-- ============================================================

-- ── 1. Fecha de nacimiento ──────────────────────────────────
-- La columna ya existe para el panel del barbero (birth_date). Se reusa esa
-- misma: dos columnas para el mismo dato acabarían discrepando.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS birth_date date;

-- Buscar "quién cumple hoy" sin recorrer toda la tabla.
-- Va por mes y día y no por to_char: dar formato a una fecha depende del
-- DateStyle de la sesión, así que Postgres no la acepta en un índice.
CREATE INDEX IF NOT EXISTS clients_birth_date_idx
  ON public.clients (
    (EXTRACT(MONTH FROM birth_date)),
    (EXTRACT(DAY   FROM birth_date))
  );

-- ── 2. Clientes creados por el barbero ──────────────────────
-- Un walk-in es un perfil real sin cuenta: acumula citas, gastos e historial.
-- Cuando esa persona se registre, su cuenta se engancha a este perfil en vez
-- de crear uno duplicado.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS created_by_barber boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS linked_at         timestamptz,
  -- Se calcula al guardar, para poder cruzar teléfonos escritos de mil formas
  ADD COLUMN IF NOT EXISTS phone_digits      text;

-- Solo los últimos 10 dígitos: ignora +1, guiones, paréntesis y espacios
CREATE OR REPLACE FUNCTION public.normalize_phone(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(RIGHT(regexp_replace(COALESCE(p, ''), '\D', '', 'g'), 10), '');
$$;

CREATE OR REPLACE FUNCTION public.clients_set_phone_digits()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.phone_digits := public.normalize_phone(NEW.phone);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_clients_phone_digits ON public.clients;
CREATE TRIGGER trg_clients_phone_digits
  BEFORE INSERT OR UPDATE OF phone ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.clients_set_phone_digits();

UPDATE public.clients SET phone_digits = public.normalize_phone(phone)
WHERE phone_digits IS DISTINCT FROM public.normalize_phone(phone);

CREATE INDEX IF NOT EXISTS clients_phone_digits_idx ON public.clients (phone_digits);
CREATE INDEX IF NOT EXISTS clients_email_lower_idx  ON public.clients (lower(email));

/*
 * Busca un perfil sin cuenta que coincida con quien se está registrando.
 * SECURITY DEFINER porque corre antes de que el usuario tenga acceso a nada;
 * devuelve solo lo justo para que el registro pueda ofrecer la vinculación.
 */
CREATE OR REPLACE FUNCTION public.find_unclaimed_client(p_email text, p_phone text)
RETURNS TABLE (id uuid, full_name text, visit_count bigint, has_phone boolean)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT c.id,
         c.full_name,
         (SELECT count(*) FROM public.appointments a WHERE a.client_id = c.id),
         c.phone_digits IS NOT NULL
    FROM public.clients c
   WHERE c.user_id IS NULL
     AND (
       (p_email IS NOT NULL AND c.email IS NOT NULL AND lower(c.email) = lower(trim(p_email)))
       OR (public.normalize_phone(p_phone) IS NOT NULL
           AND c.phone_digits = public.normalize_phone(p_phone))
     )
   ORDER BY (SELECT count(*) FROM public.appointments a WHERE a.client_id = c.id) DESC
   LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.find_unclaimed_client(text, text) TO anon, authenticated;

/*
 * Adopta ese perfil. Solo funciona si el perfil sigue sin dueño, así que dos
 * personas no pueden reclamar el mismo historial.
 */
CREATE OR REPLACE FUNCTION public.claim_client_profile(p_client_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ok boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  -- Nadie con cuenta ya vinculada puede quedarse con otro perfil
  IF EXISTS (SELECT 1 FROM public.clients WHERE user_id = auth.uid()) THEN
    RETURN false;
  END IF;

  UPDATE public.clients
     SET user_id = auth.uid(), linked_at = now()
   WHERE id = p_client_id AND user_id IS NULL;

  GET DIAGNOSTICS ok = ROW_COUNT;
  RETURN ok > 0;
END $$;

GRANT EXECUTE ON FUNCTION public.claim_client_profile(uuid) TO authenticated;

-- ── 3. El estado "nuevo" deja de ser para siempre ───────────
CREATE OR REPLACE FUNCTION public.client_is_new(
  p_created_at timestamptz,
  p_visits bigint,
  p_days int DEFAULT 60,
  p_visits_limit int DEFAULT 3
) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p_created_at > now() - (p_days || ' days')::interval
     AND p_visits < p_visits_limit;
$$;

-- ── 4. Ajustes de cumpleaños y del estado "nuevo" ───────────
ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS birthday_enabled     boolean NOT NULL DEFAULT false,
  -- 'percent' | 'fixed'
  ADD COLUMN IF NOT EXISTS birthday_kind        text NOT NULL DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS birthday_amount      numeric(10,2) NOT NULL DEFAULT 15,
  -- Días antes y después del cumpleaños en los que sigue valiendo
  ADD COLUMN IF NOT EXISTS birthday_window_days int NOT NULL DEFAULT 7,
  -- Vacío = todos los servicios
  ADD COLUMN IF NOT EXISTS birthday_service_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS new_client_days      int NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS new_client_visits    int NOT NULL DEFAULT 3;

-- ── 5. Buzón de feedback ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feedback (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  -- 'app' | 'service'
  area        text NOT NULL CHECK (area IN ('app', 'service')),
  message     text NOT NULL CHECK (length(trim(message)) > 0),
  -- 1..5, opcional
  rating      int CHECK (rating BETWEEN 1 AND 5),
  -- 'new' | 'read' | 'archived'
  status      text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'archived')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_status_idx ON public.feedback (status, created_at DESC);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feedback_client_insert" ON public.feedback;
CREATE POLICY "feedback_client_insert" ON public.feedback
  FOR INSERT WITH CHECK (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "feedback_client_read" ON public.feedback;
CREATE POLICY "feedback_client_read" ON public.feedback
  FOR SELECT USING (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "feedback_admin_all" ON public.feedback;
CREATE POLICY "feedback_admin_all" ON public.feedback
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 6. La foto del cliente la maneja solo el barbero ────────
-- El cliente puede editar su fila, pero no su avatar. Un trigger lo garantiza
-- aunque alguien llame a la API directamente.
CREATE OR REPLACE FUNCTION public.clients_protect_avatar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.avatar_url IS DISTINCT FROM OLD.avatar_url AND NOT public.is_admin() THEN
    -- Se ignora el cambio en vez de fallar, para no romper un guardado que
    -- además trae campos legítimos.
    NEW.avatar_url := OLD.avatar_url;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_clients_protect_avatar ON public.clients;
CREATE TRIGGER trg_clients_protect_avatar
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.clients_protect_avatar();

SELECT 'migración 29 lista' AS resultado;
