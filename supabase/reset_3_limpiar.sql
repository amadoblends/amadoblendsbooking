-- ============================================================
-- reset_3_limpiar.sql
--
-- ⚠️  ESTE SÍ BORRA. No lo corras sin haber corrido antes:
--       reset_1_inventario.sql  (ver qué hay)
--       reset_2_respaldo.sql    (guardar una copia)
--
-- Borra los DATOS de prueba. No toca la estructura: ni tablas, ni columnas,
-- ni funciones, ni políticas RLS, ni triggers, ni el schema, ni Storage.
--
-- Conserva:
--   • La cuenta amadoblends@gmail.com, su perfil y su rol de barbero.
--   • Horarios, ajustes de reserva, identidad del negocio.
--   • Servicios, productos y reglas de recordatorio.
--
-- Se ejecuta entero o no se ejecuta: el editor de Supabase lo envuelve en
-- una transacción, así que un fallo a mitad no deja la base a medias.
-- ============================================================

-- ── Frenos de seguridad ─────────────────────────────────────
/*
 * Primero: la migración 34 tiene que estar corrida.
 *
 * Sin ella no existe admin_allowlist, y este script no tendría forma de
 * saber qué cuenta conservar. Se comprueba con to_regclass para que el aviso
 * diga qué hacer, en vez de un «relation does not exist» a media ejecución.
 */
DO $$ BEGIN
  IF to_regclass('public.admin_allowlist') IS NULL THEN
    RAISE EXCEPTION
      'Falta la migración 34: sin admin_allowlist no sé qué cuenta conservar. Córrela primero.';
  END IF;
END $$;

/*
 * Segundo: tiene que haber una cuenta de barbero que conservar. Sin ella la
 * limpieza te dejaría fuera de tu propio panel.
 */
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users u
    JOIN public.admin_allowlist a ON lower(a.email) = lower(u.email)
  ) THEN
    RAISE EXCEPTION 'No hay ninguna cuenta de barbero autorizada en admin_allowlist.';
  END IF;
END $$;

/*
 * Y si no hay respaldo, también para. Es la clase de paso que se salta con
 * prisa y se echa de menos después.
 */
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.schemata WHERE schema_name LIKE 'backup_%'
  ) THEN
    RAISE EXCEPTION 'No encuentro ningún respaldo. Corre reset_2_respaldo.sql antes.';
  END IF;
END $$;

-- ── 1. Los datos ────────────────────────────────────────────
/*
 * El orden va de hijo a padre. La mayoría caería igual por CASCADE, pero
 * escribirlo explícito hace que se lea qué desaparece y en qué orden, en vez
 * de confiar en que las claves foráneas estén todas bien puestas.
 *
 * Se salta lo que no existe. Varias de estas tablas llegan con migraciones
 * distintas, y nombrar una que falta abortaría la limpieza entera dejando
 * medio borrado el resto.
 */
DO $$
DECLARE
  t text;
  n bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'scheduled_reminders', 'notification_events', 'notifications',
    'client_notifications', 'client_preferences', 'feedback',
    'appointment_service_products', 'appointment_products', 'appointment_guests',
    'appointments', 'client_notes', 'clients',
    'blocked_times', 'closures', 'carousel_posts', 'promotions'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'omitida % (no existe todavía)', t;
      CONTINUE;
    END IF;
    EXECUTE format('DELETE FROM public.%I', t);
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE 'borradas % filas de %', n, t;
  END LOOP;
END $$;

-- Los dispositivos de los clientes de prueba; el del barbero se conserva
DO $$ BEGIN
  IF to_regclass('public.push_subscriptions') IS NOT NULL THEN
    DELETE FROM public.push_subscriptions
     WHERE user_id NOT IN (
       SELECT u.id FROM auth.users u
       JOIN public.admin_allowlist a ON lower(a.email) = lower(u.email)
     );
  END IF;
END $$;

-- ── 2. Las cuentas de prueba ────────────────────────────────
/*
 * Se borran al final, cuando ya no queda nada apuntando a ellas. Sin esto
 * quedarían usuarios de Auth sin perfil — y al revés, si se borraran primero,
 * fichas de cliente sin cuenta.
 *
 * user_roles va en CASCADE desde auth.users, así que se limpia sola.
 */
DELETE FROM auth.users u
 WHERE NOT EXISTS (
   SELECT 1 FROM public.admin_allowlist a WHERE lower(a.email) = lower(u.email)
 );

-- ── 3. Los contadores vuelven a cero ────────────────────────
-- Las columnas llegan con la migración 30; sin ella no hay nada que poner a cero
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'profiles'
       AND column_name = 'citas_seen_at'
  ) THEN
    UPDATE public.profiles SET citas_seen_at = now(), feedback_seen_at = now();
  END IF;
END $$;

-- ── 4. Comprobación de integridad ───────────────────────────
/*
 * Todo esto debe salir en cero. Si algo no lo está, la limpieza dejó un
 * huérfano y hay que mirarlo antes de seguir.
 */
SELECT 'clientes sin cuenta existente'  AS comprobacion,
       count(*) AS debe_ser_cero
  FROM public.clients c
 WHERE c.user_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = c.user_id)
UNION ALL
SELECT 'citas sin cliente',
       count(*) FROM public.appointments a
 WHERE a.client_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = a.client_id)
UNION ALL
SELECT 'perfiles sin cuenta',
       count(*) FROM public.profiles p
 WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
UNION ALL
SELECT 'roles sin cuenta',
       count(*) FROM public.user_roles r
 WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = r.user_id);

-- ── 5. Cómo quedó ───────────────────────────────────────────
SELECT
  (SELECT count(*) FROM auth.users)                              AS cuentas,
  (SELECT count(*) FROM public.user_roles WHERE role = 'barber') AS barberos,
  (SELECT count(*) FROM public.clients)                          AS clientes,
  (SELECT count(*) FROM public.appointments)                     AS citas,
  (SELECT count(*) FROM public.services)                         AS servicios_conservados,
  (SELECT count(*) FROM public.availability)                     AS horarios_conservados,
  '✅ limpieza terminada'                                         AS resultado;

-- Debe listar solo amadoblends@gmail.com
SELECT email, 'sigue pudiendo entrar' AS estado FROM auth.users;
