# honorapp

Control de cobros para profesionales que atienden pacientes en Argentina (psicología, nutrición, kinesiología y más): pacientes, sesiones, pagos y reportes para la contadora. Pesos y dólares siempre por separado. **No es software clínico**: no guarda historia clínica ni notas de sesión.

App publicada: **https://control-de-facturacion-eight.vercel.app**

## Qué hace

- **Cuentas**: registro abierto con mail y contraseña o con Google. Cada cuenta ve solo sus datos.
- **Tutorial de bienvenida**: la primera vez que alguien entra, un recorrido paso a paso le muestra cada sección. Se puede repetir desde Ajustes → «Ver tutorial».
- **Pacientes**: tarifa estándar (la de Ajustes) o personalizada, por hora; duración de la sesión; días fijos; activo o inactivo; buscador y filtros (Todos, Deben, Activos, Inactivos).
- **Ficha del paciente**: saldo por moneda, historial mes a mes, editar y borrar sesiones y pagos, cargar de un toque las sesiones del mes según los días fijos, WhatsApp.
- **Registrar**: sesión o pago en pocos toques (en el celular, botón flotante).
- **Cobro mensual**: lo que se debe de un mes es la suma de sus sesiones. Cada pago se imputa a un mes; lo que sobra cancela los meses impagos más viejos. Si cambia la tarifa, las sesiones ya cargadas conservan su precio.
- **Inicio**: cobrado y pendiente del mes, sesiones sin abonar con recordatorio por WhatsApp (mensaje editable en Ajustes) y gráfico de 6 meses.
- **Reporte del mes**: facturado, cobrado y pendiente por paciente, con cada sesión marcada como pagada, parcial o pendiente. Se descarga en Excel.
- **Reporte para contadora**: cobros por fecha de pago, por mes, moneda y medio, con números de factura y total de los últimos 12 meses. Se descarga en Excel o PDF.
- **Importar** `.xlsx` o `.csv`: reconoce la plantilla de la app (hojas Pacientes, Sesiones, Pagos) o deja elegir las columnas de cualquier planilla. Valida fechas `dd/mm/aaaa` y montos `25.000,50`, muestra las filas con error, no duplica lo ya cargado, pregunta antes de crear pacientes y guarda todo o nada.
- **Descargar Excel**: sin datos, baja la plantilla vacía para completar; con datos, baja todo en ese mismo formato (sirve de backup y se puede volver a subir).
- **PWA**: se instala en el celular, se actualiza sola y, sin internet, avisa y no deja cargar nada.
- **Modo oscuro** y diseño responsive (celular y computadora).

## Puesta en marcha (ya hecha; sirve para rehacerla)

### 1. Supabase
1. Crear un proyecto en [supabase.com](https://supabase.com) (región São Paulo).
2. **SQL Editor → New query**: pegar todo [`supabase/schema.sql`](supabase/schema.sql) y tocar **Run**. Se puede volver a correr cuando el archivo cambie: no borra datos.
3. **Authentication → URL Configuration**:
   - **Site URL**: la dirección de Vercel (hoy `https://control-de-facturacion-eight.vercel.app`).
   - **Redirect URLs**: esa misma dirección con `/**` al final y `http://localhost:5173/**` (desarrollo).

### 2. Vercel
1. Importar el repo `CONTROL_DE_FACTURACION` (framework Vite).
2. **Settings → Environment Variables**:
   - `VITE_SUPABASE_URL` = Project URL (Supabase → Project Settings → API)
   - `VITE_SUPABASE_ANON_KEY` = clave **anon public** (la `service_role` no se usa nunca en la app)
3. **Deployments → Redeploy**. Cada push a `main` publica solo.

### 3. Ingreso con Google
- Google Cloud, proyecto **Consultorio** (nombre interno) → Google Auth Platform: app «honorapp» **en producción**, cliente web «Consultorio web».
  - Orígenes autorizados: la dirección de Vercel y `http://localhost:5173`.
  - Redirección autorizada: `https://uxcpfnupwetwtpqhoqvd.supabase.co/auth/v1/callback`.
- Supabase → Authentication → Sign In / Providers → Google: activado, con el Client ID y el Client Secret de ese cliente.
- Si cambia la dirección de la app, actualizarla en los dos lados (orígenes en Google; Site URL y Redirect URLs en Supabase).
- Las páginas `/privacidad` y `/terminos` son públicas: Google las pide para mantener la app publicada.

### 4. Cuenta de la profesional
Abrir la app → «¿No tenés cuenta? Creá una» (o «Continuar con Google»). Las colegas pueden hacer lo mismo.

## Recomendado a futuro

- **Mails en castellano y sin límite chico**: hoy los mails de confirmar cuenta y recuperar contraseña salen en inglés y el servicio de Supabase manda pocos por hora. Configurando un SMTP propio (por ejemplo, [Resend](https://resend.com), que tiene plan gratis) en Supabase → Authentication → Emails → SMTP Settings, se pueden editar los textos y mandar sin ese límite.
- **Protección contra contraseñas filtradas**: Supabase la ofrece en el plan Pro (Authentication → Attack Protection).
- **Ingreso con Apple**: requiere una cuenta de Apple Developer (USD 99 por año).

## Desarrollo local

```bash
npm install
cp .env.example .env   # completar con los datos de Supabase
npm run dev
```

- `npm test`: tests (formato argentino, saldos, inicio, reportes, importación, exportación).
- `npm run build`: compila para producción (incluye el service worker de la PWA).
- `npm run lint`: revisa el código.

Antes de cada commit tienen que pasar los tres.

## Estructura

```
supabase/schema.sql      esquema completo: tablas, RLS, índices, importación (único archivo)
src/lib/                 lógica pura: formato argentino, saldos, reportes, importar, exportar
src/features/            una carpeta por pantalla (auth, inicio, pacientes, registro, reportes, importar, ajustes, tutorial, legal)
src/components/          piezas de UI compartidas (botones, hojas, navegación, Descargar Excel)
docs/diseno/             prototipo de Claude Design y logo (docs/diseno/logo)
docs/mails/              textos de los mails de la app en castellano
public/                  plantilla de Excel e íconos de la app
```

Reglas del proyecto (para quien siga programando, persona o IA): ver [`CLAUDE.md`](CLAUDE.md).
