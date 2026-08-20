-- ============================================================
-- reset_1_inventario.sql
--
-- NO BORRA NADA. Solo te enseña qué hay y qué se borraría.
--
-- Córrelo primero y lee el resultado. El orden es:
--   reset_1_inventario.sql   ← estás aquí: mirar
--   reset_2_respaldo.sql     ← exportar antes de tocar nada
--   reset_3_limpiar.sql      ← borrar, ya sabiendo qué
--
-- Funciona esté la base como esté: una tabla que aún no existe sale como
-- "(falta la migración)" en vez de reventar la consulta entera.
-- ============================================================

-- ── Cuántas filas tiene una tabla, exista o no ──────────────
/*
 * to_regclass devuelve NULL en vez de fallar cuando la tabla no está, así
 * que este inventario se puede correr en cualquier momento. La primera
 * versión nombraba las tablas directamente y moría con
 * «relation does not exist», que no dice qué hacer.
 */
CREATE OR REPLACE FUNCTION pg_temp.filas(p_tabla text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  IF to_regclass('public.' || p_tabla) IS NULL THEN
    RETURN '(falta la migración)';
  END IF;
  EXECUTE format('SELECT count(*) FROM public.%I', p_tabla) INTO n;
  RETURN n::text;
END $$;

-- ── Qué se CONSERVA (configuración del negocio) ─────────────
SELECT 'SE CONSERVA' AS accion, t AS tabla, pg_temp.filas(t) AS filas
FROM unnest(ARRAY[
  'business_settings', 'booking_settings', 'availability',
  'services', 'products', 'reminder_rules',
  'profiles', 'user_roles', 'admin_allowlist'
]) AS t
ORDER BY t;

-- ── Qué se BORRA (datos de prueba) ──────────────────────────
SELECT 'SE BORRA' AS accion, t AS tabla, pg_temp.filas(t) AS filas
FROM unnest(ARRAY[
  'appointments', 'appointment_products', 'appointment_guests',
  'appointment_service_products', 'clients', 'client_notes',
  'blocked_times', 'closures', 'carousel_posts', 'promotions',
  'notifications', 'notification_events', 'feedback',
  'push_subscriptions', 'scheduled_reminders'
]) AS t
ORDER BY t;

-- ── Las cuentas ─────────────────────────────────────────────
/*
 * Antes de la migración 34 no existe admin_allowlist, así que el correo
 * autorizado se compara contra la constante. Después manda la tabla.
 */
SELECT
  u.email,
  CASE
    WHEN to_regclass('public.admin_allowlist') IS NOT NULL
      THEN CASE WHEN EXISTS (
             SELECT 1 FROM public.admin_allowlist a
              WHERE lower(a.email) = lower(u.email))
           THEN '✅ CONSERVAR — barbero autorizado'
           ELSE '🗑️  BORRAR — cuenta de prueba' END
    WHEN lower(u.email) = 'amadoblends@gmail.com'
      THEN '✅ CONSERVAR — barbero (aún sin migración 34)'
    ELSE '🗑️  BORRAR — cuenta de prueba'
  END AS accion,
  u.created_at::date      AS creada,
  u.last_sign_in_at::date AS ultimo_acceso
FROM auth.users u
ORDER BY lower(u.email) = 'amadoblends@gmail.com' DESC, u.created_at;

-- ── Avisos ──────────────────────────────────────────────────
SELECT '⚠️  Falta la migración 34 — córrela antes de limpiar' AS aviso
WHERE to_regclass('public.user_roles') IS NULL
UNION ALL
SELECT '⛔ PARA — amadoblends@gmail.com no existe en auth.users'
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE lower(email) = 'amadoblends@gmail.com'
);

-- ── Qué se lleva por delante cada borrado (claves foráneas) ─
/*
 * Todo esto va en CASCADE desde las tablas de arriba. Se lista para que no
 * haya sorpresas: no queda ningún huérfano, y no hace falta borrarlo a mano.
 */
SELECT
  tc.table_name   AS tabla_hija,
  kcu.column_name AS columna,
  ccu.table_name  AS depende_de,
  rc.delete_rule  AS al_borrar
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_name = tc.constraint_name AND kcu.constraint_schema = tc.constraint_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name AND ccu.constraint_schema = tc.constraint_schema
JOIN information_schema.referential_constraints rc
  ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND ccu.table_name IN ('appointments', 'clients')
ORDER BY ccu.table_name, tc.table_name;
