import { useQuery } from '@tanstack/react-query'
import { Navigate } from 'react-router-dom'
import { ClipboardList, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Boton, Chip, EstadoError, EstadoVacio, Esqueleto, Tarjeta, Titulo, type Tono } from '../../components/ui'
import { usePerfil } from '../../lib/datos'
import { formatFecha } from '../../lib/formato'
import { supabase } from '../../lib/supabase'
import { contarOpciones, formatDuracion, nps, rankingProblemas, type FilaPrueba, type ResumenEjercicio } from './analisis'
import { ENCUESTA } from './ejercicios'
import { usePrueba } from './PruebaContext'

function tonoPuntaje(p: number | null): Tono {
  if (p == null) return 'neutro'
  if (p >= 50) return 'mal'
  if (p >= 25) return 'parcial'
  return 'ok'
}

const pct = (x: number | null) => (x == null ? '—' : `${Math.round(x * 100)} %`)

export function ResultadosPage() {
  const { data: perfil, isPending: cargandoPerfil } = usePerfil()
  const { ejercicios } = usePrueba()
  const consulta = useQuery({
    queryKey: ['pruebas', 'todas'],
    enabled: Boolean(perfil?.es_admin),
    queryFn: async (): Promise<FilaPrueba[]> => {
      const { data, error } = await supabase.rpc('resultados_pruebas')
      if (error) throw error
      return (data ?? []) as FilaPrueba[]
    },
  })

  if (cargandoPerfil) return <Esqueleto que="los resultados" />
  if (!perfil?.es_admin) return <Navigate to="/pruebas" replace />
  if (consulta.isPending) return <Esqueleto que="los resultados" tarjetas />
  if (consulta.error) return <EstadoError que="los resultados" reintentar={() => consulta.refetch()} />

  const filas = consulta.data
  const ranking = rankingProblemas(ejercicios, filas)
  const terminaron = filas.filter((f) => f.terminado).length
  const n = nps(filas)

  async function copiar() {
    const texto = JSON.stringify(
      {
        personas: filas.length,
        terminaron,
        nps: n,
        ranking: ranking.map((r) => ({
          ejercicio: r.ejercicio.titulo,
          puntaje: r.puntaje,
          hechos: r.hechos,
          exito: r.tasaExito,
          medianaSeg: r.medianaMs == null ? null : Math.round(r.medianaMs / 1000),
          esperadoSeg: r.ejercicio.esperado,
          dificultad: r.dificultadPromedio,
          pantallas: r.pantallas.slice(0, 4).map((p) => `${p.nombre} ${Math.round(p.msPromedio / 1000)}s`),
          comentarios: r.comentarios,
        })),
        encuesta: filas.map((f) => f.encuesta).filter(Boolean),
      },
      null,
      2,
    )
    try {
      await navigator.clipboard.writeText(texto)
      toast.success('Resultados copiados: pegalos en el chat con Claude')
    } catch {
      toast.error('No se pudo copiar. Probá desde la compu.')
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Titulo sub={`${filas.length} ${filas.length === 1 ? 'persona' : 'personas'} · ${terminaron} con la encuesta`}>
          Resultados de las pruebas
        </Titulo>
        {filas.length > 0 && (
          <Boton variante="borde" alto="h-12" icono={Copy} className="px-4" onClick={() => void copiar()}>
            Copiar resultados
          </Boton>
        )}
      </div>

      {filas.length === 0 ? (
        <EstadoVacio icono={ClipboardList} titulo="Todavía nadie hizo las pruebas">
          Pasale a tus colegas el link de la app y pediles que entren a «Probá honorapp» desde Ajustes.
        </EstadoVacio>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))] gap-3">
            <Dato etiqueta="Personas" valor={String(filas.length)} />
            <Dato etiqueta="Terminaron todo" valor={String(terminaron)} />
            <Dato etiqueta="Recomendarían (NPS)" valor={n ? String(n.valor) : '—'} nota={n ? `${n.respuestas} respuestas` : 'Sin respuestas'} />
            <Dato
              etiqueta="Desde el celular"
              valor={String(filas.filter((f) => f.dispositivo === 'celular').length)}
              nota={`${filas.filter((f) => (f.letra ?? 1) >= 3).length} con letra grande`}
            />
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="m-0 text-xl font-semibold">Qué arreglar primero</h2>
            <p className="m-0 max-w-[40rem] text-[0.9375rem] leading-normal text-ink2">
              Ordenado por puntaje de problema, de 0 a 100: pesa no haberlo logrado (50 %), la dificultad que marcaron (30 %) y
              tardar más de lo esperado (20 %).
            </p>
            {ranking.map((r, i) => (
              <FilaRanking key={r.ejercicio.id} r={r} posicion={i + 1} />
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="m-0 text-xl font-semibold">Encuesta</h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] gap-3">
              <Votos titulo={ENCUESTA.hoy.pregunta} datos={contarOpciones(filas, 'hoy', ENCUESTA.hoy.opciones)} />
              <Votos titulo={ENCUESTA.sirvio.pregunta} datos={contarOpciones(filas, 'sirvio', ENCUESTA.sirvio.opciones)} />
              <Votos titulo={ENCUESTA.costo.pregunta} datos={contarOpciones(filas, 'costo', ENCUESTA.costo.opciones)} />
              <Votos titulo={ENCUESTA.falto.pregunta} datos={contarOpciones(filas, 'falto', ENCUESTA.falto.opciones)} />
              <Votos titulo={ENCUESTA.pagaria.pregunta} datos={contarOpciones(filas, 'pagaria', ENCUESTA.pagaria.opciones)} />
              <Votos titulo={ENCUESTA.precio.pregunta} datos={contarOpciones(filas, 'precio', ENCUESTA.precio.opciones)} />
            </div>
            {filas.some((f) => f.encuesta?.comentario?.trim()) && (
              <Tarjeta className="flex flex-col gap-2 p-[1.375rem]">
                <div className="text-base font-semibold">{ENCUESTA.comentario.pregunta}</div>
                {filas
                  .map((f) => f.encuesta?.comentario?.trim())
                  .filter(Boolean)
                  .map((c, i) => (
                    <p key={i} className="m-0 border-t border-line pt-2 text-[0.9375rem] leading-normal first:border-0 first:pt-0">
                      {c}
                    </p>
                  ))}
              </Tarjeta>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="m-0 text-xl font-semibold">Quiénes participaron</h2>
            <Tarjeta className="flex flex-col p-2">
              {filas.map((f) => {
                const hechos = ejercicios.filter((e) => f.ejercicios?.[e.id] && f.ejercicios[e.id].estado !== 'en_curso').length
                return (
                  <div key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl px-3.5 py-3">
                    <div className="min-w-0 flex-1 text-base font-semibold">{f.nombre || 'Sin nombre'}</div>
                    <div className="text-sm text-ink2">
                      {f.dispositivo ?? '—'} · letra {f.letra ?? 1} · {formatFecha(f.created_at.slice(0, 10))}
                    </div>
                    <Chip tono={f.terminado ? 'ok' : 'parcial'}>
                      {f.terminado ? 'Terminó' : `${hechos} de ${ejercicios.length}`}
                    </Chip>
                  </div>
                )
              })}
            </Tarjeta>
          </div>
        </>
      )}
    </section>
  )
}

function Dato({ etiqueta, valor, nota }: { etiqueta: string; valor: string; nota?: string }) {
  return (
    <Tarjeta className="flex flex-col gap-1 p-[1.125rem]">
      <div className="text-[0.9375rem] font-medium text-ink2">{etiqueta}</div>
      <div className="num text-[2rem]">{valor}</div>
      {nota && <div className="text-sm text-ink2">{nota}</div>}
    </Tarjeta>
  )
}

function FilaRanking({ r, posicion }: { r: ResumenEjercicio; posicion: number }) {
  return (
    <Tarjeta className="flex flex-col gap-3 p-[1.125rem]">
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-surface2 text-sm font-semibold tabular">{posicion}</div>
        <div className="min-w-0 flex-1 text-[1.0625rem] font-semibold">{r.ejercicio.titulo}</div>
        <Chip tono={tonoPuntaje(r.puntaje)}>{r.puntaje == null ? 'Sin datos' : `Puntaje ${r.puntaje}`}</Chip>
      </div>
      {r.hechos > 0 && (
        <>
          <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(100%,8.5rem),1fr))] gap-x-4 gap-y-2 text-sm">
            <Par t="Lo lograron" v={`${pct(r.tasaExito)} (${r.logrados} de ${r.hechos})`} />
            <Par t="Tiempo (mediana)" v={`${formatDuracion(r.medianaMs)} · esperado ${formatDuracion(r.ejercicio.esperado * 1000)}`} />
            <Par t="Dificultad" v={r.dificultadPromedio == null ? '—' : `${r.dificultadPromedio.toFixed(1)} de 5`} />
            <Par t="Lo saltearon" v={String(r.salteados)} />
          </dl>
          {r.pantallas.length > 0 && (
            <div className="text-sm text-ink2">
              Pasaron por: {r.pantallas.slice(0, 4).map((p) => `${p.nombre} (${formatDuracion(p.msPromedio)})`).join(' · ')}
            </div>
          )}
          {r.comentarios.length > 0 && (
            <ul className="m-0 flex flex-col gap-1.5 border-t border-line pt-3 pl-0 text-[0.9375rem] leading-snug">
              {r.comentarios.map((c, i) => (
                <li key={i} className="list-none">
                  «{c}»
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Tarjeta>
  )
}

function Par({ t, v }: { t: string; v: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-ink2">{t}</dt>
      <dd className="m-0 font-semibold tabular">{v}</dd>
    </div>
  )
}

function Votos({ titulo, datos }: { titulo: string; datos: { opcion: string; votos: number }[] }) {
  const max = Math.max(1, ...datos.map((d) => d.votos))
  return (
    <Tarjeta className="flex flex-col gap-2.5 p-[1.125rem]">
      <div className="text-[0.9375rem] font-semibold">{titulo}</div>
      {datos.map((d) => (
        <div key={d.opcion} className="flex flex-col gap-1">
          <div className="flex justify-between gap-3 text-sm">
            <span className="min-w-0">{d.opcion}</span>
            <span className="font-semibold tabular">{d.votos}</span>
          </div>
          <div className="h-2 rounded-full bg-surface2">
            <div className="h-2 rounded-full bg-acc" style={{ width: `${(d.votos / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </Tarjeta>
  )
}
