import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Check, MessageCircle, Undo2 } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Avatar, Boton, Chip, EstadoError, EstadoVacio, Esqueleto, IC, Segmentado, Tarjeta, Titulo } from '../../components/ui'
import { nombreCompleto, useDatos } from '../../lib/datos'
import { capitalizar, formatFecha, hoyAR, nombreMes, periodoDe, ZONA_AR } from '../../lib/formato'
import { linkRecordatorio, porRecordar, textoMeses, type PorRecordar } from '../../lib/recordatorios'
import { textoDeuda } from '../../lib/resumen'
import { mensajeError, supabase } from '../../lib/supabase'

type Vista = 'enviar' | 'enviados'

/** Fecha 'AAAA-MM-DD' en Argentina de un timestamp. */
const diaAR = (ts: string) => new Date(ts).toLocaleDateString('en-CA', { timeZone: ZONA_AR })

/** Recordatorios del mes: quién debe, mandarle el WhatsApp y marcar a quién ya se le escribió. */
export function RecordatoriosPage() {
  const { perfil, pacientes, sesiones, pagos, cargando, error, reintentar } = useDatos()
  const periodo = periodoDe(hoyAR())
  const qc = useQueryClient()
  const [vista, setVista] = useState<Vista>('enviar')

  const enviados = useQuery({
    queryKey: ['recordatorios', periodo],
    queryFn: async () => {
      const { data, error } = await supabase.from('recordatorios').select('patient_id, enviado_en').eq('periodo', periodo)
      if (error) throw error
      return new Map(data.map((r) => [r.patient_id as string, r.enviado_en as string]))
    },
  })

  const marcar = useMutation({
    mutationFn: async ({ id, enviado }: { id: string; enviado: boolean }) => {
      const { error } = enviado
        ? await supabase.from('recordatorios').upsert({ patient_id: id, periodo, enviado_en: new Date().toISOString() })
        : await supabase.from('recordatorios').delete().eq('patient_id', id).eq('periodo', periodo)
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['recordatorios', periodo] }),
  })

  const lista = useMemo(() => porRecordar(pacientes, sesiones, pagos), [pacientes, sesiones, pagos])

  if (perfil && !perfil.ver_recordatorios) return <Navigate to="/ajustes" replace />
  if (cargando || enviados.isLoading) return <Esqueleto que="los recordatorios" />
  if (error || enviados.error)
    return (
      <EstadoError
        que="los recordatorios"
        reintentar={() => {
          reintentar()
          void enviados.refetch()
        }}
      />
    )

  const mapa = enviados.data ?? new Map<string, string>()
  const porEnviar = lista.filter((r) => !mapa.has(r.paciente.id))
  const yaEnviados = lista.filter((r) => mapa.has(r.paciente.id))
  const visibles = vista === 'enviar' ? porEnviar : yaEnviados

  async function cambiar(r: PorRecordar, enviado: boolean, silencioso = false) {
    try {
      await marcar.mutateAsync({ id: r.paciente.id, enviado })
      if (!silencioso) toast.success(enviado ? `${r.paciente.nombre}: marcado como enviado` : `${r.paciente.nombre}: vuelve a Por enviar`)
    } catch (e) {
      toast.error(`No se pudo guardar: ${mensajeError(e)}`)
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <Titulo sub={`Quién te debe hoy. Al mandar el WhatsApp queda marcado como enviado en ${nombreMes(periodo)}.`}>
        Recordatorios
      </Titulo>

      {lista.length === 0 ? (
        <EstadoVacio icono={Check} titulo="Nadie te debe">
          Cuando un paciente tenga {perfil?.termino === 'consulta' ? 'consultas' : 'sesiones'} sin pagar, aparece acá para mandarle el recordatorio.
        </EstadoVacio>
      ) : (
        <>
          <Segmentado
            opciones={[
              { v: 'enviar' as Vista, l: `Por enviar (${porEnviar.length})` },
              { v: 'enviados' as Vista, l: `Enviados (${yaEnviados.length})` },
            ]}
            valor={vista}
            onCambio={setVista}
            className="self-start"
          />

          {visibles.length === 0 ? (
            <Tarjeta className="px-6 py-10 text-center text-[1.0625rem] text-ink2">
              {vista === 'enviar' ? `Ya les escribiste a todos en ${nombreMes(periodo)}.` : 'Todavía no mandaste recordatorios este mes.'}
            </Tarjeta>
          ) : (
            <Tarjeta className="p-2">
              {visibles.map((r) => {
                const wa = linkRecordatorio(r, perfil)
                const enviado = mapa.get(r.paciente.id)
                return (
                  <div key={r.paciente.id} className="flex items-center gap-3 rounded-2xl px-3.5 py-3 [&+&]:border-t [&+&]:border-line">
                    <Avatar nombre={nombreCompleto(r.paciente)} className="size-11 text-[0.9375rem]" />
                    <div className="min-w-0 flex-1">
                      <Link to={`/pacientes/${r.paciente.id}`} className="block truncate text-[1.0625rem] font-semibold">
                        {nombreCompleto(r.paciente)}
                      </Link>
                      <div className="mt-0.5 text-base font-semibold tabular">{textoDeuda(r.deuda)}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink2">
                        {capitalizar(textoMeses(r.meses))}
                        {enviado && <Chip tono="ok">Enviado el {formatFecha(diaAR(enviado))}</Chip>}
                        {!wa && <span>· Sin teléfono cargado</span>}
                      </div>
                    </div>
                    {enviado ? (
                      <Boton variante="texto" alto="h-11" icono={Undo2} onClick={() => cambiar(r, false)} aria-label="Volver a Por enviar">
                        <span className="max-sm:hidden">Desmarcar</span>
                      </Boton>
                    ) : wa ? (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => void cambiar(r, true, true)}
                        aria-label={`Mandar recordatorio a ${r.paciente.nombre} por WhatsApp`}
                        className="flex h-11 shrink-0 items-center gap-2 rounded-[0.875rem] bg-wa-soft px-3.5 font-semibold text-wa hover:brightness-95"
                      >
                        <MessageCircle {...IC} />
                        <span className="max-sm:hidden">WhatsApp</span>
                      </a>
                    ) : (
                      <Boton variante="borde" alto="h-11" icono={Check} onClick={() => cambiar(r, true)}>
                        <span className="max-sm:hidden">Marcar enviado</span>
                      </Boton>
                    )}
                  </div>
                )
              })}
            </Tarjeta>
          )}
        </>
      )}
    </section>
  )
}
