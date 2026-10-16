import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChartColumn, Check, ClipboardList, Play } from 'lucide-react'
import { Boton, Campo, Chip, Esqueleto, IC, Tarjeta, Titulo, type Tono } from '../../components/ui'
import { usePerfil } from '../../lib/datos'
import { formatDuracion, type Encuesta, type ResultadoEjercicio } from './analisis'
import { ENCUESTA } from './ejercicios'
import { usePrueba } from './PruebaContext'

const ESTADO: Record<ResultadoEjercicio['estado'], { tono: Tono; texto: string }> = {
  logrado: { tono: 'ok', texto: 'Lo logré' },
  no_pude: { tono: 'mal', texto: 'No pude' },
  salteado: { tono: 'neutro', texto: 'Salteado' },
  en_curso: { tono: 'parcial', texto: 'Empezado' },
}

export function PruebasPage() {
  const { fila, cargando, ejercicios, activo, crear, continuar, empezar } = usePrueba()
  const { data: perfil } = usePerfil()
  const navegar = useNavigate()
  const [nombre, setNombre] = useState('')
  const [creando, setCreando] = useState(false)

  if (cargando) return <Esqueleto que="las pruebas" />

  const enlaceResultados = perfil?.es_admin && (
    <Boton variante="borde" alto="h-12" icono={ChartColumn} className="self-start px-4" onClick={() => navegar('/pruebas/resultados')}>
      Ver resultados de todas
    </Boton>
  )

  if (!fila) {
    return (
      <section className="flex max-w-[45rem] flex-col gap-5">
        <Titulo sub="Unos 30 minutos · desde el celular o la compu">Probá honorapp</Titulo>
        <Tarjeta className="flex flex-col gap-4 p-[1.375rem] text-[1.0625rem] leading-normal">
          <p className="m-0">
            Te vamos a pedir {ejercicios.length} tareas cortas, como cargar un paciente o descargar un reporte. Arriba de
            la pantalla vas a ver cada consigna con un reloj. Hacelas como te salgan: si algo no se entiende, es culpa de
            la app y eso es justo lo que queremos encontrar.
          </p>
          <ul className="m-0 flex flex-col gap-2 pl-0">
            {[
              'Usá datos inventados, nunca pacientes reales.',
              'El reloj cuenta solo mientras tenés la app abierta.',
              'Podés pausar y seguir otro día: todo se guarda al terminar cada tarea.',
              'Al final hay una encuesta de 8 preguntas.',
            ].map((t) => (
              <li key={t} className="flex list-none items-start gap-2.5">
                <Check {...IC} className="mt-1 shrink-0 text-acc-strong" />
                {t}
              </li>
            ))}
          </ul>
          <Campo
            etiqueta="Tu nombre"
            opcional
            id="prueba-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Para saber quién respondió"
          />
          <Boton
            alto="h-[3.25rem]"
            icono={Play}
            className="self-start px-6"
            cargando={creando}
            onClick={async () => {
              setCreando(true)
              await crear(nombre)
              setCreando(false)
            }}
          >
            Empezar las pruebas
          </Boton>
        </Tarjeta>
        {enlaceResultados}
      </section>
    )
  }

  const hechos = ejercicios.filter((e) => fila.ejercicios[e.id] && fila.ejercicios[e.id].estado !== 'en_curso').length
  const todosHechos = hechos === ejercicios.length

  return (
    <section className="flex max-w-[45rem] flex-col gap-5">
      <Titulo sub={`${hechos} de ${ejercicios.length} tareas hechas`}>Probá honorapp</Titulo>

      {!todosHechos && !activo && (
        <Boton alto="h-[3.25rem]" icono={Play} className="self-start px-6" onClick={continuar}>
          {hechos ? 'Seguir con las pruebas' : 'Empezar las pruebas'}
        </Boton>
      )}

      {todosHechos && !fila.terminado && <FormEncuesta />}

      {fila.terminado && (
        <Tarjeta className="flex flex-col gap-2 p-[1.375rem]">
          <div className="text-xl font-semibold">¡Gracias por tu tiempo!</div>
          <p className="m-0 text-[1.0625rem] leading-normal text-ink2">
            Tus respuestas ya están guardadas. Con lo que nos contaste vamos a ordenar qué mejorar primero.
          </p>
        </Tarjeta>
      )}

      <Tarjeta className="flex flex-col p-2">
        {ejercicios.map((e, i) => {
          const r = fila.ejercicios[e.id]
          const est = r ? ESTADO[r.estado] : null
          return (
            <div key={e.id} className="flex items-center gap-3 rounded-2xl px-3.5 py-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-full bg-surface2 text-sm font-semibold tabular">{i + 1}</div>
              <div className="min-w-0 flex-1">
                <div className="text-base font-semibold">{e.titulo}</div>
                {r && r.estado !== 'en_curso' && r.estado !== 'salteado' && (
                  <div className="text-sm text-ink2">{formatDuracion(r.ms)}</div>
                )}
              </div>
              {est ? (
                <Chip tono={est.tono}>{est.texto}</Chip>
              ) : (
                !activo && (
                  <Boton variante="suave" alto="h-10" className="px-3.5 text-sm" onClick={() => empezar(e.id)}>
                    Hacer
                  </Boton>
                )
              )}
            </div>
          )
        })}
      </Tarjeta>
      {enlaceResultados}
    </section>
  )
}

