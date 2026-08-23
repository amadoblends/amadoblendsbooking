# Registrarse sin esperar el código

Mientras el correo no esté terminado, el registro puede saltarse el código
de 6 dígitos. Hacen falta **dos** cosas — una en Vercel y otra en Supabase.
Con una sola no funciona.

## 1. Vercel

Project Settings → Environment Variables:

```
NEXT_PUBLIC_AUTH_SKIP_OTP = true
```

Y vuelve a desplegar. Es `NEXT_PUBLIC_` porque la pantalla de registro corre
en el navegador y necesita saberlo.

## 2. Supabase

Authentication → Providers → Email → **apaga "Confirm email"**.

Sin esto, `signUp` manda un correo de confirmación y no devuelve sesión —
que es exactamente la espera que queremos saltar. Si se te olvida, la app te
lo dice en pantalla en vez de quedarse colgada.

## Cómo queda

```
Rellenas el formulario → entras.
```

Sin código, sin correo, sin esperar. El perfil se crea igual, y si el
barbero ya tenía una ficha tuya como walk-in, te la sigue ofreciendo.

Mientras está encendido, la pantalla de login muestra un aviso amarillo:

> ⚠️ Modo de pruebas: el correo no se verifica.

No se puede cerrar. Un modo de pruebas que se esconde es un modo de pruebas
que acaba en producción.

## Qué se pierde

Nadie demuestra que el correo que escribe es suyo. Cualquiera puede
registrarse como cualquiera, y la recuperación de contraseña mandaría el
código al buzón de otra persona.

Da igual en una base de pruebas. **No da igual con clientes reales.**

## Para apagarlo

```
NEXT_PUBLIC_AUTH_SKIP_OTP = false     (o bórrala)
```

Y vuelve a encender "Confirm email" en Supabase.

Lo comprueba `src/lib/auth-config.ts` y ningún otro sitio — es el único
archivo que hay que mirar antes de salir a producción. La comparación es
estricta contra `"true"`: `"false"` también es una cadena con contenido, y
un interruptor que se enciende al ponerlo en `false` es peor que no tenerlo.
