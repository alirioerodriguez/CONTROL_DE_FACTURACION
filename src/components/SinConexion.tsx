import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CloudUpload, WifiOff } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../features/auth/AuthProvider'
import { formatHoraAR, leerCacheDatos, sincronizar } from '../lib/colaOffline'
import { enviarBorradorASupabase, useBorradores } from '../lib/datos'
import { plural } from '../lib/formato'
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

/** Franja fija que avisa cuando no hay señal, muestra la hora de los últimos datos y sincroniza borradores al volver internet. */
export function SinConexion() {
  const enLinea = useEnLinea()
  const { session } = useAuth()
  const userId = session?.user.id ?? ''
  const borradores = useBorradores(userId)
  const qc = useQueryClient()
  const sincronizando = useRef(false)

  useEffect(() => {
    if (!enLinea || !userId || borradores.length === 0 || sincronizando.current) return
    sincronizando.current = true
    sincronizar(userId, enviarBorradorASupabase, localStorage)
      .then(async (r) => {
        if (r.enviados > 0 || r.repetidos > 0) {
          await qc.invalidateQueries()
        }
        if (r.enviados > 0) {
          toast.success(
            r.enviados === 1
              ? 'Se envió 1 borrador que estaba pendiente'
              : `Se enviaron ${r.enviados} borradores pendientes`,
          )
        }
      })
      .finally(() => {
        sincronizando.current = false
      })
  }, [enLinea, userId, borradores.length, qc])

  if (enLinea && borradores.length === 0) return null

  const cache = !enLinea && userId ? leerCacheDatos(userId, localStorage) : null
  const hora = cache ? formatHoraAR(cache.guardadoEn) : null

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-50 flex flex-wrap items-center justify-center gap-2 bg-warn-soft px-4 pt-[max(0.625rem,env(safe-area-inset-top))] pb-2.5 text-center text-[0.9375rem] font-semibold text-warn"
    >
      {enLinea ? <CloudUpload className="shrink-0" {...IC} /> : <WifiOff className="shrink-0" {...IC} />}
      <span>
        {!enLinea ? (
          <>
            Sin conexión{hora ? ` · Datos de las ${hora}` : ''}. Podés consultar quién debe y guardar pagos (quedan «Pendiente de enviar»).
          </>
        ) : (
          <>Enviando {plural(borradores.length, 'borrador pendiente', 'borradores pendientes')}…</>
        )}
      </span>
    </div>
  )
}
