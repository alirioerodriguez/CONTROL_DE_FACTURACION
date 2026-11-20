import { requestWidgetUpdate } from 'react-native-android-widget';
import { guardar, type DatosWidget } from './datos';
import { WIDGETS, dibujar } from './WidgetsAndroid';

export function actualizarWidgets(d: DatosWidget) {
  guardar(d); // para cuando Android los redibuje solos (al agregarlos, al reiniciar el teléfono)
  for (const nombre of WIDGETS)
    requestWidgetUpdate({ widgetName: nombre, renderWidget: (info) => dibujar(nombre, d, info.width, info.height) }).catch(() => {});
}
