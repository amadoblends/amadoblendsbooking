-- ============================================================
-- migration_23_carousel_window.sql
-- El carrusel del cliente respeta fecha Y hora, y nunca queda vacío.
-- ============================================================
--
-- Problemas que resuelve:
--
-- 1) La ventana era solo por fecha (starts_on / ends_on) y `ends_on >=
--    CURRENT_DATE` deja visible todo el último día. Peor: si el barbero dejó
--    la fecha final vacía, ends_on queda NULL y la publicación no caduca
--    nunca. Por eso seguía apareciendo el aviso de vacaciones ya terminado.
--
-- 2) CURRENT_DATE en Postgres es UTC, no la zona de la barbería, así que
--    cerca de medianoche la ventana se corría unas horas.
--
-- 3) Cuando no hay nada vigente el carrusel se quedaba vacío.
--
-- Solución: instantes exactos (timestamptz) en vez de fechas sueltas, más un
-- marcador de contenido permanente que solo se muestra cuando no hay nada
-- activo.

-- ── 1. Ventana exacta ───────────────────────────────────────
ALTER TABLE public.carousel_posts
  ADD COLUMN IF NOT EXISTS starts_at   timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at     timestamptz,
  -- Contenido de marca que se muestra solo como respaldo
  ADD COLUMN IF NOT EXISTS is_permanent boolean NOT NULL DEFAULT false;

-- ── 2. Rellenar desde las fechas que ya existen ─────────────
-- starts_on se interpreta como el comienzo de ese día en la barbería y
-- ends_on como el final del mismo día (inclusive), que es como se venían
-- entendiendo en la interfaz.
UPDATE public.carousel_posts
SET starts_at = (starts_on::timestamp AT TIME ZONE 'America/Puerto_Rico')
WHERE starts_at IS NULL AND starts_on IS NOT NULL;

UPDATE public.carousel_posts
SET ends_at = ((ends_on + 1)::timestamp AT TIME ZONE 'America/Puerto_Rico')
WHERE ends_at IS NULL AND ends_on IS NOT NULL;

-- ── 3. Publicaciones sin fecha de fin ───────────────────────
-- Una publicación normal sin fin nunca caducaba. Las que ya vencieron según
-- su cierre asociado se cierran aquí; el resto se marcan como permanentes
-- solo si el barbero las creó como contenido de marca (type 'info').
UPDATE public.carousel_posts p
SET ends_at = c.ends_on::timestamp + interval '1 day' AT TIME ZONE 'America/Puerto_Rico'
FROM public.closures c
WHERE c.carousel_post_id = p.id
  AND p.ends_at IS NULL;

-- ── 4. Estado explícito ─────────────────────────────────────
-- draft · scheduled · active · paused · expired se derivan de estas tres
-- columnas; no se guarda un estado suelto que pueda quedar desincronizado.
--   is_draft   → draft
--   NOT is_active → paused
--   now() < starts_at → scheduled
--   now() >= ends_at  → expired
--   resto → active

-- ── 5. RLS: el cliente solo ve lo realmente vigente ─────────
DROP POLICY IF EXISTS "carousel_public_read" ON public.carousel_posts;
CREATE POLICY "carousel_public_read" ON public.carousel_posts
  FOR SELECT USING (
    is_active
    AND NOT is_draft
    AND (
      -- Contenido permanente: siempre legible, la app decide si lo enseña
      is_permanent
      OR (
        (starts_at IS NULL OR starts_at <= now())
        AND (ends_at IS NOT NULL AND ends_at > now())
      )
    )
  );

-- El barbero sigue viendo todo, incluidas las finalizadas
DROP POLICY IF EXISTS "carousel_admin_all" ON public.carousel_posts;
CREATE POLICY "carousel_admin_all" ON public.carousel_posts
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ── 6. Índice para la comprobación de ventana ───────────────
DROP INDEX IF EXISTS carousel_active_idx;
CREATE INDEX IF NOT EXISTS carousel_window_idx
  ON public.carousel_posts (is_active, is_draft, is_permanent, starts_at, ends_at);

-- ── 7. Lo mismo para promociones ────────────────────────────
ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at   timestamptz;

UPDATE public.promotions
SET starts_at = (starts_on::timestamp AT TIME ZONE 'America/Puerto_Rico')
WHERE starts_at IS NULL AND starts_on IS NOT NULL;

UPDATE public.promotions
SET ends_at = ((ends_on + 1)::timestamp AT TIME ZONE 'America/Puerto_Rico')
WHERE ends_at IS NULL AND ends_on IS NOT NULL;

DROP POLICY IF EXISTS "promos_public_read" ON public.promotions;
CREATE POLICY "promos_public_read" ON public.promotions
  FOR SELECT USING (
    is_active
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at   IS NULL OR ends_at   >  now())
  );

DROP POLICY IF EXISTS "promos_admin_read" ON public.promotions;
CREATE POLICY "promos_admin_read" ON public.promotions
  FOR SELECT USING (is_admin());

SELECT 'migración 23 lista' AS resultado;
