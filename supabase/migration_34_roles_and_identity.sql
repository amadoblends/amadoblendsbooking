-- ============================================================
-- migration_34_roles_and_identity.sql
--
-- ⚠️  CORRIGE UN FALLO DE SEGURIDAD GRAVE.
--
-- El trigger `on_auth_user_created` corría en CADA alta de auth.users —
-- incluida la de cada cliente que se registraba en la app de clientes — e
-- insertaba un perfil con role = 'admin'. Como `is_admin()` solo miraba si
-- existía esa fila, y `profiles.role` tenía CHECK (role = 'admin') de modo
-- que no podía valer otra cosa:
--
--   TODO cliente registrado hasta hoy es administrador en la base de datos,
--   con acceso por RLS a todas las citas, todos los clientes, los ingresos
--   y la configuración del negocio.
--
-- Esta migración lo corta, limpia lo que quedó mal, y deja una identidad
-- única por persona con roles asociados en vez de perfiles duplicados.
-- ============================================================

-- ── 1. Los roles ────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('barber', 'client');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

/*
 * Una identidad (auth.users) puede tener varios roles. Así, si algún día
 * el barbero necesita reservarse a sí mismo como cliente, se le añade el
 * rol 'client' sin crear un segundo usuario ni duplicar su correo.
 */
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.app_role NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ── 2. Quién puede ser barbero ──────────────────────────────
/*
 * Una lista explícita. El rol de barbero no se puede obtener registrándose:
 * hay que estar aquí, y aquí solo se entra desde el editor SQL.
 */
CREATE TABLE IF NOT EXISTS public.admin_allowlist (
  email      text PRIMARY KEY,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_allowlist ENABLE ROW LEVEL SECURITY;

-- El único barbero autorizado hoy
INSERT INTO public.admin_allowlist (email, note)
VALUES ('amadoblends@gmail.com', 'Amado Blends — único barbero autorizado')
ON CONFLICT (email) DO NOTHING;

-- ── 3. El rol de barbero no se puede colar ──────────────────
/*
 * Aunque alguien consiguiera escribir en user_roles, no puede darse el rol
 * de barbero si su correo no está en la lista. La regla vive aquí y no en
 * la pantalla, que es lo único que no se puede saltar.
 */
CREATE OR REPLACE FUNCTION public.user_roles_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email text;
BEGIN
  IF NEW.role <> 'barber' THEN RETURN NEW; END IF;

  SELECT lower(u.email) INTO v_email FROM auth.users u WHERE u.id = NEW.user_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.admin_allowlist a WHERE lower(a.email) = v_email
  ) THEN
    RAISE EXCEPTION 'not_authorized_as_barber'
      USING HINT = 'Ese correo no está autorizado como barbero.';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_user_roles_guard ON public.user_roles;
CREATE TRIGGER trg_user_roles_guard
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.user_roles_guard();

-- ── 4. Las preguntas que hacen las dos apps ─────────────────
CREATE OR REPLACE FUNCTION public.has_role(p_role public.app_role)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles r
     WHERE r.user_id = auth.uid() AND r.role = p_role
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_role(public.app_role) TO authenticated;

-- is_admin() ahora responde por el rol, no por "existe una fila en profiles"
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles r
     WHERE r.user_id = auth.uid() AND r.role = 'barber'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_client()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles r
     WHERE r.user_id = auth.uid() AND r.role = 'client'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_client() TO authenticated;

/*
 * Lo que cada app pregunta al entrar: "¿esta cuenta es de aquí?".
 * Devuelve los roles de quien haya iniciado sesión, y nada más.
 */
CREATE OR REPLACE FUNCTION public.my_roles()
RETURNS TABLE (is_barber boolean, is_client boolean)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.user_roles r
             WHERE r.user_id = auth.uid() AND r.role = 'barber'),
    EXISTS (SELECT 1 FROM public.user_roles r
             WHERE r.user_id = auth.uid() AND r.role = 'client');
$$;

GRANT EXECUTE ON FUNCTION public.my_roles() TO authenticated;

-- Cada quien puede leer sus propios roles; escribirlos, nadie desde la app
DROP POLICY IF EXISTS "user_roles_read_own" ON public.user_roles;
CREATE POLICY "user_roles_read_own" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "admin_allowlist_admin_read" ON public.admin_allowlist;
CREATE POLICY "admin_allowlist_admin_read" ON public.admin_allowlist
  FOR SELECT USING (public.is_admin());

