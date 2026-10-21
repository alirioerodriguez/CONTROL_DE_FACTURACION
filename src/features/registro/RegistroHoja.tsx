import { useMemo, useState } from 'react'
import { CalendarDays, FileText, Mail, MessageCircle, Search, Share2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Calendario } from '../../components/Calendario'
import { AYUDA_ESTADO, type EstadoGuardado } from '../../lib/estados'
import {
  Alerta, Avatar, Boton, Campo, CampoMonto, Confirmar, Hoja, IC, Pastilla, Segmentado, type Opcion,
} from '../../components/ui'
import {
  ETIQUETA_MEDIO, nombreCompleto, useDatos, useGuardar, type Medio, type Paciente, type Pagador, type Pago, type Perfil,
} from '../../lib/datos'
import {
  capitalizar, etiquetaDia, formatMonto, formatPeriodo, hoyAR, montoParaInput, normalizar, parseMontoAR, periodoDe,
  redondear2, sumarDias, sumarMeses, type Moneda,
} from '../../lib/formato'
import { coincideDocumento } from '../../lib/documentos'
import { tieneAbono } from '../../lib/abono'
import { deudaDe, debeAlgo, saldosDe, textoDeuda } from '../../lib/resumen'
import { periodoSugerido, tarifaVigente } from '../../lib/saldos'
import { mensajeError } from '../../lib/supabase'
import { guardarPreferencia, preferencia } from '../../lib/tema'
import { usePalabras } from '../../components/usePalabras'
import { opcionesHoras } from './opciones'
import type { Apertura } from './RegistroContext'

const MEDIOS: Opcion<Medio>[] = (['efectivo', 'transferencia', 'mercadopago', 'otro'] as const).map((v) => ({
  v,
  l: ETIQUETA_MEDIO[v],
}))
const MONEDAS: Opcion<Moneda>[] = [
  { v: 'ARS', l: 'ARS' },
  { v: 'USD', l: 'USD' },
]

