# honorapp · app para iPhone y Android

App hecha con Expo 58. Muestra la web publicada (`https://control-de-facturacion-eight.vercel.app`), así cada
cambio que se publica en la web llega solo a la app, sin volver a compilarla.

Lo que agrega sobre la web:
- **Ingreso con Google**: Google no deja iniciar sesión dentro de la vista web de una app. La app abre la web en
  la ventana segura del sistema con `?ingresoApp=google`, la web entra con Google y le devuelve la sesión a la app
  (`honorapp://auth#…`). Ver `src/lib/puenteApp.ts` y `entrarConGoogle` en `App.tsx`.
- **Excel, PDF y recibos**: las descargas se interceptan y se abren con el menú de compartir del teléfono
  (guardar en Archivos, WhatsApp, mail).
- WhatsApp y mail se abren en su app; botón atrás de Android; aviso de sin conexión.
- **Widgets de la pantalla de inicio** (carpeta `widget/`, desde el 20/11/2026): **Cobros** (lo cobrado en el mes, lo
  esperado y cuánto te deben, con «+ Pago»), **Te deben** (de lo que más debe a lo que menos, con los meses), **Hoy** (la
  agenda del día y la próxima sesión), **Atajos** (Sesión, Pago y Pegar un comprobante) y **Monotributo** (lo cobrado en 12
  meses contra el tope). La web arma los textos (`src/lib/widgetsApp.ts` y `src/components/PuenteWidgets.tsx`) respetando
  «ocultar montos» y «Solo iniciales en los widgets» (Ajustes); la app los valida (`widget/datos.ts`) y los muestra.
  Tocar un widget abre `honorapp://sesion`, `pago`, `comprobante`, `deben`, `agenda` o `inicio`.
  Android: `WidgetsAndroid.tsx` (react-native-android-widget). iPhone: `WidgetsIOS.tsx` (expo-widgets, grupo
  `group.ar.alirio.honorapp`). **Expo Go no muestra widgets**: hace falta un build. En Android la app de Google Play hoy es
  la TWA, que no admite widgets: para tenerlos hay que publicar esta app en su lugar (como Mis Cuentas).

Identificador: `ar.alirio.honorapp` (el mismo que la app de Android de Google Play).

## Probar en el iPhone (gratis)
```bash
cd mobile && npm install && npx expo start
```
Escaneá el QR con la cámara del iPhone (con Expo Go instalado) o abrila desde Expo Go.

## Compilar
Necesitás `eas-cli` (`npm install -g eas-cli`) y la cuenta de Expo. La primera vez: `eas login` y `eas init`.
- iPhone de prueba: `npm run build:ios` (pide la cuenta de Apple Developer).
- App Store: `npm run build:tienda` y después `npm run subir:tienda`.
- Android: la de Google Play sigue siendo la versión web empaquetada (TWA). Esta app también compila para
  Android (`npm run build:android`), pero no hace falta.
