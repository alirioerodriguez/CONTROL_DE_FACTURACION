import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Plus, Search, Upload, Users } from 'lucide-react'
import { toast } from 'sonner'
import { DescargarExcel } from '../../components/DescargarExcel'
import { useEnLinea } from '../../components/SinConexion'
import {
  Avatar, Boton, Chip, EstadoError, EstadoVacio, Esqueleto, IC, Pastilla, Tarjeta, Titulo,
} from '../../components/ui'
import { nombreCompleto, useBorradores, useDatos, useGuardar, type Paciente } from '../../lib/datos'
import { encolar } from '../../lib/colaOffline'
import { hoyAR, normalizar, plural } from '../../lib/formato'
import { verMonto } from '../../lib/discreto'
import { debeAlgo, deudaDe, saldosDe, textoDeuda } from '../../lib/resumen'
import { tieneAbono } from '../../lib/abono'
import { armarSesionVinoHoy, yaVinoEnFecha } from '../../lib/pasillo'
import { tarifaVigente } from '../../lib/saldos'
import { coincideDocumento, formatCuil, formatDni } from '../../lib/documentos'
import { mensajeError } from '../../lib/supabase'
import { modoPasilloActual } from '../../lib/tema'
import { usePais, usePalabras } from '../../components/usePalabras'
import { useRegistro } from '../registro/RegistroContext'

const FILTROS = ['Todos', 'Deben', 'Activos', 'Inactivos'] as const
type Filtro = (typeof FILTROS)[number]

