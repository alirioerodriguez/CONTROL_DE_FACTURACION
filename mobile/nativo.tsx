// Barra de abajo, Inicio y Pacientes nativos. La web sigue haciendo las cuentas (cobros, saldos, agenda) y le pasa
// a la app los textos ya escritos (ver src/components/PuenteNativo.tsx): así las cifras nunca difieren de la web.
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import * as Haptics from 'expo-haptics';
import type { SFSymbol } from 'sf-symbols-typescript';
import { APP } from './config';

type Cobros = { cobrado: string; esperado: string; deben: string; pct: number; usd: string | null };
export type Turno = { hora: string; paciente: string; pacienteId: string; hecho: boolean; proxima: boolean };
export type Deudor = { id: string; nombre: string; monto: string; variosMeses: boolean };
export type Inicio = {
  nombre: string; mes: string; oculto: boolean; cobros: Cobros;
  hoy: { dia: string; total: number; turnos: Turno[] };
  deben: { total: string; cantidad: number; lista: Deudor[] };
  mono: { categoria: string; cobrado: string; tope: string; pct: number; estado: 'bien' | 'cerca' | 'pasado'; recat: string } | null;
};
export type FilaPaciente = { id: string; nombre: string; sub: string; saldo: string | null; debe: boolean; activo: boolean };
export type Pacientes = { oculto: boolean; lista: FilaPaciente[] };

export function esInicio(x: unknown): x is Inicio {
  const i = x as Inicio;
  return !!i && !!i.cobros && typeof i.cobros.cobrado === 'string' && !!i.hoy && Array.isArray(i.hoy.turnos) && !!i.deben && Array.isArray(i.deben.lista);
}
export function esPacientes(x: unknown): x is Pacientes {
  const p = x as Pacientes;
  return !!p && Array.isArray(p.lista);
}

const T = {
  fondo: APP.fondo, tarjeta: '#ffffff', linea: '#e4e1d8', texto: APP.texto, suave: '#5f6b64',
  acento: APP.acento, suaveAcento: '#e3ece6', rojo: '#b4483c', ambar: '#a86a12',
};
const SERIF = 'Georgia';
const toque = () => Haptics.selectionAsync().catch(() => {});

function Icono({ ios, android, color, tam = 24 }: { ios: SFSymbol; android: string; color: string; tam?: number }) {
  return <SymbolView name={{ ios, android: android as never }} tintColor={color} size={tam} fallback={<View style={{ width: tam, height: tam }} />} />;
}

export type Pestana = '/' | '/pacientes' | '/mes' | 'mas';
const PESTANAS: { id: Pestana; texto: string; ios: SFSymbol; android: string }[] = [
  { id: '/', texto: 'Inicio', ios: 'house.fill', android: 'home' },
  { id: '/pacientes', texto: 'Pacientes', ios: 'person.2.fill', android: 'group' },
  { id: '/mes', texto: 'Mes', ios: 'chart.bar.fill', android: 'bar_chart' },
  { id: 'mas', texto: 'Más', ios: 'ellipsis', android: 'more_horiz' },
];

/** Qué pestaña se marca según la ruta de la web. */
export function pestanaDe(ruta: string): Pestana | null {
  if (ruta === '/') return '/';
  if (ruta.startsWith('/pacientes')) return '/pacientes';
  if (ruta.startsWith('/mes')) return '/mes';
  if (/^\/(ajustes|contadora|facturar|recordatorios|agenda|conciliar|importar)/.test(ruta)) return 'mas';
  return null;
}

// Barra de abajo: Inicio, Pacientes, «+» (registrar), Mes y Más
export function Barra({ actual, ir, registrar, abajo }: { actual: Pestana | null; ir: (p: Pestana) => void; registrar: () => void; abajo: number }) {
  const boton = (p: (typeof PESTANAS)[number]) => {
    const on = actual === p.id;
    const color = on ? T.acento : T.suave;
    return (
      <Pressable key={p.id} style={s.item} onPress={() => { toque(); ir(p.id); }} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={p.texto}>
        <View style={[s.pastilla, on && { backgroundColor: T.suaveAcento }]}><Icono ios={p.ios} android={p.android} color={color} tam={20} /></View>
        <Text style={[s.itemTexto, { color }]} numberOfLines={1}>{p.texto}</Text>
      </Pressable>
    );
  };
  return (
    <View style={[s.barra, { paddingBottom: Math.max(abajo, 8) }]} accessibilityRole="tabbar">
      {boton(PESTANAS[0])}{boton(PESTANAS[1])}
      <View style={s.item}>
        <Pressable style={s.mas} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); registrar(); }}
          accessibilityRole="button" accessibilityLabel="Registrar una sesión o un pago">
          <Icono ios="plus" android="add" color="#ffffff" tam={26} />
        </Pressable>
      </View>
      {boton(PESTANAS[2])}{boton(PESTANAS[3])}
    </View>
  );
}

