# honorapp

Control de cobros para profesionales que atienden pacientes en Argentina (psicología, nutrición, kinesiología y más): pacientes, sesiones, pagos y reportes para la contadora. Pesos y dólares siempre por separado. **No es software clínico**: no guarda historia clínica ni notas de sesión.

App publicada: **https://control-de-facturacion-eight.vercel.app**

## Qué hace

- **Cuentas**: registro abierto con mail y contraseña o con Google. Cada cuenta ve solo sus datos.
- **Para cualquier profesión con pacientes**: al entrar por primera vez se elige la profesión; según eso la app habla de «sesión» o «consulta» y la tarifa es por hora o por sesión/consulta (se cambia en Ajustes).
- **Tutorial de bienvenida**: la primera vez que alguien entra, un recorrido paso a paso le muestra cada sección. Se puede repetir desde Ajustes → «Ver tutorial».
- **Pacientes**: tarifa estándar (la de Ajustes) o personalizada, por hora; duración de la sesión; días fijos; activo o inactivo; buscador y filtros (Todos, Deben, Activos, Inactivos).
- **Ficha del paciente**: saldo por moneda, historial mes a mes, editar y borrar sesiones y pagos, cargar de un toque las sesiones del mes según los días fijos, WhatsApp.
- **Registrar**: sesión o pago en pocos toques (en el celular, botón flotante).
- **Cobro mensual**: lo que se debe de un mes es la suma de sus sesiones. Cada pago se imputa a un mes; lo que sobra cancela los meses impagos más viejos. Si cambia la tarifa, las sesiones ya cargadas conservan su precio.
- **Inicio**: cobrado y pendiente del mes, sesiones sin abonar con recordatorio por WhatsApp (mensaje editable en Ajustes) y gráfico de 6 meses.
- **Reporte del mes**: a cobrar, cobrado y pendiente por paciente, con cada sesión marcada como pagada, parcial o pendiente. Se descarga en Excel.
- **Reporte para contadora**: cobros por fecha de pago, por mes, moneda y medio, con números de factura y total de los últimos 12 meses. Se descarga en Excel o PDF.
- **Importar** `.xlsx` o `.csv`: reconoce la planilla de la app, de una sola pestaña «Citas» (paciente, DNI, CUIL/CUIT, condición frente al IVA, obra social, teléfono, fecha y hora de la cita, monto, moneda, pagó y nº de factura), el Excel completo de copia de seguridad, o deja elegir las columnas de cualquier planilla. Valida fechas `dd/mm/aaaa` y montos `25.000,50`, muestra las filas con error, no duplica lo ya cargado, pregunta antes de crear pacientes y guarda todo o nada.
- **Descargar Excel**: sin datos, baja la planilla de citas para completar (`node scripts/generar-plantilla.mjs` la regenera); con datos, baja todo en formato completo (sirve de backup y se puede volver a subir).
- **PWA**: se instala en el celular, se actualiza sola y, sin internet, avisa y no deja cargar nada.
- **Modo oscuro**, **tamaño de letra** (5 opciones en Ajustes; toda la app escala) y diseño responsive (celular y computadora).
- **Control del tope del monotributo**: la categoría se elige en Ajustes; Inicio muestra lo cobrado en los últimos 12 meses contra el tope, avisa desde el 80 % y sugiere categoría. Los dólares se suman solo si se carga el tipo de cambio. Es orientativo.
- **Recibos**: desde un pago se descarga el recibo en PDF o se comparte por WhatsApp o mail (en el celular con el menú de compartir; en la computadora se descarga y se abre el mensaje).
- **Abono mensual**: un paciente puede pagar un monto fijo por mes; se reparte entre las sesiones del mes (`src/lib/abono.ts`) y los meses sin sesiones no se cobran.
- **Para facturar** (`/facturar`, desde Contadora): pagos sin Factura C con los datos que pide ARCA para copiar, y «Ya la hice» para anotar el número.
- **Enviar a mi contadora**: manda el PDF del reporte; el mail de la contadora es opcional (Ajustes).
- **Calendario en Google**: link privado (Ajustes) que muestra las sesiones con solo las iniciales. Lo sirve la función `calendario`.
- **Funciones opcionales** (Ajustes, apagadas de entrada): pantalla Recordatorios (quién debe, WhatsApp y marca de enviado por mes), resumen mensual por mail y obras sociales/prepagas (obra social y afiliado del paciente, quién pagó cada pago).
- **Pruebas con usuarias** (`/pruebas`): 13 tareas guiadas con reloj y tiempo por pantalla, más una encuesta. Las cuentas con `profiles.es_admin` ven el tablero en `/pruebas/resultados` (se activa solo por SQL).

