import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Banknote, Calendar, CalendarPlus, ChevronLeft, MessageCircle, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import {
  Avatar, Boton, Chip, Confirmar, EstadoError, EstadoVacio, Esqueleto, IC, MontoGrande, Segmentado, Tarjeta,
  type Tono,
} from '../../components/ui'
import {
  ETIQUETA_MEDIO, nombreCompleto, useDatos, useGuardar, type Paciente, type Pago, type Sesion,
} from '../../lib/datos'
import {
  capitalizar, etiquetaDia, formatMonto, formatPeriodo, hoyAR, montoParaInput, nombreMes, NOMBRES_DIAS,
  numeroWhatsApp, periodoDe, plural, sumarMeses,
} from '../../lib/formato'
import { cobrables, estadoVisible } from '../../lib/estados'
import { aFavorDe, deudaDe, saldosDe } from '../../lib/resumen'
import { estadoSesion, fechasDelMes, pagadoPorSesion, tarifaVigente, type EstadoSesion } from '../../lib/saldos'
import { mensajeError } from '../../lib/supabase'
import { usePalabras } from '../../components/usePalabras'
import { useRegistro } from '../registro/RegistroContext'

const CHIP_ESTADO: Record<EstadoSesion, { tono: Tono; texto: string }> = {
  pagada: { tono: 'ok', texto: 'Pagada' },
  parcial: { tono: 'parcial', texto: 'Parcial' },
  pendiente: { tono: 'mal', texto: 'Pendiente' },
}

type Movimiento = { fecha: string; orden: number; sesion?: Sesion; pago?: Pago }

