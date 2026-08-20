-- ============================================================
-- migration_33_carousel_crop.sql
-- Encuadre elegido para la imagen del carrusel.
--
-- No se recorta el archivo: se guarda QUÉ parte se ve. Así la imagen
-- original queda intacta y el encuadre se puede cambiar cuantas veces
-- haga falta sin volver a subirla ni perder calidad.
--
-- focal_x/focal_y son el punto de la imagen que queda centrado, en
-- porcentaje — exactamente lo que espera background-position.
-- zoom es el tamaño respecto a "cover": 1 = justo lo que cabe.
-- ============================================================

ALTER TABLE public.carousel_posts
  ADD COLUMN IF NOT EXISTS focal_x numeric(5,2) NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS focal_y numeric(5,2) NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS zoom    numeric(4,2) NOT NULL DEFAULT 1;

-- Un encuadre fuera de rango dejaría la imagen en blanco
DO $$ BEGIN
  ALTER TABLE public.carousel_posts ADD CONSTRAINT carousel_focal_range CHECK (
    focal_x BETWEEN 0 AND 100
    AND focal_y BETWEEN 0 AND 100
    AND zoom BETWEEN 1 AND 4
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

SELECT 'migración 33 lista' AS resultado;
