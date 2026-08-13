# Configuración — lo que hay que hacer fuera del código

Tres cosas de esta lista **no se arreglan programando**. Están en paneles de
control, y hasta que las hagas el código correcto seguirá dando el resultado
equivocado. Van en orden de importancia.

---

## 1. El código de 6 dígitos (ahora llega un enlace)

**Síntoma:** pides el código y te llega un correo de Supabase que dice
*"Your sign-in link"* con un botón *Sign in*, en vez de seis dígitos.

**Por qué:** Supabase decide entre enlace y código **según la plantilla**. Si
la plantilla no contiene `{{ .Token }}`, manda un enlace. La plantilla que
tienes es la de fábrica y solo tiene `{{ .ConfirmationURL }}`.

**Arreglo:** Supabase → **Authentication → Emails → Magic Link** → pega esto
y guarda:

```html
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
  <div style="text-align:center;margin-bottom:28px;">
    <div style="display:inline-block;width:56px;height:56px;line-height:56px;border-radius:16px;background:#f2683c;color:#fff;font-size:26px;font-weight:800;">A</div>
    <h1 style="margin:14px 0 0;font-size:21px;color:#14151a;">Amado Blends</h1>
  </div>

  <p style="font-size:15px;color:#6b6b75;text-align:center;margin:0 0 20px;">
    Tu código de verificación es:
  </p>

  <div style="text-align:center;margin:0 0 24px;">
    <span style="display:inline-block;padding:16px 32px;background:#f5f5f6;border-radius:14px;font-size:32px;font-weight:800;letter-spacing:.22em;color:#14151a;">{{ .Token }}</span>
  </div>

  <p style="font-size:13px;color:#6b6b75;text-align:center;line-height:1.6;margin:0;">
    Vence en 1 hora y solo se puede usar una vez.<br>
    Si no fuiste tú, ignora este correo.
  </p>
</div>
```

Haz lo mismo en **Confirm signup** (la misma plantilla sirve).

> `{{ .Token }}` es la pieza obligatoria. Si la quitas, vuelve el enlace.

**Comprobación:** regístrate con un correo nuevo. Debe llegar un correo con
seis dígitos grandes, sin ningún botón de "Sign in".

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
| `BARBER_NOTIFY_EMAIL` | tu correo personal | dónde te avisan a ti |
| `NEXT_PUBLIC_SHOP_TIMEZONE` | `America/Puerto_Rico` | la hora de la barbería |

Vuelve a desplegar después de guardarlas.

**Qué se envía y a quién:**

| Cuándo | Al cliente | A ti |
|---|---|---|
| Reserva nueva | Confirmación con todos los datos | Aviso de cita nueva |
| Cancelación | Confirmación de cancelación | Aviso, con la hora que se liberó |
| Reprogramación | Hora nueva, con la anterior de referencia | Igual |

Cada correo lleva servicio, fecha, hora, duración, barbero, productos,
dirección con enlace a mapas, notas, total y código de confirmación.

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
```

Hasta la 23, el aviso de vacaciones terminado seguirá en el carrusel. Hasta la
24, registrarse con un correo ya usado seguirá entrando a la cuenta vieja sin
avisar.
