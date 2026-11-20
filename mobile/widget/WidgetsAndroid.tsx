// Widgets de Android (react-native-android-widget): Cobros, Te deben, Hoy, Atajos y Monotributo.
// Cada uno con su versión clara y oscura, los colores y los íconos (Lucide) de honorapp.
import type { ReactNode } from 'react';
import { FlexWidget, SvgWidget, TextWidget, type WidgetRepresentation } from 'react-native-android-widget';
import { CLARO, OSCURO, URL, type DatosWidget, type Paleta } from './datos';

export const W_COBROS = 'Cobros';
export const W_DEBEN = 'TeDeben';
export const W_HOY = 'Hoy';
export const W_ATAJOS = 'Atajos';
export const W_MONO = 'Monotributo';
export const WIDGETS = [W_COBROS, W_DEBEN, W_HOY, W_ATAJOS, W_MONO];

// Íconos de Lucide (los de la app), sin emojis
const TRAZOS = {
  mas: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  sesion: '<path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h5"/><path d="M17.5 17.5 16 16.3V14"/><circle cx="16" cy="16" r="6"/>',
  pago: '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
  pegar: '<path d="M11 14h10"/><path d="M16 4h2a2 2 0 0 1 2 2v1.344"/><path d="m17 18 4-4-4-4"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 1.793-1.113"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
  check: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  campana: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M22 8c0-2.3-.8-4.3-2-6"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/><path d="M4 2C2.8 3.7 2 5.7 2 8"/>',
};
const icono = (n: keyof typeof TRAZOS, color: string, tam = 16) => (
  <SvgWidget
    svg={`<svg xmlns="http://www.w3.org/2000/svg" width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${TRAZOS[n]}</svg>`}
    style={{ width: tam, height: tam }}
  />
);
const logo = (p: Paleta) => (
  <SvgWidget
    svg={`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="${p.acento}"/><path d="M16 10v28M16 27c0-5 3.5-8 7.5-8s7.5 3 7.5 8v6l5-5" fill="none" stroke="${p.sobreAcento}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`}
    style={{ width: 18, height: 18 }}
  />
);

const vacio = () => <TextWidget text=" " style={{ fontSize: 1 }} />;

function Marco({ p, uri = URL.inicio, etiqueta, children }: { p: Paleta; uri?: string; etiqueta: string; children: ReactNode }) {
  return (
    <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri }} accessibilityLabel={etiqueta}
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: p.fondo, borderRadius: 22, paddingHorizontal: 15, paddingVertical: 13, flexDirection: 'column', flexGap: 5 }}>
      {children}
    </FlexWidget>
  );
}

function Cabecera({ p, titulo, derecha }: { p: Paleta; titulo: string; derecha?: string }) {
  return (
    <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: 'match_parent' }}>
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 7 }}>
        {logo(p)}
        <TextWidget text={titulo} style={{ fontSize: 13, fontWeight: '600', color: p.texto }} />
      </FlexWidget>
      {derecha ? <TextWidget text={derecha} maxLines={1} style={{ fontSize: 12, color: p.suave }} /> : vacio()}
    </FlexWidget>
  );
}

function Boton({ p, uri, n, texto }: { p: Paleta; uri: string; n: keyof typeof TRAZOS; texto: string }) {
  return (
    <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri }} accessibilityLabel={texto}
      style={{ flexDirection: 'row', alignItems: 'center', flexGap: 5, backgroundColor: p.acento, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 }}>
      {icono(n, p.sobreAcento, 15)}
      <TextWidget text={texto} style={{ fontSize: 14, fontWeight: '600', color: p.sobreAcento }} />
    </FlexWidget>
  );
}

