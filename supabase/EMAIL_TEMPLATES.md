# Plantillas de correo — Amado Blends

## ⚠️ Por qué el código no funcionaba

Supabase estaba enviando **"Your sign-in link"** con un enlace, no un código de 6 dígitos.
La app pide un código, así que no había nada válido que escribir.

La variable `{{ .Token }}` es la que imprime el código. Sin ella, el correo solo trae enlace.

---

## Cómo aplicarlo

Ve a **Supabase → Authentication → Emails → Templates** y reemplaza el cuerpo de cada
plantilla con el HTML de abajo. En **Magic Link** cambia también el asunto a:

> Tu código de verificación — Amado Blends

---

## 1. Magic Link  (la que usa la app para verificar identidad)

```html
<div style="margin:0;padding:32px 16px;background:#0a0a0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:440px;margin:0 auto;background:#141416;border-radius:20px;overflow:hidden;">

    <div style="padding:28px 28px 20px;text-align:center;border-bottom:1px solid #26262a;">
      <div style="display:inline-block;width:48px;height:48px;line-height:48px;border-radius:14px;background:#ff6a3d;color:#fff;font-size:20px;font-weight:800;">AB</div>
      <p style="margin:12px 0 0;color:#f4f4f5;font-size:15px;font-weight:700;letter-spacing:.16em;">AMADO BLENDS</p>
      <p style="margin:4px 0 0;color:#8b8b93;font-size:12px;">Barbershop</p>
    </div>

    <div style="padding:28px;">
      <p style="margin:0 0 6px;color:#f4f4f5;font-size:18px;font-weight:700;">Hola{{ if .Data.first_name }}, {{ .Data.first_name }}{{ end }}</p>
      <p style="margin:0 0 22px;color:#8b8b93;font-size:14px;line-height:1.6;">
        Recibimos una solicitud para verificar tu identidad y actualizar la información de tu cuenta.
      </p>

      <div style="background:#0a0a0b;border:1px solid #26262a;border-radius:14px;padding:20px;text-align:center;">
        <p style="margin:0 0 8px;color:#8b8b93;font-size:11px;text-transform:uppercase;letter-spacing:.1em;">Tu código de verificación</p>
        <p style="margin:0;color:#ff6a3d;font-size:34px;font-weight:800;letter-spacing:.28em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">{{ .Token }}</p>
      </div>

      <p style="margin:18px 0 0;color:#8b8b93;font-size:13px;text-align:center;">
        Este código expira en <strong style="color:#f4f4f5;">10 minutos</strong> y solo puede usarse una vez.
      </p>

      <div style="margin-top:24px;padding-top:20px;border-top:1px solid #26262a;">
        <p style="margin:0;color:#71717a;font-size:12px;line-height:1.6;">
          Si tú no solicitaste este cambio, ignora este correo. Tu cuenta sigue segura y no se
          modificará nada.
        </p>
      </div>
    </div>

    <div style="padding:16px 28px;background:#0a0a0b;text-align:center;">
      <p style="margin:0;color:#71717a;font-size:11px;">Amado Blends Barbershop</p>
    </div>
  </div>
</div>
```

---

## 2. Confirm signup  (registro de clientes nuevos)

Mismo diseño, texto adaptado al registro:

```html
<div style="margin:0;padding:32px 16px;background:#0a0a0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:440px;margin:0 auto;background:#141416;border-radius:20px;overflow:hidden;">

    <div style="padding:28px 28px 20px;text-align:center;border-bottom:1px solid #26262a;">
      <div style="display:inline-block;width:48px;height:48px;line-height:48px;border-radius:14px;background:#ff6a3d;color:#fff;font-size:20px;font-weight:800;">AB</div>
      <p style="margin:12px 0 0;color:#f4f4f5;font-size:15px;font-weight:700;letter-spacing:.16em;">AMADO BLENDS</p>
      <p style="margin:4px 0 0;color:#8b8b93;font-size:12px;">Barbershop</p>
    </div>

    <div style="padding:28px;">
      <p style="margin:0 0 6px;color:#f4f4f5;font-size:18px;font-weight:700;">¡Bienvenido{{ if .Data.first_name }}, {{ .Data.first_name }}{{ end }}!</p>
      <p style="margin:0 0 22px;color:#8b8b93;font-size:14px;line-height:1.6;">
        Usa este código para confirmar tu correo y terminar de crear tu cuenta.
      </p>

      <div style="background:#0a0a0b;border:1px solid #26262a;border-radius:14px;padding:20px;text-align:center;">
        <p style="margin:0 0 8px;color:#8b8b93;font-size:11px;text-transform:uppercase;letter-spacing:.1em;">Código de confirmación</p>
        <p style="margin:0;color:#ff6a3d;font-size:34px;font-weight:800;letter-spacing:.28em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">{{ .Token }}</p>
      </div>

      <p style="margin:18px 0 0;color:#8b8b93;font-size:13px;text-align:center;">
        Expira en <strong style="color:#f4f4f5;">10 minutos</strong>.
      </p>

      <div style="margin-top:24px;padding-top:20px;border-top:1px solid #26262a;">
        <p style="margin:0;color:#71717a;font-size:12px;line-height:1.6;">
          Si no creaste esta cuenta, puedes ignorar este correo.
        </p>
      </div>
    </div>

    <div style="padding:16px 28px;background:#0a0a0b;text-align:center;">
      <p style="margin:0;color:#71717a;font-size:11px;">Amado Blends Barbershop</p>
    </div>
  </div>
</div>
```

---

## 3. Ajustes recomendados

**Authentication → Providers → Email**

| Opción | Valor |
|---|---|
| Email OTP Expiration | `600` (10 minutos, coincide con el texto) |
| Confirm email | Activado |

**Authentication → Rate Limits** — deja el reenvío en 60 segundos; la app respeta
ese tiempo con su propio contador.

---

## Nota sobre el logo

El HTML usa el cuadro naranja con «AB». Cuando subas tu logo en
**Más → Negocio**, cópialo aquí reemplazando ese `<div>` por:

```html
<img src="URL_DE_TU_LOGO" width="48" height="48" style="border-radius:14px;display:inline-block;" alt="Amado Blends" />
```

La URL sale de Supabase Storage y es pública, así que funciona en cualquier cliente de correo.
