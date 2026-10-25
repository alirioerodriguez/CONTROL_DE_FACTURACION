import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { TriangleAlert, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Alerta, Boton, Campo, CampoMonto, Confirmar, Hoja, IC, Segmentado, type Opcion } from '../../components/ui'
import { nombreCompleto, useDatos, useGuardar, type Paciente } from '../../lib/datos'
import { hoyAR, montoParaInput, parseMontoAR, type Moneda } from '../../lib/formato'
import { verMonto } from '../../lib/discreto'
import {
  cuilCoincideConDni, cuilValido, dniValido, formatCuil, formatDni, pacienteConMismoDocumento, soloDigitos, sugerirCuil,
} from '../../lib/documentos'
import { mensajeError } from '../../lib/supabase'
import { usePalabras } from '../../components/usePalabras'
import { opcionesHoras } from './opciones'

const DIAS: Opcion<number>[] = [
  { v: 1, l: 'Lun' },
  { v: 2, l: 'Mar' },
  { v: 3, l: 'Mié' },
  { v: 4, l: 'Jue' },
  { v: 5, l: 'Vie' },
  { v: 6, l: 'Sáb' },
]
const FRECUENCIAS = ['Semanal', 'Quincenal', 'Mensual'].map((f) => ({ v: f, l: f }))

const CONDICIONES_IVA = ['Consumidor final', 'Monotributista', 'Responsable inscripto', 'Exento']

/** Aviso que no impide guardar (ej. DNI repetido). */
function Aviso({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="flex items-start gap-2.5 rounded-[0.875rem] bg-warn-soft px-3.5 py-3 text-[0.9375rem] leading-snug text-ink">
      <TriangleAlert {...IC} className="mt-px shrink-0 text-warn" />
      <span>{children}</span>
    </div>
  )
}

