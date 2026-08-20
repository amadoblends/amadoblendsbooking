-- ============================================================
-- reset_1_inventario.sql
--
-- NO BORRA NADA. Solo te enseña qué hay y qué se borraría.
--
-- Córrelo primero y lee el resultado. El orden es:
--   reset_1_inventario.sql   ← estás aquí: mirar
--   reset_2_respaldo.sql     ← exportar antes de tocar nada
--   reset_3_limpiar.sql      ← borrar, ya sabiendo qué
-- ============================================================

-- ── Qué se CONSERVA (configuración del negocio) ─────────────
SELECT 'SE CONSERVA' AS accion, tabla, filas FROM (
  SELECT 'business_settings' AS tabla, count(*) AS filas FROM public.business_settings
  UNION ALL SELECT 'booking_settings',  count(*) FROM public.booking_settings
  UNION ALL SELECT 'availability',      count(*) FROM public.availability
  UNION ALL SELECT 'services',          count(*) FROM public.services
  UNION ALL SELECT 'products',          count(*) FROM public.products
  UNION ALL SELECT 'reminder_rules',    count(*) FROM public.reminder_rules
  UNION ALL SELECT 'profiles (barbero)', count(*) FROM public.profiles
  UNION ALL SELECT 'user_roles',        count(*) FROM public.user_roles
  UNION ALL SELECT 'admin_allowlist',   count(*) FROM public.admin_allowlist
) t ORDER BY tabla;

-- ── Qué se BORRA (datos de prueba) ──────────────────────────
SELECT 'SE BORRA' AS accion, tabla, filas FROM (
  SELECT 'appointments' AS tabla, count(*) AS filas FROM public.appointments
  UNION ALL SELECT 'clients',              count(*) FROM public.clients
  UNION ALL SELECT 'client_notes',         count(*) FROM public.client_notes
  UNION ALL SELECT 'blocked_times',        count(*) FROM public.blocked_times
  UNION ALL SELECT 'closures',             count(*) FROM public.closures
  UNION ALL SELECT 'carousel_posts',       count(*) FROM public.carousel_posts
  UNION ALL SELECT 'promotions',           count(*) FROM public.promotions
  UNION ALL SELECT 'notifications',        count(*) FROM public.notifications
  UNION ALL SELECT 'notification_events',  count(*) FROM public.notification_events
  UNION ALL SELECT 'feedback',             count(*) FROM public.feedback
  UNION ALL SELECT 'push_subscriptions',   count(*) FROM public.push_subscriptions
) t ORDER BY tabla;

-- ── Las cuentas ─────────────────────────────────────────────
-- Comprueba con tus ojos que la línea de amadoblends@gmail.com dice CONSERVAR
SELECT
  u.email,
  CASE
    WHEN EXISTS (SELECT 1 FROM public.admin_allowlist a WHERE lower(a.email) = lower(u.email))
      THEN '✅ CONSERVAR — barbero autorizado'
    ELSE '🗑️  BORRAR — cuenta de prueba'
  END AS accion,
  u.created_at::date AS creada,
  u.last_sign_in_at::date AS ultimo_acceso
FROM auth.users u
ORDER BY
  EXISTS (SELECT 1 FROM public.admin_allowlist a WHERE lower(a.email) = lower(u.email)) DESC,
  u.created_at;

-- ── Aviso si algo no cuadra ─────────────────────────────────
/*
 * Si esto devuelve una fila, PARA: no hay ninguna cuenta autorizada, y la
 * limpieza te dejaría sin forma de entrar al panel. Corre antes la
 * migración 34, y comprueba que amadoblends@gmail.com existe en auth.users.
 */
SELECT '⛔ PARA — no hay ninguna cuenta de barbero que conservar' AS aviso
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users u
  JOIN public.admin_allowlist a ON lower(a.email) = lower(u.email)
);

-- ── Qué se lleva por delante cada borrado (claves foráneas) ─
/*
 * Todo esto va en CASCADE desde las tablas de arriba. Se lista para que no
 * haya sorpresas: no queda ningún huérfano, y no hace falta borrarlo a mano.
 */
SELECT
  tc.table_name       AS tabla_hija,
  kcu.column_name     AS columna,
  ccu.table_name      AS depende_de,
  rc.delete_rule      AS al_borrar
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
