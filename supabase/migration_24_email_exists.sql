-- ============================================================
-- migration_24_email_exists.sql
-- Saber si un correo ya tiene cuenta, antes de mandar el código.
-- ============================================================
--
-- Supabase oculta a propósito si un correo existe: signInWithOtp con
-- shouldCreateUser:true simplemente inicia sesión en la cuenta que ya estaba,
-- sin avisar. Por eso alguien que se "registraba" con un correo ya usado
-- entraba a la cuenta vieja sin entender qué pasó.
--
-- Esta función expone solo un booleano, nunca datos de la cuenta. Es una
-- decisión consciente del dueño del negocio: en una barbería el flujo claro
-- vale más que ocultar qué correos están registrados — y de todas formas el
-- formulario de inicio de sesión ya lo revela al fallar la contraseña.

CREATE OR REPLACE FUNCTION public.email_has_account(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
-- search_path fijo: sin esto, SECURITY DEFINER es un riesgo de escalada
SET search_path = public, auth
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE lower(email) = lower(trim(p_email))
      AND deleted_at IS NULL
  );
$$;

-- Cualquiera puede preguntar (el formulario de registro corre sin sesión)
GRANT EXECUTE ON FUNCTION public.email_has_account(text) TO anon, authenticated;

COMMENT ON FUNCTION public.email_has_account(text) IS
  'Devuelve true si el correo ya tiene cuenta. Solo un booleano, nunca datos.';

SELECT 'migración 24 lista' AS resultado;
