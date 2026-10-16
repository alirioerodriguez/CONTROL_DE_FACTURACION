import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { AjustarAncho, Alerta, Boton, EstadoError, Esqueleto, IC, MontoGrande, Pastilla, Tarjeta, Titulo } from '../../components/ui'
import { ETIQUETA_MEDIO, useDatos } from '../../lib/datos'
import { capitalizar, formatFecha, formatMonto, formatPeriodo, hoyAR, partesMonto, periodoDe, plural, sumarMeses, type Moneda } from '../../lib/formato'
import { MEDIOS, mesesEntre, reporteContadora } from '../../lib/reportes'
import { mensajeError } from '../../lib/supabase'

const MONEDAS: Moneda[] = ['ARS', 'USD']
const COLUMNAS = 'grid-cols-[minmax(120px,1.2fr)_64px_repeat(5,minmax(116px,1fr))_84px]'

export function ContadoraPage() {
  const navegar = useNavigate()
  const { perfil, pacientes, pagos, cargando, error, reintentar } = useDatos()
  const actual = periodoDe(hoyAR())
  const [desde, setDesde] = useState(sumarMeses(actual, -5))
  const [hasta, setHasta] = useState(actual)
  const [abierto, setAbierto] = useState<string | null>(actual)
  const [exportando, setExportando] = useState<'xlsx' | 'pdf' | null>(null)

  const opcionesMes = useMemo(() => mesesEntre(sumarMeses(actual, -35), actual).reverse(), [actual])
  const rangoMalo = desde > hasta
  const r = useMemo(
    () => (rangoMalo ? null : reporteContadora(desde, hasta, hoyAR(), pacientes, pagos)),
    [rangoMalo, desde, hasta, pacientes, pagos],
  )

  if (cargando) return <Esqueleto que="el reporte para contadora" tarjetas />
  if (error) return <EstadoError que="el reporte para contadora" reintentar={reintentar} />

  const rapidos = [
    { l: 'Este mes', d: actual },
    { l: 'Últimos 3 meses', d: sumarMeses(actual, -2) },
    { l: 'Últimos 6 meses', d: sumarMeses(actual, -5) },
    { l: `Año ${actual.slice(0, 4)}`, d: `${actual.slice(0, 4)}-01-01` },
    { l: '12 meses', d: sumarMeses(actual, -11) },
  ]
  const hayPagos = !!r && r.cantidadPagos > 0

  async function exportar(tipo: 'xlsx' | 'pdf') {
    setExportando(tipo)
    try {
      const m = await import('../../lib/exportar')
      if (tipo === 'xlsx') await m.exportarContadoraXlsx(desde, hasta, perfil, pacientes, pagos)
      else await m.exportarContadoraPdf(desde, hasta, perfil, pacientes, pagos)
      toast.success(`Reporte para contadora exportado en ${tipo === 'xlsx' ? 'Excel' : 'PDF'}`)
    } catch (e) {
      toast.error(`No se pudo exportar: ${mensajeError(e)}`)
    } finally {
      setExportando(null)
    }
  }

  const etiquetaMes = (p: string) => capitalizar(formatPeriodo(p))
  const guion = (n: number, m: Moneda) => (n ? formatMonto(n, m) : '—')

  return (
    <section className="flex flex-col gap-6">
      <button
        type="button"
        onClick={() => navegar('/mes')}
        className="flex h-10 items-center gap-1.5 self-start rounded-full pr-3.5 pl-2 text-base font-semibold text-ink2 hover:bg-surface2 md:hidden"
      >
        <ChevronLeft {...IC} />
        Mes
      </button>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Titulo sub="Cobros según fecha de pago, por moneda y medio.">Reporte para contadora</Titulo>
        <div data-tour="descargar-contadora" className="flex flex-wrap gap-2">
          <Boton variante="borde" icono={Download} disabled={!hayPagos} cargando={exportando === 'xlsx'} onClick={() => exportar('xlsx')}>
            Descargar Excel
          </Boton>
          <Boton icono={FileText} disabled={!hayPagos} cargando={exportando === 'pdf'} onClick={() => exportar('pdf')}>
            Descargar PDF
          </Boton>
        </div>
      </div>

      <Tarjeta className="flex flex-col gap-4 p-5">
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {rapidos.map((q) => (
            <Pastilla
              key={q.l}
              activa={desde === q.d && hasta === actual}
              onClick={() => {
                setDesde(q.d)
                setHasta(actual)
              }}
            >
              {q.l}
            </Pastilla>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {(
            [
              ['Desde', desde, setDesde],
              ['Hasta', hasta, setHasta],
            ] as const
          ).map(([l, v, set]) => (
            <label key={l} className="flex max-w-[240px] flex-[1_1_160px] flex-col gap-1.5 text-sm font-semibold text-ink2">
              {l}
              <select
                value={v}
                onChange={(e) => set(e.target.value)}
                className="h-12 cursor-pointer rounded-xl border border-line bg-fondo px-3.5 text-base font-semibold text-ink"
              >
                {opcionesMes.map((p) => (
                  <option key={p} value={p}>
                    {etiquetaMes(p)}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {r && (
            <div className="pb-3 text-[15px] text-ink2">
              {plural(r.meses.length, 'mes', 'meses')} · {plural(r.cantidadPagos, 'pago', 'pagos')}
            </div>
          )}
        </div>
        {rangoMalo && <Alerta>El mes “Desde” es posterior a “Hasta”. Cambiá alguno de los dos.</Alerta>}
      </Tarjeta>

      {r && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,290px),1fr))] gap-3">
          {MONEDAS.filter((m) => r.totales[m].cantidad).map((m) => {
            const a = r.totales[m]
            return (
              <Tarjeta key={m} className="flex flex-col gap-3.5 p-[22px]">
                <div className="flex justify-between text-[15px] font-medium text-ink2">
                  <span>{m === 'ARS' ? 'Pesos · ARS' : 'Dólares · USD'}</span>
                  <span>{plural(a.cantidad, 'pago', 'pagos')}</span>
                </div>
                <MontoGrande monto={a.total} moneda={m} />
                <div className="flex flex-col gap-2.5">
                  {MEDIOS.filter((x) => x !== 'otro' || a.medios.otro > 0).map((x) => (
                    <div key={x} className="flex flex-col gap-1.5">
                      <div className="flex justify-between gap-2.5 text-[15px]">
                        <span className="text-ink2">{ETIQUETA_MEDIO[x]}</span>
                        <span className="font-semibold tabular">{formatMonto(a.medios[x], m)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface2">
                        <div className="h-full rounded-full bg-acc" style={{ width: `${a.total ? Math.round((a.medios[x] / a.total) * 100) : 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-sm text-ink2">{plural(a.conFactura, 'pago con factura', 'pagos con factura')}</div>
              </Tarjeta>
            )
          })}
          {!hayPagos && (
            <Tarjeta className="flex flex-col justify-center gap-2 px-[22px] py-8">
              <div className="text-lg font-semibold">Sin cobros en este rango</div>
              <div className="text-[15px] leading-normal text-ink2">Probá con otro período o registrá los pagos que falten.</div>
            </Tarjeta>
          )}
          <div className="flex flex-col gap-3.5 rounded-[22px] bg-acc-soft p-[22px]">
            <div className="flex flex-wrap justify-between gap-2.5 text-[15px] font-semibold text-acc-strong">
              <span>Últimos 12 meses</span>
              <span className="font-medium">
                {formatPeriodo(r.rango12.desde)} – {formatPeriodo(r.rango12.hasta)}
              </span>
            </div>
            {MONEDAS.map((m) => {
              const p = partesMonto(r.ultimos12[m].total, m)
              return (
                <div key={m} className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold text-acc-strong">{m}</span>
                  <AjustarAncho className="num text-right text-[clamp(26px,3cqi,36px)]">
                    {p.entero}
                    {p.decimales && <span className="text-[.55em] tracking-normal opacity-70">{p.decimales}</span>}
                  </AjustarAncho>
                </div>
              )
            })}
            <div className="text-sm leading-normal text-acc-strong">
              {plural(r.ultimos12.ARS.cantidad + r.ultimos12.USD.cantidad, 'pago', 'pagos')} ·{' '}
              {r.ultimos12.ARS.conFactura + r.ultimos12.USD.conFactura} con factura
            </div>
          </div>
        </div>
      )}

      {r && hayPagos && (
        <Tarjeta className="overflow-hidden">
          <div className="flex flex-wrap items-baseline justify-between gap-3 px-[22px] pt-[18px] pb-1.5">
            <h2 className="m-0 text-xl font-semibold">Por mes</h2>
            <span className="text-sm text-ink2">Tocá un mes para ver cada pago y su factura</span>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[980px]">
              <div className={`grid ${COLUMNAS} gap-3 border-b border-line px-[22px] py-3.5 text-[13px] font-bold tracking-[.06em] text-ink2 uppercase`}>
                <div>Mes</div>
                <div>Moneda</div>
                {MEDIOS.map((x) => (
                  <div key={x} className="text-right">
                    {ETIQUETA_MEDIO[x]}
                  </div>
                ))}
                <div className="text-right">Total</div>
                <div className="text-right">Facturas</div>
              </div>
              {[...r.meses].reverse().map((m) => {
                const monedas = MONEDAS.filter((x) => m.porMoneda[x].cantidad)
                const estaAbierto = abierto === m.periodo && m.pagos.length > 0
                return (
                  <div key={m.periodo} className={`border-b border-line ${estaAbierto ? 'bg-surface2' : ''}`}>
                    <button
                      type="button"
                      aria-expanded={estaAbierto}
                      onClick={() => setAbierto(abierto === m.periodo ? null : m.periodo)}
                      className="block w-full text-left hover:bg-surface2"
                    >
                      {(monedas.length ? monedas : [null]).map((moneda, i) => (
                        <div key={moneda ?? 'nada'} className={`grid ${COLUMNAS} items-center gap-3 px-[22px] py-3 text-base tabular`}>
                          <div className="flex items-center gap-1.5 font-semibold">
                            {i === 0 && (
                              <>
                                <ChevronRight size={14} strokeWidth={2} className={`text-ink2 transition-transform ${estaAbierto ? 'rotate-90' : ''}`} />
                                {etiquetaMes(m.periodo)}
                              </>
                            )}
                          </div>
                          <div className="text-sm font-bold text-ink2">{moneda ?? '—'}</div>
                          {moneda ? (
                            <>
                              {MEDIOS.map((x) => (
                                <div key={x} className="text-right">
                                  {guion(m.porMoneda[moneda].medios[x], moneda)}
                                </div>
                              ))}
                              <div className="text-right font-bold">{formatMonto(m.porMoneda[moneda].total, moneda)}</div>
                              <div className="text-right text-ink2">
                                {m.porMoneda[moneda].conFactura} / {m.porMoneda[moneda].cantidad}
                              </div>
                            </>
                          ) : (
                            <div className="col-span-6 text-right text-ink2">Sin cobros</div>
                          )}
                        </div>
                      ))}
                    </button>
                    {estaAbierto && (
                      <div className="border-t border-line bg-fondo px-[22px] pt-1.5 pb-3">
                        <div className="grid grid-cols-[80px_minmax(160px,1.4fr)_130px_minmax(160px,1fr)_140px] gap-3 py-2.5 text-xs font-bold tracking-[.06em] text-ink2 uppercase">
                          <div>Fecha</div>
                          <div>Paciente</div>
                          <div>Medio</div>
                          <div>Nro de factura</div>
                          <div className="text-right">Monto</div>
                        </div>
                        {[...m.pagos].reverse().map(({ pago: p, paciente }) => (
                          <div
                            key={p.id}
                            className="grid grid-cols-[80px_minmax(160px,1.4fr)_130px_minmax(160px,1fr)_140px] gap-3 border-t border-line py-2.5 text-[15px] tabular"
                          >
                            <div className="text-ink2">{formatFecha(p.fecha).slice(0, 5)}</div>
                            <div className="truncate font-semibold">{paciente}</div>
                            <div>{ETIQUETA_MEDIO[p.medio]}</div>
                            <div className={p.nro_factura ? '' : 'text-ink2'}>
                              {[p.punto_venta, p.nro_factura].filter(Boolean).join('-') || 'Sin factura'}
                            </div>
                            <div className="text-right font-semibold">{formatMonto(p.monto, p.moneda)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              {MONEDAS.filter((m) => r.totales[m].cantidad).map((m) => (
                <div key={m} className={`grid ${COLUMNAS} gap-3 bg-surface2 px-[22px] py-3.5 text-base font-bold tabular`}>
                  <div>Total del período</div>
                  <div className="text-sm text-ink2">{m}</div>
                  {MEDIOS.map((x) => (
                    <div key={x} className="text-right">
                      {guion(r.totales[m].medios[x], m)}
                    </div>
                  ))}
                  <div className="text-right">{formatMonto(r.totales[m].total, m)}</div>
                  <div className="text-right text-ink2">
                    {r.totales[m].conFactura} / {r.totales[m].cantidad}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Tarjeta>
      )}
    </section>
  )
}
