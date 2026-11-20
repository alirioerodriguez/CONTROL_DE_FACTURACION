// Lo que muestran los widgets de la pantalla de inicio. La web (src/lib/widgetsApp.ts y PuenteWidgets) manda los
// textos ya escritos, respetando «ocultar montos» y sin nombres de pacientes; acá se validan, se guardan y se muestran.
// null = sin sesión: los widgets piden abrir la app.
import { File, Paths } from 'expo-file-system';

export type Deudor = { nombre: string; monto: string; meses: string; variosMeses: boolean };
export type Turno = { hora: string; nombre: string; hecho: boolean; proxima: boolean; enMin: number | null };
export type Mono = { categoria: string; cobrado: string; tope: string; pct: number; estado: 'bien' | 'cerca' | 'pasado'; recat: string };

export type DatosWidget = {
  oculto: boolean;
  mes: string;
  actualizado: string;
  cobros: { cobrado: string; esperado: string; deben: string; pct: number; usd: string | null };
  deben: { total: string; cantidad: number; variosMeses: number; lista: Deudor[] };
  hoy: { dia: string; total: number; faltan: number; turnos: Turno[] };
  mono: Mono | null;
} | null;

// Lo que abre cada parte de los widgets (ver PuenteWidgets en la web)
export const URL = {
  inicio: 'honorapp://inicio',
  sesion: 'honorapp://sesion',
  pago: 'honorapp://pago',
  comprobante: 'honorapp://comprobante',
  deben: 'honorapp://deben',
  agenda: 'honorapp://agenda',
} as const;

// Los colores de la app (src/index.css), claro y oscuro
type Hex = `#${string}`;
export type Paleta = Record<'fondo' | 'fondo2' | 'texto' | 'suave' | 'linea' | 'acento' | 'acentoFuerte' | 'acentoSuave' | 'sobreAcento' | 'ambar' | 'rojo', Hex>;
export const CLARO: Paleta = { fondo: '#ffffff', fondo2: '#eeede7', texto: '#1e2420', suave: '#5d6660', linea: '#e3e2db', acento: '#557f69', acentoFuerte: '#3c6450', acentoSuave: '#e2ece5', sobreAcento: '#ffffff', ambar: '#8f6418', rojo: '#a3452c' };
export const OSCURO: Paleta = { fondo: '#1b201d', fondo2: '#252b27', texto: '#eceeea', suave: '#a0aaa4', linea: '#2d3430', acento: '#8bb89f', acentoFuerte: '#a8ccb8', acentoSuave: '#223129', sobreAcento: '#14201a', ambar: '#e3b66c', rojo: '#e8977b' };

const texto = (v: unknown, max = 60) => typeof v === 'string' && v.length <= max;
const num = (v: unknown) => typeof v === 'number' && isFinite(v);
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' ? (v as Record<string, unknown>) : null);
const lista = <T,>(v: unknown, ok: (x: Record<string, unknown>) => boolean, max: number): T[] =>
  Array.isArray(v) ? (v.map(obj).filter((x): x is Record<string, unknown> => !!x && ok(x)).slice(0, max) as unknown as T[]) : [];

/** Valida y deja solo lo que los widgets saben mostrar: lo que llega de la página es dato, no se confía a ciegas. */
export function limpiar(d: unknown): DatosWidget {
  const x = obj(d);
  const c = obj(x?.cobros), de = obj(x?.deben), h = obj(x?.hoy), m = obj(x?.mono);
  if (!x || !c || !de || !h || !texto(x.mes, 20) || !texto(x.actualizado, 10)) return null;
  if (![c.cobrado, c.esperado, c.deben].every((v) => texto(v, 30)) || !num(c.pct)) return null;
  return {
    oculto: !!x.oculto,
    mes: x.mes as string,
    actualizado: x.actualizado as string,
    cobros: { cobrado: c.cobrado as string, esperado: c.esperado as string, deben: c.deben as string, pct: Math.max(0, Math.min(100, c.pct as number)), usd: texto(c.usd, 30) ? (c.usd as string) : null },
    deben: {
      total: texto(de.total, 30) ? (de.total as string) : '',
      cantidad: num(de.cantidad) ? (de.cantidad as number) : 0,
      variosMeses: num(de.variosMeses) ? (de.variosMeses as number) : 0,
      lista: lista<Deudor>(de.lista, (y) => texto(y.nombre, 30) && texto(y.monto, 30) && texto(y.meses, 40), 5).map((y) => ({ ...y, variosMeses: !!y.variosMeses })),
    },
    hoy: {
      dia: texto(h.dia, 20) ? (h.dia as string) : '',
      total: num(h.total) ? (h.total as number) : 0,
      faltan: num(h.faltan) ? (h.faltan as number) : 0,
      turnos: lista<Turno>(h.turnos, (y) => texto(y.hora, 8) && texto(y.nombre, 30), 6).map((y) => ({ ...y, hecho: !!y.hecho, proxima: !!y.proxima, enMin: num(y.enMin) ? y.enMin : null })),
    },
    mono:
      m && texto(m.categoria, 3) && texto(m.cobrado, 20) && texto(m.tope, 20) && num(m.pct) && ['bien', 'cerca', 'pasado'].includes(m.estado as string) && texto(m.recat, 12)
        ? { categoria: m.categoria as string, cobrado: m.cobrado as string, tope: m.tope as string, pct: m.pct as number, estado: m.estado as Mono['estado'], recat: m.recat as string }
        : null,
  };
}

const archivo = () => new File(Paths.document, 'widgets.json');

export function guardar(d: DatosWidget) {
  try { archivo().writeSync(JSON.stringify(d)); } catch { /* sin disco: los widgets muestran lo último */ }
}

export function leer(): DatosWidget {
  try {
    const f = archivo();
    return f.exists ? limpiar(JSON.parse(f.textSync())) : null;
  } catch { return null; }
}
