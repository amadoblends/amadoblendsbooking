-- ============================================================
-- migration_36_feedback_visit.sql
-- Atar un comentario a la visita que lo provocó.
--
-- Las estrellas sin contexto no dicen nada: "4 estrellas" de hace tres
-- semanas no se puede cruzar con qué servicio fue ni con qué día. Y sin
-- saber qué visita ya se valoró, no hay forma de pedirlo en el momento
-- adecuado sin repetir la pregunta.
-- ============================================================

ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS appointment_id uuid
    REFERENCES public.appointments(id) ON DELETE SET NULL;

/*
 * ON DELETE SET NULL, no CASCADE: si la cita se borra, el comentario sigue
 * siendo algo que el cliente dijo. Perder la referencia es aceptable;
 * perder lo que escribió, no.
 */

-- Para responder "¿ya valoró esta visita?" sin recorrer la tabla
CREATE INDEX IF NOT EXISTS feedback_appointment_idx
  ON public.feedback (appointment_id)
  WHERE appointment_id IS NOT NULL;

/*
 * La última visita terminada que el cliente aún no ha valorado.
 *
 * Devuelve como mucho una fila: se pregunta por la más reciente y solo esa,
 * porque encadenar cuatro peticiones de valoración seguidas hace que no se
 * conteste ninguna.
 */
CREATE OR REPLACE FUNCTION public.visit_awaiting_rating()
RETURNS TABLE (
  appointment_id uuid,
  starts_at      timestamptz,
  service_name   text
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT a.id, a.starts_at, s.name
    FROM public.appointments a
    JOIN public.clients c ON c.id = a.client_id
    LEFT JOIN public.services s ON s.id = a.service_id
   WHERE c.user_id = auth.uid()
     AND a.status::text = 'completada'
     -- Se pregunta mientras está fresco; después ya no tiene sentido
     AND a.starts_at > now() - interval '14 days'
     AND a.starts_at < now()
     AND NOT EXISTS (
       SELECT 1 FROM public.feedback f
        WHERE f.appointment_id = a.id AND f.area = 'service'
     )
   ORDER BY a.starts_at DESC
   LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.visit_awaiting_rating() TO authenticated;

SELECT 'migración 36 lista' AS resultado;