export function PacienteHoja({ paciente, onCerrar }: { paciente?: Paciente; onCerrar: () => void }) {
  const { perfil, pacientes } = useDatos()
  const guardar = useGuardar()
  const navegar = useNavigate()
  const pal = usePalabras()
  const tarifaEstandar = perfil?.tarifa_estandar ?? 0
  const monedaEstandar = perfil?.moneda_default ?? 'ARS'

  const [nombre, setNombre] = useState(paciente ? nombreCompleto(paciente) : '')
  const [telefono, setTelefono] = useState(paciente?.telefono ?? '')
  const [dni, setDni] = useState(soloDigitos(paciente?.dni))
  const [cuil, setCuil] = useState(formatCuil(paciente?.cuil_cuit))
  // Lo pide ARCA en cada factura. Casi todos los pacientes son consumidores finales.
  const [iva, setIva] = useState(paciente?.condicion_iva || 'Consumidor final')
  const [tipo, setTipo] = useState<'estandar' | 'personalizada' | 'abono'>(
    paciente?.abono_mensual ? 'abono' : (paciente?.tipo_tarifa ?? 'estandar'),
  )
  const [tarifaTxt, setTarifaTxt] = useState(
    paciente?.abono_mensual
      ? montoParaInput(paciente.abono_mensual)
      : paciente?.tarifa_personalizada != null
        ? montoParaInput(paciente.tarifa_personalizada)
        : '',
  )
  const [moneda, setMoneda] = useState<Moneda>(paciente?.moneda ?? monedaEstandar)
  const [horas, setHoras] = useState(paciente?.horas_por_sesion ?? 1)
  const [dias, setDias] = useState<number[]>(paciente?.dias_semana ?? [])
  const [frecuencia, setFrecuencia] = useState(paciente?.frecuencia ?? 'Semanal')
  const [activo, setActivo] = useState(paciente?.activo ?? true)
  const [notas, setNotas] = useState(paciente?.notas_admin ?? '')
  const [obraSocial, setObraSocial] = useState(paciente?.obra_social ?? '')
  const [afiliado, setAfiliado] = useState(paciente?.nro_afiliado ?? '')
  const [error, setError] = useState('')
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)
  // Id fijo mientras la hoja está abierta: reintentar después de un corte no crea el paciente dos veces.
  const [idNuevo] = useState(() => crypto.randomUUID())

  function alternarDia(d: number) {
    setDias((actuales) => (actuales.includes(d) ? actuales.filter((x) => x !== d) : [...actuales, d].sort()))
  }

  async function guardarPaciente() {
    const limpio = nombre.trim().replace(/\s+/g, ' ')
    if (!limpio) return setError('Escribí el nombre del paciente.')
    const tarifa = parseMontoAR(tarifaTxt)
    if (tipo === 'personalizada' && !(tarifa != null && tarifa > 0)) return setError(`Ingresá la tarifa ${pal.porUnidad}.`)
    if (tipo === 'abono' && !(tarifa != null && tarifa > 0)) return setError('Ingresá el monto del abono mensual.')
    if (dni && !dniValido(dni)) return setError('El DNI tiene que tener 7 u 8 números.')
    if (cuil && !cuilValido(cuil)) return setError('El CUIL/CUIT no es válido: revisá los 11 números (el último es el dígito verificador).')
    setError('')
    const fila = {
      nombre: limpio,
      apellido: null,
      telefono: telefono.trim() || null,
      dni: dni || null,
      cuil_cuit: cuil ? formatCuil(cuil) : null,
      condicion_iva: iva,
      // Con abono las sesiones guardan la tarifa estándar como referencia; lo que se cobra es el abono (ver abono.ts).
      tipo_tarifa: tipo === 'personalizada' ? 'personalizada' : 'estandar',
      tarifa_personalizada: tipo === 'personalizada' ? tarifa : null,
      abono_mensual: tipo === 'abono' ? tarifa : null,
      // Con tarifa estándar el paciente usa la moneda de la tarifa estándar.
      moneda: tipo === 'estandar' ? monedaEstandar : moneda,
      horas_por_sesion: pal.porHora ? horas : 1,
      dias_semana: dias,
      frecuencia,
      activo,
      notas_admin: notas.trim() || null,
      ...(perfil?.usa_obras_sociales
        ? { obra_social: obraSocial.trim() || null, nro_afiliado: obraSocial.trim() ? afiliado.trim() || null : null }
        : {}),
    }
    try {
      if (paciente) {
        await guardar.mutateAsync([{ tipo: 'actualizar', tabla: 'patients', id: paciente.id, cambios: fila }])
        toast.success('Paciente actualizado')
        onCerrar()
      } else {
        await guardar.mutateAsync([{ tipo: 'insertar', tabla: 'patients', filas: [{ ...fila, id: idNuevo, fecha_alta: hoyAR() }] }])
        toast.success(`Paciente creado · ${limpio}`)
        onCerrar()
        navegar(`/pacientes/${idNuevo}`)
      }
    } catch (e) {
      setError(mensajeError(e))
      toast.error(`No se pudo guardar: ${mensajeError(e)}`)
    }
  }

  async function borrar() {
    if (!paciente) return
    try {
      await guardar.mutateAsync([{ tipo: 'borrar', tabla: 'patients', id: paciente.id }])
      toast.success('Paciente eliminado')
      onCerrar()
      navegar('/pacientes')
    } catch (e) {
      toast.error(`No se pudo eliminar: ${mensajeError(e)}`)
      setConfirmarBorrado(false)
    }
  }

  // Avisos que no impiden guardar.
  const avisos: string[] = []
  const dniRepetido = dniValido(dni) ? pacienteConMismoDocumento(pacientes, 'dni', dni, paciente?.id) : undefined
  if (dniRepetido) avisos.push(`Ya tenés otro paciente con el DNI ${formatDni(dni)}: ${nombreCompleto(dniRepetido)}.`)
  const cuilRepetido = cuilValido(cuil) ? pacienteConMismoDocumento(pacientes, 'cuil_cuit', cuil, paciente?.id) : undefined
  if (cuilRepetido) avisos.push(`Ya tenés otro paciente con el CUIL/CUIT ${formatCuil(cuil)}: ${nombreCompleto(cuilRepetido)}.`)
  if (soloDigitos(cuil).length === 11 && !cuilValido(cuil)) {
    avisos.push('El último número del CUIL/CUIT no coincide con el dígito verificador. Revisalo.')
  } else if (dniValido(dni) && cuilValido(cuil) && !cuilCoincideConDni(cuil, dni)) {
    avisos.push('El CUIL no lleva este DNI en el medio. Revisá que los dos sean de la misma persona.')
  }

  if (confirmarBorrado && paciente) {
    return (
      <Confirmar
        titulo="¿Eliminar paciente?"
        textoConfirmar="Sí, eliminar todo"
        cargando={guardar.isPending}
        onConfirmar={borrar}
        onCancelar={() => setConfirmarBorrado(false)}
      >
        Se borra <strong className="text-ink">{nombreCompleto(paciente)}</strong> junto con todas sus sesiones y pagos.
        No se puede deshacer. Si dejó de venir, mejor marcalo como inactivo.
      </Confirmar>
    )
  }

  return (
    <Hoja titulo={paciente ? 'Editar paciente' : 'Nuevo paciente'} onCerrar={onCerrar}>
      <Campo
        etiqueta="Nombre y apellido"
        maxLength={120}
        autoFocus={!paciente}
        value={nombre}
        onChange={(e) => {
          setNombre(e.target.value)
          setError('')
        }}
        placeholder="Ej. Laura Benítez"
      />
      <Campo
        etiqueta="Teléfono"
        maxLength={40}
        type="tel"
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
        placeholder="11 5555-5555"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo
          etiqueta="DNI"
          opcional
          inputMode="numeric"
          autoComplete="off"
          maxLength={10}
          value={dni}
          onChange={(e) => {
            setDni(soloDigitos(e.target.value).slice(0, 8))
            setError('')
          }}
          placeholder="Solo números"
        />
        <Campo
          etiqueta="CUIL / CUIT"
          opcional
          inputMode="numeric"
          autoComplete="off"
          maxLength={13}
          value={cuil}
          onChange={(e) => {
            setCuil(formatCuil(e.target.value))
            setError('')
          }}
          placeholder="XX-XXXXXXXX-X"
        />
      </div>
      {dniValido(dni) && !cuil && (
        <div className="-mt-1 flex flex-wrap items-center gap-2 text-sm text-ink2">
          <span>Completar el CUIL con el DNI:</span>
          {(['F', 'M'] as const).map((sexo) => {
            const sugerido = sugerirCuil(dni, sexo)!
            return (
              <button
                key={sexo}
                type="button"
                onClick={() => setCuil(sugerido)}
                className="num min-h-10 rounded-full border border-line bg-surface px-3 text-[0.9375rem] font-semibold text-ink hover:bg-surface2"
              >
                {sugerido} <span className="font-normal text-ink2">{sexo === 'F' ? 'fem.' : 'masc.'}</span>
              </button>
            )
          })}
        </div>
      )}
      {avisos.map((a) => (
        <Aviso key={a}>{a}</Aviso>
      ))}
      <label className="flex flex-col gap-2 text-[0.9375rem] font-semibold">
        Condición frente al IVA
        <select
          value={iva}
          onChange={(e) => setIva(e.target.value)}
          className="h-[3.25rem] rounded-[0.875rem] border border-line bg-fondo px-3.5 text-[1.0625rem] font-normal"
        >
          {[...new Set([...CONDICIONES_IVA, iva])].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span className="text-sm font-normal text-ink2">La pide ARCA para la factura. Si no sabés, dejá «Consumidor final».</span>
      </label>
      {perfil?.usa_obras_sociales && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1fr]">
          <Campo
            etiqueta="Obra social o prepaga"
            opcional
            value={obraSocial}
            maxLength={80}
            onChange={(e) => setObraSocial(e.target.value)}
            placeholder="Ej. OSDE 310"
          />
          <Campo
            etiqueta="N.º de afiliado"
            opcional
            value={afiliado}
            maxLength={40}
            disabled={!obraSocial.trim()}
            onChange={(e) => setAfiliado(e.target.value)}
          />
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        <div className="text-[0.9375rem] font-semibold">Honorario</div>
        <div className="-mt-1 text-sm leading-snug text-ink2">
          Estándar: tu precio de siempre (lo cargás en Ajustes). Personalizada: un precio distinto para este paciente. Abono: un monto fijo por mes.
        </div>
        <Segmentado
          opciones={[
            { v: 'estandar', l: 'Estándar' },
            { v: 'personalizada', l: 'Personalizada' },
            { v: 'abono', l: 'Abono mensual' },
          ]}
          valor={tipo}
          onCambio={setTipo}
        />
        {tipo === 'estandar' ? (
          <div className="text-[0.9375rem] text-ink2">
            {tarifaEstandar > 0
              ? `${verMonto(tarifaEstandar, monedaEstandar)} ${pal.porUnidad}. Si cambiás la tarifa estándar en Ajustes, cambia para este paciente.`
              : 'Todavía no cargaste tu tarifa estándar. Hacelo en Ajustes.'}
          </div>
        ) : (
          <div className="flex gap-2.5">
            <CampoMonto
              etiqueta={tipo === 'abono' ? 'Monto por mes' : `Tarifa ${pal.porUnidad}`}
              simbolo={moneda === 'USD' ? 'US$' : '$'}
              valor={tarifaTxt}
              onCambio={(v) => {
                setTarifaTxt(v)
                setError('')
              }}
            />
            <Segmentado
              opciones={[
                { v: 'ARS' as Moneda, l: 'ARS' },
                { v: 'USD' as Moneda, l: 'USD' },
              ]}
              valor={moneda}
              onCambio={setMoneda}
              className="w-[7.75rem] shrink-0"
              alto="h-full"
              redondeo="rounded-xl"
            />
          </div>
        )}
        {tipo === 'abono' && (
          <div className="text-[0.9375rem] leading-snug text-ink2">
            Paga lo mismo cada mes, sin importar cuántas {pal.sesiones} haga. Los meses sin {pal.sesiones} no se cobran.
          </div>
        )}
      </div>

      {pal.porHora && (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[0.9375rem] font-semibold">Duración de la {pal.sesion}</div>
        <Segmentado opciones={opcionesHoras(horas)} valor={horas} onCambio={setHoras} className="min-w-[12.5rem]" alto="h-10" />
      </div>
      )}

      <div className="flex flex-col gap-2.5">
        <div>
          <div className="text-[0.9375rem] font-semibold">Días fijos</div>
          <div className="text-sm text-ink2">Para cargar las {pal.sesiones} del mes de un toque.</div>
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {DIAS.map((d) => {
            const on = dias.includes(d.v)
            return (
              <button
                key={d.v}
                type="button"
                aria-pressed={on}
                onClick={() => alternarDia(d.v)}
                className={`h-11 rounded-full border text-[0.9375rem] font-semibold ${
                  on ? 'border-acc bg-acc text-on-acc' : 'border-line bg-surface text-ink'
                }`}
              >
                {d.l}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="text-[0.9375rem] font-semibold">Frecuencia</div>
        <Segmentado opciones={FRECUENCIAS} valor={frecuencia} onCambio={setFrecuencia} />
      </div>

      {paciente && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[0.9375rem] font-semibold">Estado</div>
            <Segmentado
              opciones={[
                { v: true, l: 'Activo' },
                { v: false, l: 'Inactivo' },
              ]}
              valor={activo}
              onCambio={setActivo}
              className="w-[13.75rem]"
              alto="h-10"
            />
          </div>
          <label className="flex flex-col gap-2 text-[0.9375rem] font-semibold">
            <span>
              Notas administrativas<span className="ml-2 text-sm font-normal text-ink2">Nada clínico</span>
            </span>
            <textarea
              value={notas}
              maxLength={500}
              rows={2}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej. paga a fin de mes, factura a nombre de la madre"
              className="rounded-[0.875rem] border border-line bg-fondo px-4 py-3 text-base font-normal outline-none focus:border-acc"
            />
          </label>
        </>
      )}

      {error && <Alerta>{error}</Alerta>}

      <Boton alto="h-[3.625rem]" className="shrink-0 text-[1.0625rem]" cargando={guardar.isPending} onClick={guardarPaciente}>
        {guardar.isPending ? 'Guardando…' : paciente ? 'Guardar cambios' : 'Crear paciente'}
      </Boton>
      {paciente && (
        <Boton variante="texto" icono={Trash2} className="text-bad hover:bg-bad-soft" onClick={() => setConfirmarBorrado(true)}>
          Eliminar paciente
        </Boton>
      )}
    </Hoja>
  )
}
