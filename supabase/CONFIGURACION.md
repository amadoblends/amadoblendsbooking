# Configuración — lo que hay que hacer fuera del código

Tres cosas de esta lista **no se arreglan programando**. Están en paneles de
control, y hasta que las hagas el código correcto seguirá dando el resultado
equivocado. Van en orden de importancia.

---

## 1. El código de 6 dígitos (ahora llega un enlace)

Las plantillas están escritas y listas para pegar en
[`email-templates/`](email-templates/), con instrucciones en su propio
README: las cuatro plantillas, los asuntos, y cómo dejar de enviar desde
`noreply@mail.app.supabase.io`.

Lo esencial, por si no abres el otro archivo: Supabase manda un **código** si
la plantilla contiene `{{ .Token }}`, y un **enlace** si no. La plantilla por
defecto no lo tiene, y la app pide 6 dígitos — por eso no encajan.

---

## 2. Entrar con Google

El código ya está completo en ambos lados (`/auth/callback` incluido). Falta
darle credenciales.

**a) Google Cloud Console** → crea un proyecto → *APIs y servicios* →
*Credenciales* → **Crear credenciales → ID de cliente de OAuth** → tipo
**Aplicación web**.

En **URIs de redireccionamiento autorizados** pon exactamente:

```
https://<TU-PROYECTO>.supabase.co/auth/v1/callback
```

(Lo encuentras en Supabase → Authentication → Providers → Google; ahí te lo
muestra ya escrito.)

En **Orígenes autorizados de JavaScript**:

```
https://amadoblendsbooking.vercel.app
https://amado-blends.vercel.app
http://localhost:3000
```

**b) Supabase** → Authentication → Providers → **Google** → activar → pega el
*Client ID* y el *Client Secret* de Google → guardar.

**c) Supabase** → Authentication → **URL Configuration**:

- *Site URL*: `https://amadoblendsbooking.vercel.app`
- *Redirect URLs* (una por línea):
  ```
  https://amadoblendsbooking.vercel.app/**
  https://amado-blends.vercel.app/**
  http://localhost:3000/**
  ```

Sin el paso (c) Google devuelve al usuario a `localhost` en producción.

---

## 3. Correos de citas (a ti y a tus clientes)

Los correos de Supabase solo cubren el registro. Para los avisos de citas hace
falta un proveedor de envío. El código usa **Resend**, que es gratis hasta
3.000 correos al mes — de sobra.

**a)** Crea una cuenta en [resend.com](https://resend.com).

**b)** *Domains* → añade tu dominio y copia los registros DNS (SPF, DKIM) donde
tengas el dominio. Sin dominio propio puedes empezar con el remitente de
prueba `onboarding@resend.dev`, pero solo te deja escribirte a ti mismo.

**c)** *API Keys* → crea una → cópiala.

**d)** En Vercel, proyecto **amadoblendsbooking** → Settings → Environment
Variables:

| Variable | Valor | Para qué |
|---|---|---|
| `RESEND_API_KEY` | `re_...` | la clave del paso (c) |
| `EMAIL_FROM` | `Amado Blends <citas@tudominio.com>` | remitente |
| `NEXT_PUBLIC_SHOP_TIMEZONE` | `America/Puerto_Rico` | la hora de la barbería |
| `BARBER_NOTIFY_EMAIL` | *(opcional)* | respaldo, ver abajo |

Ponlas en **los dos proyectos** de Vercel: el panel manda correos cuando tú
creas o mueves una cita, y la app del cliente cuando reserva un cliente.
Vuelve a desplegar después de guardarlas.

**¿A qué correo te llegan a ti?** Se resuelve en este orden:

1. **Panel → Negocio → "Correo para notificaciones"** ← usa este. Se cambia
   sin redesplegar y puede ser tu Gmail o el de la compañía.
2. `BARBER_NOTIFY_EMAIL`, si dejaste ese campo vacío.
3. El correo con el que inicias sesión, como último recurso.

**Qué se envía y a quién:**

| Qué pasa | Al cliente | A ti |
|---|---|---|
| Un cliente reserva desde su app | Confirmación completa | Aviso de cita nueva |
| **Tú creas una cita en el panel** | Confirmación completa | Tu copia |
| Un cliente cancela | Confirmación de cancelación | Aviso, con la hora liberada |
| **Tú cancelas desde el panel** | Aviso de cancelación | Tu copia |
| Un cliente reprograma | Hora nueva, con la anterior | Igual |
| **Tú mueves una cita** | Hora nueva, con la anterior | Tu copia |
| **Marcas "No asistió"** | — *(a propósito)* | Solo para tu registro |

Cada correo lleva servicio, fecha, hora, duración, barbero, productos,
dirección con enlace a mapas, notas, total y código de confirmación. El aviso
que te llega a ti responde directo al cliente si le das a *Responder*.

> Mientras falten `RESEND_API_KEY` o `EMAIL_FROM`, la app funciona igual: no
> manda correos y no falla ninguna reserva. Tu campanita dentro de la app
> avisa de todas formas.

---

## 4. Migraciones pendientes

En el editor SQL de Supabase, **en este orden**:

