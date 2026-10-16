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
create or replace function public.importar_datos(p_pacientes jsonb, p_sesiones jsonb, p_pagos jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r jsonb;
  nuevo uuid;
  refs_pac jsonb := '{}'::jsonb;
  refs_ses jsonb := '{}'::jsonb;
  n_pac int := 0;
  n_ses int := 0;
  n_pag int := 0;
begin
  for r in select * from jsonb_array_elements(coalesce(p_pacientes, '[]'::jsonb)) loop
    insert into public.patients (
      codigo, nombre, apellido, dni, cuil_cuit, condicion_iva, telefono, email, domicilio, frecuencia,
      tipo_tarifa, tarifa_personalizada, moneda, fecha_alta, activo, notas_admin
    ) values (
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

  for r in select * from jsonb_array_elements(coalesce(p_sesiones, '[]'::jsonb)) loop
    insert into public.sessions (patient_id, fecha, horas, tarifa_hora, moneda, observaciones)
    values (
      coalesce((r->>'patient_id')::uuid, (refs_pac->>(r->>'paciente_ref'))::uuid),
      (r->>'fecha')::date, coalesce((r->>'horas')::numeric, 1), (r->>'tarifa_hora')::numeric,
      r->>'moneda', nullif(r->>'observaciones', '')
    )
    returning id into nuevo;
    if r->>'ref' is not null then
      refs_ses := refs_ses || jsonb_build_object(r->>'ref', nuevo);
    end if;
    n_ses := n_ses + 1;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_pagos, '[]'::jsonb)) loop
    insert into public.payments (
      patient_id, fecha, periodo, monto, moneda, medio, comprobante, punto_venta, nro_factura, session_id, observaciones
    ) values (
      coalesce((r->>'patient_id')::uuid, (refs_pac->>(r->>'paciente_ref'))::uuid),
      (r->>'fecha')::date, (r->>'periodo')::date, (r->>'monto')::numeric, r->>'moneda',
      coalesce(r->>'medio', 'transferencia'), coalesce(r->>'comprobante', 'sin_comprobante'),
      nullif(r->>'punto_venta', ''), nullif(r->>'nro_factura', ''),
      (refs_ses->>(r->>'sesion_ref'))::uuid, nullif(r->>'observaciones', '')
    );
    n_pag := n_pag + 1;
  end loop;

  return jsonb_build_object('pacientes', n_pac, 'sesiones', n_ses, 'pagos', n_pag);
end;
$$;

revoke execute on function public.importar_datos(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.importar_datos(jsonb, jsonb, jsonb) to authenticated;

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

-- Perfiles para usuarias que ya existían antes de correr este script.
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;
