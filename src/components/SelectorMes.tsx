import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { capitalizar, formatPeriodo, hoyAR, periodoDe, sumarMeses } from '../lib/formato'
import { IC } from './ui'

/** Mes elegido, guardado en la URL (?mes=2026-10) para compartirlo entre Inicio y Mes. */
// eslint-disable-next-line react-refresh/only-export-components
export function useMesSeleccionado(): [string, (periodo: string) => void] {
  const [params, setParams] = useSearchParams()
  const actual = periodoDe(hoyAR())
  const valor = params.get('mes')
  const periodo = valor && /^\d{4}-\d{2}$/.test(valor) ? `${valor}-01` : actual
  const cambiar = (p: string) =>
    setParams(
      (prev) => {
        const sig = new URLSearchParams(prev)
        if (p === actual) sig.delete('mes')
        else sig.set('mes', p.slice(0, 7))
        return sig
      },
      { replace: true },
    )
  return [periodo, cambiar]
}

export function SelectorMes({ periodo, onCambio }: { periodo: string; onCambio: (p: string) => void }) {
  const boton = 'grid size-[42px] place-items-center rounded-full hover:bg-surface2'
  return (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-line bg-surface p-1">
      <button type="button" aria-label="Mes anterior" className={boton} onClick={() => onCambio(sumarMeses(periodo, -1))}>
        <ChevronLeft {...IC} />
      </button>
      <div className="min-w-[150px] text-center text-[17px] font-semibold">{capitalizar(formatPeriodo(periodo))}</div>
      <button type="button" aria-label="Mes siguiente" className={boton} onClick={() => onCambio(sumarMeses(periodo, 1))}>
        <ChevronRight {...IC} />
      </button>
    </div>
  )
}