function Opciones({
  opciones,
  valor,
  onCambio,
  multiple,
  maximo,
}: {
  opciones: readonly string[]
  valor: string[]
  onCambio: (v: string[]) => void
  multiple?: boolean
  maximo?: number
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {opciones.map((o) => {
        const elegida = valor.includes(o)
        const lleno = multiple && maximo != null && valor.length >= maximo && !elegida
        return (
          <button
            key={o}
            type="button"
            aria-pressed={elegida}
            disabled={lleno}
            onClick={() => {
              if (!multiple) onCambio([o])
              else onCambio(elegida ? valor.filter((x) => x !== o) : [...valor, o])
            }}
            className={`min-h-11 rounded-full border px-4 py-2 text-left text-[0.9375rem] font-semibold disabled:opacity-40 ${
              elegida ? 'border-ink bg-ink text-fondo' : 'border-line bg-surface hover:bg-surface2'
            }`}
          >
            {o}
          </button>
        )
      })}
    </div>
  )
}

function FormEncuesta() {
  const { guardarEncuesta } = usePrueba()
  const [r, setR] = useState<Encuesta>({})
  const [guardando, setGuardando] = useState(false)
  const set = <K extends keyof Encuesta>(k: K, v: Encuesta[K]) => setR((prev) => ({ ...prev, [k]: v }))
  const noPagaria = r.pagaria === ENCUESTA.pagaria.opciones[3]
  const completa = r.hoy && r.sirvio?.length && r.costo?.length && r.falto?.length && r.recomendaria != null && r.pagaria

  const pregunta = 'flex flex-col gap-3'
  const titulo = 'text-[1.0625rem] font-semibold'

  return (
    <Tarjeta className="flex flex-col gap-6 p-[1.375rem]">
      <div className="flex items-center gap-2.5 text-xl font-semibold">
        <ClipboardList {...IC} className="text-acc-strong" />
        Última parte: 8 preguntas
      </div>

      <div className={pregunta}>
        <div className={titulo}>1. {ENCUESTA.hoy.pregunta}</div>
        <Opciones opciones={ENCUESTA.hoy.opciones} valor={r.hoy ? [r.hoy] : []} onCambio={(v) => set('hoy', v[0])} />
      </div>
      <div className={pregunta}>
        <div className={titulo}>2. {ENCUESTA.sirvio.pregunta}</div>
        <Opciones opciones={ENCUESTA.sirvio.opciones} valor={r.sirvio ?? []} onCambio={(v) => set('sirvio', v)} multiple maximo={ENCUESTA.sirvio.maximo} />
      </div>
      <div className={pregunta}>
        <div className={titulo}>3. {ENCUESTA.costo.pregunta}</div>
        <Opciones opciones={ENCUESTA.costo.opciones} valor={r.costo ?? []} onCambio={(v) => set('costo', v)} multiple />
      </div>
      <div className={pregunta}>
        <div className={titulo}>4. {ENCUESTA.falto.pregunta}</div>
        <Opciones opciones={ENCUESTA.falto.opciones} valor={r.falto ?? []} onCambio={(v) => set('falto', v)} multiple />
      </div>
      <div className={pregunta}>
        <div className={titulo}>5. {ENCUESTA.recomendaria.pregunta}</div>
        <div role="radiogroup" aria-label="Del 0 al 10" className="grid grid-cols-11 gap-1">
          {Array.from({ length: 11 }, (_, n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={r.recomendaria === n}
              onClick={() => set('recomendaria', n)}
              className={`grid aspect-square w-full place-items-center rounded-xl border text-base font-semibold tabular ${
                r.recomendaria === n ? 'border-ink bg-ink text-fondo' : 'border-line bg-surface hover:bg-surface2'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-sm text-ink2">
          <span>Nada probable</span>
          <span>Muy probable</span>
        </div>
      </div>
      <div className={pregunta}>
        <div className={titulo}>6. {ENCUESTA.pagaria.pregunta}</div>
        <Opciones opciones={ENCUESTA.pagaria.opciones} valor={r.pagaria ? [r.pagaria] : []} onCambio={(v) => set('pagaria', v[0])} />
      </div>
      {!noPagaria && (
        <div className={pregunta}>
          <div className={titulo}>7. {ENCUESTA.precio.pregunta}</div>
          <Opciones opciones={ENCUESTA.precio.opciones} valor={r.precio ? [r.precio] : []} onCambio={(v) => set('precio', v[0])} />
        </div>
      )}
      <label className={pregunta}>
        <span className={titulo}>8. {ENCUESTA.comentario.pregunta}</span>
        <textarea
          id="encuesta-comentario"
          rows={3}
          maxLength={1500}
          value={r.comentario ?? ''}
          onChange={(e) => set('comentario', e.target.value)}
          placeholder="Una idea, algo que te molestó, algo que te gustó. Por favor, sin datos de pacientes."
          className="rounded-[0.875rem] border border-line bg-fondo px-4 py-3 text-base outline-none focus:border-acc"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Boton
          alto="h-[3.25rem]"
          className="px-6"
          disabled={!completa}
          cargando={guardando}
          onClick={async () => {
            setGuardando(true)
            await guardarEncuesta({ ...r, precio: noPagaria ? undefined : r.precio })
            setGuardando(false)
          }}
        >
          Enviar respuestas
        </Boton>
        {!completa && <span className="text-sm text-ink2">Respondé de la 1 a la 6 para enviar.</span>}
      </div>
    </Tarjeta>
  )
}
