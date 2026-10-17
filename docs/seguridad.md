# Pruebas de seguridad

Última revisión: 17/10/2026, sobre la app publicada (control-de-facturacion-eight.vercel.app) y el proyecto de Supabase.
Se probó como lo haría un atacante: sin cuenta (solo con la clave pública que trae la página) y con una cuenta ajena.

## Qué se probó y resultado

| Prueba | Resultado |
|---|---|
| Claves secretas en el código publicado (service_role, sb_secret) | ✅ No hay. Solo la clave pública `anon`, que es pública por diseño. |
| Leer cualquier tabla sin cuenta | ✅ Devuelve vacío en todas. |
| Crear, cambiar o borrar datos sin cuenta | ✅ Rechazado por RLS (error 42501). |
| Llamar funciones de la base sin cuenta | ✅ Ninguna habilitada. Las que necesitan cuenta validan `auth.uid()`. |
| Una cuenta ve, cambia, borra o apunta a datos de otra | ✅ Imposible. `supabase/tests/aislamiento.sql` → «Aislamiento OK» (incluye recordatorios, avisos, link del calendario y resumen mensual). |
| Darse permisos de administrador | ✅ Lo impide el trigger `proteger_es_admin`. |
| Cambiar el dueño de un dato | ✅ Lo impide el trigger `user_id_inmutable`. |
| Calendario con links falsos o inyección | ✅ 404 / bloqueado. El código del link es un UUID aleatorio (122 bits). |
| Funciones web públicas | ✅ `actualizar-monotributo` se limita a una vez por hora. `aviso-mensual` corregida (ver abajo). |
| Inserción de código (XSS) | ✅ React escapa todo; no hay `innerHTML` ni `eval`; los links usan `encodeURIComponent`. |
| Fórmulas maliciosas en Excel exportado | ✅ `celdaSegura` las neutraliza. |
| Archivos subidos (Storage) | ✅ No hay buckets. |
| Dependencias con fallas conocidas | ✅ `npm audit`: 0 (se actualizó `uuid`, que usaba exceljs). |
| HTTPS | ✅ Obligatorio, con HSTS. |

## Qué se corrigió en esta revisión

1. **Encabezados de seguridad** (`vercel.json`): política de contenido estricta (CSP: solo scripts propios, conexiones solo a Supabase), bloqueo de iframes (anti-clickjacking), `nosniff`, `Referrer-Policy` y `Permissions-Policy`. El script del tema pasó a `public/tema.js` para no permitir scripts sueltos.
2. **Resumen mensual**: solo actúa los días 1 a 3 (nadie puede adelantarlo) y manda siempre al mail verificado de la cuenta, no al que se puede editar en el perfil (evita usar honorapp para mandar mails a terceros).
3. **Límites de largo** en todos los textos libres de la base (31 reglas): nadie puede llenar la base con textos gigantes.

## Pendiente (desde el panel de Supabase)

- **Contraseña mínima de 8 caracteres**: en Supabase → Authentication, en la configuración del proveedor Email (*Minimum password length*).
- **Protección contra contraseñas filtradas**: requiere el plan Pro de Supabase.
- **Doble factor (MFA)**: ver `docs/ideas.md`.
- **Copias de seguridad**: si el proyecto está en el plan gratuito de Supabase, no hay copias automáticas para restaurar; el plan Pro las trae (diarias). Mientras tanto, «Descargar Excel» en Ajustes sirve de copia manual.

## Cómo repetir las pruebas

- Aislamiento entre cuentas: correr `supabase/tests/aislamiento.sql` en el SQL Editor.
- Encabezados: `curl -I https://control-de-facturacion-eight.vercel.app/`.
- Avisos de Supabase: Advisors → Security (los únicos avisos que quedan son intencionales: funciones con cuenta validadas por los tests, tablas internas sin políticas y la protección de contraseñas del plan Pro).
