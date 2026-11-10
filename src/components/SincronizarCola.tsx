import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '../features/auth/AuthProvider'
import { pendientesDe, sincronizar } from '../lib/cola'
import { supabase } from '../lib/supabase'

/** No muestra nada: manda los pagos en borrador al abrir la app y cada vez que vuelve internet (Safari no tiene Background Sync). */
export function SincronizarCola() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const userId = session?.user.id

  useEffect(() => {
    if (!userId) return
    let corriendo = false
    async function mandar() {
      if (corriendo || !navigator.onLine || pendientesDe(localStorage, userId!).length === 0) return
      corriendo = true
      try {
        const r = await sincronizar(localStorage, userId!, async (b) => {
          // El id viene del teléfono: si ya llegó antes, la base lo ignora y no se duplica.
          const { error } = await supabase.from('payments').upsert([b.fila], { onConflict: 'id', ignoreDuplicates: true })
          if (error) throw error
        })
        if (r.enviados.length) {
          toast.success(r.enviados.length === 1 ? 'Se cargó 1 pago que estaba pendiente' : `Se cargaron ${r.enviados.length} pagos que estaban pendientes`)
          void qc.invalidateQueries()
        }
        if (r.fallidos.length) toast.error(`No se pudieron cargar ${r.fallidos.length} pagos pendientes. Se reintenta al volver la señal.`)
      } catch {
        // localStorage bloqueado: no hay cola que mandar.
      } finally {
        corriendo = false
      }
    }
    void mandar()
    window.addEventListener('online', mandar)
    return () => window.removeEventListener('online', mandar)
  }, [userId, qc])

  return null
}
