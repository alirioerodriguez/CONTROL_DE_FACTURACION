import { useSyncExternalStore } from 'react'
import { WifiOff } from 'lucide-react'
import { IC } from './ui'

function suscribir(avisar: () => void) {
  window.addEventListener('online', avisar)
  window.addEventListener('offline', avisar)
  return () => {
    window.removeEventListener('online', avisar)
    window.removeEventListener('offline', avisar)
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEnLinea() {
  return useSyncExternalStore(suscribir, () => navigator.onLine, () => true)
}

/** Franja fija que avisa que no hay internet (y que no se puede cargar nada). */
export function SinConexion() {
  const enLinea = useEnLinea()
  if (enLinea) return null
  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-warn-soft px-4 pt-[max(0.625rem,env(safe-area-inset-top))] pb-2.5 text-center text-[0.9375rem] font-semibold text-warn"
    >
      <WifiOff {...IC} className="shrink-0" />
      Sin conexión a internet. Podés mirar, pero no se puede cargar nada hasta que vuelva.
    </div>
  )
}