const Barrita = ({ pct, color }: { pct: number; color: string }) => (
  <View style={s.barraFondo}><View style={[s.barraLlena, { width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: color }]} /></View>
);

// Inicio: cobros del mes, la agenda de hoy, quién debe y el monotributo
export function InicioNativo({ d, sesion, pago, abrirPaciente, ir, ocultar, refrescar, refrescando }: {
  d: Inicio; sesion: () => void; pago: () => void; abrirPaciente: (id: string) => void; ir: (ruta: string) => void;
  ocultar: () => void; refrescar: () => void; refrescando: boolean;
}) {
  const c = d.cobros;
  return (
    <ScrollView style={{ backgroundColor: T.fondo }} contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={T.suave} />}>
      <View style={s.saludo}>
        <View style={{ flex: 1 }}>
          <Text style={s.hola} accessibilityRole="header">{d.nombre ? `Hola, ${d.nombre.split(' ')[0]}` : 'honorapp'}</Text>
          <Text style={s.sub}>{d.hoy.dia.charAt(0).toUpperCase() + d.hoy.dia.slice(1)}</Text>
        </View>
        <Pressable onPress={() => { toque(); ocultar(); }} hitSlop={12} accessibilityRole="button" accessibilityLabel={d.oculto ? 'Mostrar los montos' : 'Ocultar los montos'}>
          <Icono ios={d.oculto ? 'eye.slash' : 'eye'} android={d.oculto ? 'visibility_off' : 'visibility'} color={T.suave} />
        </Pressable>
      </View>

      <View style={s.tarjeta} accessible accessibilityLabel={`Cobrado en ${d.mes}: ${c.cobrado} de ${c.esperado}. Te deben ${c.deben}.`}>
        <Text style={s.etiqueta}>Cobrado en {d.mes}</Text>
        <Text style={s.grande} adjustsFontSizeToFit numberOfLines={1}>{c.cobrado}</Text>
        <Barrita pct={c.pct} color={T.acento} />
        <View style={s.fila2}>
          <View style={{ flex: 1 }}><Text style={s.etiqueta}>Esperado</Text><Text style={s.cifra}>{c.esperado}</Text></View>
          <View style={{ flex: 1 }}><Text style={s.etiqueta}>Te deben</Text><Text style={[s.cifra, { color: T.rojo }]}>{c.deben}</Text></View>
        </View>
        {!!c.usd && <Text style={[s.sub, { marginTop: 8 }]}>En dólares: {c.usd}</Text>}
      </View>

      <View style={s.acciones}>
        <Pressable style={[s.accion, s.accionPpal]} onPress={() => { toque(); sesion(); }} accessibilityRole="button">
          <Icono ios="calendar.badge.plus" android="event_available" color="#ffffff" tam={20} />
          <Text style={[s.accionTexto, { color: '#ffffff' }]}>Sesión</Text>
        </Pressable>
        <Pressable style={s.accion} onPress={() => { toque(); pago(); }} accessibilityRole="button">
          <Icono ios="banknote" android="payments" color={T.texto} tam={20} />
          <Text style={s.accionTexto}>Pago</Text>
        </Pressable>
      </View>

      <View style={s.tituloLista}>
        <Text style={s.subtitulo} accessibilityRole="header">Hoy</Text>
        <Pressable onPress={() => { toque(); ir('/agenda'); }} hitSlop={10} accessibilityRole="link"><Text style={s.verTodos}>Agenda</Text></Pressable>
      </View>
      {d.hoy.turnos.length === 0 ? <Text style={s.vacio}>No tenés sesiones hoy.</Text> : d.hoy.turnos.map((t, i) => (
        <Pressable key={`${t.hora}-${i}`} style={({ pressed }) => [s.fila, pressed && { opacity: 0.6 }]} disabled={!t.pacienteId}
          onPress={() => { toque(); abrirPaciente(t.pacienteId); }} accessibilityRole="button"
          accessibilityLabel={`${t.hora}, ${t.paciente}${t.hecho ? ', ya pasó' : t.proxima ? ', la próxima' : ''}`}>
          <View style={[s.hora, t.proxima && { backgroundColor: T.acento }]}>
            <Text style={[s.horaTexto, t.proxima && { color: '#ffffff' }, t.hecho && { color: T.suave }]}>{t.hora}</Text>
          </View>
          <Text style={[s.filaTitulo, { flex: 1 }, t.hecho && { color: T.suave }]} numberOfLines={1}>{t.paciente}</Text>
          {t.proxima && <Text style={s.chip}>próxima</Text>}
        </Pressable>
      ))}

      <View style={s.tituloLista}>
        <Text style={s.subtitulo} accessibilityRole="header">Te deben</Text>
        {d.deben.cantidad > 0 && <Text style={s.sub}>{d.deben.cantidad} paciente{d.deben.cantidad === 1 ? '' : 's'}</Text>}
      </View>
      {d.deben.lista.length === 0 ? <Text style={s.vacio}>Nadie te debe. Todo al día.</Text> : d.deben.lista.map((x, i) => (
        <Pressable key={`${x.id}-${i}`} style={({ pressed }) => [s.fila, pressed && { opacity: 0.6 }]} onPress={() => { toque(); abrirPaciente(x.id); }}
          accessibilityRole="button" accessibilityLabel={`${x.nombre} te debe ${x.monto}${x.variosMeses ? ', de más de un mes' : ''}`}>
          <View style={s.inicial}><Text style={s.inicialTexto}>{x.nombre.charAt(0).toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.filaTitulo} numberOfLines={1}>{x.nombre}</Text>
            {x.variosMeses && <Text style={[s.sub, { color: T.ambar }]}>más de un mes</Text>}
          </View>
          <Text style={[s.monto, { color: T.rojo }]}>{x.monto}</Text>
        </Pressable>
      ))}

      {d.mono && (
        <View style={[s.tarjeta, { marginTop: 20 }]} accessible
          accessibilityLabel={`Monotributo categoría ${d.mono.categoria}: ${d.mono.cobrado} de ${d.mono.tope}, ${d.mono.pct} por ciento`}>
          <Text style={s.etiqueta}>Monotributo · categoría {d.mono.categoria}</Text>
          <Text style={[s.cifra, { marginVertical: 6 }]}>{d.mono.cobrado} de {d.mono.tope}</Text>
          <Barrita pct={d.mono.pct} color={d.mono.estado === 'pasado' ? T.rojo : d.mono.estado === 'cerca' ? T.ambar : T.acento} />
          <Text style={[s.sub, { marginTop: 6 }]}>Próxima recategorización: {d.mono.recat}</Text>
        </View>
      )}
    </ScrollView>
  );
}

