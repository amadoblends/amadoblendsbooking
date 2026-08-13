-- Migración 22 · Las promociones vencidas dejan de verse solas
--
-- Problema: la política pública de promociones era USING (true) y la app del
-- cliente solo filtraba por is_active. Una promoción cuyo ends_on ya pasó
-- seguía aplicando descuentos, y una que aún no empieza ya se aplicaba.
--
-- La ventana de fechas se aplica ahora en la base de datos, así que cualquier
-- consulta futura la hereda sin tener que acordarse de repetir el filtro.

DROP POLICY IF EXISTS "promos_public_read" ON public.promotions;

-- El barbero sigue viendo todas (incluidas las finalizadas) para su panel
CREATE POLICY "promos_admin_read" ON public.promotions
  FOR SELECT USING (is_admin());

-- El cliente solo ve las que están vigentes hoy
CREATE POLICY "promos_public_read" ON public.promotions
  FOR SELECT USING (
    is_active
    AND (starts_on IS NULL OR starts_on <= CURRENT_DATE)
    AND (ends_on   IS NULL OR ends_on   >= CURRENT_DATE)
  );

-- Índice para la comprobación de ventana, que ahora corre en cada lectura
CREATE INDEX IF NOT EXISTS promotions_window_idx
  ON public.promotions (is_active, starts_on, ends_on);

SELECT 'migración 22 lista' AS resultado;
