import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, MessageCircle, Plus } from 'lucide-react'
import { useUsuario } from '../../components/FotoUsuario'
import { SelectorMes, useMesSeleccionado } from '../../components/SelectorMes'
import {
  Avatar, Boton, Chip, EstadoError, Esqueleto, IC, MontoGrande, Segmentado, Tarjeta, type Tono,
} from '../../components/ui'
import { nombreCompleto, useDatos, type Paciente } from '../../lib/datos'
import {
  capitalizar, completarPlantilla, etiquetaDia, fechaLarga, formatCompacto, formatMonto, hoyAR, mesCorto, nombreMes,
  numeroWhatsApp, periodoDe, plural, type Moneda,
} from '../../lib/formato'
import { resumenMes, type SesionImpaga } from '../../lib/inicio'
import { deudaDe, saldosDe } from '../../lib/resumen'
import { usePalabras } from '../../components/usePalabras'
import { useRegistro } from '../registro/RegistroContext'

const CHIP: Record<SesionImpaga['estado'], { tono: Tono; texto: string }> = {
  parcial: { tono: 'parcial', texto: 'Parcial' },
  pendiente: { tono: 'mal', texto: 'Pendiente' },
}

export function InicioPage() {
  const { perfil, pacientes, sesiones, pagos, cargando, error, reintentar } = useDatos()
  const { abrir } = useRegistro()
  const navegar = useNavigate()
  const [periodo, setPeriodo] = useMesSeleccionado()
  const usuario = useUsuario()
  const pal = usePalabras()
  const [monedaGrafico, setMonedaGrafico] = useState<Moneda>('ARS')

  const r = useMemo(() => resumenMes(periodo, pacientes, sesiones, pagos), [periodo, pacientes, sesiones, pagos])
  const porId = useMemo(() => new Map(pacientes.map((p) => [p.id, p])), [pacientes])

  if (cargando) return <Esqueleto que="el inicio" tarjetas />
  if (error) return <EstadoError que="el inicio" reintentar={reintentar} />

  const mes = nombreMes(periodo)
  // Primer nombre, salteando títulos como "Lic." o "Dra.".
  const primerNombre = usuario.nombre?.split(' ').find((p) => !/^(lic|dr|dra)\.?$/i.test(p))
  const sinNadaCargado = sesiones.length === 0

  /** Link de WhatsApp con el recordatorio completado con la deuda del paciente. */
  function linkRecordatorio(p: Paciente, s: SesionImpaga) {
    const numero = numeroWhatsApp(p.telefono)
    if (!numero) return null
    const deuda = deudaDe(saldosDe(p.id, sesiones, pagos))[s.sesion.moneda]
    const texto = completarPlantilla(perfil?.plantilla_whatsapp ?? '', {
      nombre: p.nombre.split(' ')[0],
      mes: nombreMes(periodoDe(s.sesion.fecha)),
      monto: formatMonto(deuda || s.debe, s.sesion.moneda),
    })
    return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`
  }

  const max = Math.max(...r.barras.map((b) => b.cobrado[monedaGrafico]), 1)
  const graficoVacio = r.barras.every((b) => !b.cobrado[monedaGrafico])

  const tarjeta = 'flex min-w-0 flex-col gap-3 rounded-[1.375rem] border border-line bg-surface px-[1.125rem] pt-[1.125rem] pb-5'
  const etiqueta = 'text-[0.9375rem] font-medium text-ink2'

  return (
    <section className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1.5 text-[0.9375rem] text-ink2">{fechaLarga(hoyAR())}</div>
          <h1 className="m-0 font-serif text-[clamp(2.375rem,5cqi,3.25rem)] leading-none font-normal">
            Hola{primerNombre ? `, ${primerNombre}` : ''}
          </h1>
        </div>
        <SelectorMes periodo={periodo} onCambio={setPeriodo} />
      </div>

      <div data-tour="resumen" className="grid grid-cols-2 gap-3 max-md:letra-grande:grid-cols-1 md:grid-cols-[repeat(auto-fit,minmax(13.75rem,1fr))]">
        <div className={`${tarjeta} col-span-2 max-md:letra-grande:col-span-1 md:col-span-1`}>
          <div className={etiqueta}>Cobrado ARS</div>
          <MontoGrande monto={r.cobrado.ARS} moneda="ARS" />
          <div className="text-sm text-ink2">
            {plural(r.cantPagos.ARS, 'pago', 'pagos')} en {mes}
          </div>
        </div>
        <div className={tarjeta}>
          <div className={etiqueta}>Cobrado USD</div>
          <MontoGrande monto={r.cobrado.USD} moneda="USD" className="text-[clamp(1.625rem,3.6cqi,2.625rem)]" />
          <div className="text-sm text-ink2">
            {plural(r.cantPagos.USD, 'pago', 'pagos')} en {mes}
          </div>
        </div>
        <div className={`${tarjeta} order-last col-span-2 max-md:letra-grande:col-span-1 md:order-none md:col-span-1`}>
          <div className={`${etiqueta} flex items-center gap-2`}>
            <span className="size-2 rounded-full bg-bad" />
            Pendiente de cobro
          </div>
          <MontoGrande monto={r.pendiente.ARS} moneda="ARS" className="text-[clamp(1.75rem,3.2cqi,2.625rem)]" />
          <div className="text-sm text-ink2">
            {r.pendiente.USD > 0 ? `+ ${formatMonto(r.pendiente.USD, 'USD')} · ` : ''}{pal.sesiones} de {mes}
          </div>
        </div>
        <div className={tarjeta}>
          <div className={etiqueta}>Pacientes activos</div>
          <div className="num text-[clamp(1.625rem,3.6cqi,2.625rem)]">{r.pacientesConSesiones}</div>
          <div className="text-sm text-ink2">de {r.pacientesActivos} en total</div>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 md:grid-cols-[repeat(auto-fit,minmax(min(100%,26.25rem),1fr))]">
        <Tarjeta className="@container p-2" data-tour="sin-abonar">
          <div className="flex items-baseline justify-between gap-3 px-3.5 pt-3.5 pb-2">
            <h2 className="m-0 text-xl font-semibold">{pal.Sesiones} sin abonar</h2>
            <div className="text-[0.9375rem] text-ink2">{r.impagas.length ? plural(r.impagas.length, pal.sesion, pal.sesiones) : ''}</div>
          </div>
          {r.impagas.length > 0 ? (
            r.impagas.map((i) => {
              const p = porId.get(i.sesion.patient_id)
              if (!p) return null
              const wa = linkRecordatorio(p, i)
              return (
                <div
                  key={i.sesion.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navegar(`/pacientes/${p.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && navegar(`/pacientes/${p.id}`)}
                  className="flex cursor-pointer items-center gap-3 rounded-2xl px-3.5 py-3 hover:bg-surface2"
                >
                  <Avatar nombre={nombreCompleto(p)} className="size-11 text-[0.9375rem]" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[1.0625rem] font-semibold">{nombreCompleto(p)}</div>
                    <div className="mt-[0.1875rem] flex flex-wrap items-center gap-2 text-sm text-ink2">
                      {etiquetaDia(i.sesion.fecha)}
                      <Chip tono={CHIP[i.estado].tono}>{CHIP[i.estado].texto}</Chip>
                    </div>
                    {/* Si la tarjeta es angosta, el monto va debajo para no tapar el nombre. */}
                    <div className="mt-1 text-base font-semibold break-words tabular @[30rem]:hidden">
                      {formatMonto(i.debe, i.sesion.moneda)}
                    </div>
                  </div>
                  <div className="hidden text-[1.0625rem] font-semibold whitespace-nowrap tabular @[30rem]:block">
                    {formatMonto(i.debe, i.sesion.moneda)}
                  </div>
                  {wa ? (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Recordar por WhatsApp"
                      title="Recordar por WhatsApp"
                      className="grid size-11 shrink-0 place-items-center rounded-[0.875rem] bg-wa-soft text-wa hover:brightness-95"
                    >
                      <MessageCircle {...IC} />
                    </a>
                  ) : (
                    <span
                      title="Cargá el teléfono del paciente para mandarle un recordatorio"
                      className="grid size-11 shrink-0 place-items-center rounded-[0.875rem] bg-surface2 text-ink2 opacity-50"
                    >
                      <MessageCircle {...IC} />
                    </span>
                  )}
                </div>
              )
            })
          ) : (
            <div className="flex flex-col items-center gap-2.5 px-5 pt-9 pb-10 text-center">
              <div className="grid size-[3.25rem] place-items-center rounded-2xl bg-acc-soft text-[1.375rem] text-acc-strong">
                <Check {...IC} />
              </div>
              <div className="text-lg font-semibold">{sinNadaCargado ? `${capitalizar(mes)} sin ${pal.sesiones} todavía` : 'Todo al día'}</div>
              <div className="max-w-[18.75rem] text-[0.9375rem] leading-snug text-ink2">
                {sinNadaCargado ? `Cuando registres una ${pal.sesion}, la vas a ver acá.` : `Ninguna ${pal.sesion} quedó sin abonar.`}
              </div>
              {r.sesionesDelMes === 0 && (
                <Boton alto="h-12" icono={Plus} className="mt-1.5" onClick={() => abrir({ modo: 'sesion' })}>
                  Registrar {pal.sesion}
                </Boton>
              )}
            </div>
          )}
        </Tarjeta>

        <Tarjeta className="p-[1.375rem]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="m-0 text-xl font-semibold">Cobrado por mes</h2>
              <div className="mt-1 text-[0.9375rem] text-ink2">
                En {mes}: {formatMonto(r.barras[5].cobrado[monedaGrafico], monedaGrafico)}
              </div>
            </div>
            <Segmentado
              opciones={[
                { v: 'ARS' as Moneda, l: 'ARS' },
                { v: 'USD' as Moneda, l: 'USD' },
              ]}
              valor={monedaGrafico}
              onCambio={setMonedaGrafico}
              alto="h-[2.125rem]"
              className="[&>button]:px-3.5 [&>button]:text-sm"
            />
          </div>
          <div className="relative mt-5 flex h-[13.125rem] items-end gap-2.5">
            {r.barras.map((b, i) => {
              const elegido = i === 5
              const valor = b.cobrado[monedaGrafico]
              return (
                <div key={b.periodo} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                  <div className={`text-xs font-bold whitespace-nowrap ${elegido ? 'text-ink' : 'hidden text-ink2 md:block'}`}>
                    {formatCompacto(valor, monedaGrafico)}
                  </div>
                  <div
                    className={`min-h-1 w-full max-w-12 rounded-[0.625rem] ${elegido ? 'bg-acc' : 'bg-acc-soft'}`}
                    style={{ height: `${Math.round((valor / max) * 82)}%` }}
                    title={`${capitalizar(nombreMes(b.periodo))}: ${formatMonto(valor, monedaGrafico)}`}
                  />
                </div>
              )
            })}
            {graficoVacio && (
              <div className="absolute inset-x-0 top-0 bottom-[1.875rem] grid place-items-center text-[0.9375rem] text-ink2">
                Sin cobros en estos 6 meses
              </div>
            )}
          </div>
          <div className="mt-2.5 flex gap-2.5">
            {r.barras.map((b, i) => (
              <div key={b.periodo} className={`flex-1 text-center text-sm ${i === 5 ? 'font-bold text-ink' : 'font-medium text-ink2'}`}>
                {mesCorto(b.periodo)}
              </div>
            ))}
          </div>
        </Tarjeta>
      </div>
    </section>
  )
}
