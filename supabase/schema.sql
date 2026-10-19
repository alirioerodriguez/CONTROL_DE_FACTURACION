-- =====================================================================
-- honorapp — esquema completo de la base de datos.
--
-- Este es el ÚNICO archivo de esquema. Es idempotente: se puede correr
-- entero las veces que haga falta en Supabase > SQL Editor.
-- Si el esquema cambia, se actualiza este archivo (no migraciones sueltas).
--
-- Cada usuaria (profesional) ve únicamente sus propios datos (RLS).
-- No se guardan datos clínicos: solo información administrativa.
-- =====================================================================

-- ---------------------------------------------------------------------
-- profiles: ajustes y datos fiscales de cada profesional
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  nombre                text,
  dni                   text,
  cuit                  text,
  condicion_iva         text default 'Monotributo',
  categoria_monotributo text,
  actividad             text,
  domicilio_fiscal      text,
  punto_venta           text,
  matricula             text,
  email                 text,
  telefono              text,
  contadora_nombre      text,
  contadora_email       text,
  tarifa_estandar       numeric(14,2) not null default 0 check (tarifa_estandar >= 0),
  moneda_default        text not null default 'ARS' check (moneda_default in ('ARS','USD')),
  plantilla_whatsapp    text not null default
    'Hola {nombre}, ¿cómo estás? Te escribo para recordarte el pago de {mes}: {monto}. ¡Gracias!',
  tutorial_visto        boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Columnas agregadas después de la primera versión (para bases ya creadas).
