import { useCallback, useEffect, useRef, useState, type ComponentType, type Ref } from 'react';
import { ActivityIndicator, Alert, BackHandler, Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as WebBrowser from 'expo-web-browser';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewProps } from 'react-native-webview';
import type { ShouldStartLoadRequest, WebViewMessageEvent, WebViewNavigation, WebViewOpenWindowEvent } from 'react-native-webview/lib/WebViewTypes';
import { APP } from './config';
import { entrarConApple } from './apple';
import { limpiar } from './widget/datos';
import { actualizarWidgets } from './widget/actualizar';
import { Barra, InicioNativo, PacientesNativo, esInicio, esPacientes, pestanaDe, type Inicio, type Pacientes, type Pestana } from './nativo';

// La app muestra la web publicada: cada cambio que se publica llega solo, sin volver a compilar.
// Lo que agrega: ingreso con Google (Google no lo permite dentro de una vista web), descargas de
// Excel/PDF con el menú de compartir del teléfono, enlaces externos (WhatsApp, mail) en su app,
// botón atrás de Android, aviso de sin conexión y los widgets de la pantalla de inicio (carpeta widget/).

type WebViewHandle = WebView<{}>;
const RNWebView = WebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebViewHandle> }>;

SplashScreen.preventAutoHideAsync().catch(() => {});

// Lo que se toca en un widget abre la app con honorapp://sesion, pago, comprobante, deben, agenda o inicio
// (ver PuenteWidgets en la web).
const ACCIONES = ['sesion', 'pago', 'comprobante', 'deben', 'agenda', 'inicio'] as const;
const accionDe = (url: string | null | undefined) => {
  const m = url && /^honorapp:\/\/([a-z]+)/.exec(url);
  return m && (ACCIONES as readonly string[]).includes(m[1]) ? m[1] : null;
};

const ORIGEN = new URL(APP.sitio).origin;
const esPropia = (url: string) =>
  url.startsWith(ORIGEN) || url.startsWith('about:') || url.startsWith('data:') || url.startsWith('blob:');

// Descargas: las páginas arman el archivo en memoria (blob:) y lo "descargan" con un enlace. En el iPhone eso
// no hace nada dentro de una app, así que se intercepta y se le pasa el archivo a la app.
const PUENTE = `(function () {
  if (window.__puenteApp) return; window.__puenteApp = true;
  var revocar = URL.revokeObjectURL.bind(URL);
  URL.revokeObjectURL = function (u) { setTimeout(function () { revocar(u); }, 60000); };
  function enviar(a) {
    var nombre = a.getAttribute('download') || 'archivo';
    fetch(a.href).then(function (r) { return r.blob(); }).then(function (b) {
      var fr = new FileReader();
      fr.onload = function () { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'archivo', nombre: nombre, datos: fr.result })); };
      fr.readAsDataURL(b);
    }).catch(function () {});
  }
  var esArchivo = function (a) { return a && a.hasAttribute && a.hasAttribute('download') && /^(blob:|data:)/.test(a.href); };
  var click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { if (esArchivo(this)) return enviar(this); return click.apply(this, arguments); };
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (esArchivo(a)) { e.preventDefault(); enviar(a); }
  }, true);
})(); true;`;

