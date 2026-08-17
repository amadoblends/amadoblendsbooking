-- ============================================================
-- migration_27_product_categories_time.sql
-- Categorías ampliables y productos que suman tiempo al servicio.
-- ============================================================
--
-- 1) La categoría era un CHECK con solo 'dry' y 'wet'. Cada categoría nueva
--    obligaba a una migración, así que pasa a ser una tabla: añadir "Tinte" es
--    insertar una fila.
--
-- 2) Un producto puede alargar la cita. Un enhancement suma 4 minutos, un
--    tinte 10. Eso tiene que afectar los horarios que se ofrecen, la hora
--    final y la prevención de solapes — no solo el texto de la confirmación.

-- ── 1. Catálogo de categorías ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_categories (
  id         text PRIMARY KEY,          -- 'hair', 'beard', ...
  label_es   text NOT NULL,
  label_en   text NOT NULL,
  emoji      text,
  sort_order int  NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true
);

INSERT INTO public.product_categories (id, label_es, label_en, emoji, sort_order) VALUES
  ('hair',        'Pelo',        'Hair',        '💇', 10),
  ('face',        'Facial',      'Face',        '🧖', 20),
  ('beard',       'Barba',       'Beard',       '🧔', 30),
  ('fragrance',   'Perfumería',  'Fragrance',   '🌸', 40),
  ('enhancement', 'Enhancement', 'Enhancement', '✨', 50),
  ('hair_color',  'Tinte',       'Hair Color',  '🎨', 60),
  ('styling',     'Styling',     'Styling',     '💈', 70),
  ('aftercare',   'Aftercare',   'Aftercare',   '🧴', 80),
  ('other',       'Otros',       'Other',       '📦', 90)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pcat_public_read" ON public.product_categories;
CREATE POLICY "pcat_public_read" ON public.product_categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "pcat_admin_all" ON public.product_categories;
CREATE POLICY "pcat_admin_all" ON public.product_categories
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ── 2. Liberar products.category del CHECK ──────────────────
-- El nombre del constraint depende de cómo lo creó Postgres, así que se busca.
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.products'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%category%'
  LOOP
    EXECUTE format('ALTER TABLE public.products DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

-- Lo que existía se traduce a las categorías nuevas
UPDATE public.products SET category = 'hair' WHERE category = 'dry';
UPDATE public.products SET category = 'aftercare' WHERE category = 'wet';
UPDATE public.products SET category = 'other' WHERE category IS NULL;

-- Referencia suave: borrar una categoría deja los productos sin ella en vez
-- de borrarlos.
DO $$
BEGIN
  ALTER TABLE public.products
    ADD CONSTRAINT products_category_fk
    FOREIGN KEY (category) REFERENCES public.product_categories(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR invalid_foreign_key THEN NULL;
END $$;

-- ── 3. Tiempo extra ─────────────────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS extra_minutes int NOT NULL DEFAULT 0
    CHECK (extra_minutes >= 0 AND extra_minutes <= 240);

COMMENT ON COLUMN public.products.extra_minutes IS
  'Minutos que este producto añade a la cita cuando el cliente lo elige. No cambia la duración base del servicio.';

-- ── 4. Guardar cuánto se alargó cada cita ───────────────────
-- Sin esto no se podría recalcular una cita vieja si el producto cambia de
-- minutos después.
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS extra_minutes int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS products_category_idx
  ON public.products (category, available_for_services);

SELECT 'migración 27 lista' AS resultado;