export function RegistroHoja({
  apertura,
  onCerrar,
  onCambiarModo,
}: {
  apertura: Exclude<Apertura, { modo: 'paciente' }>
  onCerrar: () => void
  onCambiarModo: (a: Apertura) => void
}) {
  const { perfil, pacientes, sesiones, pagos } = useDatos()
  const guardar = useGuardar()
  const pal = usePalabras()
  const hoy = hoyAR()

  const edSesion = apertura.modo === 'editar-sesion' ? apertura.sesion : null
  const edPago = apertura.modo === 'editar-pago' ? apertura.pago : null
  const editando = Boolean(edSesion || edPago)
  const esSesion = apertura.modo === 'sesion' || apertura.modo === 'editar-sesion'
  const tarifaEstandar = perfil?.tarifa_estandar ?? 0

  // Valores sugeridos al elegir un paciente.
  function sugeridos(p: Paciente | undefined, fecha: string) {
    if (!p) return { horas: 1, monto: '', moneda: perfil?.moneda_default ?? ('ARS' as Moneda), periodo: periodoDe(fecha) }
    if (esSesion) {
      const tarifa = tarifaVigente(p, tarifaEstandar)
      // Con tarifa por sesión/consulta, cada encuentro vale una unidad.
      const horas = pal.porHora ? p.horas_por_sesion : 1
      const monto = tarifa * horas
      return { horas, monto: monto ? montoParaInput(monto) : '', moneda: p.moneda, periodo: periodoDe(fecha) }
    }
    const saldos = saldosDe(p.id, sesiones, pagos)
    const deuda = deudaDe(saldos)[p.moneda]
    return {
      horas: 1,
      monto: deuda > 0 ? montoParaInput(deuda) : '',
      moneda: p.moneda,
      periodo: periodoSugerido(saldos, p.moneda, fecha),
    }
  }

  const pidInicial =
    edSesion?.patient_id ?? edPago?.patient_id ?? ('pacienteId' in apertura ? (apertura.pacienteId ?? null) : null)
  const [pid, setPid] = useState<string | null>(pidInicial)
  const paciente = pacientes.find((p) => p.id === pid)

  const [inicial] = useState(() => {
    const fecha = edSesion?.fecha ?? edPago?.fecha ?? hoy
    const s = sugeridos(paciente, fecha)
    return {
      fecha,
      horas: edSesion?.horas ?? s.horas,
      monto: edSesion ? montoParaInput(edSesion.monto) : edPago ? montoParaInput(edPago.monto) : s.monto,
      moneda: edSesion?.moneda ?? edPago?.moneda ?? s.moneda,
      periodo: edPago?.periodo ?? s.periodo,
    }
  })
  const [fecha, setFecha] = useState(inicial.fecha)
  const [hora, setHora] = useState(edSesion?.hora ?? '')
  const [verCalendario, setVerCalendario] = useState(false)
  const [horas, setHoras] = useState(inicial.horas)
  const [estado, setEstado] = useState<EstadoGuardado>(edSesion?.estado ?? 'normal')
  const [montoTxt, setMontoTxt] = useState(inicial.monto)
  const [montoTocado, setMontoTocado] = useState(false)
  const [moneda, setMoneda] = useState<Moneda>(inicial.moneda)
  const [periodo, setPeriodo] = useState(inicial.periodo)
  const [pagado, setPagado] = useState(false)
  const [medio, setMedio] = useState<Medio>(edPago?.medio ?? preferencia<Medio>('ultimoMedio', 'transferencia'))
  const [factura, setFactura] = useState(edPago?.nro_factura ?? '')
  const [pagador, setPagador] = useState<Pagador>(edPago?.pagador ?? 'paciente')
  // Ids fijos mientras la hoja está abierta: si se reintenta después de un corte, no se duplica nada.
  const [ids] = useState(() => ({ sesion: crypto.randomUUID(), pago: crypto.randomUUID() }))
  const [busqueda, setBusqueda] = useState('')
  const [error, setError] = useState('')
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)

  const monto = parseMontoAR(montoTxt) ?? 0

  function elegir(p: Paciente) {
    const s = sugeridos(p, fecha)
    setPid(p.id)
    setHoras(s.horas)
    setMontoTxt(s.monto)
    setMoneda(s.moneda)
    setPeriodo(s.periodo)
    setMontoTocado(false)
    setError('')
  }

  function cambiarHoras(h: number) {
    setHoras(h)
    // Si no escribió el monto a mano, se recalcula. Al editar se usa la tarifa
    // guardada en la sesión, para no cambiarle el precio con el que se cargó.
    if (montoTocado || !paciente) return
    const tarifa = edSesion ? edSesion.tarifa_hora : tarifaVigente(paciente, tarifaEstandar)
    setMontoTxt(montoParaInput(tarifa * h))
  }

  const candidatos = useMemo(() => {
    const ultima = new Map<string, string>()
    for (const s of sesiones) if ((ultima.get(s.patient_id) ?? '') < s.fecha) ultima.set(s.patient_id, s.fecha)
    const q = normalizar(busqueda.trim())
    return pacientes
      .filter((p) => p.activo && (!q || normalizar(nombreCompleto(p)).includes(q) || coincideDocumento(p, q)))
      .sort((a, b) => (ultima.get(b.id) ?? '').localeCompare(ultima.get(a.id) ?? '') || a.nombre.localeCompare(b.nombre))
      .slice(0, 8)
  }, [pacientes, sesiones, busqueda])

  const meses = useMemo(() => {
    const actual = periodoDe(hoy)
    const lista = Array.from({ length: 15 }, (_, i) => sumarMeses(actual, 1 - i))
    if (!lista.includes(periodo)) lista.push(periodo)
    return lista.sort().reverse()
  }, [hoy, periodo])

  // Solo se pregunta quién pagó si la función está prendida y el paciente tiene obra social.
  const conObraSocial = !!perfil?.usa_obras_sociales && !!paciente?.obra_social

  const resumenPaciente = paciente
    ? (() => {
        const d = deudaDe(saldosDe(paciente.id, sesiones, pagos))
        const tarifa = tarifaVigente(paciente, tarifaEstandar)
        const honorario = tieneAbono(paciente)
          ? `abono de ${formatMonto(paciente.abono_mensual ?? 0, paciente.moneda)} por mes`
          : `${formatMonto(tarifa, paciente.moneda)}${pal.sufijo}`
        return `${debeAlgo(d) ? `Debe ${textoDeuda(d)}` : 'Al día'} · ${honorario}`
      })()
    : ''

  async function guardarTodo() {
    if (!pid || !paciente) return setError('Elegí un paciente.')
    // Con abono el monto de la sesión es solo de referencia: puede quedar en 0.
    if (!(monto > 0) && !(esSesion && tieneAbono(paciente))) return setError('Ingresá un monto mayor a 0.')
    if (!fecha) return setError('Elegí una fecha.')
    setError('')
    const nombre = paciente.nombre.split(' ')[0]
    try {
      if (esSesion) {
        const fila = { patient_id: pid, fecha, hora: hora || null, horas, tarifa_hora: redondear2(monto / horas), moneda, estado }
        const conPago = pagado && estado !== 'cancelada'
        if (edSesion) {
          await guardar.mutateAsync([{ tipo: 'actualizar', tabla: 'sessions', id: edSesion.id, cambios: fila }])
          toast.success(`${pal.Sesion} actualizada`)
        } else {
          if (conPago) guardarPreferencia('ultimoMedio', medio)
          // Sesión y pago en un solo envío; con ids fijos, reintentar no los duplica.
          await guardar.mutateAsync([
            { tipo: 'insertar', tabla: 'sessions', filas: [{ ...fila, id: ids.sesion }] },
            ...(conPago
              ? [
                  {
                    tipo: 'insertar' as const,
                    tabla: 'payments' as const,
                    filas: [{ id: ids.pago, patient_id: pid, fecha, periodo: periodoDe(fecha), monto, moneda, medio, session_id: ids.sesion }],
                  },
                ]
              : []),
          ])
          toast.success(`${pal.Sesion} guardada · ${nombre} · ${formatMonto(monto, moneda)} · ${pagado ? 'pagada' : 'pendiente'}`)
        }
      } else {
        const nro = factura.trim()
        const fila = {
          patient_id: pid,
          fecha,
          periodo,
          monto,
          moneda,
          medio,
          pagador: conObraSocial ? pagador : 'paciente',
          nro_factura: nro || null,
          comprobante: nro ? 'factura_c' : 'sin_comprobante',
        }
        guardarPreferencia('ultimoMedio', medio)
        if (edPago) {
          await guardar.mutateAsync([{ tipo: 'actualizar', tabla: 'payments', id: edPago.id, cambios: fila }])
          toast.success('Pago actualizado')
        } else {
          await guardar.mutateAsync([{ tipo: 'insertar', tabla: 'payments', filas: [{ ...fila, id: ids.pago }] }])
          toast.success(`Pago registrado · ${nombre} · ${formatMonto(monto, moneda)}`)
        }
      }
      onCerrar()
    } catch (e) {
      setError(mensajeError(e))
      toast.error(`No se pudo guardar: ${mensajeError(e)}`)
    }
  }

  async function borrar() {
    const tabla = edSesion ? 'sessions' : 'payments'
    const id = (edSesion ?? edPago)!.id
    try {
      await guardar.mutateAsync([{ tipo: 'borrar', tabla, id }])
      toast.success(edSesion ? `${pal.Sesion} eliminada` : 'Pago eliminado')
      onCerrar()
    } catch (e) {
      toast.error(`No se pudo eliminar: ${mensajeError(e)}`)
      setConfirmarBorrado(false)
    }
  }

  const titulo = edSesion ? `Editar ${pal.sesion}` : edPago ? 'Editar pago' : 'Registrar'
  const textoBoton = editando
    ? 'Guardar cambios'
    : `${esSesion ? `Guardar ${pal.sesion}` : 'Guardar pago'}${monto > 0 ? ` · ${formatMonto(monto, moneda)}` : ''}`

  if (confirmarBorrado) {
    return (
      <Confirmar
        titulo={edSesion ? `¿Eliminar la ${pal.sesion}?` : '¿Eliminar el pago?'}
        textoConfirmar="Sí, eliminar"
        cargando={guardar.isPending}
        onConfirmar={borrar}
        onCancelar={() => setConfirmarBorrado(false)}
      >
        {edSesion
          ? `Se borra la ${pal.sesion} del ${fecha.split('-').reverse().join('/')} de ${paciente ? nombreCompleto(paciente) : 'este paciente'}. No se puede deshacer.`
          : `Se borra el pago de ${formatMonto(monto, moneda)}. No se puede deshacer.`}
      </Confirmar>
    )
  }

  return (
    <Hoja titulo={titulo} onCerrar={onCerrar}>
      {!editando && (
        <Segmentado
          opciones={[
            { v: 'sesion', l: pal.Sesion },
            { v: 'pago', l: 'Pago' },
          ]}
          valor={esSesion ? 'sesion' : 'pago'}
          onCambio={(m) => onCambiarModo({ modo: m as 'sesion' | 'pago', pacienteId: pid ?? undefined })}
        />
      )}

      <div className="flex flex-col gap-2.5">
        <div className="text-[0.9375rem] font-semibold">Paciente</div>
        {paciente ? (
          <div className="flex items-center gap-3 rounded-2xl bg-acc-soft px-3 py-2.5">
            <Avatar nombre={nombreCompleto(paciente)} className="size-10 bg-surface text-sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-semibold">{nombreCompleto(paciente)}</div>
              <div className="truncate text-sm text-ink2">{resumenPaciente}</div>
            </div>
            {!editando && (
              <button type="button" onClick={() => setPid(null)} className="p-2 text-[0.9375rem] font-semibold text-acc-strong">
                Cambiar
              </button>
            )}
          </div>
        ) : (
          <>
            <label className="flex h-[3.125rem] items-center gap-2.5 rounded-[0.875rem] border border-line bg-fondo px-4 text-[1.0625rem] text-ink2 focus-within:border-acc">
              <Search {...IC} />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar paciente"
                className="min-w-0 flex-1 border-none bg-transparent text-ink outline-none"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {candidatos.map((p) => {
                const partes = nombreCompleto(p).split(' ')
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => elegir(p)}
                    className="presionable flex h-11 items-center gap-2 rounded-full border border-line bg-surface pr-3.5 pl-[0.3125rem] text-[0.9375rem] font-semibold hover:border-acc hover:bg-acc-soft"
                  >
                    <Avatar nombre={nombreCompleto(p)} className="size-[2.125rem] text-xs" />
                    {partes[0]} {partes[1] ? `${partes[1][0]}.` : ''}
                  </button>
                )
              })}
            </div>
            {candidatos.length === 0 && (
              <div className="text-[0.9375rem] text-ink2">
                {pacientes.length ? 'No hay pacientes con ese nombre.' : 'Todavía no cargaste pacientes.'}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="text-[0.9375rem] font-semibold">Fecha</div>
        <div className="flex flex-wrap gap-2">
          <Pastilla activa={fecha === hoy} onClick={() => setFecha(hoy)} alto="h-[2.875rem]">
            Hoy
          </Pastilla>
          <Pastilla activa={fecha === sumarDias(hoy, -1)} onClick={() => setFecha(sumarDias(hoy, -1))} alto="h-[2.875rem]">
            Ayer
          </Pastilla>
          <button
            type="button"
            onClick={() => setVerCalendario((v) => !v)}
            aria-expanded={verCalendario}
            className={`flex h-[2.875rem] min-w-[9.375rem] flex-1 items-center justify-center gap-2 rounded-full border px-3.5 text-[0.9375rem] font-semibold ${
              verCalendario || (fecha !== hoy && fecha !== sumarDias(hoy, -1))
                ? 'border-ink bg-ink text-fondo'
                : 'border-line bg-surface text-ink'
            }`}
          >
            <CalendarDays {...IC} />
            {fecha ? etiquetaDia(fecha) : 'Elegir fecha'}
          </button>
        </div>
        {verCalendario && (
          <Calendario
            valor={fecha}
            onCambio={(f) => {
              setFecha(f)
              setVerCalendario(false)
            }}
            marcados={
              pid
                ? new Set((esSesion ? sesiones : pagos).filter((x) => x.patient_id === pid).map((x) => x.fecha))
                : undefined
            }
            textoMarcados={esSesion ? `Días con ${pal.sesion} cargada` : 'Días con pago cargado'}
          />
        )}
      </div>

      {esSesion && (
        <label className="flex flex-wrap items-center justify-between gap-3 text-[0.9375rem] font-semibold">
          <span>
            Hora<span className="ml-2 text-sm font-normal text-ink2">Opcional</span>
          </span>
          <input
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            className="h-12 w-[9rem] rounded-[0.875rem] border border-line bg-fondo px-3.5 text-[1.0625rem] font-normal"
          />
        </label>
      )}

      {esSesion && pal.porHora && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[0.9375rem] font-semibold">Duración</div>
          <Segmentado opciones={opcionesHoras(horas)} valor={horas} onCambio={cambiarHoras} className="min-w-[12.5rem]" alto="h-10" />
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        <div className="text-[0.9375rem] font-semibold">Monto</div>
        <div className="flex items-stretch gap-2.5">
          <CampoMonto
            grande
            simbolo={moneda === 'USD' ? 'US$' : '$'}
            valor={montoTxt}
            onCambio={(v) => {
              setMontoTxt(v)
              setMontoTocado(true)
              setError('')
            }}
          />
          <Segmentado
            opciones={MONEDAS}
            valor={moneda}
            onCambio={setMoneda}
            className="w-[7.75rem] shrink-0"
            alto="h-full"
            redondeo="rounded-xl"
          />
        </div>
      </div>

      {esSesion && (
        <div className="flex flex-col gap-2.5">
          <div className="text-[0.9375rem] font-semibold">Estado</div>
          <Segmentado
            opciones={[
              { v: 'normal' as EstadoGuardado, l: 'Normal' },
              { v: 'ausente' as EstadoGuardado, l: 'Ausente' },
              { v: 'cancelada' as EstadoGuardado, l: 'Cancelada' },
            ]}
            valor={estado}
            onCambio={setEstado}
            className="[&>button]:text-sm"
          />
          <div className="text-sm text-ink2">{AYUDA_ESTADO[estado]}</div>
        </div>
      )}

      {esSesion && !editando && estado !== 'cancelada' && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[0.9375rem] font-semibold">¿Ya la pagó?</div>
          <Segmentado
            opciones={[
              { v: true, l: 'Sí' },
              { v: false, l: 'No' },
            ]}
            valor={pagado}
            onCambio={setPagado}
            className="w-[11.25rem]"
            alto="h-10"
          />
        </div>
      )}

      {!esSesion && conObraSocial && paciente?.obra_social && (
        <div className="flex flex-col gap-2.5">
          <div className="text-[0.9375rem] font-semibold">Quién paga</div>
          <Segmentado
            opciones={[
              { v: 'paciente' as Pagador, l: 'El paciente' },
              { v: 'obra_social' as Pagador, l: paciente.obra_social },
            ]}
            valor={pagador}
            onCambio={setPagador}
            className="[&>button]:text-sm [&>button]:leading-tight [&>button]:whitespace-normal"
          />
        </div>
      )}

      {(!esSesion || pagado) && (
        <div className="flex flex-col gap-2.5">
          <div className="text-[0.9375rem] font-semibold">Medio de pago</div>
          <Segmentado opciones={MEDIOS} valor={medio} onCambio={setMedio} className="[&>button]:text-sm [&>button]:leading-tight [&>button]:whitespace-normal" />
        </div>
      )}

      {!esSesion && (
        <>
          <label className="flex flex-col gap-2 text-[0.9375rem] font-semibold">
            Mes que paga
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="h-[3.125rem] rounded-[0.875rem] border border-line bg-fondo px-3.5 font-normal"
            >
              {meses.map((m) => (
                <option key={m} value={m}>
                  {capitalizar(formatPeriodo(m))}
                </option>
              ))}
            </select>
            <span className="text-sm font-normal text-ink2">
              ¿De qué mes son las {pal.sesiones} que te paga? Viene sugerido el mes más viejo que debe (o este mes, si está al día).
            </span>
          </label>
          <Campo
            etiqueta="Nro de factura"
            opcional
            value={factura}
            onChange={(e) => setFactura(e.target.value)}
            placeholder="C 0002-00000123"
          />
        </>
      )}

      {error && <Alerta>{error}</Alerta>}

      <Boton alto="h-[3.625rem]" className="shrink-0 text-[1.0625rem]" cargando={guardar.isPending} onClick={guardarTodo}>
        {guardar.isPending ? 'Guardando…' : textoBoton}
      </Boton>
      {edPago && paciente && <AccionesRecibo pago={edPago} paciente={paciente} perfil={perfil} unidad={pal.sesiones} />}
      {editando && (
        <Boton variante="texto" icono={Trash2} className="text-bad hover:bg-bad-soft" onClick={() => setConfirmarBorrado(true)}>
          {edSesion ? `Eliminar ${pal.sesion}` : 'Eliminar pago'}
        </Boton>
      )}
    </Hoja>
  )
}

/** Descargar o compartir el recibo de un pago ya guardado. */
function AccionesRecibo({ pago, paciente, perfil, unidad }: { pago: Pago; paciente: Paciente; perfil: Perfil | undefined; unidad: string }) {
  const [elegir, setElegir] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  const conRecibo = async (accion: (r: typeof import('../../lib/recibo')) => Promise<void>) => {
    setOcupado(true)
    try {
      await accion(await import('../../lib/recibo'))
    } catch (e) {
      toast.error(`No se pudo armar el recibo: ${mensajeError(e)}`)
    } finally {
      setOcupado(false)
    }
  }

  const compartir = () =>
    conRecibo(async (r) => {
      const res = await r.compartirRecibo(pago, paciente, perfil, unidad)
      if (res === 'compartido') toast.success('Recibo compartido')
      if (res === 'sin-soporte') setElegir(true)
    })

  // En la computadora no se puede adjuntar solo: se descarga y se abre el mensaje para adjuntarlo.
  const porLink = (link: (r: typeof import('../../lib/recibo')) => string) =>
    conRecibo(async (r) => {
      await r.descargarRecibo(pago, paciente, perfil, unidad)
      window.open(link(r), '_blank', 'noopener')
      toast.success('Recibo descargado. Adjuntalo en el mensaje que se abrió.')
    })

  return (
    <div className="flex shrink-0 flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <Boton variante="borde" icono={Share2} cargando={ocupado} onClick={compartir}>
          Compartir recibo
        </Boton>
        <Boton
          variante="borde"
          icono={FileText}
          onClick={() =>
            conRecibo(async (r) => {
              await r.descargarRecibo(pago, paciente, perfil, unidad)
              toast.success('Recibo descargado')
            })
          }
        >
          Descargar
        </Boton>
      </div>
      {elegir && (
        <div className="grid grid-cols-2 gap-2">
          <Boton variante="texto" icono={MessageCircle} onClick={() => porLink((r) => r.linkWhatsAppRecibo(pago, paciente, perfil))}>
            Por WhatsApp
          </Boton>
          <Boton variante="texto" icono={Mail} onClick={() => porLink((r) => r.linkMailRecibo(pago, paciente, perfil))}>
            Por mail
          </Boton>
        </div>
      )}
    </div>
  )
}
