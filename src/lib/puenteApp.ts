import { supabase } from './supabase'

// Puente con la app del celular (carpeta mobile/). Google no deja iniciar sesión dentro de la vista web de
// una app, así que la app abre esta misma página en la ventana segura del sistema con ?ingresoApp=google:
// 1. La página arranca el ingreso con Google y vuelve con ?ingresoApp=volver.
// 2. Con la sesión ya iniciada, la manda a la app (honorapp://auth#access_token=…&refresh_token=…) y
//    la borra de esta ventana, para que la sesión quede solo en la app.
// La app la recibe y la carga en su vista web con window.__sesionDesdeApp.

export const ESQUEMA_APP = 'honorapp'
const MARCA = 'honorapp_ingreso_app'
const VIGENCIA = 10 * 60 * 1000

/** true si estamos dentro de la app del celular. */
export const enLaApp = () => typeof window !== 'undefined' && 'ReactNativeWebView' in window

/** Dentro de la app: le pide a la app que haga el ingreso con Google. */
export function pedirGoogleALaApp() {
  ;(window as unknown as { ReactNativeWebView: { postMessage: (m: string) => void } }).ReactNativeWebView.postMessage(
    JSON.stringify({ type: 'google' }),
  )
}

function volverALaApp(hash: string) {
  window.location.replace(`${ESQUEMA_APP}://auth#${hash}`)
}

/** Se llama antes de mostrar la página. Devuelve true si esta carga es parte del ingreso desde la app. */
export function manejarIngresoApp(): boolean {
  if (typeof window === 'undefined') return false
  // La app carga la sesión con esto después de recibirla
  ;(window as unknown as { __sesionDesdeApp: unknown }).__sesionDesdeApp = (access_token: string, refresh_token: string) =>
    supabase.auth.setSession({ access_token, refresh_token })

  const params = new URLSearchParams(window.location.search)
  const paso = params.get('ingresoApp')
  const marca = Number(localStorage.getItem(MARCA) || 0)
  const pendiente = marca > 0 && Date.now() - marca < VIGENCIA

  if (paso === 'google') {
    localStorage.setItem(MARCA, String(Date.now()))
    document.body.textContent = 'Abriendo Google…'
    supabase.auth
      .signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/?ingresoApp=volver`, queryParams: { prompt: 'select_account' } },
      })
      .then(({ error }) => {
        if (error) volverALaApp('error=' + encodeURIComponent(error.message))
      })
    return true
  }

  const vieneDeGoogle = paso === 'volver' || /[?&#](code|access_token|error)=/.test(window.location.search + window.location.hash)
  if (!pendiente || !vieneDeGoogle) return false

  localStorage.removeItem(MARCA)
  document.body.textContent = 'Volviendo a honorapp…'
  const error = new URLSearchParams(window.location.search + '&' + window.location.hash.slice(1)).get('error_description')
  if (error) {
    volverALaApp('error=' + encodeURIComponent(error))
    return true
  }
  // getSession espera a que Supabase termine de leer el ingreso que trajo la dirección
  supabase.auth.getSession().then(({ data }) => {
    const s = data.session
    if (!s) return volverALaApp('error=' + encodeURIComponent('No se pudo entrar con Google'))
    supabase.auth.stopAutoRefresh()
    // Se borra la sesión de esta ventana sin cerrarla en el servidor (eso cerraría también la de la app)
    for (const k of Object.keys(localStorage)) if (/^sb-.*-auth-token/.test(k)) localStorage.removeItem(k)
    volverALaApp(`access_token=${encodeURIComponent(s.access_token)}&refresh_token=${encodeURIComponent(s.refresh_token)}`)
  })
  return true
}
