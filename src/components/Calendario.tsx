import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { capitalizar, hoyAR, nombreMes, sumarDias, sumarMeses } from '../lib/formato'
import { IC } from './ui'

const DIAS = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do']

/**
 * Calendario de un mes para elegir una fecha 'AAAA-MM-DD'. La semana empieza el lunes.
 * `marcados`: días con un punto debajo (por ejemplo, donde el paciente ya tiene sesión).
 */
export function Calendario({
  valor,
  onCambio,
  marcados,
  textoMarcados,
}: {
  valor: string
  onCambio: (fecha: string) => void
  marcados?: Set<string>
  textoMarcados?: string
}) {
  const hoy = hoyAR()
  const [mes, setMes] = useState(`${(valor || hoy).slice(0, 7)}-01`)

  // Lunes = 0 … domingo = 6.
  const [a, m] = mes.split('-').map(Number)
  const primerDia = (new Date(Date.UTC(a, m - 1, 1)).getUTCDay() + 6) % 7
  const diasDelMes = new Date(Date.UTC(a, m, 0)).getUTCDate()
  const celdas: (string | null)[] = [
    ...Array<null>(primerDia).fill(null),
    ...Array.from({ length: diasDelMes }, (_, i) => sumarDias(mes, i)),
  ]

  return (
    <div className="rounded-[18px] border border-line bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMes(sumarMeses(mes, -1))}
          aria-label="Mes anterior"
          className="grid size-11 place-items-center rounded-full hover:bg-surface2"
        >
          <ChevronLeft {...IC} />
        </button>
        <div className="text-base font-semibold" aria-live="polite">
          {capitalizar(nombreMes(mes))} {a}
        </div>
        <button
          type="button"
          onClick={() => setMes(sumarMeses(mes, 1))}
          aria-label="Mes siguiente"
          className="grid size-11 place-items-center rounded-full hover:bg-surface2"
        >
          <ChevronRight {...IC} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {DIAS.map((d) => (
          <div key={d} className="pb-1 text-xs font-semibold text-ink2 uppercase">
            {d}
          </div>
        ))}
        {celdas.map((f, i) => {
          if (!f) return <div key={`v${i}`} />
          const elegido = f === valor
          const esHoy = f === hoy
          return (
            <button
              key={f}
              type="button"
              onClick={() => onCambio(f)}
              aria-pressed={elegido}
              aria-label={f.split('-').reverse().join('/')}
              className={`relative mx-auto grid size-11 place-items-center rounded-full text-base tabular ${
                elegido
                  ? 'bg-acc font-semibold text-on-acc'
                  : esHoy
                    ? 'font-semibold text-acc-strong ring-1 ring-acc ring-inset hover:bg-surface2'
                    : 'hover:bg-surface2'
              }`}
            >
              {Number(f.slice(8))}
              {marcados?.has(f) && (
                <span className={`absolute bottom-1.5 size-1 rounded-full ${elegido ? 'bg-on-acc' : 'bg-acc'}`} />
              )}
            </button>
          )
        })}
      </div>
      {textoMarcados && marcados && marcados.size > 0 && (
        <div className="mt-2 flex items-center gap-2 px-1 text-sm text-ink2">
          <span className="size-1.5 rounded-full bg-acc" />
          {textoMarcados}
        </div>
      )}
    </div>
  )
}