function Barra({ p, pct, color }: { p: Paleta; pct: number; color: Paleta[keyof Paleta] }) {
  const v = Math.max(2, Math.min(100, pct));
  return (
    <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', height: 7, borderRadius: 4, backgroundColor: p.fondo2 }}>
      <FlexWidget style={{ flex: v, height: 7, borderRadius: 4, backgroundColor: color }} />
      {v < 100 ? <FlexWidget style={{ flex: 100 - v, height: 7 }} /> : vacio()}
    </FlexWidget>
  );
}

const SinSesion = ({ p, titulo }: { p: Paleta; titulo: string }) => (
  <Marco p={p} etiqueta={`honorapp: ${titulo}`}>
    <Cabecera p={p} titulo={titulo} />
    <TextWidget text="Abrí honorapp para ver tus cobros acá." maxLines={2} style={{ fontSize: 13, color: p.suave }} />
  </Marco>
);

// ---------- Cobros del mes ----------
function Cobros({ d, p, chico }: { d: DatosWidget; p: Paleta; chico: boolean }) {
  if (!d) return <SinSesion p={p} titulo="Cobros" />;
  const c = d.cobros;
  return (
    <Marco p={p} etiqueta={`Cobraste ${c.cobrado} en ${d.mes}, de ${c.esperado}. Te deben ${c.deben}.`}>
      <Cabecera p={p} titulo="Cobros" derecha={chico ? d.mes.slice(0, 3) : d.mes} />
      <TextWidget text={c.cobrado} maxLines={1} style={{ fontSize: chico ? 26 : 32, fontFamily: 'serif', color: p.texto }} />
      <TextWidget text={`${chico ? 'de' : 'cobrado de'} ${c.esperado}`} maxLines={1} style={{ fontSize: 12.5, color: p.suave }} />
      <Barra p={p} pct={c.pct} color={p.acento} />
      <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', width: 'match_parent' }}>
        <TextWidget text={`Te deben ${c.deben}`} maxLines={1} style={{ fontSize: 12.5, fontWeight: '600', color: p.rojo }} />
        {!chico && c.usd ? <TextWidget text={`${c.usd} cobrado`} style={{ fontSize: 12.5, color: p.suave }} /> : vacio()}
      </FlexWidget>
      {!chico ? (
        <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: 'match_parent' }}>
          <TextWidget text={`Act. ${d.actualizado}`} style={{ fontSize: 11.5, color: p.suave }} />
          <Boton p={p} uri={URL.pago} n="mas" texto="Pago" />
        </FlexWidget>
      ) : vacio()}
    </Marco>
  );
}

// ---------- Te deben ----------
function TeDeben({ d, p, alto }: { d: DatosWidget; p: Paleta; alto: number }) {
  if (!d) return <SinSesion p={p} titulo="Te deben" />;
  const grande = alto >= 250;
  const filas = d.deben.lista.slice(0, Math.max(1, Math.min(5, Math.floor((alto - 56) / 36))));
  return (
    <Marco p={p} uri={URL.deben} etiqueta={`Te deben ${d.deben.total}, ${d.deben.cantidad} pacientes.`}>
      <Cabecera p={p} titulo="Te deben" derecha={d.deben.cantidad ? d.deben.total : ''} />
      {filas.length ? (
        filas.map((x, i) => (
          <FlexWidget key={i} style={{ flexDirection: 'row', alignItems: 'center', flexGap: 10, width: 'match_parent', paddingVertical: 2 }}>
            <FlexWidget style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: p.acentoSuave, alignItems: 'center', justifyContent: 'center' }}>
              <TextWidget text={x.nombre.split(/[ .]+/).filter(Boolean).map((s) => s[0]).join('').slice(0, 2)} style={{ fontSize: 12, fontWeight: '700', color: p.acentoFuerte }} />
            </FlexWidget>
            <FlexWidget style={{ flexDirection: 'column', flex: 1 }}>
              <TextWidget text={x.nombre} maxLines={1} style={{ fontSize: 14.5, fontWeight: '600', color: p.texto }} />
              <TextWidget text={x.meses} maxLines={1} style={{ fontSize: 11.5, color: x.variosMeses ? p.rojo : p.suave }} />
            </FlexWidget>
            <TextWidget text={x.monto} style={{ fontSize: 14.5, fontWeight: '600', color: p.texto }} />
          </FlexWidget>
        ))
      ) : (
        <TextWidget text={d.deben.cantidad ? `${d.deben.cantidad} ${d.deben.cantidad === 1 ? 'paciente te debe' : 'pacientes te deben'}${d.deben.variosMeses ? ` · ${d.deben.variosMeses} de más de un mes` : ''}. Tocá para ver.` : 'Nadie te debe. Todo al día.'} maxLines={3} style={{ fontSize: 13, color: d.deben.variosMeses ? p.rojo : p.suave }} />
      )}
      {grande && d.deben.cantidad ? (
        <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: 'match_parent' }}>
          <TextWidget text={`${d.deben.cantidad} pacientes${d.deben.variosMeses ? ` · ${d.deben.variosMeses} con más de un mes` : ''}`} maxLines={1} style={{ fontSize: 12, color: p.suave }} />
          <Boton p={p} uri={URL.deben} n="campana" texto="Recordar" />
        </FlexWidget>
      ) : filas.length && d.deben.cantidad > filas.length ? (
        <TextWidget text={`y ${d.deben.cantidad - filas.length} más`} style={{ fontSize: 12, color: p.suave }} />
      ) : vacio()}
    </Marco>
  );
}

