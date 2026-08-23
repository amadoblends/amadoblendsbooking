-- ============================================================
-- confirmar_correos.sql
--
-- Marca como verificados los correos de las cuentas que ya existen.
--
-- "Verificado" no es más que una fecha en auth.users: `email_confirmed_at`.
-- Tocar el enlace del correo escribe esa fecha, y nada más. Escribirla desde
-- aquí es lo mismo, sin el correo de por medio.
--
-- Es para las cuentas de prueba que ya están creadas. Las nuevas salen ya
-- confirmadas: la pantalla de completar perfil las marca al guardarlas
-- (ver src/lib/actions/complete-profile.ts).
-- ============================================================

-- ── 1. Mira antes de tocar ──────────────────────────────────
SELECT
  u.email,
  CASE
    WHEN u.email_confirmed_at IS NOT NULL THEN '✅ ya verificado'
    ELSE '⏳ sin verificar'
  END AS correo,
  CASE
    WHEN u.phone IS NULL OR u.phone = '' THEN '— sin teléfono'
    ELSE u.phone
  END AS telefono,
  u.created_at::date AS creada
FROM auth.users u
ORDER BY u.email_confirmed_at NULLS FIRST, u.created_at;

-- ── 2. Confírmalos ──────────────────────────────────────────
/*
 * Solo toca `email_confirmed_at`. `confirmed_at` es una columna generada en
 * las versiones recientes de Supabase — se calcula sola a partir de esta y
 * de phone_confirmed_at, y escribirla directamente da error.
 */
UPDATE auth.users
   SET email_confirmed_at = now()
 WHERE email_confirmed_at IS NULL;

-- ── 3. Comprueba cómo quedó ─────────────────────────────────
SELECT
  count(*) FILTER (WHERE email_confirmed_at IS NOT NULL) AS verificados,
  count(*) FILTER (WHERE email_confirmed_at IS NULL)     AS sin_verificar,
  count(*)                                               AS total
FROM auth.users;

-- ============================================================
-- ¿Podrán entrar por teléfono?
--
-- El acceso por teléfono busca la cuenta por `clients.phone_digits`. Si una
-- cuenta no tiene teléfono en su ficha, escribir su número en /entrar no la
-- encuentra: crea una cuenta NUEVA y vacía al lado.
--
-- Esto te dice, cuenta por cuenta, si eso va a pasar.
-- ============================================================

SELECT
  u.email,
  COALESCE(c.full_name, '(sin ficha de cliente)') AS cliente,
  COALESCE(c.phone, '—')                          AS telefono_en_ficha,
  CASE
    WHEN c.id IS NULL              THEN '❌ no tiene ficha — entrar por teléfono creará otra cuenta'
    WHEN c.phone_digits IS NULL    THEN '❌ sin teléfono — entrar por teléfono creará otra cuenta'
    ELSE '✅ entrará en esta misma cuenta'
  END AS al_entrar_por_telefono
FROM auth.users u
LEFT JOIN public.clients c ON c.user_id = u.id
ORDER BY u.email;

-- ── Ponerle teléfono a una cuenta de prueba ─────────────────
/*
 * Descomenta y cambia el correo y el número. `phone_digits` lo calcula solo
 * un trigger (migración 29), así que basta con escribir `phone`.
 *
 * Después, ese número en /entrar con el código 000000 entra en ESTA cuenta
 * en vez de crear otra.
 */
-- UPDATE public.clients c
--    SET phone = '787-555-0001'
--   FROM auth.users u
--  WHERE u.id = c.user_id
--    AND lower(u.email) = 'maria@gmail.com';
