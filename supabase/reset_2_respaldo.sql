-- ============================================================
-- reset_2_respaldo.sql
--
-- Guarda una copia de todo lo que reset_3 va a borrar, DENTRO de la misma
-- base, en un esquema aparte llamado `backup_YYYYMMDD`.
--
-- Por qué dentro y no un fichero: no depende de que la descarga termine, ni
-- de dónde quedó guardada, ni de volver a subirla. Si mañana descubres que
-- hacía falta una fila, sigue estando a un SELECT de distancia.
--
-- No estorba: es un esquema aparte, no lo toca ninguna consulta de la app, y
-- se borra cuando quieras (ver el final del archivo).
-- ============================================================

DO $$
DECLARE
  v_schema text := 'backup_' || to_char(now(), 'YYYYMMDD_HH24MI');
  v_table  text;
  v_tables text[] := ARRAY[
    'appointments', 'appointment_products', 'appointment_guests',
    'appointment_service_products', 'clients', 'client_notes',
    'blocked_times', 'closures', 'carousel_posts', 'promotions',
    'notifications', 'notification_events', 'feedback',
    'push_subscriptions', 'scheduled_reminders'
  ];
  v_count bigint;
BEGIN
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', v_schema);

  FOREACH v_table IN ARRAY v_tables LOOP
    -- Una tabla que no existe todavía (migración sin correr) no es un error
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = v_table
    ) THEN
      /*
       * CREATE TABLE AS copia los datos, no las restricciones. Es justo lo
       * que se quiere: un respaldo no debe imponer claves foráneas contra
       * filas que ya no van a existir.
       */
      EXECUTE format('CREATE TABLE %I.%I AS TABLE public.%I', v_schema, v_table, v_table);
      EXECUTE format('SELECT count(*) FROM %I.%I', v_schema, v_table) INTO v_count;
      RAISE NOTICE 'respaldadas % filas de %', v_count, v_table;
    END IF;
  END LOOP;

  -- Las cuentas se copian aparte: auth.users no se puede tocar en bloque
  EXECUTE format(
    'CREATE TABLE %I.auth_users AS
       SELECT id, email, created_at, last_sign_in_at, raw_user_meta_data
         FROM auth.users', v_schema);

  RAISE NOTICE '────────────────────────────────';
  RAISE NOTICE 'Respaldo completo en el esquema: %', v_schema;
  RAISE NOTICE 'Para consultarlo:  SELECT * FROM %.appointments;', v_schema;
  RAISE NOTICE '────────────────────────────────';
END $$;

-- Comprueba qué se guardó
SELECT
  table_schema AS respaldo,
  table_name   AS tabla,
  (xpath('/row/c/text()',
    query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name),
                 false, true, '')))[1]::text::bigint AS filas
FROM information_schema.tables
WHERE table_schema LIKE 'backup_%'
ORDER BY table_schema DESC, table_name;

-- ── Cuando ya no lo necesites ───────────────────────────────
-- Sustituye la fecha por la que te dijo el aviso de arriba:
--
--   DROP SCHEMA backup_20260819_1430 CASCADE;
