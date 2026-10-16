import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Alerta, Boton, Campo, CampoMonto, Confirmar, Hoja, Segmentado, type Opcion } from '../../components/ui'
import { nombreCompleto, useDatos, useGuardar, type Paciente } from '../../lib/datos'
import { formatMonto, hoyAR, montoParaInput, parseMontoAR, type Moneda } from '../../lib/formato'
import { mensajeError } from '../../lib/supabase'
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

export function PacienteHoja({ paciente, onCerrar }: { paciente?: Paciente; onCerrar: () => void }) {
  const { perfil } = useDatos()
  const guardar = useGuardar()
  const navegar = useNavigate()
  const tarifaEstandar = perfil?.tarifa_estandar ?? 0
  const monedaEstandar = perfil?.moneda_default ?? 'ARS'

  const [nombre, setNombre] = useState(paciente ? nombreCompleto(paciente) : '')
  const [telefono, setTelefono] = useState(paciente?.telefono ?? '')
  const [tipo, setTipo] = useState<'estandar' | 'personalizada'>(paciente?.tipo_tarifa ?? 'estandar')
  const [tarifaTxt, setTarifaTxt] = useState(
    paciente?.tarifa_personalizada != null ? montoParaInput(paciente.tarifa_personalizada) : '',
  )
  const [moneda, setMoneda] = useState<Moneda>(paciente?.moneda ?? monedaEstandar)
  const [horas, setHoras] = useState(paciente?.horas_por_sesion ?? 1)
  const [dias, setDias] = useState<number[]>(paciente?.dias_semana ?? [])
  const [frecuencia, setFrecuencia] = useState(paciente?.frecuencia ?? 'Semanal')
  const [activo, setActivo] = useState(paciente?.activo ?? true)
  const [notas, setNotas] = useState(paciente?.notas_admin ?? '')
  const [error, setError] = useState('')
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)

  function alternarDia(d: number) {
    setDias((actuales) => (actuales.includes(d) ? actuales.filter((x) => x !== d) : [...actuales, d].sort()))
  }

  async function guardarPaciente() {
    const limpio = nombre.trim().replace(/\s+/g, ' ')
    if (!limpio) return setError('Escribí el nombre del paciente.')
    const tarifa = parseMontoAR(tarifaTxt)
    if (tipo === 'personalizada' && !(tarifa != null && tarifa > 0)) return setError('Ingresá la tarifa por hora.')
    setError('')
    const fila = {
      nombre: limpio,
      apellido: null,
      telefono: telefono.trim() || null,
      tipo_tarifa: tipo,
      tarifa_personalizada: tipo === 'personalizada' ? tarifa : null,
      // Con tarifa estándar el paciente usa la moneda de la tarifa estándar.
      moneda: tipo === 'estandar' ? monedaEstandar : moneda,
      horas_por_sesion: horas,
      dias_semana: dias,
      frecuencia,
      activo,
      notas_admin: notas.trim() || null,
    }
    try {
      if (paciente) {
        await guardar.mutateAsync([{ tipo: 'actualizar', tabla: 'patients', id: paciente.id, cambios: fila }])
        toast.success('Paciente actualizado')
        onCerrar()
      } else {
        const [creados] = await guardar.mutateAsync([
          { tipo: 'insertar', tabla: 'patients', filas: [{ ...fila, fecha_alta: hoyAR() }] },
        ])
        toast.success(`Paciente creado · ${limpio}`)
        onCerrar()
        if (creados[0]?.id) navegar(`/pacientes/${creados[0].id}`)
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
        type="tel"
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
        placeholder="11 5555-5555"
      />

      <div className="flex flex-col gap-2.5">
        <div className="text-[15px] font-semibold">Honorario por hora</div>
        <Segmentado
          opciones={[
            { v: 'estandar', l: 'Tarifa estándar' },
            { v: 'personalizada', l: 'Personalizada' },
          ]}
          valor={tipo}
          onCambio={setTipo}
        />
        {tipo === 'estandar' ? (
          <div className="text-[15px] text-ink2">
            {tarifaEstandar > 0
              ? `${formatMonto(tarifaEstandar, monedaEstandar)} por hora. Si cambiás la tarifa estándar en Ajustes, cambia para este paciente.`
              : 'Todavía no cargaste tu tarifa estándar. Hacelo en Ajustes.'}
          </div>
        ) : (
          <div className="flex gap-2.5">
            <CampoMonto
              etiqueta="Tarifa por hora"
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
              className="w-[124px] shrink-0"
              alto="h-full"
              redondeo="rounded-xl"
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[15px] font-semibold">Duración de la sesión</div>
        <Segmentado opciones={opcionesHoras(horas)} valor={horas} onCambio={setHoras} className="min-w-[200px]" alto="h-10" />
      </div>

      <div className="flex flex-col gap-2.5">
        <div>
          <div className="text-[15px] font-semibold">Días fijos</div>
          <div className="text-sm text-ink2">Para cargar las sesiones del mes de un toque.</div>
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
                className={`h-11 rounded-full border text-[15px] font-semibold ${
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
        <div className="text-[15px] font-semibold">Frecuencia</div>
        <Segmentado opciones={FRECUENCIAS} valor={frecuencia} onCambio={setFrecuencia} />
      </div>

      {paciente && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[15px] font-semibold">Estado</div>
            <Segmentado
              opciones={[
                { v: true, l: 'Activo' },
                { v: false, l: 'Inactivo' },
              ]}
              valor={activo}
              onCambio={setActivo}
              className="w-[220px]"
              alto="h-10"
            />
          </div>
          <label className="flex flex-col gap-2 text-[15px] font-semibold">
            <span>
              Notas administrativas<span className="ml-2 text-sm font-normal text-ink2">Nada clínico</span>
            </span>
            <textarea
              value={notas}
              maxLength={500}
              rows={2}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej. paga a fin de mes, factura a nombre de la madre"
              className="rounded-[14px] border border-line bg-fondo px-4 py-3 text-base font-normal outline-none focus:border-acc"
            />
          </label>
        </>
      )}

      {error && <Alerta>{error}</Alerta>}

      <Boton alto="h-[58px]" className="shrink-0 text-[17px]" cargando={guardar.isPending} onClick={guardarPaciente}>
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
