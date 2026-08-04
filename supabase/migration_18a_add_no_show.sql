-- ============================================================
-- migration_18a_add_no_show.sql
-- PASO 1 de 2 — corre SOLO este archivo y espera a que termine.
--
-- status es un ENUM (appointment_status). Postgres no permite usar
-- un valor de enum recién agregado dentro de la misma transacción,
-- por eso este paso va solo y el resto queda en migration_18b.
-- ============================================================

DO $$
DECLARE
  v_type text;
BEGIN
  -- Detecta el nombre real del enum de la columna status
  SELECT t.typname INTO v_type
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_type t ON t.oid = a.atttypid
  WHERE n.nspname = 'public'
    AND c.relname = 'appointments'
    AND a.attname = 'status'
    AND t.typtype = 'e';

  IF v_type IS NULL THEN
    RAISE NOTICE 'status no es un enum: no hay nada que agregar.';
  ELSE
    EXECUTE format('ALTER TYPE public.%I ADD VALUE IF NOT EXISTS %L', v_type, 'no_show');
    RAISE NOTICE 'Valor no_show agregado al enum %', v_type;
  END IF;
END $$;

-- Verifica que quedó registrado
SELECT unnest(enum_range(NULL::appointment_status))::text AS estados_disponibles;