```
migration_17_closures_theme_slots.sql
migration_18a_add_no_show.sql        ← sola, sin nada más
migration_18b_no_show_rules.sql
migration_19_product_link.sql
migration_20_branding.sql
migration_21_business_identity.sql
migration_22_promotions_window.sql
migration_23_carousel_window.sql
migration_24_email_exists.sql        ← "ese correo ya tiene cuenta"
migration_25_notify_email.sql        ← el correo que recibe los avisos
migration_26_appointment_notifications.sql  ← la campanita (¡esta primero!)
migration_27_product_categories_time.sql
migration_28_notification_events.sql
migration_29_clients_birthday_feedback.sql  ← cumpleaños, walk-ins y comentarios
migration_30_seen_markers.sql               ← el número rojo en Citas
migration_31_client_status.sql              ← estados y lista negra
migration_32_feedback_categories.sql        ← categorías de comentarios
migration_33_carousel_crop.sql              ← encuadre de las imágenes
```

Hasta la 23, el aviso de vacaciones terminado seguirá en el carrusel. Hasta la
24, registrarse con un correo ya usado seguirá entrando a la cuenta vieja sin
avisar. **Hasta la 26, la campanita no se llena cuando un cliente reserva** —
esa es la que quieres correr primero.

Hasta la 29 no hay buzón de comentarios ni descuento de cumpleaños, y un
cliente que ya tenías apuntado a mano no se engancha a su cuenta al
registrarse: se le crearía un perfil nuevo y vacío. Hasta la 30 no aparece el
número de citas nuevas sobre el icono de Citas.

Mientras falten, la app no se rompe: cada pantalla lo dice o simplemente no
muestra esa parte.

---

## 5. Notificaciones push (opcional)

Las push llegan al teléfono aunque la app esté cerrada. Necesitan un par de
llaves VAPID, que se generan una sola vez:

```bash
node scripts/generate-vapid-keys.mjs
```

Copia las cuatro variables que imprime a **los dos proyectos** de Vercel. La
privada no lleva `NEXT_PUBLIC_`: nunca debe llegar al navegador.

**Dos cosas sobre el iPhone que explican casi todos los "no me llegan":**

1. Safari solo permite push desde una app **añadida a la pantalla de inicio**.
   En una pestaña normal la API ni siquiera existe.
2. El permiso debe pedirse desde un toque del usuario. Pedirlo al cargar la
   página se deniega en silencio.

La app detecta ambos casos y lo dice en pantalla en vez de fallar callada.

Sin las llaves, todo lo demás sigue funcionando: la campanita y los correos no
dependen de esto.

---

## 6. Migraciones (lista completa)

```
migration_17_closures_theme_slots.sql
migration_18a_add_no_show.sql              ← sola, sin nada más
migration_18b_no_show_rules.sql
migration_19_product_link.sql
migration_20_branding.sql
migration_21_business_identity.sql
migration_22_promotions_window.sql
migration_23_carousel_window.sql           ← arregla el carrusel
migration_24_email_exists.sql
migration_25_notify_email.sql
migration_26_appointment_notifications.sql ← la campanita
migration_27_product_categories_time.sql   ← categorías + tiempo extra
migration_28_notification_events.sql       ← un evento, varios canales
```


---

## 7. El envío de correos

### Por qué el `From` no puede ser amadoblends@gmail.com

Un proveedor transaccional firma el correo con DKIM para un dominio que ha
verificado que controlas. Nadie puede verificar que controla un buzón de
gmail.com — ese dominio es de Google. Un `From: …@gmail.com` enviado por
Resend llega sin alineación de SPF ni DKIM, y Gmail, Outlook y Yahoo lo
tratan como suplantación: acaba en spam, o directamente rechazado. Además
enseñaría a los filtros a desconfiar de la dirección que de verdad usas.

La forma correcta, que es la que está puesta:

```
From:     Amado Blends <citas@tudominio.com>   ← verificado y firmado
Reply-To: amadoblends@gmail.com                ← donde llegan las respuestas
```

El cliente ve **Amado Blends** como remitente, y al responder te escribe a tu
Gmail de siempre. No se pierde nada por no falsificar el `From`.

### Qué configurar

1. En Resend → **Domains**, añade tu dominio y pon los registros DNS que te
   da (SPF, DKIM y DMARC).
2. Cuando quede verificado, en Vercel:

```
EMAIL_FROM        = citas@tudominio.com
EMAIL_BRAND_NAME  = Amado Blends
EMAIL_REPLY_TO    = amadoblends@gmail.com
RESEND_API_KEY    = re_...        (sin NEXT_PUBLIC_, nunca)
```

Mientras no haya dominio verificado, los correos salen desde el remitente de
pruebas de Resend, con la marca puesta, y la app lo avisa en los logs en vez
de fallar en silencio. Si pones un Gmail en `EMAIL_FROM`, **no se usa**: se
avisa y se envía desde el remitente de pruebas, porque enviarlo así dañaría
tu reputación de correo.

---

## 8. Los recordatorios automáticos

Necesitan dos variables más:

```
SUPABASE_SERVICE_ROLE_KEY = ...   (sin NEXT_PUBLIC_, nunca)
CRON_SECRET               = una cadena larga al azar
```

`SUPABASE_SERVICE_ROLE_KEY` es la única forma de mandar recordatorios: se
envían sin que nadie haya iniciado sesión, así que RLS los rechazaría con
razón. Se usa solo en `lib/supabase/service.ts`, en el servidor.

`vercel.json` ya trae el cron cada cinco minutos. No hace falta precisión: un
recordatorio está vencido desde su hora en adelante, así que cada pasada
recoge todo lo vencido desde la anterior. Si una pasada se salta, no se
pierde nada; si dos se solapan, no se manda nada dos veces —el reclamo es
atómico.

Para probarlo a mano:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://amadoblendsbooking.vercel.app/api/cron/reminders
```
