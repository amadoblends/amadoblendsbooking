-- ============================================================
-- migration_37_phone_otp.sql
-- Registro por teléfono con código, y perfil obligatorio.
--
-- El código temporal 000000 NO vive aquí. Aquí vive el desafío: a qué
-- número se pidió, cuándo caduca, cuántos intentos lleva y si ya se usó.
-- Quién genera y entrega el código es otra cosa — hoy un proveedor de
-- desarrollo, mañana Twilio — y por eso está separado.
-- ============================================================

-- ── 1. Los desafíos ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.otp_challenges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Solo dígitos, sin +1 ni guiones: ver normalize_phone (migración 29)
  phone        text NOT NULL,
  /*
   * El código no se guarda en claro. Aunque sea 000000 hoy, mañana será uno
   * real, y una tabla con códigos legibles es una tabla que da acceso a
   * cualquier cuenta a quien la lea.
   */
  code_hash    text NOT NULL,
  expires_at   timestamptz NOT NULL,
  attempts     int NOT NULL DEFAULT 0,
  -- Cuándo se canjeó. Un desafío usado no se puede volver a usar.
  consumed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- La consulta de verificar: el último desafío vivo de un número
CREATE INDEX IF NOT EXISTS otp_challenges_phone_idx
  ON public.otp_challenges (phone, created_at DESC);

/*
 * Nadie desde la app. Ni leer ni escribir: los desafíos solo los toca el
 * servidor con la clave de servicio. Sin políticas y con RLS activo, la
 * tabla es invisible para anon y authenticated.
 */
ALTER TABLE public.otp_challenges ENABLE ROW LEVEL SECURITY;

-- ── 2. Cuántos códigos se han pedido últimamente ────────────
/*
 * Contar antes de mandar. Sin esto, pedir código es un botón que manda
 * SMS gratis a cuenta del negocio — y con Twilio eso es dinero real.
 */
CREATE OR REPLACE FUNCTION public.otp_recent_count(p_phone text, p_minutes int DEFAULT 60)
RETURNS int
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT count(*)::int FROM public.otp_challenges
   WHERE phone = p_phone
     AND created_at > now() - (p_minutes || ' minutes')::interval;
$$;

REVOKE ALL ON FUNCTION public.otp_recent_count(text, int) FROM public, anon, authenticated;

-- ── 3. El perfil completo ───────────────────────────────────
/*
 * Verificar el teléfono deja entrar, no deja reservar. Hasta que estén
 * nombre, apellido, correo y fecha de nacimiento, la cuenta está a medias.
 *
 * Se DEDUCE de los campos en vez de guardarse en un booleano: un booleano
 * se queda desactualizado en cuanto alguien vacía un campo desde el editor
 * SQL, y entonces la app cree que está completo y no lo está.
 */
CREATE OR REPLACE FUNCTION public.client_profile_complete(p_client public.clients)
RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(NULLIF(trim(p_client.first_name), ''), NULL) IS NOT NULL
     AND COALESCE(NULLIF(trim(p_client.last_name),  ''), NULL) IS NOT NULL
     AND COALESCE(NULLIF(trim(p_client.email),      ''), NULL) IS NOT NULL
     AND p_client.birth_date IS NOT NULL
     AND COALESCE(NULLIF(trim(p_client.phone),      ''), NULL) IS NOT NULL;
$$;

/** Lo que la app pregunta al entrar: ¿puedo usar esto ya? */
CREATE OR REPLACE FUNCTION public.my_profile_state()
RETURNS TABLE (
  has_profile     boolean,
  complete        boolean,
  phone           text,
  missing         text[]
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE c public.clients;
BEGIN
  SELECT * INTO c FROM public.clients WHERE user_id = auth.uid() LIMIT 1;

  IF c.id IS NULL THEN
    RETURN QUERY SELECT false, false, NULL::text, ARRAY['profile']::text[];
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    true,
    public.client_profile_complete(c),
    c.phone,
    /*
     * Qué falta exactamente, para poder pedir solo eso. A un cliente que ya
     * existía no se le vuelve a pedir todo: se le pide lo que le falta.
     */
    ARRAY_REMOVE(ARRAY[
      CASE WHEN NULLIF(trim(c.first_name), '') IS NULL THEN 'first_name' END,
      CASE WHEN NULLIF(trim(c.last_name),  '') IS NULL THEN 'last_name'  END,
      CASE WHEN NULLIF(trim(c.email),      '') IS NULL THEN 'email'      END,
      CASE WHEN c.birth_date IS NULL              THEN 'birth_date' END,
      CASE WHEN NULLIF(trim(c.phone),      '') IS NULL THEN 'phone'      END
    ], NULL);
END $$;

GRANT EXECUTE ON FUNCTION public.my_profile_state() TO authenticated;

-- ── 4. Una cuenta a medias no puede reservar ────────────────
/*
 * Se impone aquí y no solo en la pantalla, por lo mismo de siempre: la app
 * del cliente escribe en `appointments` directamente, así que esconder el
 * botón no es una regla.
 */
CREATE OR REPLACE FUNCTION public.appointments_require_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.clients;
BEGIN
  -- El barbero apunta a quien quiera; esto es sobre la reserva en línea
  IF public.is_admin() THEN RETURN NEW; END IF;

  SELECT * INTO c FROM public.clients WHERE id = NEW.client_id;
  IF c.id IS NULL THEN RETURN NEW; END IF;

  IF NOT public.client_profile_complete(c) THEN
    RAISE EXCEPTION 'profile_incomplete'
      USING HINT = 'Completa tu perfil antes de reservar.';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_appointments_require_profile ON public.appointments;
CREATE TRIGGER trg_appointments_require_profile
  BEFORE INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.appointments_require_profile();

-- ── 5. El teléfono identifica de forma única ────────────────
/*
 * Dos cuentas con el mismo número serían dos historiales para una persona,
 * y el código del segundo entraría en la primera. phone_digits lo calcula
 * un trigger desde la migración 29.
 */
CREATE UNIQUE INDEX IF NOT EXISTS clients_phone_digits_key
  ON public.clients (phone_digits)
  WHERE phone_digits IS NOT NULL;

SELECT
  (SELECT count(*) FROM public.clients WHERE phone_digits IS NOT NULL) AS clientes_con_telefono,
  'migración 37 lista' AS resultado;