-- ── 5. El alta de usuarios deja de repartir admin ───────────
/*
 * Antes: cualquiera que se registrara salía administrador.
 * Ahora: el rol depende de la lista, y el perfil de barbero solo se crea
 * para quien está en ella. Todos los demás son clientes.
 */
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_is_barber boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.admin_allowlist a WHERE lower(a.email) = lower(NEW.email)
  ) INTO v_is_barber;

  IF v_is_barber THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'barber')
    ON CONFLICT DO NOTHING;

    INSERT INTO public.profiles (id, full_name, role)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'Admin'),
      'admin'
    )
    ON CONFLICT (id) DO NOTHING;
  ELSE
    -- Todo registro público es un cliente. Sin perfil de barbero, nunca.
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'client')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 6. Reparar lo que el trigger viejo dejó hecho ───────────
/*
 * Se reparten los roles según lo que cada cuenta ES en realidad, y se
 * retiran los perfiles de administrador que nunca debieron existir.
 */

-- El barbero autorizado conserva (o recupera) su rol
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'barber'
  FROM auth.users u
  JOIN public.admin_allowlist a ON lower(a.email) = lower(u.email)
ON CONFLICT DO NOTHING;

-- Cualquiera con ficha de cliente es cliente
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT c.user_id, 'client'
  FROM public.clients c
 WHERE c.user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Y quien no sea ni lo uno ni lo otro es cliente: se registró por la app
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'client'
  FROM auth.users u
 WHERE NOT EXISTS (
         SELECT 1 FROM public.admin_allowlist a WHERE lower(a.email) = lower(u.email)
       )
   AND NOT EXISTS (
         SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id
       )
ON CONFLICT DO NOTHING;

/*
 * Los perfiles de administrador creados por error.
 *
 * Se borran, no se degradan: `profiles` es la ficha del barbero y una fila
 * ahí no debería existir para un cliente. dashboard_layout va con ellos por
 * ON DELETE CASCADE, que es lo correcto — era el panel de un administrador
 * que nunca lo fue.
 */
DELETE FROM public.profiles p
 WHERE NOT EXISTS (
   SELECT 1
     FROM auth.users u
     JOIN public.admin_allowlist a ON lower(a.email) = lower(u.email)
    WHERE u.id = p.id
 );

-- ── 7. Sin perfiles duplicados ──────────────────────────────
/*
 * `profiles.id` ya era clave primaria, así que ahí nunca hubo duplicados.
 * `clients.user_id` no tenía nada: la misma cuenta podía acabar con dos
 * fichas de cliente. Se limpian las sobrantes conservando la que tiene
 * historial, y se impide que vuelva a pasar.
 */
WITH ranked AS (
  SELECT c.id,
         c.user_id,
         row_number() OVER (
           PARTITION BY c.user_id
           ORDER BY (SELECT count(*) FROM public.appointments a WHERE a.client_id = c.id) DESC,
                    c.created_at ASC
         ) AS rn
    FROM public.clients c
   WHERE c.user_id IS NOT NULL
)
UPDATE public.clients c
   SET user_id = NULL
  FROM ranked
 WHERE c.id = ranked.id AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS clients_user_id_key
  ON public.clients (user_id) WHERE user_id IS NOT NULL;

-- ── 8. Nadie se hace admin escribiendo en profiles ──────────
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self" ON public.profiles;

CREATE POLICY "profiles_self_read" ON public.profiles
  FOR SELECT USING (id = auth.uid());

-- Solo puede tocar SU perfil, y solo si ya es barbero
CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE USING (id = auth.uid() AND public.is_admin())
  WITH CHECK (id = auth.uid() AND public.is_admin());

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ── 9. Solo un cliente puede crearse ficha de cliente ───────
/*
 * La pantalla de "completa tu perfil" inserta en `clients`. Sin esto, un
 * barbero que llegara ahí se crearía una ficha de cliente y acabaría con
 * los dos roles sin que nadie lo decidiera.
 *
 * La regla: puedes crear TU ficha, y solo si tienes el rol de cliente. El
 * barbero sigue pudiendo crear fichas de walk-in, por su propia política.
 */
DROP POLICY IF EXISTS "clients_self_insert" ON public.clients;
CREATE POLICY "clients_self_insert" ON public.clients
  FOR INSERT WITH CHECK (
    (user_id = auth.uid() AND public.is_client())
    OR public.is_admin()
  );

-- ── 10. Qué quedó ───────────────────────────────────────────
SELECT
  (SELECT count(*) FROM public.user_roles WHERE role = 'barber') AS barberos,
  (SELECT count(*) FROM public.user_roles WHERE role = 'client') AS clientes,
  (SELECT count(*) FROM public.profiles)                          AS perfiles_barbero,
  'migración 34 lista'                                            AS resultado;
