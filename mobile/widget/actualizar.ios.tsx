import { Widget } from 'expo-widgets';
import type { DatosWidget } from './datos';
import { AtajosIOS, CobrosIOS, DebenIOS, HoyIOS, MonoIOS, type PropsAtajos, type PropsCobros, type PropsDeben, type PropsHoy, type PropsMono } from './WidgetsIOS';

// Los nombres tienen que coincidir con los de app.json (plugin expo-widgets).
const cobros = new Widget<PropsCobros>('Cobros', CobrosIOS);
const deben = new Widget<PropsDeben>('TeDeben', DebenIOS);
const hoy = new Widget<PropsHoy>('Hoy', HoyIOS);
const atajos = new Widget<PropsAtajos>('Atajos', AtajosIOS);
const mono = new Widget<PropsMono>('Monotributo', MonoIOS);

export function actualizarWidgets(d: DatosWidget) {
  const hay = !!d;
  const intentar = (f: () => void) => { try { f(); } catch { /* sin ese widget instalado */ } };
  intentar(() => cobros.updateSnapshot(d ? { hay, mes: d.mes, actualizado: d.actualizado, ...d.cobros } : { hay }));
  intentar(() => deben.updateSnapshot(d ? { hay, ...d.deben } : { hay }));
  intentar(() => hoy.updateSnapshot(d ? { hay, ...d.hoy } : { hay }));
  intentar(() => atajos.updateSnapshot({ hay }));
  intentar(() => mono.updateSnapshot({ hay, mono: d ? d.mono : null }));
}
