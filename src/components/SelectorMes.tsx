import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { capitalizar, formatPeriodo, hoyAR, mesCorto, periodoDe, sumarMeses } from '../lib/formato'
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
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)
  // Con letra grande las flechas no pasan de 46 px, para que el selector entre en el celular.
  const boton = 'grid size-[min(2.625rem,46px)] shrink-0 place-items-center rounded-full hover:bg-surface2'

  // Se cierra tocando afuera o con Escape.
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: PointerEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false)
    }
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('pointerdown', fuera)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('pointerdown', fuera)
      document.removeEventListener('keydown', tecla)
    }
  }, [abierto])

  return (
    <div ref={caja} className="relative inline-block max-w-full">
      <div className="inline-flex max-w-full items-center gap-0.5 rounded-full border border-line bg-surface p-1">
        <button type="button" aria-label="Mes anterior" className={boton} onClick={() => onCambio(sumarMeses(periodo, -1))}>
          <ChevronLeft {...IC} />
        </button>
        <button
          type="button"
          onClick={() => setAbierto((a) => !a)}
          aria-expanded={abierto}
          aria-label={`Elegir mes (ahora ${formatPeriodo(periodo)})`}
          className="flex min-w-0 items-center justify-center gap-2 rounded-full px-2 py-2 text-[min(1.0625rem,20px)] font-semibold whitespace-nowrap hover:bg-surface2"
        >
          <CalendarDays {...IC} className="text-ink2" />
          {capitalizar(formatPeriodo(periodo))}
        </button>
        <button type="button" aria-label="Mes siguiente" className={boton} onClick={() => onCambio(sumarMeses(periodo, 1))}>
          <ChevronRight {...IC} />
        </button>
      </div>
      {abierto && (
        <CalendarioMeses
          periodo={periodo}
          onCambio={(p) => {
            onCambio(p)
            setAbierto(false)
          }}
        />
      )}
    </div>
  )
}

/** Grilla de 12 meses con el año arriba. */
function CalendarioMeses({ periodo, onCambio }: { periodo: string; onCambio: (p: string) => void }) {
  const [anio, setAnio] = useState(Number(periodo.slice(0, 4)))
  const actual = periodoDe(hoyAR())
  const boton = 'grid size-11 place-items-center rounded-full hover:bg-surface2'
  return (
    <div className="absolute top-full left-0 z-30 mt-2 w-[19rem] max-w-[calc(100vw-2rem)] rounded-[1.375rem] border border-line bg-surface p-3 shadow-[0_12px_32px_rgba(0,0,0,.22)] md:right-0 md:left-auto">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" aria-label="Año anterior" className={boton} onClick={() => setAnio(anio - 1)}>
          <ChevronLeft {...IC} />
        </button>
        <div className="text-lg font-semibold tabular">{anio}</div>
        <button type="button" aria-label="Año siguiente" className={boton} onClick={() => setAnio(anio + 1)}>
          <ChevronRight {...IC} />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 12 }, (_, i) => {
          const p = `${anio}-${String(i + 1).padStart(2, '0')}-01`
          const elegido = p === periodo
          return (
            <button
              key={p}
              type="button"
              onClick={() => onCambio(p)}
              aria-pressed={elegido}
              aria-label={capitalizar(formatPeriodo(p))}
              className={`h-12 rounded-full text-base font-semibold ${
                elegido
                  ? 'bg-acc text-on-acc'
                  : p === actual
                    ? 'text-acc-strong ring-1 ring-acc ring-inset hover:bg-surface2'
                    : 'hover:bg-surface2'
              }`}
            >
              {capitalizar(mesCorto(p))}
            </button>
          )
        })}
      </div>
    </div>
  )
}