alter table public.profiles add column if not exists tutorial_visto boolean not null default false;
-- Profesión y vocabulario: 'sesión' o 'consulta'; tarifa por hora o por sesión/consulta.
alter table public.profiles add column if not exists profesion text;
alter table public.profiles add column if not exists termino text not null default 'sesion';
alter table public.profiles add column if not exists modo_cobro text not null default 'hora';
do $$ begin
  alter table public.profiles add constraint profiles_termino_check check (termino in ('sesion','consulta'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_modo_cobro_check check (modo_cobro in ('hora','sesion'));
exception when duplicate_object then null; end $$;
-- Matrícula profesional (opcional): aparece en el recibo para el paciente.
alter table public.profiles add column if not exists matricula text;
do $$ begin
  alter table public.profiles add constraint profiles_matricula_check check (length(matricula) <= 60);
exception when duplicate_object then null; end $$;
-- Datos de pago para el recordatorio de WhatsApp: alias, CBU o link de Mercado Pago.
alter table public.profiles add column if not exists datos_pago text;
do $$ begin
  alter table public.profiles add constraint profiles_datos_pago_check check (length(datos_pago) <= 300);
exception when duplicate_object then null; end $$;
-- Monotributo: categoría A a K, 'no' si no usa monotributo, null si todavía no eligió.
-- Tipo de cambio para sumar los dólares al control del tope (la app no convierte sola).
alter table public.profiles add column if not exists monotributo_categoria text;
alter table public.profiles add column if not exists tipo_cambio_usd numeric(14,2);
do $$ begin
  alter table public.profiles add constraint profiles_monotributo_check
    check (monotributo_categoria in ('A','B','C','D','E','F','G','H','I','J','K','no'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_tipo_cambio_check check (tipo_cambio_usd > 0);
exception when duplicate_object then null; end $$;

-- Crea el perfil automáticamente cuando alguien se registra
-- (con Google también guarda el nombre).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, nombre)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Solo la usa el trigger: no debe poder llamarse desde la API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- patients
-- tipo_tarifa = 'estandar'      -> usa profiles.tarifa_estandar
-- tipo_tarifa = 'personalizada' -> usa tarifa_personalizada
-- dias_semana: días fijos de sesión (0 = domingo ... 6 = sábado),
-- sirve para generar las sesiones del mes.
-- ---------------------------------------------------------------------
create table if not exists public.patients (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  codigo               text,
  nombre               text not null check (length(trim(nombre)) > 0),
  apellido             text,
  dni                  text,
  cuil_cuit            text,
  condicion_iva        text default 'Consumidor final',
  telefono             text,
  email                text,
  domicilio            text,
  frecuencia           text default 'Semanal',
  dias_semana          smallint[] not null default '{}',
  horas_por_sesion     numeric(4,2) not null default 1 check (horas_por_sesion > 0),
  tipo_tarifa          text not null default 'estandar' check (tipo_tarifa in ('estandar','personalizada')),
  tarifa_personalizada numeric(14,2) check (tarifa_personalizada >= 0),
  moneda               text not null default 'ARS' check (moneda in ('ARS','USD')),
  fecha_alta           date not null default (now() at time zone 'America/Argentina/Buenos_Aires')::date,
  activo               boolean not null default true,
  notas_admin          text check (length(notas_admin) <= 500),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint patients_tarifa_personalizada_requerida
    check (tipo_tarifa = 'estandar' or tarifa_personalizada is not null),
  constraint patients_id_user_unique unique (id, user_id)
);

create unique index if not exists patients_user_codigo_idx
  on public.patients (user_id, codigo) where codigo is not null;
create index if not exists patients_user_idx on public.patients (user_id, activo);

-- ---------------------------------------------------------------------
-- sessions
-- tarifa_hora se guarda al cargar la sesión: si después cambia la
-- tarifa, las sesiones viejas conservan su precio.
-- ---------------------------------------------------------------------
create table if not exists public.sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  patient_id    uuid not null,
  fecha         date not null,
  horas         numeric(4,2) not null default 1 check (horas > 0),
  tarifa_hora   numeric(14,2) not null check (tarifa_hora >= 0),
  monto         numeric(14,2) generated always as (round(horas * tarifa_hora, 2)) stored,
  moneda        text not null check (moneda in ('ARS','USD')),
  observaciones text check (length(observaciones) <= 500),
  created_at    timestamptz not null default now(),
  constraint sessions_patient_fk foreign key (patient_id, user_id)
    references public.patients (id, user_id) on delete cascade
);

-- Estado guardado: 'normal' (la app la muestra como programada si la fecha es futura y realizada si ya
-- pasó), 'ausente' (el paciente faltó: se cobra) o 'cancelada' (no se cobra).
alter table public.sessions add column if not exists estado text not null default 'normal';
do $$ begin
  alter table public.sessions add constraint sessions_estado_check check (estado in ('normal','ausente','cancelada'));
exception when duplicate_object then null; end $$;

create index if not exists sessions_user_fecha_idx on public.sessions (user_id, fecha);
create index if not exists sessions_patient_idx on public.sessions (patient_id, fecha);
create index if not exists sessions_patient_user_idx on public.sessions (patient_id, user_id);

-- ---------------------------------------------------------------------
-- payments
-- periodo = mes al que se imputa el pago (siempre día 1 del mes).
-- ---------------------------------------------------------------------
create table if not exists public.payments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  patient_id    uuid not null,
  fecha         date not null,
  periodo       date not null check (extract(day from periodo) = 1),
  monto         numeric(14,2) not null check (monto > 0),
  moneda        text not null check (moneda in ('ARS','USD')),
  medio         text not null default 'transferencia'
                check (medio in ('efectivo','transferencia','mercadopago','otro')),
  comprobante   text not null default 'sin_comprobante'
                check (comprobante in ('factura_c','recibo','sin_comprobante')),
  punto_venta   text,
  nro_factura   text,
  session_id    uuid references public.sessions (id) on delete set null,
  observaciones text check (length(observaciones) <= 500),
  created_at    timestamptz not null default now(),
  constraint payments_patient_fk foreign key (patient_id, user_id)
    references public.patients (id, user_id) on delete cascade
);

create index if not exists payments_user_fecha_idx on public.payments (user_id, fecha);
create index if not exists payments_user_periodo_idx on public.payments (user_id, periodo);
create index if not exists payments_patient_idx on public.payments (patient_id, periodo);
create index if not exists payments_patient_user_idx on public.payments (patient_id, user_id);
create index if not exists payments_session_idx on public.payments (session_id);

-- ---------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists patients_updated_at on public.patients;
create trigger patients_updated_at before update on public.patients
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security: cada usuaria solo ve y toca lo suyo
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.sessions enable row level security;
alter table public.payments enable row level security;

drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_update on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists patients_all on public.patients;
create policy patients_all on public.patients
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists sessions_all on public.sessions;
create policy sessions_all on public.sessions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists payments_all on public.payments;
create policy payments_all on public.payments
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Importación "todo o nada": pacientes, sesiones y pagos en una sola
-- transacción. Corre con los permisos de quien llama (RLS aplica igual).
-- Los pacientes y sesiones nuevos traen una "ref" para enlazarse entre sí.
-- ---------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- Importaciones: cada importación queda registrada y lo que trajo se puede
-- deshacer durante 7 días (deshacer_importacion).
-- ---------------------------------------------------------------------------
create table if not exists public.importaciones (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pacientes   integer not null default 0,
  sesiones    integer not null default 0,
  pagos       integer not null default 0,
  deshecha    boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (id, user_id)
);
create index if not exists importaciones_user_idx on public.importaciones (user_id, created_at desc);
alter table public.importaciones enable row level security;
drop policy if exists "importaciones propias" on public.importaciones;
create policy "importaciones propias" on public.importaciones
  for select to authenticated using (user_id = (select auth.uid()));
-- Se crean y se deshacen solo con las funciones de abajo.
revoke insert, update, delete on public.importaciones from authenticated, anon;

alter table public.patients add column if not exists importacion_id uuid;
alter table public.sessions add column if not exists importacion_id uuid;
alter table public.payments add column if not exists importacion_id uuid;
do $$ begin
  alter table public.patients add constraint patients_importacion_fk foreign key (importacion_id, user_id)
    references public.importaciones (id, user_id) on delete set null (importacion_id);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.sessions add constraint sessions_importacion_fk foreign key (importacion_id, user_id)
    references public.importaciones (id, user_id) on delete set null (importacion_id);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.payments add constraint payments_importacion_fk foreign key (importacion_id, user_id)
    references public.importaciones (id, user_id) on delete set null (importacion_id);
exception when duplicate_object then null; end $$;
create index if not exists patients_importacion_idx on public.patients (importacion_id) where importacion_id is not null;
create index if not exists sessions_importacion_idx on public.sessions (importacion_id) where importacion_id is not null;
create index if not exists payments_importacion_idx on public.payments (importacion_id) where importacion_id is not null;

create or replace function public.importar_datos(p_pacientes jsonb, p_sesiones jsonb, p_pagos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb;
  nuevo uuid;
  imp uuid;
  yo uuid := auth.uid();
  refs_pac jsonb := '{}'::jsonb;
  refs_ses jsonb := '{}'::jsonb;
  n_pac int := 0;
  n_ses int := 0;
  n_pag int := 0;
begin
  if yo is null then
    raise exception 'Sin sesión';
  end if;
  insert into public.importaciones (user_id) values (yo) returning id into imp;

  for r in select * from jsonb_array_elements(coalesce(p_pacientes, '[]'::jsonb)) loop
    insert into public.patients (
      user_id, importacion_id,
      codigo, nombre, apellido, dni, cuil_cuit, condicion_iva, telefono, email, domicilio, frecuencia,
      tipo_tarifa, tarifa_personalizada, moneda, fecha_alta, activo, notas_admin
    ) values (
      yo, imp,
      nullif(r->>'codigo', ''), r->>'nombre', nullif(r->>'apellido', ''), nullif(r->>'dni', ''),
      nullif(r->>'cuil_cuit', ''), nullif(r->>'condicion_iva', ''), nullif(r->>'telefono', ''),
      nullif(r->>'email', ''), nullif(r->>'domicilio', ''), nullif(r->>'frecuencia', ''),
      coalesce(r->>'tipo_tarifa', 'estandar'), (r->>'tarifa_personalizada')::numeric,
      coalesce(r->>'moneda', 'ARS'),
      coalesce((r->>'fecha_alta')::date, (now() at time zone 'America/Argentina/Buenos_Aires')::date),
      coalesce((r->>'activo')::boolean, true), nullif(r->>'notas_admin', '')
    )
    returning id into nuevo;
    refs_pac := refs_pac || jsonb_build_object(r->>'ref', nuevo);
    n_pac := n_pac + 1;
  end loop;

  -- Los pacientes existentes se validan con la FK compuesta (patient_id, user_id): no se puede apuntar a uno ajeno.
  for r in select * from jsonb_array_elements(coalesce(p_sesiones, '[]'::jsonb)) loop
    insert into public.sessions (user_id, importacion_id, patient_id, fecha, horas, tarifa_hora, moneda, observaciones, estado)
    values (
      yo, imp,
      coalesce((r->>'patient_id')::uuid, (refs_pac->>(r->>'paciente_ref'))::uuid),
      (r->>'fecha')::date, coalesce((r->>'horas')::numeric, 1), (r->>'tarifa_hora')::numeric,
      r->>'moneda', nullif(r->>'observaciones', ''), coalesce(nullif(r->>'estado', ''), 'normal')
    )
    returning id into nuevo;
    if r->>'ref' is not null then
      refs_ses := refs_ses || jsonb_build_object(r->>'ref', nuevo);
    end if;
    n_ses := n_ses + 1;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_pagos, '[]'::jsonb)) loop
    insert into public.payments (
      user_id, importacion_id,
      patient_id, fecha, periodo, monto, moneda, medio, comprobante, punto_venta, nro_factura, session_id, observaciones
    ) values (
      yo, imp,
      coalesce((r->>'patient_id')::uuid, (refs_pac->>(r->>'paciente_ref'))::uuid),
      (r->>'fecha')::date, (r->>'periodo')::date, (r->>'monto')::numeric, r->>'moneda',
      coalesce(r->>'medio', 'transferencia'), coalesce(r->>'comprobante', 'sin_comprobante'),
      nullif(r->>'punto_venta', ''), nullif(r->>'nro_factura', ''),
      (refs_ses->>(r->>'sesion_ref'))::uuid, nullif(r->>'observaciones', '')
    );
    n_pag := n_pag + 1;
  end loop;

  update public.importaciones set pacientes = n_pac, sesiones = n_ses, pagos = n_pag where id = imp;
  return jsonb_build_object('importacion', imp, 'pacientes', n_pac, 'sesiones', n_ses, 'pagos', n_pag);