// ---------- Hoy ----------
function Hoy({ d, p, alto }: { d: DatosWidget; p: Paleta; alto: number }) {
  if (!d) return <SinSesion p={p} titulo="Hoy" />;
  const h = d.hoy;
  const grande = alto >= 250;
  const turnos = h.turnos.slice(0, Math.max(1, Math.min(6, Math.floor((alto - 70) / 30))));
  return (
    <Marco p={p} uri={URL.agenda} etiqueta={`Hoy, ${h.dia}: ${h.total} sesiones, faltan ${h.faltan}.`}>
      <Cabecera p={p} titulo="Hoy" derecha={h.dia} />
      {turnos.length ? (
        turnos.map((t, i) => (
          <FlexWidget key={i} style={{ flexDirection: 'row', alignItems: 'center', flexGap: 10, width: 'match_parent', paddingVertical: 2 }}>
            <TextWidget text={t.hora} style={{ fontSize: 14, fontWeight: '700', color: t.proxima ? p.acentoFuerte : p.suave }} />
            <FlexWidget style={{ flexDirection: 'column', flex: 1 }}>
              <TextWidget text={t.nombre} maxLines={1} style={{ fontSize: 14.5, fontWeight: '600', color: t.hecho ? p.suave : p.texto }} />
              {t.proxima && t.enMin ? <TextWidget text={t.enMin < 60 ? `en ${t.enMin} min` : 'la próxima'} style={{ fontSize: 11.5, color: p.acentoFuerte }} /> : vacio()}
            </FlexWidget>
            {t.hecho ? icono('check', p.acento, 17) : vacio()}
          </FlexWidget>
        ))
      ) : (
        <TextWidget text="Hoy no tenés sesiones." style={{ fontSize: 13, color: p.suave }} />
      )}
      <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: 'match_parent' }}>
        <TextWidget text={h.total ? `${h.total} ${h.total === 1 ? 'sesión' : 'sesiones'} · faltan ${h.faltan}` : ' '} style={{ fontSize: 12, color: p.suave }} />
        {grande ? <Boton p={p} uri={URL.sesion} n="mas" texto="Sesión" /> : vacio()}
      </FlexWidget>
    </Marco>
  );
}

