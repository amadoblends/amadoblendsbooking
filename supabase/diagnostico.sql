-- ============================================================
-- diagnostico.sql
--
-- NO CAMBIA NADA. Solo mira y reporta.
--
-- Córrelo entero y mándame el resultado. Contesta, con hechos y no con
-- suposiciones, si cada migración quedó realmente aplicada — porque "la
-- corrí" y "quedó aplicada" no son lo mismo: el editor de Supabase envuelve
-- todo en una transacción, así que un error al final deshace lo anterior sin
-- dejar rastro visible.
-- ============================================================

-- ── 1. ¿Existen las piezas que cada migración debía crear? ──
SELECT
  pieza,
  CASE WHEN presente THEN '✅ sí' ELSE '❌ NO' END AS estado,
  migracion
FROM (
  VALUES
    ('tabla user_roles',            to_regclass('public.user_roles')      IS NOT NULL, '34'),
    ('tabla admin_allowlist',       to_regclass('public.admin_allowlist') IS NOT NULL, '34'),
    ('tabla reminder_rules',        to_regclass('public.reminder_rules')  IS NOT NULL, '35'),
    ('tabla scheduled_reminders',   to_regclass('public.scheduled_reminders') IS NOT NULL, '35'),
    ('tabla feedback',              to_regclass('public.feedback')        IS NOT NULL, '29'),
    ('columna clients.status',
      EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='clients' AND column_name='status'), '31'),
    ('columna clients.birth_date',
      EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='clients' AND column_name='birth_date'), '29'),
    ('columna feedback.appointment_id',
      EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='feedback' AND column_name='appointment_id'), '36'),
    ('columna carousel_posts.focal_x',
      EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='carousel_posts' AND column_name='focal_x'), '33')
) AS t(pieza, presente, migracion)
ORDER BY migracion, pieza;

-- ── 2. ¿Están puestos los triggers que imponen las reglas? ──
/*
 * Estos son los que hacen que el bloqueo y la foto funcionen. Si falta
 * alguno, la regla no existe por mucho que la pantalla la muestre.
 */
SELECT
  regla,
  CASE WHEN presente THEN '✅ activo' ELSE '❌ FALTA' END AS estado
FROM (
  VALUES
    ('cliente bloqueado no puede reservar',
      EXISTS (SELECT 1 FROM pg_trigger
               WHERE tgname='trg_appointments_block_check' AND NOT tgisinternal)),
    ('solo el barbero cambia la foto',
      EXISTS (SELECT 1 FROM pg_trigger
               WHERE tgname='trg_clients_protect_avatar' AND NOT tgisinternal)),
    ('el alta de usuarios NO reparte admin',
      EXISTS (SELECT 1 FROM pg_trigger
               WHERE tgname='on_auth_user_created' AND NOT tgisinternal)),
    ('los recordatorios se recalculan solos',
      EXISTS (SELECT 1 FROM pg_trigger
               WHERE tgname='trg_appointments_sync_reminders' AND NOT tgisinternal))
) AS t(regla, presente)
ORDER BY regla;

-- ── 3. ¿is_admin() ya responde por rol? ─────────────────────
/*
 * Si todavía dice "profiles", la migración 34 no llegó a aplicarse, y cada
 * cliente registrado sigue siendo administrador.
 */
SELECT
  CASE
    WHEN prosrc ILIKE '%user_roles%' THEN '✅ lee user_roles (migración 34 aplicada)'
    WHEN prosrc ILIKE '%profiles%'   THEN '❌ TODAVÍA lee profiles — la 34 NO se aplicó'
    ELSE '⚠️ no reconozco esta versión'
  END AS is_admin_dice
FROM pg_proc
WHERE proname = 'is_admin'
LIMIT 1;

-- ── 4. Las cuentas y sus roles ──────────────────────────────
SELECT
  u.email,
  COALESCE(string_agg(r.role::text, ', ' ORDER BY r.role), '(ninguno)') AS roles,
  CASE WHEN p.id IS NOT NULL THEN 'sí' ELSE 'no' END AS tiene_perfil_barbero
FROM auth.users u
LEFT JOIN public.user_roles r ON r.user_id = u.id
LEFT JOIN public.profiles   p ON p.id = u.id
GROUP BY u.email, p.id
ORDER BY u.email;

-- ── 5. El estado real de cada cliente ───────────────────────
/*
 * Si bloqueaste a alguien y aquí sale 'active', el guardado no llegó a la
 * base — el problema está en el panel, no en la regla.
 */
SELECT
  c.full_name,
  c.status,
  c.block_reason,
  c.status_changed_at,
  CASE WHEN c.avatar_url IS NULL THEN 'sin foto' ELSE 'con foto' END AS foto
FROM public.clients c
ORDER BY c.status, c.full_name;

-- ── 6. ¿Se puede registrar sin verificar el correo? ─────────
/*
 * Esto NO se puede leer desde SQL: vive en la configuración de Auth, no en
 * la base. Compruébalo a ojo en
 *   Authentication → Providers → Email → "Confirm email"
 * Tiene que estar APAGADO, y además NEXT_PUBLIC_AUTH_SKIP_OTP=true en Vercel.
 * Con una sola de las dos, no funciona.
 */
SELECT 'Revisa a mano: Confirm email apagado + NEXT_PUBLIC_AUTH_SKIP_OTP=true' AS recordatorio;
