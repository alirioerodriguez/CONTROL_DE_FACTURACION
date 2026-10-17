-- Tests de aislamiento entre cuentas (RLS, FK compuestas, funciones y user_id inmutable).
-- Crea dos cuentas ficticias (A y B) dentro de una transacción y al final la deshace: no deja nada.
-- Cómo correrlo: pegarlo en Supabase → SQL Editor y ejecutarlo. Si algo falla, corta con el error
-- que explica qué se pudo hacer de más; si todo está bien, devuelve «Aislamiento OK».

begin;

-- Cuentas ficticias (el trigger handle_new_user les crea el perfil).
insert into auth.users (id, email, aud, role, raw_user_meta_data)
values
  ('00000000-0000-4000-a000-00000000000a', 'a@aislamiento.test', 'authenticated', 'authenticated', '{}'),
  ('00000000-0000-4000-a000-00000000000b', 'b@aislamiento.test', 'authenticated', 'authenticated', '{}');

-- Datos de A.
insert into public.patients (id, user_id, nombre)
values ('00000000-0000-4000-b000-00000000000a', '00000000-0000-4000-a000-00000000000a', 'Paciente de A');
insert into public.sessions (user_id, patient_id, fecha, tarifa_hora, moneda)
values ('00000000-0000-4000-a000-00000000000a', '00000000-0000-4000-b000-00000000000a', '2026-10-01', 1000, 'ARS');
insert into public.payments (user_id, patient_id, fecha, periodo, monto, moneda)
values ('00000000-0000-4000-a000-00000000000a', '00000000-0000-4000-b000-00000000000a', '2026-10-02', '2026-10-01', 1000, 'ARS');
insert into public.pruebas (user_id, nombre) values ('00000000-0000-4000-a000-00000000000a', 'Prueba de A');
insert into public.importaciones (id, user_id)
values ('00000000-0000-4000-c000-00000000000a', '00000000-0000-4000-a000-00000000000a');
insert into public.recordatorios (user_id, patient_id, periodo)
values ('00000000-0000-4000-a000-00000000000a', '00000000-0000-4000-b000-00000000000a', '2026-10-01');
insert into public.avisos_enviados (user_id, periodo) values ('00000000-0000-4000-a000-00000000000a', '2026-10-01');
update public.profiles set calendario_token = '00000000-0000-4000-d000-00000000000a' where id = '00000000-0000-4000-a000-00000000000a';

-- ===================== Como B =====================
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-a000-00000000000b", "role": "authenticated"}';

do $$
declare
  n int;
  a_pac constant uuid := '00000000-0000-4000-b000-00000000000a';
