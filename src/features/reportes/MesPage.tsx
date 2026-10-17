import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Download, FileSpreadsheet, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { SelectorMes, useMesSeleccionado } from '../../components/SelectorMes'
import { Avatar, Boton, EstadoError, EstadoVacio, Esqueleto, MontoGrande, Tarjeta } from '../../components/ui'
import { useDatos } from '../../lib/datos'
import { etiquetaDia, formatMonto, nombreMes, periodoDe, plural, redondear2 } from '../../lib/formato'
import { reporteMes } from '../../lib/reportes'
import type { EstadoSesion } from '../../lib/saldos'
import { mensajeError } from '../../lib/supabase'
import { usePalabras } from '../../components/usePalabras'
import { useRegistro } from '../registro/RegistroContext'

type EstadoPunto = EstadoSesion | 'programada' | 'cancelada'
const PUNTO: Record<EstadoPunto, string> = {
  pagada: 'bg-acc-soft text-acc-strong',
  parcial: 'bg-warn-soft text-warn',
  pendiente: 'bg-bad-soft text-bad',
  programada: 'border border-dashed border-line text-ink2',
  cancelada: 'bg-surface2 text-ink2 line-through opacity-60',
}
const TEXTO_ESTADO: Record<EstadoPunto, string> = {
  pagada: 'Pagada',
  parcial: 'Parcial',
  pendiente: 'Pendiente',
  programada: 'Programada',
  cancelada: 'Cancelada',
}
const COLUMNAS = 'grid-cols-[minmax(11.875rem,1.5fr)_minmax(13.75rem,2fr)_repeat(3,minmax(7.5rem,1fr))]'

