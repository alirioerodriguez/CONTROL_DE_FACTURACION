// Instalar honorapp desde el navegador (como app, con su ícono). Detecta si ya está
// instalada, guarda el pedido de instalación de Chrome/Edge y arma los pasos según el equipo.

/** Link de Google Play. Cuando la app esté publicada, poner PUBLICADA_EN_PLAY en true. */
export const LINK_PLAY = 'https://play.google.com/store/apps/details?id=ar.alirio.honorapp'
export const PUBLICADA_EN_PLAY = false

export type Plataforma = 'android' | 'ios' | 'escritorio'
/** Navegador, solo cuando cambia los pasos. */
export type Navegador = 'safari' | 'chrome' | 'edge' | 'samsung' | 'firefox' | 'otro'

export function plataformaDe(ua: string, puntosTactiles = 0): Plataforma {
  if (/android/i.test(ua)) return 'android'
  // iPadOS se presenta como Mac, pero con pantalla táctil.
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && puntosTactiles > 1)) return 'ios'
  return 'escritorio'
}

export function navegadorDe(ua: string): Navegador {
  if (/samsungbrowser/i.test(ua)) return 'samsung'
  if (/edg(e|a|ios)?\//i.test(ua)) return 'edge'
  if (/firefox|fxios/i.test(ua)) return 'firefox'
  if (/crios|chrome/i.test(ua)) return 'chrome'
  if (/safari/i.test(ua)) return 'safari'
  return 'otro'
}

/** Cuánto tiempo no vuelve el aviso después de cerrarlo. */
export const DIAS_SIN_AVISO = 120
const CLAVE_OCULTO = 'honorapp_instalar_oculto'
const CLAVE_APP = 'honorapp_app_android'

/** true si el aviso se cerró hace menos de DIAS_SIN_AVISO días. */
export function avisoCerradoHace(guardado: string | null, ahora: number): boolean {
  const cuando = Number(guardado)
  if (!guardado || !Number.isFinite(cuando)) return false
  return ahora - cuando < DIAS_SIN_AVISO * 86_400_000
}

function leer(clave: string) {
  try {
    return localStorage.getItem(clave)
  } catch {
    return null
  }
}

function guardar(clave: string, valor: string) {
  try {
    localStorage.setItem(clave, valor)
  } catch {
    // Sin almacenamiento (modo privado): el aviso vuelve la próxima vez.
  }
}

/**
 * ¿Ya se abre como app? Instalada desde el navegador (display-mode standalone), agregada
 * a la pantalla de inicio en iPhone (navigator.standalone) o la app de Google Play.
 * La de Play (Trusted Web Activity) llega con referrer android-app:// solo en la primera
 * página, así que se recuerda.
 */
export function abiertaComoApp(): boolean {
  if (typeof window === 'undefined') return false
  if (document.referrer.startsWith('android-app://')) guardar(CLAVE_APP, '1')
  if (leer(CLAVE_APP) === '1') return true
  if ((navigator as Navigator & { standalone?: boolean }).standalone) return true
  return ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'].some(
    (m) => window.matchMedia?.(`(display-mode: ${m})`).matches,
  )
}

export function avisoCerrado() {
  return avisoCerradoHace(leer(CLAVE_OCULTO), Date.now())
}

export function cerrarAviso() {
  guardar(CLAVE_OCULTO, String(Date.now()))
}

// ── Pedido de instalación de Chrome / Edge / Android ────────────────────────
// Chrome lo dispara una sola vez y temprano, así que se escucha apenas carga la app.

interface PedidoInstalacion extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let pedido: PedidoInstalacion | null = null
let instalada = false
const avisar = new Set<() => void>()
const cambio = () => avisar.forEach((f) => f())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // el aviso propio reemplaza la barrita de Chrome
    pedido = e as PedidoInstalacion
    cambio()
  })
  window.addEventListener('appinstalled', () => {
    pedido = null
    instalada = true
    cambio()
  })
}

export function suscribirInstalacion(f: () => void) {
  avisar.add(f)
  return () => {
    avisar.delete(f)
  }
}

/** Estado para useSyncExternalStore: 'lista' = se puede instalar con un toque. */
export function estadoInstalacion(): 'instalada' | 'lista' | 'manual' {
  if (instalada) return 'instalada'
  return pedido ? 'lista' : 'manual'
}

/** Abre el cartel de instalación del navegador. Devuelve true si la instaló. */
export async function instalarAhora(): Promise<boolean> {
  if (!pedido) return false
  const p = pedido
  await p.prompt()
  const { outcome } = await p.userChoice
  // El pedido se usa una sola vez.
  pedido = null
  cambio()
  return outcome === 'accepted'
}