async function guardarYCompartir(nombre: string, datos: string) {
  const base64 = datos.slice(datos.indexOf(',') + 1);
  const archivo = new File(Paths.cache, nombre.replace(/[\\/:*?"<>|]/g, '_'));
  if (archivo.exists) archivo.delete();
  await archivo.write(base64, { encoding: 'base64' });
  await Sharing.shareAsync(archivo.uri, { dialogTitle: nombre });
}

// Le avisa a la web, antes de que cargue, que la app dibuja su propia barra, Inicio y Pacientes (ver PuenteNativo en la web)
const SHELL = 'window.__shellNativo = true; true;';

export default function App() {
  return <SafeAreaProvider><Pantalla /></SafeAreaProvider>;
}

function Pantalla() {
  const web = useRef<WebViewHandle>(null);
  const insets = useSafeAreaInsets();
  // Lo que manda la web: Inicio (null = sin sesión), Pacientes, en qué ruta está y si hay una hoja abierta
  const [ini, setIni] = useState<Inicio | null>(null);
  const [pacs, setPacs] = useState<Pacientes | null>(null);
  const [ruta, setRuta] = useState<string | null>(null);
  const [hoja, setHoja] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  // Pacientes nativo es la portada de «Pacientes»; con «sumar» se ve la pantalla de la web
  const [pacNativo, setPacNativo] = useState(true);
  const js = useCallback((codigo: string) => web.current?.injectJavaScript(`${codigo}; true;`), []);
  const [canGoBack, setCanGoBack] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const enGoogle = useRef(false);
  const cargada = useRef(false);
  // Si la app estaba cerrada y se abrió desde un widget, la página arranca con ?accion=…
  const [inicio, setInicio] = useState<string | null>(null);
  useEffect(() => {
    Linking.getInitialURL()
      .then((u) => { const a = accionDe(u); setInicio(a && a !== 'inicio' ? `${APP.sitio}?accion=${a}` : APP.sitio); })
      .catch(() => setInicio(APP.sitio));
    const sub = Linking.addEventListener('url', ({ url }) => {
      const a = accionDe(url);
      if (a && cargada.current) web.current?.injectJavaScript(`window.__accionDesdeApp && window.__accionDesdeApp(${JSON.stringify(a)}); true;`);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { setLoading(false); SplashScreen.hideAsync().catch(() => {}); }, 8000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) { web.current?.goBack(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]);

  // Google: se abre la web en la ventana segura del sistema; la web entra con Google y vuelve a la app
  // con la sesión (APP.esquema://auth#access_token=…&refresh_token=…), que se carga en la vista web.
  const entrarConGoogle = useCallback(async () => {
    if (enGoogle.current) return;
    enGoogle.current = true;
    try {
      const r = await WebBrowser.openAuthSessionAsync(`${ORIGEN}/?ingresoApp=google`, `${APP.esquema}://auth`);
      if (r.type !== 'success') return;
      const p = new URLSearchParams(r.url.split('#')[1] || r.url.split('?')[1] || '');
      const at = p.get('access_token');
      const rt = p.get('refresh_token');
      if (!at || !rt) {
        Alert.alert('No se pudo entrar con Google', p.get('error') || 'Probá de nuevo.');
        return;
      }
      web.current?.injectJavaScript(
        `window.__sesionDesdeApp(${JSON.stringify(at)}, ${JSON.stringify(rt)}).then(function(){ location.replace(${JSON.stringify(ORIGEN + '/')}); }); true;`,
      );
    } finally {
      enGoogle.current = false;
    }
  }, []);

  const onShouldStart = useCallback((req: ShouldStartLoadRequest) => {
    // Respaldo: si la página intenta ir a Google desde la vista web, se hace con la ventana del sistema
    if (/\/auth\/v1\/authorize|accounts\.google\.com/.test(req.url)) { entrarConGoogle(); return false; }
    if (req.isTopFrame === false || esPropia(req.url)) return true;
    Linking.openURL(req.url).catch(() => {});
    return false;
  }, [entrarConGoogle]);

  const onOpenWindow = useCallback((e: WebViewOpenWindowEvent) => {
    Linking.openURL(e.nativeEvent.targetUrl).catch(() => {});
  }, []);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    let msg: { type?: string; nombre?: string; datos?: unknown; title?: string; text?: string; url?: string };
    try { msg = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (msg.type === 'google') entrarConGoogle();
    else if (msg.type === 'apple') entrarConApple(web);
    else if (msg.type === 'widget') actualizarWidgets(msg.datos === null ? null : limpiar(msg.datos));
    else if (msg.type === 'inicio') setIni(esInicio(msg.datos) ? msg.datos : null);
    else if (msg.type === 'pacientes') setPacs(esPacientes(msg.datos) ? msg.datos : null);
    else if (msg.type === 'hoja') setHoja(msg.datos === true);
    else if (msg.type === 'refrescado') setRefrescando(false);
    else if (msg.type === 'seccion') {
      const r = (msg.datos as { ruta?: unknown } | undefined)?.ruta;
      if (typeof r === 'string') { setRuta(r); if (!r.startsWith('/pacientes')) setPacNativo(true); }
    }
    else if (msg.type === 'archivo' && msg.nombre && typeof msg.datos === 'string')
      guardarYCompartir(msg.nombre, msg.datos).catch(() => Alert.alert('No se pudo guardar el archivo', 'Probá de nuevo.'));
    else if (msg.type === 'share')
      Share.share({ title: msg.title, message: [msg.text, msg.url].filter(Boolean).join('\n') }).catch(() => {});
  }, [entrarConGoogle]);

  const retry = () => { setFailed(false); setLoading(true); web.current?.reload(); };

  // La barra y las pantallas nativas aparecen solo con sesión, sin hojas abiertas y en sus rutas
  const conBarra = !!ini && ruta !== null && pestanaDe(ruta) !== null;
  const enInicio = !!ini && !hoja && ruta === '/';
  const enPacientes = !!ini && !hoja && !!pacs && pacNativo && ruta === '/pacientes';
  const ir = useCallback((p: Pestana | string) => {
    if (p === 'mas') return js('window.__abrirMasDesdeApp && window.__abrirMasDesdeApp()');
    if (p === '/pacientes') setPacNativo(true);
    js(`window.__irA && window.__irA(${JSON.stringify(p)})`);
  }, [js]);
  const accion = useCallback((a: 'sesion' | 'pago') => js(`window.__accionDesdeApp && window.__accionDesdeApp(${JSON.stringify(a)})`), [js]);
  const abrirPaciente = useCallback((id: string) => js(`window.__abrirPacienteDesdeApp && window.__abrirPacienteDesdeApp(${JSON.stringify(id)})`), [js]);
  const refrescar = useCallback(() => {
    setRefrescando(true);
    js('window.__refrescarDesdeApp && window.__refrescarDesdeApp()');
    setTimeout(() => setRefrescando(false), 10000); // por si la web no contesta
  }, [js]);

  return (
    <>
      <StatusBar style={APP.barraClara ? 'light' : 'dark'} />
      <SafeAreaView style={[styles.root, { backgroundColor: APP.fondo }]} edges={['top', 'left', 'right']}>
        <View style={styles.root}>
        {inicio && <RNWebView
          ref={web}
          source={{ uri: inicio }}
          style={[styles.web, { backgroundColor: APP.fondo }]}
          applicationNameForUserAgent={APP.agente}
          originWhitelist={['*']}
          injectedJavaScriptBeforeContentLoaded={SHELL + PUENTE}
          onShouldStartLoadWithRequest={onShouldStart}
          onOpenWindow={onOpenWindow}
          setSupportMultipleWindows
          onMessage={onMessage}
          onNavigationStateChange={(s: WebViewNavigation) => setCanGoBack(s.canGoBack)}
          onLoadEnd={() => { cargada.current = true; setLoading(false); SplashScreen.hideAsync().catch(() => {}); }}
          onError={() => { setFailed(true); setLoading(false); SplashScreen.hideAsync().catch(() => {}); }}
          onContentProcessDidTerminate={() => web.current?.reload()}
          onRenderProcessGone={() => web.current?.reload()}
          domStorageEnabled
          javaScriptEnabled
          sharedCookiesEnabled
          allowsBackForwardNavigationGestures
          allowsInlineMediaPlayback
          decelerationRate="normal"
          overScrollMode="never"
        />}
        {enInicio && ini && (
          <View style={[styles.cover, styles.pantalla]}>
            <InicioNativo d={ini} sesion={() => accion('sesion')} pago={() => accion('pago')} abrirPaciente={abrirPaciente} ir={ir}
              ocultar={() => js('window.__ocultarDesdeApp && window.__ocultarDesdeApp()')} refrescar={refrescar} refrescando={refrescando} />
          </View>
        )}
        {enPacientes && pacs && (
          <View style={[styles.cover, styles.pantalla]}>
            <PacientesNativo p={pacs} abrir={abrirPaciente} nuevo={() => setPacNativo(false)} refrescar={refrescar} refrescando={refrescando} />
          </View>
        )}
        {loading && !failed && (
          <View style={[styles.cover, { backgroundColor: APP.fondo }]} pointerEvents="none"><ActivityIndicator color={APP.acento} /></View>
        )}
        {failed && (
          <View style={[styles.cover, { backgroundColor: APP.fondo }]}>
            <Text style={[styles.title, { color: APP.texto }]}>Sin conexión</Text>
            <Text style={styles.text}>Revisá tu internet y probá de nuevo.</Text>
            <Pressable style={[styles.btn, { backgroundColor: APP.acento }]} onPress={retry}><Text style={styles.btnText}>Reintentar</Text></Pressable>
          </View>
        )}
        </View>
        {conBarra && !failed && ruta !== null && (
          <Barra actual={pestanaDe(ruta)} ir={ir} registrar={() => accion('sesion')} abajo={insets.bottom} />
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  web: { flex: 1 },
  // Las pantallas nativas ocupan todo el ancho (cover centra y deja margen, que es para los avisos)
  pantalla: { alignItems: 'stretch', justifyContent: 'flex-start', padding: 0, backgroundColor: APP.fondo },
  cover: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  text: { color: '#8a8580', fontSize: 15, textAlign: 'center', marginBottom: 20 },
  btn: { borderRadius: 999, paddingHorizontal: 22, paddingVertical: 12 },
  btnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
});
