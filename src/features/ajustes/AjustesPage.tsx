import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, FileSpreadsheet, LogOut, Moon, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Boton, Campo, EstadoError, Esqueleto, IC, Segmentado, Tarjeta } from '../../components/ui'
import { useGuardar, usePacientes, usePerfil } from '../../lib/datos'
import { formatMonto, montoParaInput, parseMontoAR, type Moneda } from '../../lib/formato'
import { mensajeError, supabase } from '../../lib/supabase'
import { cambiarTema, temaActual, type Tema } from '../../lib/tema'
import { useAuth } from '../auth/AuthProvider'

export function AjustesPage() {
  const { session } = useAuth()
  const perfil = usePerfil()
  const { data: pacientes = [] } = usePacientes()
  const guardar = useGuardar()
  const navegar = useNavigate()

  const [nombre, setNombre] = useState('')
  const [tarifaTxt, setTarifaTxt] = useState('')
  const [moneda, setMoneda] = useState<Moneda>('ARS')
  const [tema, setTema] = useState<Tema>(temaActual())

  useEffect(() => {
    if (!perfil.data) return
    setNombre(perfil.data.nombre ?? '')
    setTarifaTxt(perfil.data.tarifa_estandar ? montoParaInput(perfil.data.tarifa_estandar) : '')
    setMoneda(perfil.data.moneda_default)
  }, [perfil.data])

  if (perfil.isPending) return <Esqueleto que="los ajustes" />
  if (perfil.error) return <EstadoError que="los ajustes" reintentar={() => perfil.refetch()} />

  const conEstandar = pacientes.filter((p) => p.tipo_tarifa === 'estandar').length

  async function guardarCobros() {
    const tarifa = parseMontoAR(tarifaTxt || '0')
    if (tarifa == null || tarifa < 0) {
      toast.error('Revisá la tarifa: tiene que ser un número, por ejemplo 50.000')
      return
    }
    try {
      await guardar.mutateAsync([
        {
          tipo: 'actualizar',
          tabla: 'profiles',
          id: perfil.data!.id,
          cambios: { nombre: nombre.trim() || null, tarifa_estandar: tarifa, moneda_default: moneda },
        },
      ])
      // Los pacientes con tarifa estándar siguen la moneda de la tarifa estándar.
      const aActualizar = pacientes.filter((p) => p.tipo_tarifa === 'estandar' && p.moneda !== moneda)
      if (aActualizar.length) {
        await guardar.mutateAsync(
          aActualizar.map((p) => ({ tipo: 'actualizar' as const, tabla: 'patients' as const, id: p.id, cambios: { moneda } })),
        )
      }
      setTarifaTxt(tarifa ? montoParaInput(tarifa) : '')
      toast.success(`Ajustes guardados · ${formatMonto(tarifa, moneda)} por hora`)
    } catch (e) {
      toast.error(`No se pudo guardar: ${mensajeError(e)}`)
    }
  }

  function alternarTema() {
    const nuevo = tema === 'dark' ? 'light' : 'dark'
    cambiarTema(nuevo)
    setTema(nuevo)
  }

  async function salir() {
    const { error } = await supabase.auth.signOut()
    if (error) toast.error(mensajeError(error))
    else toast.success('Sesión cerrada')
  }

  const fila = 'flex h-16 w-full items-center justify-between gap-3 bg-transparent p-0 text-base font-semibold'

  return (
    <section className="flex max-w-[720px] flex-col gap-4">
      <h1 className="m-0 mb-2 font-serif text-[clamp(38px,5cqi,52px)] leading-none font-normal">Ajustes</h1>

      <Tarjeta className="flex flex-col gap-[18px] p-[22px]">
        <h2 className="m-0 text-lg font-semibold">Cobros por defecto</h2>
        <label className="flex flex-col gap-2 text-[15px] font-semibold">
          Tarifa estándar por hora
          <div className="flex h-14 items-center gap-2 rounded-[14px] border border-line bg-bg px-4 focus-within:border-acc">
            <span className="text-xl font-medium text-ink2">{moneda === 'USD' ? 'US$' : '$'}</span>
            <input
              inputMode="decimal"
              value={tarifaTxt}
              placeholder="0"
              onChange={(e) => setTarifaTxt(e.target.value.replace(/[^\d.,]/g, ''))}
              className="min-w-0 flex-1 border-none bg-transparent text-[22px] font-semibold tabular outline-none"
            />
          </div>
          <span className="text-sm font-normal text-ink2">
            {conEstandar
              ? `La usan ${conEstandar} ${conEstandar === 1 ? 'paciente' : 'pacientes'}. Si la cambiás, las sesiones nuevas se cobran con la tarifa nueva; las ya cargadas conservan su precio.`
              : 'Los pacientes con tarifa estándar usan este valor.'}
          </span>
        </label>
        <div className="flex flex-col gap-2 text-[15px] font-semibold">
          Moneda
          <Segmentado
            opciones={[
              { v: 'ARS' as Moneda, l: 'Pesos · ARS' },
              { v: 'USD' as Moneda, l: 'Dólares · USD' },
            ]}
            valor={moneda}
            onCambio={setMoneda}
            className="max-w-[280px]"
          />
        </div>
        <Campo etiqueta="Tu nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Lic. Ana Martínez" />
        <Boton alto="h-[50px]" className="self-start" cargando={guardar.isPending} onClick={guardarCobros}>
          Guardar cambios
        </Boton>
      </Tarjeta>

      <Tarjeta className="px-[22px] py-2">
        <button type="button" role="switch" aria-checked={tema === 'dark'} onClick={alternarTema} className={fila}>
          <span className="flex items-center gap-3">
            <Moon {...IC} />
            Modo oscuro
          </span>
          <span
            className={`flex h-8 w-[52px] rounded-full p-[3px] transition-colors ${
              tema === 'dark' ? 'justify-end bg-acc' : 'justify-start bg-line'
            }`}
          >
            <span className="size-[26px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)]" />
          </span>
        </button>
      </Tarjeta>

      <Tarjeta className="px-[22px] py-2">
        <button type="button" onClick={() => navegar('/importar')} className={fila}>
          <span className="flex items-center gap-3">
            <Upload {...IC} />
            Importar planilla
          </span>
          <ChevronRight {...IC} className="text-ink2" />
        </button>
        <button type="button" onClick={() => navegar('/contadora')} className={`${fila} border-t border-line`}>
          <span className="flex items-center gap-3">
            <FileSpreadsheet {...IC} />
            Reporte para contadora
          </span>
          <ChevronRight {...IC} className="text-ink2" />
        </button>
      </Tarjeta>

      <Tarjeta className="px-[22px] py-2">
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 text-base">
          <span className="text-ink2">Cuenta</span>
          <span className="font-semibold break-all">{session?.user.email}</span>
        </div>
        <button type="button" onClick={salir} className={`${fila} justify-start border-t border-line text-bad`}>
          <LogOut {...IC} />
          Cerrar sesión
        </button>
      </Tarjeta>
    </section>
  )
}
