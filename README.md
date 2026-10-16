# Consultorio

Control de cobros para psicólogas: pacientes, sesiones, pagos y reporte mensual para la contadora. Pesos y dólares por separado. No guarda datos clínicos.

## Puesta en marcha (una sola vez)

### 1. Crear el proyecto en Supabase
1. Entrá a [supabase.com](https://supabase.com), creá una cuenta y un proyecto nuevo (región: São Paulo es la más cercana).
2. Guardá la contraseña de la base en un lugar seguro.

### 2. Crear las tablas
1. En el proyecto: **SQL Editor → New query**.
2. Pegá todo el contenido de [`supabase/schema.sql`](supabase/schema.sql) y tocá **Run**.
3. Se puede volver a correr cuando el archivo cambie: no borra datos.

### 3. Configurar el login
En **Authentication → URL Configuration**:
- **Site URL**: la dirección de Vercel (la actual es `https://control-de-facturacion-eight.vercel.app`).
- **Redirect URLs**: agregá esa misma dirección y `http://localhost:5173` (para desarrollo).

Esto hace que funcionen los links de "confirmar mail" y "recuperar contraseña".

### 4. Cargar las variables en Vercel
1. En Supabase: **Project Settings → API**. Copiá **Project URL** y la clave **anon public**. (La `service_role` no se usa nunca en la app.)
2. En Vercel: importá el repo `CONTROL_DE_FACTURACION` (framework: Vite).
3. **Settings → Environment Variables**, agregá:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon public
4. **Deployments → Redeploy** para que tome las variables.

### 5. Ingreso con Google (ya configurado)
- Google Cloud, proyecto **Consultorio** → Google Auth Platform: app **en producción**, cliente web "Consultorio web".
  - Orígenes autorizados: la dirección de Vercel y `http://localhost:5173`.
  - Redirección autorizada: `https://uxcpfnupwetwtpqhoqvd.supabase.co/auth/v1/callback`.
- Supabase → Authentication → Sign In / Providers → Google: activado, con el Client ID y el Client Secret de ese cliente.
- Si cambia la dirección de la app, actualizala en los dos lados (orígenes en Google; Site URL y Redirect URLs en Supabase).
- Las páginas `/privacidad` y `/terminos` son públicas: Google las pide para mantener la app publicada.

### 6. Crear la cuenta de ella
Abrí la app, tocá **"¿No tenés cuenta? Creá una"** y registrate con su mail. Le llega un mail para confirmar. Sus colegas pueden hacer lo mismo: cada cuenta ve solo sus datos.

## Desarrollo local

```bash
npm install
cp .env.example .env   # completar con los datos de Supabase
npm run dev
```

- `npm test`: tests (formato argentino, saldos).
- `npm run build`: compila para producción.
- `npm run lint`: revisa el código.

## Estructura

```
supabase/schema.sql   esquema completo (tablas, RLS, índices)
src/lib/              formato argentino, saldos, cliente de Supabase
src/features/         una carpeta por pantalla
src/components/       piezas de UI compartidas
docs/                 plantilla de Excel y referencias de diseño
```