begin
  -- Lectura: B no ve nada de A; de perfiles, solo el suyo.
  if (select count(*) from public.patients) <> 0 then raise exception 'B ve pacientes de A'; end if;
  if (select count(*) from public.sessions) <> 0 then raise exception 'B ve sesiones de A'; end if;
  if (select count(*) from public.payments) <> 0 then raise exception 'B ve pagos de A'; end if;
  if (select count(*) from public.pruebas) <> 0 then raise exception 'B ve la prueba de A'; end if;
  if (select count(*) from public.importaciones) <> 0 then raise exception 'B ve importaciones de A'; end if;
  if (select count(*) from public.profiles) <> 1 then raise exception 'B ve perfiles ajenos'; end if;
  if (select count(*) from public.monotributo_revisiones) <> 0 then raise exception 'B ve las revisiones de ARCA'; end if;
  if (select count(*) from public.recordatorios) <> 0 then raise exception 'B ve recordatorios de A'; end if;
  if (select count(*) from public.avisos_enviados) <> 0 then raise exception 'B ve los avisos mandados'; end if;
  if exists (select 1 from public.profiles where calendario_token is not null) then raise exception 'B ve el link del calendario de A'; end if;

  -- Escritura sobre filas de A: no afecta nada.
  update public.patients set nombre = 'cambiado' where id = a_pac;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'B pudo cambiar un paciente de A'; end if;
  delete from public.payments where patient_id = a_pac;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'B pudo borrar pagos de A'; end if;
  delete from public.sessions where patient_id = a_pac;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'B pudo borrar sesiones de A'; end if;

  -- Insertar apuntando a un paciente de A: lo frena la FK compuesta (patient_id, user_id).
  begin
    insert into public.sessions (patient_id, fecha, tarifa_hora, moneda) values (a_pac, '2026-10-03', 1, 'ARS');
    raise exception 'FALLA: B pudo cargar una sesión a un paciente de A';
  exception when others then
    if sqlerrm like 'FALLA:%' then raise; end if;
  end;
  begin
    insert into public.payments (patient_id, fecha, periodo, monto, moneda) values (a_pac, '2026-10-03', '2026-10-01', 1, 'ARS');
    raise exception 'FALLA: B pudo cargar un pago a un paciente de A';
  exception when others then
    if sqlerrm like 'FALLA:%' then raise; end if;
  end;

  begin
    insert into public.recordatorios (patient_id, periodo) values (a_pac, '2026-11-01');
    raise exception 'FALLA: B pudo marcar un recordatorio de un paciente de A';
  exception when others then
    if sqlerrm like 'FALLA:%' then raise; end if;
  end;

  -- Insertar con el user_id de A: lo frena RLS.
  begin
    insert into public.patients (user_id, nombre) values ('00000000-0000-4000-a000-00000000000a', 'Intruso');
    raise exception 'FALLA: B pudo crear un paciente a nombre de A';
  exception when others then
    if sqlerrm like 'FALLA:%' then raise; end if;
  end;

  -- Funciones: importar a un paciente de A, deshacer una importación de A, ver resultados de pruebas.
  begin
    perform public.importar_datos('[]'::jsonb,
      jsonb_build_array(jsonb_build_object('patient_id', a_pac, 'fecha', '2026-10-04', 'tarifa_hora', 1, 'moneda', 'ARS')),
      '[]'::jsonb);
    raise exception 'FALLA: B pudo importar sesiones a un paciente de A';
  exception when others then
    if sqlerrm like 'FALLA:%' then raise; end if;
  end;
  begin
    perform public.deshacer_importacion('00000000-0000-4000-c000-00000000000a');
    raise exception 'FALLA: B pudo deshacer una importación de A';
  exception when others then
    if sqlerrm like 'FALLA:%' then raise; end if;
  end;
  begin
    perform public.resultados_pruebas();
    raise exception 'FALLA: B (sin ser admin) vio los resultados de las pruebas';
  exception when others then
    if sqlerrm like 'FALLA:%' then raise; end if;
  end;

  begin
    perform public.resumen_aviso_mensual('2026-10-17');
    raise exception 'FALLA: B pudo leer el resumen de todas las cuentas';
  exception when others then
    if sqlerrm like 'FALLA:%' then raise; end if;
  end;

  -- Importaciones solo se crean con las funciones.
  begin
    insert into public.importaciones (user_id) values ('00000000-0000-4000-a000-00000000000b');
    raise exception 'FALLA: B pudo crear una importación a mano';
  exception when others then
    if sqlerrm like 'FALLA:%' then raise; end if;
  end;

  -- B no puede darse permisos de admin.
  update public.profiles set es_admin = true where id = '00000000-0000-4000-a000-00000000000b';
  if (select es_admin from public.profiles where id = '00000000-0000-4000-a000-00000000000b') then
    raise exception 'B se dio permisos de admin';
  end if;
end $$;

-- ===================== Como A =====================
set local request.jwt.claims = '{"sub": "00000000-0000-4000-a000-00000000000a", "role": "authenticated"}';

do $$
begin
  if (select nombre from public.patients where id = '00000000-0000-4000-b000-00000000000a') <> 'Paciente de A' then
    raise exception 'El paciente de A cambió';
  end if;
  if (select count(*) from public.sessions) <> 1 or (select count(*) from public.payments) <> 1 then
    raise exception 'A perdió sesiones o pagos';
  end if;

  -- El dueño de un dato no se puede cambiar.
  begin
    update public.patients set user_id = '00000000-0000-4000-a000-00000000000b'
    where id = '00000000-0000-4000-b000-00000000000a';
    raise exception 'FALLA: A pudo pasarle su paciente a B';
  exception when others then
    if sqlerrm like 'FALLA:%' then raise; end if;
  end;

  -- A sí puede deshacer su propia importación.
  perform public.deshacer_importacion('00000000-0000-4000-c000-00000000000a');
end $$;

rollback;

select 'Aislamiento OK' as resultado;