export function FichaPage() {
  const { id } = useParams()
  const navegar = useNavigate()
  const { perfil, pacientes, sesiones, pagos, cargando, error, reintentar } = useDatos()
  const { abrir } = useRegistro()
  const pal = usePalabras()
  const [generando, setGenerando] = useState(false)
  const paciente = pacientes.find((p) => p.id === id)

  const calculos = useMemo(() => {
    if (!paciente) return null
    const ses = sesiones.filter((s) => s.patient_id === paciente.id)
    const pag = pagos.filter((p) => p.patient_id === paciente.id)
    const saldos = saldosDe(paciente.id, sesiones, pagos)
    // Solo las realizadas y las ausentes se cubren con pagos; las programadas y canceladas no deben nada.
    const cubierto = pagadoPorSesion(cobrables(ses), pag)
    const movimientos: Movimiento[] = [
      ...ses.map((s) => ({ fecha: s.fecha, orden: 1, sesion: s })),
      ...pag.map((p) => ({ fecha: p.fecha, orden: 0, pago: p })),
    ].sort((a, b) => b.fecha.localeCompare(a.fecha) || a.orden - b.orden)
    const grupos: { periodo: string; items: Movimiento[] }[] = []
    for (const m of movimientos) {
      const periodo = periodoDe(m.fecha)
      const ultimo = grupos[grupos.length - 1]
      if (ultimo?.periodo === periodo) ultimo.items.push(m)
      else grupos.push({ periodo, items: [m] })
    }
    const impagas = cobrables(ses).filter((s) => estadoSesion(s.monto, cubierto.get(s.id) ?? 0) !== 'pagada').length
    return { ses, saldos, cubierto, grupos, deuda: deudaDe(saldos), aFavor: aFavorDe(saldos), impagas }
  }, [paciente, sesiones, pagos])

  if (cargando) return <Esqueleto que="la ficha" />
  if (error) return <EstadoError que="la ficha" reintentar={reintentar} />
  if (!paciente || !calculos) {
    return (
      <EstadoVacio
        icono={ChevronLeft}
        titulo="No encontramos este paciente"
        acciones={<Boton onClick={() => navegar('/pacientes')}>Ver pacientes</Boton>}
      >
        Puede que lo hayas eliminado.
      </EstadoVacio>
    )
  }

  const nombre = nombreCompleto(paciente)
  const tarifa = tarifaVigente(paciente, perfil?.tarifa_estandar ?? 0)
  const wa = numeroWhatsApp(paciente.telefono)
  const debe = calculos.deuda.ARS > 0 || calculos.deuda.USD > 0
  const monedasAFavor = (['ARS', 'USD'] as const).filter((m) => calculos.aFavor[m] > 0)

  const datos: { k: string; v: string }[] = [
    { k: 'Teléfono', v: paciente.telefono || '—' },
    {
      k: 'Honorario',
      v: tarifa > 0 ? `${formatMonto(tarifa, paciente.moneda)}${pal.sufijo} · ${paciente.tipo_tarifa === 'estandar' ? 'estándar' : 'personalizado'}` : 'Sin tarifa',
    },
    { k: 'Moneda', v: paciente.moneda === 'ARS' ? 'Pesos (ARS)' : 'Dólares (USD)' },
    {
      k: 'Días fijos',
      v: paciente.dias_semana.length ? paciente.dias_semana.map((d) => capitalizar(NOMBRES_DIAS[d])).join(', ') : '—',
    },
    { k: 'Frecuencia', v: paciente.frecuencia || '—' },
    { k: pal.Sesiones, v: String(calculos.ses.length) },
  ]
  if (pal.porHora) datos.splice(3, 0, { k: 'Duración', v: `${montoParaInput(paciente.horas_por_sesion)} h por ${pal.sesion}` })
  if (paciente.notas_admin) datos.push({ k: 'Notas', v: paciente.notas_admin })

  return (
    <section className="flex flex-col gap-5">
      <button
        type="button"
        onClick={() => navegar('/pacientes')}
        className="flex h-10 items-center gap-1.5 self-start rounded-full pr-3.5 pl-2 text-base font-semibold text-ink2 hover:bg-surface2"
      >
        <ChevronLeft {...IC} />
        Pacientes
      </button>

      <div className="flex flex-col gap-6 rounded-[1.625rem] border border-line bg-surface p-[clamp(1.25rem,3cqi,2rem)]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar nombre={nombre} className="size-16 text-xl" />
            <div className="min-w-0">
              <h1 className="m-0 font-serif text-[clamp(2rem,4.5cqi,2.875rem)] leading-[1.05] font-normal">{nombre}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.9375rem] text-ink2">
                <span
                  className={`inline-flex h-[1.625rem] items-center rounded-full px-2.5 text-[0.8125rem] font-bold ${
                    paciente.activo ? 'bg-acc-soft text-acc-strong' : 'bg-surface2 text-ink2'
                  }`}
                >
                  {paciente.activo ? 'Activo' : 'Inactivo'}
                </span>
                {[paciente.frecuencia, `desde ${formatPeriodo(periodoDe(paciente.fecha_alta))}`].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="text-[0.9375rem] font-medium text-ink2">Saldo</div>
            {debe ? (
              <>
                {(['ARS', 'USD'] as const)
                  .filter((m) => calculos.deuda[m] > 0)
                  .map((m) => (
                    <MontoGrande
                      key={m}
                      monto={calculos.deuda[m]}
                      moneda={m}
                      className="text-[clamp(2.375rem,5cqi,3.375rem)] tracking-[-0.03em] text-bad"
                      colorDecimales="text-bad"
                    />
                  ))}
                <div className="text-sm text-ink2">{plural(calculos.impagas, `${pal.sesion} sin abonar`, `${pal.sesiones} sin abonar`)}</div>
              </>
            ) : (
              <>
                <div className="num text-[clamp(2.375rem,5cqi,3.375rem)] tracking-[-0.03em] text-acc-strong">Al día</div>
                <div className="text-sm text-ink2">
                  {monedasAFavor.length
                    ? `A favor ${monedasAFavor.map((m) => formatMonto(calculos.aFavor[m], m)).join(' + ')}`
                    : `No debe ninguna ${pal.sesion}`}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(12.5rem,1fr))] gap-2.5">
          <Boton alto="h-[3.375rem]" icono={Calendar} onClick={() => abrir({ modo: 'sesion', pacienteId: paciente.id })}>
            Registrar {pal.sesion}
          </Boton>
          <Boton variante="suave" alto="h-[3.375rem]" icono={Banknote} onClick={() => abrir({ modo: 'pago', pacienteId: paciente.id })}>
            Registrar pago
          </Boton>
          {paciente.dias_semana.length > 0 && (
            <Boton variante="borde" alto="h-[3.375rem]" icono={CalendarPlus} onClick={() => setGenerando(true)}>
              Cargar {pal.sesiones} del mes
            </Boton>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <Tarjeta className="min-w-0 flex-[2_1_27.5rem] p-2">
          <h2 className="m-0 px-3.5 pt-3.5 pb-1 text-xl font-semibold">Historial</h2>
          {calculos.grupos.length === 0 ? (
            <div className="px-5 pt-10 pb-12 text-center text-base leading-normal text-ink2">
              <div className="mb-1 text-lg font-semibold text-ink">Sin movimientos todavía</div>
              Registrá la primera sesión y la vas a ver acá.
            </div>
          ) : (
            calculos.grupos.map((g) => (
              <GrupoMes key={g.periodo} periodo={g.periodo} items={g.items} cubierto={calculos.cubierto} />
            ))
          )}
        </Tarjeta>

        <Tarjeta className="flex min-w-0 flex-[1_1_16.25rem] flex-col gap-1 p-[1.375rem]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="m-0 text-xl font-semibold">Datos</h2>
            <Boton variante="texto" alto="h-10" icono={Pencil} className="px-3" onClick={() => abrir({ modo: 'paciente', paciente })}>
              Editar
            </Boton>
          </div>
          {datos.map((d) => (
            <div key={d.k} className="flex justify-between gap-3 border-t border-line py-3 text-base">
              <span className="text-ink2">{d.k}</span>
              <span className="text-right font-semibold break-words">{d.v}</span>
            </div>
          ))}
          {wa && (
            <a
              href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hola ${paciente.nombre.split(' ')[0]}! `)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex h-12 items-center justify-center gap-2 rounded-full bg-wa-soft text-base font-semibold text-wa no-underline hover:brightness-95"
            >
              <MessageCircle {...IC} />
              Escribir por WhatsApp
            </a>
          )}
        </Tarjeta>
      </div>

      {generando && <GenerarSesiones paciente={paciente} tarifa={tarifa} onCerrar={() => setGenerando(false)} />}
    </section>
  )
}

function GrupoMes({ periodo, items, cubierto }: { periodo: string; items: Movimiento[]; cubierto: Map<string, number> }) {
  const { abrir } = useRegistro()
  const pal = usePalabras()
  const cantSesiones = items.filter((i) => i.sesion).length
  const cobrado = { ARS: 0, USD: 0 }
  for (const i of items) if (i.pago) cobrado[i.pago.moneda] += i.pago.monto
  const textoCobrado = (['ARS', 'USD'] as const)
    .filter((m) => cobrado[m] > 0)
    .map((m) => formatMonto(cobrado[m], m))
    .join(' + ')

  return (
    <div className="py-1.5">
      <div className="mx-1.5 flex flex-wrap items-baseline justify-between gap-3 border-t border-line px-3.5 pt-3.5 pb-1.5">
        <div className="text-base font-bold">{capitalizar(formatPeriodo(periodo))}</div>
        <div className="text-sm text-ink2">
          {plural(cantSesiones, pal.sesion, pal.sesiones)}
          {textoCobrado && ` · cobrado ${textoCobrado}`}
        </div>
      </div>
      {items.map((it) => {
        if (it.sesion) {
          const s = it.sesion
          const pagado = cubierto.get(s.id) ?? 0
          const visible = estadoVisible(s)
          const estado =
            visible === 'programada'
              ? { tono: 'neutro' as Tono, texto: 'Programada' }
              : visible === 'cancelada'
                ? { tono: 'neutro' as Tono, texto: 'Cancelada' }
                : CHIP_ESTADO[estadoSesion(s.monto, pagado)]
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => abrir({ modo: 'editar-sesion', sesion: s })}
              className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left hover:bg-surface2"
            >
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface2 text-[0.9375rem] text-ink2">
                <Calendar {...IC} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-base font-semibold">{pal.Sesion}{s.horas !== 1 ? ` · ${montoParaInput(s.horas)} h` : ''}</div>
                <div className="mt-0.5 text-sm break-words text-ink2">
                  {etiquetaDia(s.fecha)}
                  {visible === 'ausente' ? ' · ausente (se cobra)' : ''}
                  {pagado > 0 && pagado < s.monto ? ` · abonó ${formatMonto(pagado, s.moneda)}` : ''}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div
                  className={`text-base font-semibold whitespace-nowrap tabular ${visible === 'cancelada' ? 'text-ink2 line-through' : visible === 'programada' ? 'text-ink2' : ''}`}
                >
                  {formatMonto(s.monto, s.moneda)}
                </div>
                <Chip tono={estado.tono}>{estado.texto}</Chip>
              </div>
            </button>
          )
        }
        const p = it.pago!
        const otroMes = periodoDe(p.fecha) !== p.periodo
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => abrir({ modo: 'editar-pago', pago: p })}
            className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left hover:bg-surface2"
          >
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-acc-soft text-[0.9375rem] text-acc-strong">
              <Banknote {...IC} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-base font-semibold">Pago · {ETIQUETA_MEDIO[p.medio]}</div>
              <div className="mt-0.5 text-sm break-words text-ink2">
                {etiquetaDia(p.fecha)}
                {otroMes ? ` · de ${nombreMes(p.periodo)}` : ''}
                {p.nro_factura ? ` · Fact. ${p.nro_factura}` : ''}
              </div>
            </div>
            <div className="text-base font-semibold whitespace-nowrap text-acc-strong tabular">+ {formatMonto(p.monto, p.moneda)}</div>
          </button>
        )
      })}
    </div>
  )
}

/** Carga de un toque las sesiones (o consultas) del mes según los días fijos del paciente. */
function GenerarSesiones({ paciente, tarifa, onCerrar }: { paciente: Paciente; tarifa: number; onCerrar: () => void }) {
  const { sesiones } = useDatos()
  const guardar = useGuardar()
  const pal = usePalabras()
  const horas = pal.porHora ? paciente.horas_por_sesion : 1
  const actual = periodoDe(hoyAR())
  const [periodo, setPeriodo] = useState(actual)

  const yaCargadas = new Set(sesiones.filter((s) => s.patient_id === paciente.id).map((s) => s.fecha))
  const fechas = fechasDelMes(periodo, paciente.dias_semana)
  const nuevas = tarifa > 0 ? fechas.filter((f) => !yaCargadas.has(f)) : []
  const total = tarifa * horas * nuevas.length

  async function cargar() {
    try {
      await guardar.mutateAsync([
        {
          tipo: 'insertar',
          tabla: 'sessions',
          filas: nuevas.map((fecha) => ({
            patient_id: paciente.id,
            fecha,
            horas,
            tarifa_hora: tarifa,
            moneda: paciente.moneda,
          })),
        },
      ])
      toast.success(`Cargamos ${plural(nuevas.length, pal.sesion, pal.sesiones)} de ${nombreMes(periodo)}`)
      onCerrar()
    } catch (e) {
      toast.error(`No se pudieron cargar: ${mensajeError(e)}`)
    }
  }

  return (
    <Confirmar
      titulo={`Cargar ${pal.sesiones}`}
      textoConfirmar={nuevas.length ? `Cargar ${plural(nuevas.length, pal.sesion, pal.sesiones)}` : 'Nada para cargar'}
      peligroso={false}
      cargando={guardar.isPending}
      onConfirmar={() => (nuevas.length ? cargar() : onCerrar())}
      onCancelar={onCerrar}
    >
      <div className="flex flex-col gap-4">
        <Segmentado
          opciones={[sumarMeses(actual, -1), actual, sumarMeses(actual, 1)].map((p) => ({ v: p, l: capitalizar(nombreMes(p)) }))}
          valor={periodo}
          onCambio={setPeriodo}
        />
        {tarifa <= 0 ? (
          <span>Primero cargá la tarifa: la estándar en Ajustes, o una personalizada en los datos del paciente.</span>
        ) : fechas.length === 0 ? (
          <span>No hay días fijos en este mes.</span>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {fechas.map((f) => (
                <span
                  key={f}
                  className={`inline-flex h-9 items-center rounded-full px-3 text-[0.9375rem] font-semibold ${
                    yaCargadas.has(f) ? 'bg-surface2 text-ink2 line-through' : 'bg-acc-soft text-acc-strong'
                  }`}
                >
                  {etiquetaDia(f)}
                </span>
              ))}
            </div>
            <span>
              {nuevas.length
                ? `${plural(nuevas.length, `${pal.sesion} nueva`, `${pal.sesiones} nuevas`)} · ${formatMonto(total, paciente.moneda)} en total.`
                : 'Ya están todas cargadas.'}
              {nuevas.length < fechas.length && nuevas.length > 0 ? ' Las tachadas ya estaban.' : ''}
            </span>
          </>
        )}
      </div>
    </Confirmar>
  )
}