// Pacientes: buscador y la lista con lo que debe cada uno. Tocar uno abre su ficha de la web.
export function PacientesNativo({ p, abrir, nuevo, refrescar, refrescando }: {
  p: Pacientes; abrir: (id: string) => void; nuevo: () => void; refrescar: () => void; refrescando: boolean;
}) {
  const [q, setQ] = useState('');
  const filas = useMemo(() => {
    const t = q.trim().toLocaleLowerCase('es').normalize('NFD').replace(/\p{Diacritic}/gu, '');
    if (!t) return p.lista;
    return p.lista.filter((f) => f.nombre.toLocaleLowerCase('es').normalize('NFD').replace(/\p{Diacritic}/gu, '').includes(t));
  }, [p.lista, q]);
  const activos = p.lista.filter((f) => f.activo).length;
  return (
    <FlatList
      style={{ backgroundColor: T.fondo }}
      contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
      data={filas}
      keyExtractor={(f) => f.id}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={T.suave} />}
      ListHeaderComponent={
        <View>
          <View style={s.saludo}>
            <View style={{ flex: 1 }}>
              <Text style={s.hola} accessibilityRole="header">Pacientes</Text>
              <Text style={s.sub}>{activos} activo{activos === 1 ? '' : 's'}</Text>
            </View>
            <Pressable style={s.nuevo} onPress={() => { toque(); nuevo(); }} accessibilityRole="button" accessibilityLabel="Ver la lista completa y sumar pacientes">
              <Icono ios="person.badge.plus" android="person_add" color={T.acento} tam={20} />
            </Pressable>
          </View>
          <View style={s.buscador}>
            <Icono ios="magnifyingglass" android="search" color={T.suave} tam={18} />
            <TextInput value={q} onChangeText={setQ} placeholder="Buscar por nombre" placeholderTextColor={T.suave} style={s.buscadorTexto}
              autoCorrect={false} clearButtonMode="while-editing" accessibilityLabel="Buscar un paciente" />
          </View>
        </View>
      }
      renderItem={({ item: f }) => (
        <Pressable style={({ pressed }) => [s.fila, pressed && { opacity: 0.6 }]} onPress={() => { toque(); abrir(f.id); }}
          accessibilityRole="button" accessibilityLabel={`${f.nombre}${f.sub ? `, ${f.sub}` : ''}${f.saldo ? `, debe ${f.saldo}` : ', al día'}`}>
          <View style={[s.inicial, !f.activo && { opacity: 0.5 }]}><Text style={s.inicialTexto}>{f.nombre.charAt(0).toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={[s.filaTitulo, !f.activo && { color: T.suave }]} numberOfLines={1}>{f.nombre}</Text>
            {!!f.sub && <Text style={s.sub} numberOfLines={1}>{f.sub}</Text>}
          </View>
          {f.saldo ? <Text style={[s.monto, { color: T.rojo }]}>{f.saldo}</Text> : <Text style={[s.sub, { color: T.acento }]}>al día</Text>}
        </Pressable>
      )}
      ListEmptyComponent={<Text style={s.vacio}>{q ? 'No encontré a nadie con ese nombre.' : 'Todavía no cargaste pacientes.'}</Text>}
    />
  );
}

