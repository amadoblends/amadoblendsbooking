-- ============================================================
-- migration_25_notify_email.sql
-- A qué correo llegan los avisos del negocio.
-- ============================================================
--
-- Hasta ahora el correo del barbero solo podía venir de una variable de
-- entorno, que obliga a redesplegar para cambiarla. Esto lo vuelve un ajuste
-- normal del panel: puede ser tu Gmail personal o el correo de la compañía.

ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS notify_email text;

COMMENT ON COLUMN public.business_settings.notify_email IS
  'Correo que recibe los avisos de citas. Si está vacío se usa BARBER_NOTIFY_EMAIL y, en último caso, el correo de la cuenta del administrador.';

SELECT 'migración 25 lista' AS resultado;
