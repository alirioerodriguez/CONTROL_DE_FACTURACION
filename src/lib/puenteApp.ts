import { toast } from 'sonner'
import { mensajeError, supabase } from './supabase'

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

/** true si estamos dentro de la app de iPhone (ahí se ofrece «Continuar con Apple»). */
export const enLaAppIPhone = () => enLaApp() && /iPhone|iPad|iPod/.test(navigator.userAgent)

/** Dentro de la app de iPhone: le pide a la app el ingreso con Apple (ventana del sistema, ver mobile/apple.ts). */
export function pedirAppleALaApp() {
  ;(window as unknown as { ReactNativeWebView: { postMessage: (m: string) => void } }).ReactNativeWebView.postMessage(
    JSON.stringify({ type: 'apple' }),
  )
}

/** ¿Está activo el proveedor Apple en Supabase (Authentication → Providers → Apple)? */
export async function appleDisponible(): Promise<boolean> {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
    if (!url || !key) return false
    const r = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
    const j = (await r.json()) as { external?: Record<string, boolean> }
    return !!j.external?.apple
  } catch {
    return false
  }
}

// La app le pasa el token de Apple a la página, que entra con él. Apple da el nombre solo la primera vez.
async function entrarConApple(token: string, nonce: string, nombre: string) {
  const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token, nonce })
  if (error) return toast.error('No se pudo entrar con Apple: ' + mensajeError(error))
  if (nombre && data.user && !data.user.user_metadata?.full_name) {
    await supabase.auth.updateUser({ data: { full_name: nombre } }).catch(() => {})
  }
  toast.success('Entraste con Apple')
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
  ;(window as unknown as { __entrarConApple: unknown }).__entrarConApple = entrarConApple
  ;(window as unknown as { __errorApple: unknown }).__errorApple = (msg: string) => toast.error(msg)

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
