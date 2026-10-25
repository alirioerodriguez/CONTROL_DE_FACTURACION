# Respaldo automático diario (sin plan Pro)

El workflow `.github/workflows/respaldo-diario.yml` corre todos los días a las 04:00 (hora de Argentina):

1. Vuelca el esquema `public` de la base (perfiles, pacientes, sesiones, pagos y el resto de las tablas de la app) con `pg_dump`.
2. Lo comprime y lo **cifra con [age](https://age-encryption.org)** usando una clave pública. Sin la clave privada, el archivo no se puede abrir; por eso es seguro aunque el repositorio sea público.
3. Lo guarda 30 días como artefacto del workflow (pestaña **Actions → Respaldo diario → el día que quieras → Artifacts**).

> No incluye las cuentas de ingreso (`auth.users`): sirve para recuperar los datos en el mismo proyecto de Supabase. Para mudar todo a un proyecto nuevo hace falta también migrar las cuentas (ver la documentación de Supabase).

## Configurarlo (una sola vez)

1. Instalá age en tu compu (en Windows: `winget install FiloSottile.age`).
2. Generá tu par de claves y **guardá el archivo en un lugar seguro** (no en el repo, no en la nube sin cifrar):
   ```
   age-keygen -o honorapp-respaldo.key
   ```
   Te muestra la clave pública: empieza con `age1…`.
3. En Supabase: **Project Settings → Database → Connection string → URI**, modo **Session pooler** (puerto 5432). Copiala y reemplazá `[YOUR-PASSWORD]` por la contraseña de la base.
4. En GitHub, en el repo: **Settings → Secrets and variables → Actions → New repository secret**:
   - `SUPABASE_DB_URL`: la cadena del paso 3.
   - `AGE_PUBLIC_KEY`: la clave pública `age1…` del paso 2.
5. Probalo: **Actions → Respaldo diario → Run workflow**. Tiene que terminar en verde y dejar un artefacto.

## Restaurar

1. Bajá el artefacto del día que quieras (viene en un `.zip` con el archivo `honorapp-AAAA-MM-DD.sql.gz.age`).
2. Descifralo y miralo antes de tocar nada:
   ```
   age -d -i honorapp-respaldo.key honorapp-2026-10-25.sql.gz.age | gunzip > respaldo.sql
   ```
3. Para restaurarlo **sobre una base vacía** (o un proyecto nuevo con el `schema.sql` aplicado y sin datos):
   ```
   psql "LA_CADENA_DE_CONEXIÓN" -f respaldo.sql
   ```
   Si es la base en uso, hacelo con alguien al lado: pisar datos no tiene vuelta atrás.

Si perdés la clave privada, los respaldos guardados no se pueden abrir: generá un par nuevo y actualizá `AGE_PUBLIC_KEY`.
