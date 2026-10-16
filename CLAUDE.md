# Consultorio

Web app de control de cobros para psicólogas en Argentina. Cada profesional registra sesiones y pagos de sus pacientes y le pasa reportes mensuales a su contadora. **No es software clínico**: nunca guardar historia clínica ni notas de sesión.

Registro abierto: cualquier colega puede crearse una cuenta y ve solo sus datos.

## Stack
- React + Vite + TypeScript estricto + Tailwind v4.
- TanStack Query (refetchOnWindowFocus activo), react-router, sonner (toasts).
- Supabase: auth con mail y contraseña, Postgres, RLS en todas las tablas (`user_id = auth.uid()`). En el front solo la anon key.
- Excel: exceljs. CSV: papaparse. PDF: jspdf + jspdf-autotable. Gráficos: recharts. Tests: vitest. **No usar el paquete `xlsx` de npm.**
- PWA instalable (vite-plugin-pwa), sin modo offline: sin conexión se avisa y no se permite cargar.
- Deploy en Vercel desde `main` del repo `alirioerodriguez/CONTROL_DE_FACTURACION`.

## Modelo de cobro
- Tarifa **por hora**. `profiles.tarifa_estandar` es la tarifa estándar de la profesional; cada paciente usa `tipo_tarifa = 'estandar'` (sigue a la estándar) o `'personalizada'` (`tarifa_personalizada`).
- Cada sesión guarda su `tarifa_hora` al cargarse. Si la tarifa cambia, las sesiones ya cargadas conservan su precio; las nuevas usan el nuevo.
- `patients.dias_semana` + `horas_por_sesion` permiten generar las sesiones del mes (ej.: todos los lunes; 4 o 5 según el mes).
- El paciente paga por mes. Lo que debe de un mes es la suma de las sesiones de ese mes. Los pagos se imputan a un `periodo` (día 1 del mes); lo que sobra cancela los meses impagos más viejos (FIFO); el resto es saldo a favor. Ver `src/lib/saldos.ts`.
- ARS y USD siempre separados. Nunca convertir ni sumar entre monedas.

## Reglas
- Un solo esquema: `supabase/schema.sql`, idempotente. Si el esquema cambia, se edita ESE archivo (nada de migraciones sueltas).
- Una sola versión del código: nada de archivos v2, old, copia.
- Formato argentino en toda la UI vía `src/lib/formato.ts`: `$ 25.000,00`, `US$ 50,00`, fechas dd/mm/aaaa. Fechas de negocio como texto `AAAA-MM-DD`; "hoy" en America/Argentina/Buenos_Aires (`hoyAR`).
- Toda operación muestra un toast de éxito o error. Nada falla en silencio.
- Inputs con font-size mínimo de 16px; montos con `inputMode="decimal"`.
- Responsive real a 390px y 1440px. Estados vacío, cargando y error en cada pantalla.
- Diseño: seguir el prototipo de Claude Design (verde salvia, esquinas redondeadas, títulos en serif). Referencia en `docs/diseno/`.
- La importación acepta la estructura de `public/plantilla-cobros.xlsx` (se descarga desde la pantalla Importar) (hojas Pacientes, Sesiones, Pagos; mismos nombres de columna).
- Antes de cada commit: `npm run build`, `npm run lint` y `npm test` tienen que pasar. Commits chicos, en castellano.

## Fases
1. ✅ Base, schema, auth, formato, saldos con tests.
2. ✅ Pacientes, ficha y registro rápido (incluye generar sesiones del mes).
3. ✅ Inicio (dashboard) y recordatorio por WhatsApp.
4. ✅ Importación .xlsx/.csv con tests (plantilla o columnas a elegir; guarda todo o nada con la función SQL importar_datos).
5. Reporte para contadora (xlsx/PDF), ajustes, backup, modo oscuro, PWA.
6. Repaso responsive y README final.
