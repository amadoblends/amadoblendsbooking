# Los correos de Supabase

El correo que recibiste dice dos cosas, y las dos hay que arreglar por
separado:

```
De:      Supabase Auth <noreply@mail.app.supabase.io>   ← el remitente
Asunto:  Your sign-in link                              ← la plantilla
```

La **plantilla** es el contenido y el idioma. El **remitente** es de quién
parece venir.

> ## ⚠️ El SMTP va PRIMERO
>
> Supabase ya no deja editar las plantillas sin SMTP propio. En
> *Authentication → Emails* verás:
>
> > *Set up custom SMTP to edit templates — Emails will be sent using the
> > default templates.*
>
> Los campos de Subject y Body están bloqueados hasta que lo configures. No
> es un paso opcional que puedas dejar para después: es el requisito.
>
> **Ve al punto 2 primero, y luego vuelve al 1.**

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

### Necesitas un dominio. No hay atajo.

Para verificar un dominio en Resend hace falta tener uno. Cuesta unos 10–12
dólares al año en Namecheap, Cloudflare o Porkbun, y desbloquea de una vez
las cuatro cosas que hoy están a medias:

| | Sin dominio | Con dominio |
|---|---|---|
| Editar las plantillas | ❌ bloqueado por Supabase | ✅ |
| Remitente | `noreply@mail.app.supabase.io` | `Amado Blends <citas@…>` |
| Correos de citas | remitente de pruebas | ✅ firmados |
| Límite de envío | **2 por hora** | el de Resend (3.000/mes gratis) |

El `onboarding@resend.dev` de Resend **no sirve** para esto: solo puede
enviar al correo con el que creaste la cuenta de Resend, así que no puedes
probar el registro de un cliente con otra dirección.

### Mientras tanto, ¿funciona el registro?

Sí, con el enlace. Llega *"Your sign-in link"* en inglés y sin marca, pero al
tocarlo entra: la app tiene una ruta que procesa el enlace y crea la cuenta
igual. El código de 6 dígitos es lo único que no puede funcionar todavía, y
la pantalla de login ya lo dice.

**El límite de 2 correos por hora es lo que te va a molestar de verdad** al
probar. Dos registros seguidos y el tercero no llega, sin aviso ni error.

---

## Por qué el HTML está escrito así

Tablas anidadas y estilos en línea, sin flexbox ni hojas de estilo. Gmail y
Outlook descartan casi todo el CSS moderno: un correo que se ve perfecto en
el navegador puede llegar deshecho. Es incómodo de escribir y fiable de leer,
que es el orden correcto para algo que no puedes volver a tocar una vez
enviado.

Los colores son los tuyos — negro, gris, blanco, y el naranja solo como
acento en la raya bajo el nombre.