const s = StyleSheet.create({
  barra: { flexDirection: 'row', backgroundColor: T.tarjeta, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.linea, paddingTop: 6 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 52, gap: 2 },
  pastilla: { width: 56, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  itemTexto: { fontSize: 12, fontWeight: '700' },
  mas: { width: 54, height: 54, borderRadius: 27, backgroundColor: T.acento, alignItems: 'center', justifyContent: 'center', marginTop: -16 },
  saludo: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  hola: { color: T.texto, fontSize: 30, fontFamily: SERIF },
  sub: { color: T.suave, fontSize: 14, marginTop: 2 },
  tarjeta: { backgroundColor: T.tarjeta, borderRadius: 20, padding: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: T.linea },
  etiqueta: { color: T.suave, fontSize: 13, fontWeight: '600' },
  grande: { color: T.acento, fontSize: 36, fontWeight: '700', marginVertical: 6, fontVariant: ['tabular-nums'] },
  fila2: { flexDirection: 'row', marginTop: 14 },
  cifra: { color: T.texto, fontSize: 17, fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] },
  barraFondo: { height: 8, borderRadius: 4, backgroundColor: T.linea, overflow: 'hidden' },
  barraLlena: { height: 8, borderRadius: 4 },
  acciones: { flexDirection: 'row', gap: 10, marginTop: 14 },
  accion: { flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: T.tarjeta, borderRadius: 999, minHeight: 52, borderWidth: StyleSheet.hairlineWidth, borderColor: T.linea },
  accionPpal: { backgroundColor: T.acento, borderColor: T.acento },
  accionTexto: { color: T.texto, fontSize: 16, fontWeight: '700' },
  tituloLista: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 6 },
  subtitulo: { color: T.texto, fontSize: 22, fontFamily: SERIF },
  verTodos: { color: T.acento, fontSize: 15, fontWeight: '600' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.linea },
  filaTitulo: { color: T.texto, fontSize: 16, fontWeight: '600' },
  hora: { minWidth: 60, height: 34, borderRadius: 17, backgroundColor: T.suaveAcento, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  horaTexto: { color: T.texto, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  chip: { color: T.acento, fontSize: 12, fontWeight: '700' },
  inicial: { width: 40, height: 40, borderRadius: 20, backgroundColor: T.suaveAcento, alignItems: 'center', justifyContent: 'center' },
  inicialTexto: { color: T.acento, fontSize: 17, fontWeight: '700' },
  monto: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  vacio: { color: T.suave, fontSize: 15, lineHeight: 21, paddingVertical: 10 },
  nuevo: { width: 44, height: 44, borderRadius: 22, backgroundColor: T.suaveAcento, alignItems: 'center', justifyContent: 'center' },
  buscador: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.tarjeta, borderRadius: 14, paddingHorizontal: 12, minHeight: 48, marginBottom: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: T.linea },
  buscadorTexto: { flex: 1, color: T.texto, fontSize: 16, paddingVertical: 10 },
});