export function PacientesPage() {
  const { perfil, pacientes, sesiones, pagos, cargando, error, datosHora, reintentar } = useDatos()
  const borradores = useBorradores(perfil?.id)
  const enLinea = useEnLinea()
  const guardar = useGuardar()
  const { abrir } = useRegistro()
  const pal = usePalabras()
  const tp = usePais()
  const navegar = useNavigate()
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('Todos')
  const pasillo = perfil?.modo_pasillo ?? modoPasilloActual()

  const filas = useMemo(
    () =>
      pacientes.map((p) => {
        const deuda = deudaDe(saldosDe(p.id, sesiones, pagos))
        return { p, nombre: nombreCompleto(p), deuda, debe: debeAlgo(deuda) }
      }),
    [pacientes, sesiones, pagos],
  )

  if (cargando) return <Esqueleto que="tus pacientes" />
  if (error) return <EstadoError que="tus pacientes" reintentar={reintentar} />

  const cumple: Record<Filtro, (f: (typeof filas)[number]) => boolean> = {
    Todos: () => true,
    Deben: (f) => f.debe,
    Activos: (f) => f.p.activo,
    Inactivos: (f) => !f.p.activo,
  }
  const q = normalizar(busqueda.trim())
  const lista = filas
    .filter(cumple[filtro])
    .filter((f) => !q || normalizar(f.nombre).includes(q) || coincideDocumento(f.p, q))
    .sort((a, b) => Number(b.p.activo) - Number(a.p.activo) || a.nombre.localeCompare(b.nombre))
  const activos = pacientes.filter((p) => p.activo).length
  const conSaldo = filas.filter((f) => f.debe).length
  const tarifaEstandar = perfil?.tarifa_estandar ?? 0

  const pacientesConBorrador = new Set(borradores.map((b) => b.pacienteId))

  async function registrarVinoHoy(p: Paciente) {
    const hoy = hoyAR()
    if (yaVinoEnFecha(sesiones, p.id, hoy)) {
      toast.success(`${p.nombre.split(' ')[0]} ya tiene registrada la ${pal.sesion} de hoy`)
      return
    }
    const fila = armarSesionVinoHoy(p, tarifaEstandar, pal.porHora, hoy)
    if (!navigator.onLine && perfil?.id) {
      encolar(
        {
          clave: fila.id,
          userId: perfil.id,
          tipo: 'sesion',
          pacienteId: p.id,
          fecha: fila.fecha,
          horas: fila.horas,
          tarifa_hora: fila.tarifa_hora,
          monto: fila.tarifa_hora * fila.horas,
          moneda: fila.moneda,
          estado: 'normal',
        },
        localStorage,
      )
      toast.success(`Sin señal: ${pal.sesion} de hoy guardada como «Pendiente de enviar»`)
      return
    }
    try {
      await guardar.mutateAsync([{ tipo: 'insertar', tabla: 'sessions', filas: [fila] }])
      toast.success(`${pal.Sesion} de hoy registrada · ${p.nombre.split(' ')[0]}`)
    } catch (e) {
      toast.error(`No se pudo guardar: ${mensajeError(e)}`)
    }
  }

  const subtitulo = pacientes.length
    ? `${plural(activos, 'activo', 'activos')} · ${conSaldo} con saldo${!enLinea && datosHora ? ` · Datos de las ${datosHora}` : ''}`
    : undefined

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Titulo sub={subtitulo}>
          Pacientes
        </Titulo>
        <div className="flex flex-wrap gap-2">
          <DescargarExcel soloIcono alto="h-12" className="px-4" data-tour="descargar-excel" />
          <Boton
            variante="borde"
            alto="h-12"
            icono={Upload}
            className="px-4"
            aria-label="Importar planilla"
            title="Importar planilla"
            onClick={() => navegar('/importar')}
          >
            <span className="hidden md:inline">Importar</span>
          </Boton>
          <Boton alto="h-12" icono={Plus} className="px-[1.125rem]" data-tour="nuevo-paciente" onClick={() => abrir({ modo: 'paciente' })}>
            Nuevo paciente
          </Boton>
        </div>
      </div>

      {pacientes.length === 0 ? (
        <EstadoVacio
          icono={Users}
          titulo="Todavía no hay pacientes"
          acciones={
            <>
              <Boton icono={Plus} alto="h-[3.125rem]" onClick={() => abrir({ modo: 'paciente' })}>
                Nuevo paciente
              </Boton>
              <Boton variante="suave" icono={Upload} alto="h-[3.125rem]" onClick={() => navegar('/importar')}>
                Importar planilla
              </Boton>
              <DescargarExcel vacia alto="h-[3.125rem]" />
            </>
          }
        >
          Cargalos uno por uno, traé tu planilla de Excel o descargá la nuestra para completarla.
        </EstadoVacio>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <label className="flex h-[3.375rem] items-center gap-2.5 rounded-2xl border border-line bg-surface px-[1.125rem] text-lg text-ink2 focus-within:border-acc">
              <Search {...IC} />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder={`Buscar por nombre, ${tp.docPersonal} o ${tp.docPaciente}`}
                className="min-w-0 flex-1 border-none bg-transparent text-[1.0625rem] text-ink outline-none"
              />
            </label>
            <div className="flex gap-2 overflow-x-auto pb-0.5">
              {FILTROS.map((f) => (
                <Pastilla key={f} activa={filtro === f} onClick={() => setFiltro(f)}>
                  {f} · {filas.filter(cumple[f]).length}
                </Pastilla>
              ))}
            </div>
          </div>

          {lista.length > 0 ? (
            <Tarjeta className="escalonado flex flex-col gap-0.5 p-2">
              {lista.map(({ p, nombre, deuda, debe }) => {
                const tarifa = tarifaVigente(p, tarifaEstandar)
                const tieneBorrador = pacientesConBorrador.has(p.id)
                return (
                  <div key={p.id} className={`flex flex-col gap-3 rounded-2xl ${pasillo ? 'p-3.5' : ''} ${p.activo ? '' : 'opacity-60'}`}>
                    <button
                      type="button"
                      onClick={() => navegar(`/pacientes/${p.id}`)}
                      className={`presionable flex items-center gap-3.5 rounded-2xl text-left hover:bg-surface2 ${pasillo ? '' : 'p-3.5'}`}
                    >
                      <Avatar nombre={nombre} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[1.0625rem] font-semibold">{nombre}</div>
                        <div className="mt-[0.1875rem] truncate text-sm text-ink2">
                          {tieneAbono(p)
                            ? `Abono ${verMonto(p.abono_mensual ?? 0, p.moneda)}/mes`
                            : tarifa > 0
                              ? `${verMonto(tarifa, p.moneda)}${pal.sufijo}`
                              : 'Sin tarifa'}
                          {p.tipo_tarifa === 'personalizada' ? ' · personalizada' : ''}
                          {p.frecuencia ? ` · ${p.frecuencia}` : ''}
                          {p.activo ? '' : ' · Inactivo'}
                        </div>
                        {(p.dni || p.cuil_cuit) && (
                          <div className="num mt-0.5 truncate text-sm text-ink2">
                            {p.dni ? `${tp.docPersonal} ${formatDni(p.dni)}` : `${tp.docPaciente} ${formatCuil(p.cuil_cuit)}`}
                          </div>
                        )}
                        {/* En el celular el saldo va debajo del nombre, para que los dos se lean completos. */}
                        <div className="mt-2 flex flex-wrap gap-1.5 md:hidden">
                          <Chip tono={debe ? 'mal' : 'ok'} grande ajustable>
                            {debe ? `Debe ${textoDeuda(deuda)}` : 'Al día'}
                          </Chip>
                          {tieneBorrador && <Chip tono="parcial" grande>Pendiente de enviar</Chip>}
                        </div>
                      </div>
                      <span className="hidden items-center gap-2 md:inline-flex">
                        {tieneBorrador && <Chip tono="parcial" grande>Pendiente de enviar</Chip>}
                        <Chip tono={debe ? 'mal' : 'ok'} grande>
                          {debe ? `Debe ${textoDeuda(deuda)}` : 'Al día'}
                        </Chip>
                      </span>
                      <ChevronRight {...IC} className="hidden text-ink2 md:block" />
                    </button>

                    {pasillo && (
                      <div className="grid grid-cols-3 gap-2">
                        <Boton alto="h-14" className="px-2 text-base" disabled={guardar.isPending} onClick={() => void registrarVinoHoy(p)}>
                          Vino hoy
                        </Boton>
                        <Boton alto="h-14" variante="suave" className="px-2 text-base" onClick={() => abrir({ modo: 'pago', pacienteId: p.id })}>
                          Pagó
                        </Boton>
                        <Boton alto="h-14" variante="borde" className="px-2 text-base" onClick={() => navegar(`/pacientes/${p.id}`)}>
                          Resumen
                        </Boton>
                      </div>
                    )}
                  </div>
                )
              })}
            </Tarjeta>
          ) : (
            <div className="px-5 py-12 text-center text-base leading-normal text-ink2">
              <div className="mb-1 text-lg font-semibold text-ink">Sin resultados</div>
              {q
                ? `No encontramos “${busqueda.trim()}” en ${filtro === 'Todos' ? 'tus pacientes' : filtro.toLowerCase()}.`
                : 'No hay pacientes en este filtro.'}
            </div>
          )}
        </>
      )}
    </section>
  )
}
