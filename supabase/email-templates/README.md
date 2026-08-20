# Los correos de Supabase

El correo que recibiste dice dos cosas, y las dos hay que arreglar por
separado:

```
De:      Supabase Auth <noreply@mail.app.supabase.io>   ← el remitente
Asunto:  Your sign-in link                              ← la plantilla
```

La **plantilla** es el contenido y el idioma. El **remitente** es de quién
parece venir. Se cambian en sitios distintos.

---

## 1. La plantilla — pega estos cuatro archivos

Supabase → **Authentication → Emails**. Para cada uno, borra lo que haya y
pega el archivo entero:

| Pestaña en Supabase | Archivo |
|---|---|
| Magic Link | `magic-link.html` |
| Confirm signup | `confirm-signup.html` |
| Reset password | `recovery.html` |
| Change email address | `email-change.html` |

Cambia también el **Subject** de cada una, que va aparte del cuerpo:

| Pestaña | Asunto |
|---|---|
| Magic Link | `Tu código de acceso — Amado Blends` |
| Confirm signup | `Confirma tu correo — Amado Blends` |
| Reset password | `Recupera tu contraseña — Amado Blends` |
| Change email address | `Confirma tu correo nuevo — Amado Blends` |

### Lo único que no puedes quitar

`{{ .Token }}`.

Supabase decide entre mandar un **código** o un **enlace** mirando la
plantilla: si contiene `{{ .Token }}` manda los 6 dígitos, y si no, manda un
enlace. La plantilla por defecto no lo tiene — por eso te llegó *"Your
sign-in link"* y nunca el código que la app te pide escribir.

Si algún día vuelve a llegar un enlace, es que se perdió esa línea.

---

## 2. El remitente — `noreply@mail.app.supabase.io`

Esa dirección es el servidor de correo compartido de Supabase, y **no se
puede cambiar desde las plantillas**. Se cambia poniendo tu propio SMTP.

Supabase → **Project Settings → Authentication → SMTP Settings** → activa
*Enable Custom SMTP*, y como ya tienes Resend, apúntalo ahí:

```
Host:        smtp.resend.com
Port:        465
Username:    resend
Password:    (tu RESEND_API_KEY, la misma que ya usas)
Sender email: citas@tudominio.com
Sender name:  Amado Blends
```

Y entonces llega así:

```
De:      Amado Blends <citas@tudominio.com>
Asunto:  Tu código de acceso — Amado Blends
```

### Otra vez lo mismo del Gmail

`Sender email` tiene que ser una dirección de un dominio **verificado en
Resend**. No puede ser `amadoblends@gmail.com`, por lo mismo que ya vimos con
los correos de citas: nadie puede firmar correo de gmail.com, y Gmail trata
como suplantación lo que llegue así.

Mientras no tengas dominio verificado, el remitente compartido de Supabase
funciona y llega. Es feo, pero llega — y con las plantillas puestas, el
contenido ya es tuyo aunque el remitente todavía no lo sea.

### Por qué merece la pena hacerlo igualmente

El servidor compartido de Supabase tiene **límite de 2 correos por hora** en
el plan gratuito. Con dos personas registrándose seguidas ya se agota, y los
siguientes no llegan — sin aviso ni error visible. Con tu propio SMTP ese
límite desaparece.

Si estás probando el registro varias veces, ese límite es lo primero que te
va a morder.

---

## Por qué el HTML está escrito así

Tablas anidadas y estilos en línea, sin flexbox ni hojas de estilo. Gmail y
Outlook descartan casi todo el CSS moderno: un correo que se ve perfecto en
el navegador puede llegar deshecho. Es incómodo de escribir y fiable de leer,
que es el orden correcto para algo que no puedes volver a tocar una vez
enviado.

Los colores son los tuyos — negro, gris, blanco, y el naranja solo como
acento en la raya bajo el nombre.