// ---------- Atajos ----------
function Atajos({ p, columna }: { p: Paleta; columna: boolean }) {
  const b = (uri: string, n: keyof typeof TRAZOS, texto: string, ppal = false) => (
    <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri }} accessibilityLabel={texto === 'Pegar' ? 'Pegar un comprobante' : `Registrar ${texto.toLowerCase()}`}
      style={{ flex: 1, width: columna ? 'match_parent' : undefined, height: columna ? undefined : 'match_parent', borderRadius: 16, backgroundColor: ppal ? p.acento : p.fondo2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexGap: 6 }}>
      {icono(n, ppal ? p.sobreAcento : p.texto, 18)}
      <TextWidget text={texto} style={{ fontSize: 14, fontWeight: '600', color: ppal ? p.sobreAcento : p.texto }} />
    </FlexWidget>
  );
  return (
    <FlexWidget style={{ height: 'match_parent', width: 'match_parent', backgroundColor: p.fondo, borderRadius: 22, padding: 8, flexDirection: columna ? 'column' : 'row', flexGap: 8 }}>
      {b(URL.sesion, 'sesion', 'Sesión', true)}
      {b(URL.pago, 'pago', 'Pago')}
      {b(URL.comprobante, 'pegar', 'Pegar')}
    </FlexWidget>
  );
}

// ---------- Monotributo ----------
function Monotributo({ d, p, chico }: { d: DatosWidget; p: Paleta; chico: boolean }) {
  if (!d) return <SinSesion p={p} titulo="Monotributo" />;
  const m = d.mono;
  if (!m) {
    return (
      <Marco p={p} etiqueta="Monotributo">
        <Cabecera p={p} titulo="Monotributo" />
        <TextWidget text="Elegí tu categoría en Ajustes para ver cuánto te falta para el tope." maxLines={3} style={{ fontSize: 13, color: p.suave }} />
      </Marco>
    );
  }
  const color = m.estado === 'bien' ? p.acento : m.estado === 'cerca' ? p.ambar : p.rojo;
  const texto = m.estado === 'bien' ? 'vas bien' : m.estado === 'cerca' ? 'cerca del tope' : 'pasaste el tope';
  return (
    <Marco p={p} etiqueta={`Monotributo, categoría ${m.categoria}: ${m.cobrado} de ${m.tope}, ${m.pct}%, ${texto}.`}>
      <Cabecera p={p} titulo="Monotributo" derecha={chico ? `Cat. ${m.categoria}` : `Categoría ${m.categoria}`} />
      <TextWidget text={m.cobrado} maxLines={1} style={{ fontSize: chico ? 26 : 30, fontFamily: 'serif', color: p.texto }} />
      <TextWidget text={`${chico ? 'en 12 meses, de' : 'cobrado en 12 meses, de'} ${m.tope}`} maxLines={2} style={{ fontSize: 12, color: p.suave }} />
      <Barra p={p} pct={m.pct} color={color} />
      <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', width: 'match_parent' }}>
        <TextWidget text={`${m.pct}% · ${texto}`} style={{ fontSize: 12.5, fontWeight: '600', color }} />
        {!chico ? <TextWidget text={`recategorización en ${m.recat}`} style={{ fontSize: 12, color: p.suave }} /> : vacio()}
      </FlexWidget>
    </Marco>
  );
}

/** Lo que dibuja cada widget, por su nombre (el de app.json), con su tamaño en dp. */
export function dibujar(nombre: string, d: DatosWidget, ancho = 320, alto = 170): WidgetRepresentation {
  const ver = (p: Paleta) => {
    if (nombre === W_DEBEN) return <TeDeben d={d} p={p} alto={alto} />;
    if (nombre === W_HOY) return <Hoy d={d} p={p} alto={alto} />;
    if (nombre === W_ATAJOS) return <Atajos p={p} columna={ancho < 200} />;
    if (nombre === W_MONO) return <Monotributo d={d} p={p} chico={ancho < 230} />;
    return <Cobros d={d} p={p} chico={ancho < 230} />;
  };
  return { light: ver(CLARO), dark: ver(OSCURO) };
}