export function MesPage() {
  const { perfil, pacientes, sesiones, pagos, cargando, error, reintentar } = useDatos()
  const [periodo, setPeriodo] = useMesSeleccionado()
  const { abrir } = useRegistro()
  const pal = usePalabras()
  const navegar = useNavigate()
  const [exportando, setExportando] = useState(false)
  const r = useMemo(() => reporteMes(periodo, pacientes, sesiones, pagos), [periodo, pacientes, sesiones, pagos])
  /** Lo que pagaron las obras sociales en el mes (por fecha de pago), si la función está prendida. */
  const deObrasSociales = useMemo(() => {
    const t = { ARS: 0, USD: 0 }
    if (perfil?.usa_obras_sociales)
      for (const p of pagos) if (p.pagador === 'obra_social' && periodoDe(p.fecha) === periodo) t[p.moneda] = redondear2(t[p.moneda] + p.monto)
    return t
  }, [perfil?.usa_obras_sociales, pagos, periodo])

  if (cargando) return <Esqueleto que="el reporte" tarjetas />
  if (error) return <EstadoError que="el reporte" reintentar={reintentar} />

  async function exportar() {
    setExportando(true)
    try {
      const { exportarReporteMes } = await import('../../lib/exportar')
      await exportarReporteMes(periodo, pacientes, sesiones, pagos)
      toast.success(`Reporte de ${nombreMes(periodo)} exportado`)
    } catch (e) {
      toast.error(`No se pudo exportar: ${mensajeError(e)}`)
    } finally {
      setExportando(false)
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <div data-tour="reporte-mes" className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="m-0 font-serif text-[clamp(2.375rem,5cqi,3.25rem)] leading-none font-normal">Reporte del mes</h1>
        <div className="flex flex-wrap gap-2.5">
          <SelectorMes periodo={periodo} onCambio={setPeriodo} />
          <Boton variante="borde" icono={FileSpreadsheet} onClick={() => navegar('/contadora')}>
            Para contadora
          </Boton>
          <Boton variante="borde" icono={Download} disabled={!r.filas.length} cargando={exportando} onClick={exportar}>
            Descargar Excel
          </Boton>
        </div>
      </div>

      {r.filas.length === 0 ? (
        <EstadoVacio
          icono={Calendar}
          titulo={`No hubo ${pal.sesiones} en ${nombreMes(periodo)}`}
          acciones={
            <Boton icono={Plus} alto="h-[3.125rem]" onClick={() => abrir({ modo: 'sesion' })}>
              Registrar {pal.sesion}
            </Boton>
          }
        >
          Cuando registres {pal.sesiones} de este mes, vas a ver acá lo cobrado y lo pendiente.
        </EstadoVacio>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] gap-3">
            {r.totales.map((t) => {
              const pct = t.facturado ? Math.round((t.cobrado / t.facturado) * 100) : 0
              return (
                <Tarjeta key={t.moneda} className="flex flex-col gap-3.5 p-[1.375rem]">
                  <div className="flex justify-between text-[0.9375rem] font-medium text-ink2">
                    <span>{t.moneda === 'ARS' ? 'Pesos · ARS' : 'Dólares · USD'}</span>
                    <span>{plural(t.sesiones, pal.sesion, pal.sesiones)}</span>
                  </div>
                  <div>
                    <div className="mb-1.5 text-sm text-ink2">Cobrado</div>
                    <MontoGrande monto={t.cobrado} moneda={t.moneda} className="text-[clamp(2rem,4cqi,2.625rem)]" />
                  </div>
                  <div
                    className="h-2.5 overflow-hidden rounded-full bg-bad-soft"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div className="h-full rounded-full bg-acc" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex flex-wrap justify-between gap-3 text-[0.9375rem]">
                    <span className="text-ink2">de {formatMonto(t.facturado, t.moneda)} facturado</span>
                    <span className="font-semibold text-bad">Pendiente {formatMonto(t.pendiente, t.moneda)}</span>
                  </div>
                  {deObrasSociales[t.moneda] > 0 && (
                    <div className="text-sm text-ink2">
                      Pagos de obras sociales en {nombreMes(periodo)}: {formatMonto(deObrasSociales[t.moneda], t.moneda)}
                    </div>
                  )}
                </Tarjeta>
              )
            })}
          </div>

          <Tarjeta className="overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-[45rem]">
                <div className={`grid ${COLUMNAS} gap-3 border-b border-line px-[1.375rem] py-4 text-[0.8125rem] font-bold tracking-[.06em] text-ink2 uppercase`}>
                  <div>Paciente</div>
                  <div>{pal.Sesiones}</div>
                  <div className="text-right">Facturado</div>
                  <div className="text-right">Cobrado</div>
                  <div className="text-right">Pendiente</div>
                </div>
                {r.filas.map((f) => (
                  <button
                    key={`${f.paciente.id}-${f.moneda}`}
                    type="button"
                    onClick={() => navegar(`/pacientes/${f.paciente.id}`)}
                    className={`grid w-full ${COLUMNAS} items-center gap-3 border-b border-line px-[1.375rem] py-3.5 text-left text-base tabular hover:bg-surface2`}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar nombre={f.nombre} className="size-9 text-[0.8125rem]" />
                      <span className="truncate font-semibold">{f.nombre}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {f.sesiones.map((s) => (
                        <span
                          key={s.fecha}
                          title={`${etiquetaDia(s.fecha)} · ${s.ausente ? 'Ausente · ' : ''}${TEXTO_ESTADO[s.estado]}`}
                          className={`grid size-[2.125rem] place-items-center rounded-full text-[0.8125rem] font-bold ${PUNTO[s.estado]} ${s.ausente ? 'ring-2 ring-warn ring-offset-1 ring-offset-surface' : ''}`}
                        >
                          {Number(s.fecha.slice(8))}
                        </span>
                      ))}
                    </div>
                    <div className="text-right">{formatMonto(f.facturado, f.moneda)}</div>
                    <div className="text-right">{formatMonto(f.cobrado, f.moneda)}</div>
                    <div className={`text-right font-semibold ${f.pendiente ? 'text-bad' : 'text-ink2'}`}>
                      {f.pendiente ? formatMonto(f.pendiente, f.moneda) : '—'}
                    </div>
                  </button>
                ))}
                {r.totales.map((t) => (
                  <div key={t.moneda} className={`grid ${COLUMNAS} gap-3 bg-surface2 px-[1.375rem] py-4 text-base font-bold tabular`}>
                    <div>Total {t.moneda}</div>
                    <div className="font-medium text-ink2">{plural(t.sesiones, pal.sesion, pal.sesiones)}</div>
                    <div className="text-right">{formatMonto(t.facturado, t.moneda)}</div>
                    <div className="text-right">{formatMonto(t.cobrado, t.moneda)}</div>
                    <div className="text-right text-bad">{formatMonto(t.pendiente, t.moneda)}</div>
                  </div>
                ))}
              </div>
            </div>
          </Tarjeta>

          <div className="flex flex-wrap gap-[1.125rem] text-sm text-ink2">
            {(['pagada', 'parcial', 'pendiente'] as const).map((e) => (
              <span key={e} className="flex items-center gap-2">
                <span
                  className={`size-3 rounded-full border-2 ${
                    e === 'pagada' ? 'border-acc bg-acc-soft' : e === 'parcial' ? 'border-warn bg-warn-soft' : 'border-bad bg-bad-soft'
                  }`}
                />
                {TEXTO_ESTADO[e]}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