end;
$$;

revoke execute on function public.importar_datos(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.importar_datos(jsonb, jsonb, jsonb) to authenticated;

-- Borra lo que trajo una importación propia de los últimos 7 días. Los pacientes creados por la
-- importación se borran con todo lo que tengan (también lo cargado después a mano).
create or replace function public.deshacer_importacion(p_importacion uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := auth.uid();
  imp public.importaciones;
  n_pag int;
  n_ses int;
  n_pac int;
begin
  select * into imp from public.importaciones
  where id = p_importacion and user_id = yo
  for update;
  if not found then
    raise exception 'No encontré esa importación.';
  end if;
  if imp.deshecha then
    raise exception 'Esa importación ya se deshizo.';
  end if;
  if imp.created_at < now() - interval '7 days' then
    raise exception 'Pasaron más de 7 días: ya no se puede deshacer.';
  end if;

  delete from public.payments where importacion_id = imp.id and user_id = yo;
  get diagnostics n_pag = row_count;
  delete from public.sessions where importacion_id = imp.id and user_id = yo;
  get diagnostics n_ses = row_count;
  delete from public.patients where importacion_id = imp.id and user_id = yo;
  get diagnostics n_pac = row_count;

  update public.importaciones set deshecha = true where id = imp.id;
  return jsonb_build_object('pacientes', n_pac, 'sesiones', n_ses, 'pagos', n_pag);
end;
$$;

revoke execute on function public.deshacer_importacion(uuid) from public, anon;
grant execute on function public.deshacer_importacion(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Eliminar mi cuenta: borra el usuario de auth y, en cascada, perfil,
-- pacientes, sesiones y pagos. Solo puede borrar la cuenta de quien la llama.
-- ---------------------------------------------------------------------------
create or replace function public.eliminar_mi_cuenta()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sin sesión';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.eliminar_mi_cuenta() from public, anon;
grant execute on function public.eliminar_mi_cuenta() to authenticated;

-- ---------------------------------------------------------------------------
-- Pruebas con usuarias (/pruebas): una fila por persona con sus ejercicios,
-- tiempos por pantalla y la encuesta. Cada una ve y escribe solo la suya;
-- las cuentas con profiles.es_admin ven todas con resultados_pruebas().
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists es_admin boolean not null default false;

-- Nadie se da permisos de admin desde la app: solo se cambia por SQL (sin sesión de usuaria).
create or replace function public.proteger_es_admin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      new.es_admin := false;
    else
      new.es_admin := old.es_admin;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_proteger_es_admin on public.profiles;
create trigger profiles_proteger_es_admin before insert or update on public.profiles
  for each row execute function public.proteger_es_admin();

create table if not exists public.pruebas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade unique,
  nombre      text,
  dispositivo text,
  ancho       integer,
  letra       integer,
  ejercicios  jsonb not null default '{}'::jsonb,
  encuesta    jsonb,
  terminado   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.pruebas enable row level security;

drop policy if exists "pruebas propias" on public.pruebas;
create policy "pruebas propias" on public.pruebas
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop trigger if exists pruebas_updated_at on public.pruebas;
create trigger pruebas_updated_at before update on public.pruebas
  for each row execute function public.set_updated_at();

create or replace function public.resultados_pruebas()
returns setof public.pruebas
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and es_admin) then
    raise exception 'Solo para administradores';
  end if;
  return query select * from public.pruebas order by created_at;
end;
$$;

revoke execute on function public.resultados_pruebas() from public, anon;
grant execute on function public.resultados_pruebas() to authenticated;

-- ---------------------------------------------------------------------------
-- Topes del monotributo. Los actualiza solos la función actualizar-monotributo
-- (lee arca.gob.ar todos los días, ver más abajo). Todas las cuentas los leen;
-- nadie los escribe desde la app.
-- ---------------------------------------------------------------------------
create table if not exists public.monotributo_categorias (
  letra       text primary key check (letra ~ '^[A-K]$'),
  tope        numeric(16,2) not null check (tope > 0),
  cuota       numeric(14,2) not null check (cuota > 0),
  vigencia    date not null,
  actualizado timestamptz not null default now()
);

alter table public.monotributo_categorias enable row level security;
drop policy if exists "todas leen los topes" on public.monotributo_categorias;
create policy "todas leen los topes" on public.monotributo_categorias
  for select to authenticated using (true);

-- Cada revisión de la página de ARCA: si salió bien, con qué vigencia, o qué falló.
create table if not exists public.monotributo_revisiones (
  id        bigint generated always as identity primary key,
  fecha     timestamptz not null default now(),
  ok        boolean not null,
  vigencia  date,
  cambio    boolean not null default false,
  mensaje   text
);
alter table public.monotributo_revisiones enable row level security;

-- Valores iniciales (ARCA, desde el 1/08/2026). Solo se cargan si la tabla está vacía.
insert into public.monotributo_categorias (letra, tope, cuota, vigencia)
select * from (values
  ('A', 12009410.45, 49527.18, date '2026-08-01'),
  ('B', 17595182.74, 56379.08, date '2026-08-01'),
  ('C', 24670494.31, 66020.12, date '2026-08-01'),
  ('D', 30628651.43, 84612.93, date '2026-08-01'),
  ('E', 36028231.33, 119811.45, date '2026-08-01'),
  ('F', 45151659.41, 150784.21, date '2026-08-01'),
  ('G', 53995798.87, 230312.94, date '2026-08-01'),
  ('H', 81924660.37, 522706.68, date '2026-08-01'),
  ('I', 91699761.90, 963747.86, date '2026-08-01'),
  ('J', 105012519.20, 1167299.76, date '2026-08-01'),
  ('K', 126610838.75, 1614446.04, date '2026-08-01')
) as v(letra, tope, cuota, vigencia)
where not exists (select 1 from public.monotributo_categorias);

-- Revisión diaria de ARCA a las 9 (hora argentina = 12 UTC) con pg_cron + pg_net.
create extension if not exists pg_cron;
create extension if not exists pg_net schema extensions;
select cron.unschedule('actualizar-monotributo')
where exists (select 1 from cron.job where jobname = 'actualizar-monotributo');
select cron.schedule(
  'actualizar-monotributo',
  '0 12 * * *',
  $$select net.http_post(
      url := 'https://uxcpfnupwetwtpqhoqvd.supabase.co/functions/v1/actualizar-monotributo',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    )$$
);

-- ---------------------------------------------------------------------------
-- El dueño de un dato no cambia nunca (además de lo que ya impide RLS).
-- ---------------------------------------------------------------------------
-- Recordatorios del mes (pantalla opcional, se activa en Ajustes).
-- Guarda a quién ya se le mandó el recordatorio de cada mes.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists ver_recordatorios boolean not null default false;

create table if not exists public.recordatorios (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  patient_id  uuid not null,
  periodo     date not null check (extract(day from periodo) = 1),
  enviado_en  timestamptz not null default now(),
  primary key (user_id, patient_id, periodo),
  foreign key (patient_id, user_id) references public.patients (id, user_id) on delete cascade
);
create index if not exists recordatorios_patient_idx on public.recordatorios (patient_id, user_id);
alter table public.recordatorios enable row level security;
drop policy if exists "recordatorios propios" on public.recordatorios;
create policy "recordatorios propios" on public.recordatorios
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Abono mensual fijo: si tiene, se cobra ese monto en cada mes con sesiones (ver src/lib/abono.ts).
-- ---------------------------------------------------------------------------
alter table public.patients add column if not exists abono_mensual numeric(14,2)
  check (abono_mensual is null or abono_mensual >= 0);

-- ---------------------------------------------------------------------------
-- Calendario privado (.ics) para suscribirse desde Google Calendar: función supabase/functions/calendario.
-- El token es el «secreto» del link; null = apagado. Se cambia desde Ajustes.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists calendario_token uuid;
create unique index if not exists profiles_calendario_token_idx on public.profiles (calendario_token)
  where calendario_token is not null;

-- ---------------------------------------------------------------------------
-- Mail mensual a la profesional (opcional, se prende en Ajustes): el día 1 de cada mes le llega
-- cuánto le deben y cuánto cobró el mes anterior. Lo manda la función supabase/functions/aviso-mensual
-- desde honorapp.ar@gmail.com (necesita el secreto SMTP_PASS en las funciones de Supabase).
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists aviso_mensual boolean not null default false;

-- Un mail por mes y por usuaria como máximo, aunque la función se llame varias veces.
create table if not exists public.avisos_enviados (
  user_id  uuid not null references auth.users (id) on delete cascade,
  periodo  date not null,
  enviado  timestamptz not null default now(),
  primary key (user_id, periodo)
);
alter table public.avisos_enviados enable row level security;
-- Sin políticas: solo la función (service_role) la usa.

-- Lo que debe cada paciente hoy, con la misma regla que la app (src/lib/estados.ts, saldos.ts y abono.ts):
-- cuentan las sesiones realizadas y ausentes hasta hoy; con abono, el mes vale el abono repartido entre
-- sus sesiones no canceladas. Devuelve una fila por usuaria con el aviso prendido.
create or replace function public.resumen_aviso_mensual(p_hoy date)
returns table (
  user_id uuid, email text, nombre text, termino text,
  deuda_ars numeric, deuda_usd numeric, pacientes_deben integer,
  cobrado_ars numeric, cobrado_usd numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with ses as (
    select s.user_id, s.patient_id, s.moneda, s.monto, s.fecha, s.estado,
           p.abono_mensual, p.moneda as moneda_paciente,
           (s.estado <> 'cancelada' and s.fecha <= p_hoy) as cobrable,
           date_trunc('month', s.fecha)::date as mes
    from public.sessions s
    join public.patients p on p.id = s.patient_id and p.user_id = s.user_id
    join public.profiles pr on pr.id = s.user_id and pr.aviso_mensual
    where s.estado <> 'cancelada'
  ),
  cargos as (
    -- Sin abono (o en otra moneda): el monto de cada sesión cobrable.
    select user_id, patient_id, moneda, sum(monto) as cargo
    from ses
    where cobrable and not (coalesce(abono_mensual, 0) > 0 and moneda = moneda_paciente)
    group by 1, 2, 3
    union all
    -- Con abono: por mes, la parte del abono de las sesiones que ya pasaron (la última se lleva el resto).
    select user_id, patient_id, moneda,
           case when count(*) filter (where cobrable) = count(*) then max(abono_mensual)
                else count(*) filter (where cobrable) * floor(max(abono_mensual) * 100 / count(*)) / 100 end
    from ses
    where coalesce(abono_mensual, 0) > 0 and moneda = moneda_paciente
    group by user_id, patient_id, moneda, mes
  ),
  saldos as (
    select c.user_id, c.patient_id, c.moneda,
           sum(c.cargo) - coalesce((select sum(g.monto) from public.payments g
                                     where g.patient_id = c.patient_id and g.user_id = c.user_id and g.moneda = c.moneda), 0) as saldo
    from cargos c
    group by 1, 2, 3
  ),
  deudas as (
    select user_id,
           sum(greatest(saldo, 0)) filter (where moneda = 'ARS') as ars,
           sum(greatest(saldo, 0)) filter (where moneda = 'USD') as usd,
           count(distinct patient_id) filter (where saldo > 0) as deben
    from saldos group by 1
  ),
  cobros as (
    select g.user_id,
           sum(g.monto) filter (where g.moneda = 'ARS') as ars,
           sum(g.monto) filter (where g.moneda = 'USD') as usd
    from public.payments g
    where g.fecha >= (date_trunc('month', p_hoy) - interval '1 month')::date
      and g.fecha < date_trunc('month', p_hoy)::date
    group by 1
  )
  -- Siempre el mail verificado de la cuenta (profiles.email lo puede editar la usuaria).
  select pr.id, u.email::text, pr.nombre, pr.termino,
         coalesce(d.ars, 0), coalesce(d.usd, 0), coalesce(d.deben, 0)::integer,
         coalesce(c.ars, 0), coalesce(c.usd, 0)
  from public.profiles pr
  join auth.users u on u.id = pr.id
  left join deudas d on d.user_id = pr.id
  left join cobros c on c.user_id = pr.id
  where pr.aviso_mensual;
$$;
revoke all on function public.resumen_aviso_mensual(date) from public, anon, authenticated;
grant execute on function public.resumen_aviso_mensual(date) to service_role;

select cron.unschedule('aviso-mensual')
where exists (select 1 from cron.job where jobname = 'aviso-mensual');
select cron.schedule(
  'aviso-mensual',
  '0 12 1 * *',
  $$select net.http_post(
      url := 'https://uxcpfnupwetwtpqhoqvd.supabase.co/functions/v1/aviso-mensual',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    )$$
);

-- ---------------------------------------------------------------------------
-- Obras sociales y prepagas (opcional, se prende en Ajustes): datos del paciente y quién pagó cada pago.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists usa_obras_sociales boolean not null default false;
alter table public.patients add column if not exists obra_social text
  check (obra_social is null or char_length(obra_social) <= 80);
alter table public.patients add column if not exists nro_afiliado text
  check (nro_afiliado is null or char_length(nro_afiliado) <= 40);
alter table public.payments add column if not exists pagador text not null default 'paciente'
  check (pagador in ('paciente', 'obra_social'));

-- ---------------------------------------------------------------------------
-- Límites de largo en todos los textos libres (evita que alguien llene la base con textos gigantes).
-- Son amplios: ningún uso normal llega. Se agregan solo si no existen.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('patients', 'nombre', 'char_length(nombre) <= 120'),
      ('patients', 'apellido', 'char_length(apellido) <= 120'),
      ('patients', 'codigo', 'char_length(codigo) <= 30'),
      ('patients', 'condicion_iva', 'char_length(condicion_iva) <= 60'),
      ('patients', 'cuil_cuit', 'char_length(cuil_cuit) <= 20'),
      ('patients', 'dni', 'char_length(dni) <= 20'),
      ('patients', 'domicilio', 'char_length(domicilio) <= 200'),
      ('patients', 'email', 'char_length(email) <= 200'),
      ('patients', 'frecuencia', 'char_length(frecuencia) <= 40'),
      ('patients', 'telefono', 'char_length(telefono) <= 40'),
      ('patients', 'dias_semana', 'cardinality(dias_semana) <= 7'),
      ('payments', 'nro_factura', 'char_length(nro_factura) <= 40'),
      ('payments', 'punto_venta', 'char_length(punto_venta) <= 10'),
      ('profiles', 'nombre', 'char_length(nombre) <= 120'),
      ('profiles', 'email', 'char_length(email) <= 320'),
      ('profiles', 'telefono', 'char_length(telefono) <= 40'),
      ('profiles', 'dni', 'char_length(dni) <= 20'),
      ('profiles', 'cuit', 'char_length(cuit) <= 20'),
      ('profiles', 'condicion_iva', 'char_length(condicion_iva) <= 60'),
      ('profiles', 'categoria_monotributo', 'char_length(categoria_monotributo) <= 10'),
      ('profiles', 'actividad', 'char_length(actividad) <= 120'),
      ('profiles', 'domicilio_fiscal', 'char_length(domicilio_fiscal) <= 200'),
      ('profiles', 'punto_venta', 'char_length(punto_venta) <= 10'),
      ('profiles', 'contadora_nombre', 'char_length(contadora_nombre) <= 120'),
      ('profiles', 'contadora_email', 'char_length(contadora_email) <= 200'),
      ('profiles', 'plantilla_whatsapp', 'char_length(plantilla_whatsapp) <= 1000'),
      ('profiles', 'profesion', 'char_length(profesion) <= 80'),
      ('pruebas', 'nombre', 'char_length(nombre) <= 120'),
      ('pruebas', 'dispositivo', 'char_length(dispositivo) <= 300'),
      ('pruebas', 'ejercicios', 'pg_column_size(ejercicios) <= 100000'),
      ('pruebas', 'encuesta', 'pg_column_size(encuesta) <= 20000')
    ) as v(tabla, columna, regla)
  loop
    if not exists (select 1 from pg_constraint where conname = r.tabla || '_' || r.columna || '_largo') then
      execute format('alter table public.%I add constraint %I check (%s)', r.tabla, r.tabla || '_' || r.columna || '_largo', r.regla);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Topes de sentido común: fechas entre 2000 y 2100 (atrapa errores de tipeo como 20026) y hasta 24 horas.
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select * from (values
      ('sessions', 'sessions_fecha_rango', 'fecha between ''2000-01-01'' and ''2100-12-31'''),
      ('sessions', 'sessions_horas_tope', 'horas <= 24'),
      ('payments', 'payments_fecha_rango', 'fecha between ''2000-01-01'' and ''2100-12-31'''),
      ('payments', 'payments_periodo_rango', 'periodo between ''2000-01-01'' and ''2100-12-01'''),
      ('patients', 'patients_alta_rango', 'fecha_alta between ''2000-01-01'' and ''2100-12-31'''),
      ('patients', 'patients_horas_tope', 'horas_por_sesion <= 24')
    ) as v(tabla, nombre, regla)
  loop
    if not exists (select 1 from pg_constraint where conname = r.nombre) then
      execute format('alter table public.%I add constraint %I check (%s)', r.tabla, r.nombre, r.regla);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
create or replace function public.user_id_inmutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'No se puede cambiar el dueño de un dato.';
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['patients', 'sessions', 'payments', 'pruebas', 'importaciones', 'recordatorios'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_user_id_inmutable', t);
    execute format(
      'create trigger %I before update of user_id on public.%I for each row execute function public.user_id_inmutable()',
      t || '_user_id_inmutable', t
    );
  end loop;
end $$;

-- Perfiles para usuarias que ya existían antes de correr este script.
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;
