-- ============================================================
-- migration_31_client_status.sql
-- Estados de cliente y lista negra.
--
-- Cinco situaciones distintas que antes no se podían distinguir:
--   active      — cliente normal
--   inactive    — lleva tiempo sin venir (se DEDUCE, no se guarda)
--   deactivated — cuenta dada de baja administrativamente
--   blocked     — no puede reservar
--   deleted     — cuenta eliminada de verdad
--
-- 'inactive' no se guarda: depende de la fecha de la última cita, así que
-- una columna quedaría desactualizada sola. Se calcula al leer.
-- ============================================================

-- ── 1. El estado ────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.client_status AS ENUM ('active', 'deactivated', 'blocked', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS status public.client_status NOT NULL DEFAULT 'active',
  -- Motivo interno del bloqueo. NUNCA se le muestra al cliente.
  ADD COLUMN IF NOT EXISTS block_reason      text,
  ADD COLUMN IF NOT EXISTS block_note        text,
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS clients_status_idx ON public.clients (status);

-- ── 2. Cambiar el estado ────────────────────────────────────
/*
 * Un solo punto de entrada, para que el motivo y la fecha se guarden siempre
 * y no dependan de que cada pantalla se acuerde.
 */
CREATE OR REPLACE FUNCTION public.set_client_status(
  p_client_id uuid,
  p_status    public.client_status,
  p_reason    text DEFAULT NULL,
  p_note      text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RETURN false; END IF;

  UPDATE public.clients
     SET status            = p_status,
         -- El motivo solo tiene sentido mientras esté bloqueado
         block_reason      = CASE WHEN p_status = 'blocked' THEN p_reason ELSE NULL END,
         block_note        = CASE WHEN p_status = 'blocked' THEN p_note   ELSE NULL END,
         status_changed_at = now(),
         status_changed_by = auth.uid()
   WHERE id = p_client_id;

  RETURN FOUND;
END $$;

GRANT EXECUTE ON FUNCTION public.set_client_status(uuid, public.client_status, text, text)
  TO authenticated;

-- ── 3. Un cliente bloqueado no puede reservar ───────────────
/*
 * Se impide en la base y no solo en la pantalla: la app del cliente escribe
 * en `appointments` directamente, así que esconder el botón no bastaría.
 * Quien llame a la API igual se topa con esto.
 *
 * El mensaje es neutro a propósito. El motivo interno es tuyo, no suyo.
 */
CREATE OR REPLACE FUNCTION public.appointments_block_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status public.client_status;
BEGIN
  SELECT c.status INTO v_status FROM public.clients c WHERE c.id = NEW.client_id;

  -- El barbero sí puede apuntar a quien quiera; el bloqueo es de la reserva
  -- online, no de la persona.
  IF v_status IN ('blocked', 'deactivated', 'deleted') AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'client_booking_unavailable'
      USING HINT = 'Online booking is unavailable for this account.';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_appointments_block_check ON public.appointments;
CREATE TRIGGER trg_appointments_block_check
  -- También en UPDATE: reagendar es otra forma de tomar disponibilidad
  BEFORE INSERT OR UPDATE OF starts_at, ends_at, client_id ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.appointments_block_check();

-- ── 4. Qué se perdería al eliminar ──────────────────────────
/*
 * Se enseña ANTES de borrar, para que una eliminación accidental no se lleve
 * historial que hace falta para los reportes.
 */
CREATE OR REPLACE FUNCTION public.client_delete_impact(p_client_id uuid)
RETURNS TABLE (
  appointments  bigint,
  completed     bigint,
  total_spent   numeric,
  notes         bigint,
  feedback      bigint,
  first_visit   timestamptz,
  last_visit    timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT
    (SELECT count(*) FROM public.appointments WHERE client_id = p_client_id),
    (SELECT count(*) FROM public.appointments
      WHERE client_id = p_client_id AND status = 'completada'),
    (SELECT COALESCE(sum(price), 0) FROM public.appointments
      WHERE client_id = p_client_id AND status = 'completada'),
    (SELECT count(*) FROM public.client_notes WHERE client_id = p_client_id),
    (SELECT count(*) FROM public.feedback WHERE client_id = p_client_id),
    (SELECT min(starts_at) FROM public.appointments WHERE client_id = p_client_id),
    (SELECT max(starts_at) FROM public.appointments WHERE client_id = p_client_id)
  WHERE public.is_admin();
$$;

GRANT EXECUTE ON FUNCTION public.client_delete_impact(uuid) TO authenticated;

-- ── 5. El cliente puede saber que no puede reservar ─────────
/*
 * Devuelve solo si puede o no. El motivo interno nunca sale de aquí.
 */
CREATE OR REPLACE FUNCTION public.my_booking_allowed()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT COALESCE(
    (SELECT c.status = 'active' FROM public.clients c WHERE c.user_id = auth.uid()),
    true
  );
$$;

GRANT EXECUTE ON FUNCTION public.my_booking_allowed() TO authenticated;

SELECT 'migración 31 lista' AS resultado;