### Topes del monotributo (se actualizan solos)
La función de Supabase `actualizar-monotributo` (`supabase/functions/actualizar-monotributo`) lee la tabla de [arca.gob.ar/monotributo/categorias.asp](https://www.arca.gob.ar/monotributo/categorias.asp) **todos los días a las 9** (pg_cron) y la guarda en `monotributo_categorias`. La app lee esa tabla.
- Si ARCA cambia el diseño de la página y no se puede leer, no se pisa nada: queda el error en `monotributo_revisiones` y la app sigue con los últimos valores buenos.
- Para ver cómo viene: `select * from monotributo_revisiones order by fecha desc limit 5;`
- Respaldo en el código (`CATEGORIAS` en `src/lib/monotributo.ts`): se usa solo si la base no responde. Conviene actualizarlo de vez en cuando; el test `src/lib/arca.test.ts` compara el lector con una copia real de la página.

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

### 4. Mails (Gmail)
- Los mails de la app salen desde **honorapp.ar@gmail.com**, con nombre «honorapp».
- Supabase → Authentication → Emails → SMTP Settings: `smtp.gmail.com`, puerto `465`, usuario `honorapp.ar@gmail.com` y como contraseña una **contraseña de aplicación** de Google (myaccount.google.com/apppasswords, requiere verificación en 2 pasos). Si se cambia la contraseña de la cuenta de Gmail, hay que generar una nueva y pegarla ahí.
- Los textos están en `docs/mails/` y cargados en Supabase → Authentication → Emails → Templates.
- Límite: 30 mails por hora (Authentication → Rate Limits). Gmail permite unos 500 por día; si la app crece, pasar a un servicio transaccional (por ejemplo [Resend](https://resend.com)).

### 5. Cuenta de la profesional
Abrir la app → «¿No tenés cuenta? Creá una» (o «Continuar con Google»). Las colegas pueden hacer lo mismo.

### Resumen mensual por mail
La función `aviso-mensual` corre el día 1 a las 9 (pg_cron) y manda a quienes lo prendieron cuánto les deben y cuánto cobraron el mes anterior (cálculo en SQL: `resumen_aviso_mensual`, igual al de la app). Manda desde honorapp.ar@gmail.com y **necesita el secreto `SMTP_PASS`** (contraseña de aplicación de Gmail) en Supabase → Edge Functions → Secrets. Un mail por mes y por cuenta como máximo (`avisos_enviados`).

## Recomendado a futuro
- Ver también `docs/ideas.md` (aumento de honorarios en lote, doble factor, facturación desde la app).
- **Protección contra contraseñas filtradas**: Supabase la ofrece en el plan Pro (Authentication → Attack Protection).
- **Ingreso con Apple**: requiere una cuenta de Apple Developer (USD 99 por año).

## Tests de la base (aislamiento entre cuentas)
`supabase/tests/aislamiento.sql` crea dos cuentas ficticias dentro de una transacción y comprueba que una no pueda ver, cambiar, borrar ni apuntar a nada de la otra (tablas, FK compuestas, funciones, `user_id` inmutable, `es_admin`). Al final deshace todo. Correrlo en Supabase → SQL Editor después de cada cambio en `schema.sql`: tiene que devolver «Aislamiento OK».

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
docs/investigacion/      informes: legal, ARCA, WhatsApp, competencia, dominios, pruebas, textos de presentación
public/                  plantilla de Excel e íconos de la app
```

Reglas del proyecto (para quien siga programando, persona o IA): ver [`CLAUDE.md`](CLAUDE.md).
