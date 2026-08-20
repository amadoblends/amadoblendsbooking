# Empezar de cero sin romper nada

> **Antes de nada:** corre `migration_34_roles_and_identity.sql`. Sin ella no
> existe `admin_allowlist`, y los scripts no tienen forma de saber qué cuenta
> conservar. `reset_1` te lo avisa; `reset_3` se niega a arrancar.

Tres archivos, en este orden. El primero solo mira, el segundo guarda, y solo
el tercero borra.

```
reset_1_inventario.sql   ← mira y reporta. No toca nada.
reset_2_respaldo.sql     ← copia lo que se va a borrar.
reset_3_limpiar.sql      ← borra, con dos frenos de seguridad.
```

## 1. Mirar

Corre `reset_1_inventario.sql` en el editor SQL de Supabase. Te devuelve
cuatro cosas:

- **Qué se conserva** y cuántas filas tiene.
- **Qué se borra** y cuántas filas tiene.
- **Cada cuenta**, con `✅ CONSERVAR` o `🗑️ BORRAR` al lado. Comprueba con tus
  ojos que `amadoblends@gmail.com` dice CONSERVAR.
- **Las claves foráneas**, para que veas qué se lleva por delante cada borrado.

Si aparece la línea `⛔ PARA`, no sigas: significa que no hay ninguna cuenta de
barbero autorizada, y limpiar te dejaría fuera de tu propio panel. Corre antes
la migración 34.

## 2. Guardar

`reset_2_respaldo.sql` copia todo lo borrable a un esquema aparte dentro de la
misma base, llamado `backup_20260819_1430` (con la fecha y hora reales).

Va dentro de la base y no a un fichero a propósito: no depende de que una
descarga termine, ni de dónde quedó guardada, ni de volver a subirla. Si mañana
descubres que hacía falta una fila, sigue estando a un `SELECT` de distancia:

```sql
SELECT * FROM backup_20260819_1430.appointments;
```

Cuando ya no lo necesites: `DROP SCHEMA backup_20260819_1430 CASCADE;`

## 3. Borrar

`reset_3_limpiar.sql` no arranca si falta cualquiera de las dos cosas: una
cuenta de barbero que conservar, o un respaldo. Ambas paran el script en seco
antes de tocar la primera fila.

**No toca la estructura.** Ni tablas, ni columnas, ni funciones, ni políticas
RLS, ni triggers, ni Storage, ni migraciones. Solo filas.

### Se conserva

| | |
|---|---|
| `auth.users` | solo `amadoblends@gmail.com` |
| `profiles`, `user_roles`, `admin_allowlist` | tu cuenta y tu rol |
| `availability`, `booking_settings` | tus horarios y reglas de reserva |
| `business_settings` | nombre, logo, portada, correo de avisos |
| `services`, `products` | tu catálogo |
| `reminder_rules` | los recordatorios que configuraste |

### Se borra

Citas y todo lo que cuelga de ellas, clientes y sus notas, bloqueos, cierres,
carrusel, promociones, notificaciones, comentarios, recordatorios en cola, y
las cuentas de prueba de Auth.

Las cuentas van **al final**, cuando ya no queda nada apuntando a ellas. Al
revés quedarían fichas de cliente sin cuenta; sin ese orden, cuentas sin ficha.

### Al terminar

El script comprueba la integridad él mismo: clientes sin cuenta, citas sin
cliente, perfiles sin cuenta y roles sin cuenta. **Los cuatro deben salir en
cero.** Si alguno no lo está, algo quedó suelto y hay que mirarlo antes de
seguir.

Y lista las cuentas que quedan: debe salir solo la tuya.
