import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Plus, Search, Upload, Users } from 'lucide-react'
import { DescargarExcel } from '../../components/DescargarExcel'
import {
  Avatar, Boton, Chip, EstadoError, EstadoVacio, Esqueleto, IC, Pastilla, Tarjeta, Titulo,
} from '../../components/ui'
import { nombreCompleto, useDatos } from '../../lib/datos'
import { formatMonto, normalizar, plural } from '../../lib/formato'
import { debeAlgo, deudaDe, saldosDe, textoDeuda } from '../../lib/resumen'
import { tarifaVigente } from '../../lib/saldos'
import { useRegistro } from '../registro/RegistroContext'

const FILTROS = ['Todos', 'Deben', 'Activos', 'Inactivos'] as const
type Filtro = (typeof FILTROS)[number]

export function PacientesPage() {
  const { perfil, pacientes, sesiones, pagos, cargando, error, reintentar } = useDatos()
  const { abrir } = useRegistro()
  const navegar = useNavigate()
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('Todos')

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
    .filter((f) => !q || normalizar(f.nombre).includes(q))
    .sort((a, b) => Number(b.p.activo) - Number(a.p.activo) || a.nombre.localeCompare(b.nombre))
  const activos = pacientes.filter((p) => p.activo).length
  const conSaldo = filas.filter((f) => f.debe).length
  const tarifaEstandar = perfil?.tarifa_estandar ?? 0

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Titulo sub={pacientes.length ? `${plural(activos, 'activo', 'activos')} · ${conSaldo} con saldo` : undefined}>
          Pacientes
        </Titulo>
        <div className="flex gap-2">
          <DescargarExcel soloIcono alto="h-12" className="px-4" />
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
          <Boton alto="h-12" icono={Plus} className="px-[18px]" onClick={() => abrir({ modo: 'paciente' })}>
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
              <Boton icono={Plus} alto="h-[50px]" onClick={() => abrir({ modo: 'paciente' })}>
                Nuevo paciente
              </Boton>
              <Boton variante="suave" icono={Upload} alto="h-[50px]" onClick={() => navegar('/importar')}>
                Importar planilla
              </Boton>
              <DescargarExcel vacia alto="h-[50px]" />
            </>
          }
        >
          Cargalos uno por uno, traé tu planilla de Excel o descargá la nuestra para completarla.
        </EstadoVacio>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <label className="flex h-[54px] items-center gap-2.5 rounded-2xl border border-line bg-surface px-[18px] text-lg text-ink2 focus-within:border-acc">
              <Search {...IC} />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre"
                className="min-w-0 flex-1 border-none bg-transparent text-[17px] text-ink outline-none"
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
            <Tarjeta className="flex flex-col gap-0.5 p-2">
              {lista.map(({ p, nombre, deuda, debe }) => {
                const tarifa = tarifaVigente(p, tarifaEstandar)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => navegar(`/pacientes/${p.id}`)}
                    className={`flex items-center gap-3.5 rounded-2xl p-3.5 text-left hover:bg-surface2 ${p.activo ? '' : 'opacity-60'}`}
                  >
                    <Avatar nombre={nombre} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[17px] font-semibold">{nombre}</div>
                      <div className="mt-[3px] truncate text-sm text-ink2">
                        {tarifa > 0 ? `${formatMonto(tarifa, p.moneda)}/h` : 'Sin tarifa'}
                        {p.tipo_tarifa === 'personalizada' ? ' · personalizada' : ''}
                        {p.frecuencia ? ` · ${p.frecuencia}` : ''}
                        {p.activo ? '' : ' · Inactivo'}
                      </div>
                    </div>
                    <Chip tono={debe ? 'mal' : 'ok'} grande>
                      {debe ? `Debe ${textoDeuda(deuda)}` : 'Al día'}
                    </Chip>
                    <ChevronRight {...IC} className="hidden text-ink2 md:block" />
                  </button>
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
