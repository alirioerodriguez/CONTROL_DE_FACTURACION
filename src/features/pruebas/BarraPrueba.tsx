import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Play, X } from 'lucide-react'
import { IC, Spinner } from '../../components/ui'
import { formatDuracion } from './analisis'
import { usePrueba } from './PruebaContext'

const DIFICULTAD = ['Muy fácil', 'Fácil', 'Normal', 'Difícil', 'Muy difícil']

/** Barra fija arriba de la app durante las pruebas: consigna, reloj y botones para terminar cada ejercicio. */
export function BarraPrueba() {
  const { activo, ejercicio, numero, ejercicios, msActual, empezar, terminar, calificar, saltear, salir } = usePrueba()
  const [abierta, setAbierta] = useState(true)
  const [ms, setMs] = useState(0)
  const [dificultad, setDificultad] = useState<number | null>(null)
  const [comentario, setComentario] = useState('')
  const [guardando, setGuardando] = useState(false)
  const caja = useRef<HTMLDivElement>(null)

  const fase = activo?.fase

  // El reloj se redibuja cada segundo; el tiempo real lo lleva el contexto.
  useEffect(() => {
    if (fase !== 'corriendo') return
    setMs(msActual())
    const t = setInterval(() => setMs(msActual()), 1000)
    return () => clearInterval(t)
  }, [fase, msActual])

  // Al cambiar de ejercicio o de fase: panel abierto para leer la consigna y calificación en blanco.
  useEffect(() => {
    setAbierta(fase !== 'corriendo')
    if (fase === 'calificando') {
      setDificultad(null)
      setComentario('')
    }
  }, [fase, activo?.id])

  // La app se corre hacia abajo lo que mide la barra, así no tapa nada.
  useLayoutEffect(() => {
    const el = caja.current
    if (!el) return
    const raiz = document.documentElement
    const medir = () => raiz.style.setProperty('--barra-prueba', `${el.offsetHeight}px`)
    medir()
    const o = new ResizeObserver(medir)
    o.observe(el)
    return () => {
      o.disconnect()
      raiz.style.removeProperty('--barra-prueba')
    }
  }, [])

  if (!activo || !ejercicio) return null

  async function guardar() {
    if (dificultad == null) return
    setGuardando(true)
    await calificar(dificultad, comentario)
    setGuardando(false)
  }

  const botonClaro = 'inline-flex h-11 items-center justify-center gap-2 rounded-full px-4 text-[0.9375rem] font-semibold'

  return (
    <div
      ref={caja}
      role="region"
      aria-label="Prueba de honorapp"
      className="fixed inset-x-0 top-0 z-[70] bg-[#1e2420] text-white shadow-[0_10px_28px_rgba(0,0,0,.28)]"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="mx-auto flex max-w-[60rem] flex-col gap-3 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold tracking-wide uppercase opacity-70">
              Ejercicio {numero} de {ejercicios.length}
              {fase === 'listo' && ' · por empezar'}
            </div>
            <div className="truncate text-base font-semibold">{ejercicio.titulo}</div>
          </div>
          {fase === 'corriendo' && (
            <div className="text-lg font-semibold tabular" aria-label="Tiempo">
              {formatDuracion(ms)}
            </div>
          )}
          {fase === 'corriendo' && (
            <button
              type="button"
              onClick={() => setAbierta((a) => !a)}
              aria-expanded={abierta}
              aria-label={abierta ? 'Ocultar consigna' : 'Ver consigna'}
              className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/20"
            >
              {abierta ? <ChevronUp {...IC} /> : <ChevronDown {...IC} />}
            </button>
          )}
        </div>

        {fase === 'listo' && (
          <div className="flex flex-col gap-3 pb-1">
            <p className="m-0 text-[1.0625rem] leading-snug">{ejercicio.instruccion}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => empezar(ejercicio.id)} className={`${botonClaro} bg-acc text-on-acc hover:bg-acc-strong`}>
                <Play {...IC} />
                Empezar
              </button>
              <button type="button" onClick={() => void saltear()} className={`${botonClaro} bg-white/10 hover:bg-white/20`}>
                Saltear
              </button>
              <button type="button" onClick={salir} className={`${botonClaro} bg-transparent underline-offset-4 hover:underline`}>
                Pausar las pruebas
              </button>
            </div>
          </div>
        )}

        {fase === 'corriendo' && abierta && (
          <div className="flex flex-col gap-3 pb-1">
            <p className="m-0 text-[1.0625rem] leading-snug">{ejercicio.instruccion}</p>
            <p className="m-0 text-sm opacity-75">Lo lograste si: {ejercicio.logrado}</p>
          </div>
        )}

        {fase === 'corriendo' && (
          <div className="flex flex-wrap gap-2 pb-1">
            <button type="button" onClick={() => terminar('logrado')} className={`${botonClaro} bg-acc text-on-acc hover:bg-acc-strong`}>
              <Check {...IC} />
              Lo logré
            </button>
            <button type="button" onClick={() => terminar('no_pude')} className={`${botonClaro} bg-white/10 hover:bg-white/20`}>
              <X {...IC} />
              No pude
            </button>
          </div>
        )}

        {fase === 'calificando' && (
          <div className="flex flex-col gap-3 pb-1">
            <div className="text-[1.0625rem] font-semibold">
              {activo.estado === 'logrado' ? '¡Bien!' : 'Gracias, eso nos ayuda mucho.'} ¿Qué tan fácil te resultó?
            </div>
            <div role="radiogroup" aria-label="Dificultad" className="grid grid-cols-5 gap-1.5">
              {DIFICULTAD.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={dificultad === i + 1}
                  onClick={() => setDificultad(i + 1)}
                  className={`min-h-12 rounded-xl px-1 py-1.5 text-xs leading-tight font-semibold ${
                    dificultad === i + 1 ? 'bg-acc text-on-acc' : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              ¿Algo para contar? (opcional)
              <textarea
                id="prueba-comentario"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                rows={2}
                maxLength={600}
                placeholder="Qué te confundió, qué buscabas, qué esperabas encontrar…"
                className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-base font-normal text-white outline-none placeholder:text-white/50 focus:border-acc"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={dificultad == null || guardando}
                onClick={() => void guardar()}
                className={`${botonClaro} bg-acc text-on-acc hover:bg-acc-strong disabled:opacity-50`}
              >
                {guardando && <Spinner />}
                Guardar y seguir
              </button>
              {dificultad == null && <span className="text-sm opacity-75">Elegí qué tan fácil fue para seguir.</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
