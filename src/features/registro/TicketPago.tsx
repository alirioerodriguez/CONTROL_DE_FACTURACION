import { useMemo } from 'react'
import { ReceiptText } from 'lucide-react'
import { IC } from '../../components/ui'
import type { Pago, Sesion } from '../../lib/datos'
import { cobrables } from '../../lib/estados'
import { type Moneda } from '../../lib/formato'
import { useMontosOcultos, verMonto } from '../../lib/discreto'
import { ticketDeImputacion } from '../../lib/imputacion'

/**
 * «Qué va a pasar con este pago»: antes de guardar, cuenta en castellano a qué meses se aplica, qué queda a favor
 * y cuánto debe después. Sale del mismo cálculo de saldos que usa el resto de la app (ver `imputacion.ts`).
 * Al editar, `ignorarPagoId` saca el pago que se está corrigiendo para no contarlo dos veces.
 */
export function TicketPago({
  pacienteId, sesiones, pagos, monto, moneda, periodo, ignorarPagoId,
}: {
  pacienteId: string
  sesiones: Sesion[]
  pagos: Pago[]
  monto: number
  moneda: Moneda
  periodo: string
  ignorarPagoId?: string
}) {
  const ocultos = useMontosOcultos() // vuelve a dibujar si cambia «ocultar montos»
  const ticket = useMemo(() => {
    if (!(monto > 0)) return null
    const propias = sesiones.filter((s) => s.patient_id === pacienteId)
    const previos = pagos.filter((p) => p.patient_id === pacienteId && p.id !== ignorarPagoId)
    return ticketDeImputacion(cobrables(propias), previos, { periodo, monto, moneda }, verMonto)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `ocultos` re-calcula las frases con los montos tapados
  }, [pacienteId, sesiones, pagos, monto, moneda, periodo, ignorarPagoId, ocultos])

  if (!ticket) return null
  const [titulo, ...detalle] = ticket.frases
  return (
    <section aria-label="Qué pasa con este pago" className="flex flex-col gap-1.5 rounded-[0.875rem] bg-fondo px-3.5 py-3 text-[0.9375rem] leading-snug">
      <div className="flex items-center gap-2 font-semibold">
        <ReceiptText {...IC} aria-hidden />
        Qué pasa con este pago
      </div>
      <p className="text-ink2">{titulo}</p>
      <ul className="flex flex-col gap-1">
        {detalle.map((f, i) => (
          <li key={i} className={i === detalle.length - 1 ? 'font-semibold' : undefined}>{f}</li>
        ))}
      </ul>
    </section>
  )
}
