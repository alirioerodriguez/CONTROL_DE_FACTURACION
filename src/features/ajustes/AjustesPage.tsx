import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, FileSpreadsheet, LogOut, Moon, Sparkles, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { DescargarExcel } from '../../components/DescargarExcel'
import { FotoUsuario } from '../../components/FotoUsuario'
import { Boton, Campo, Confirmar, EstadoError, Esqueleto, IC, Segmentado, Tarjeta } from '../../components/ui'
import { useGuardar, usePacientes, usePerfil } from '../../lib/datos'
import {
  completarPlantilla, formatMonto, montoParaInput, parseMontoAR, PLANTILLA_WHATSAPP_DEFECTO, type Moneda,
} from '../../lib/formato'
import { mensajeError, supabase } from '../../lib/supabase'
import { cambiarTema, temaActual, type Tema } from '../../lib/tema'
import { useAuth } from '../auth/AuthProvider'
import { CamposProfesion } from '../tutorial/Bienvenida'
import { useTutorial } from '../tutorial/Tutorial'
import { palabras, PROFESIONES, type ModoCobro, type Termino } from '../../lib/terminos'

export function AjustesPage() {
  const { session } = useAuth()
  const perfil = usePerfil()
  const { data: pacientes = [] } = usePacientes()
  const guardar = useGuardar()
  const navegar = useNavigate()
  const { iniciar: iniciarTutorial } = useTutorial()

  const [nombre, setNombre] = useState('')
  const [tarifaTxt, setTarifaTxt] = useState('')
  const [moneda, setMoneda] = useState<Moneda>('ARS')
  const [plantilla, setPlantilla] = useState('')
  const [tema, setTema] = useState<Tema>(temaActual())
  const [profesion, setProfesion] = useState('')
  const [otra, setOtra] = useState('')
  const [termino, setTermino] = useState<Termino>('sesion')
  const [modo, setModo] = useState<ModoCobro>('hora')
  const [borrar, setBorrar] = useState(false)
  const [textoBorrar, setTextoBorrar] = useState('')
  const [borrando, setBorrando] = useState(false)
  const pal = palabras(termino, modo)

  useEffect(() => {
    if (!perfil.data) return
    setNombre(perfil.data.nombre ?? '')
    setTarifaTxt(perfil.data.tarifa_estandar ? montoParaInput(perfil.data.tarifa_estandar) : '')
    setMoneda(perfil.data.moneda_default)
    setPlantilla(perfil.data.plantilla_whatsapp || PLANTILLA_WHATSAPP_DEFECTO)
    const prof = perfil.data.profesion ?? ''
    const conocida = PROFESIONES.some((x) => x.v === prof)
    setProfesion(prof && !conocida ? 'otra' : prof)
    setOtra(prof && !conocida && prof !== 'otra' ? prof : '')
    setTermino(perfil.data.termino)
    setModo(perfil.data.modo_cobro)
  }, [perfil.data])

  if (perfil.isPending) return <Esqueleto que="los ajustes" />
  if (perfil.error) return <EstadoError que="los ajustes" reintentar={() => perfil.refetch()} />

  // Vocabulario guardado (la tarjeta de profesión puede tener cambios sin guardar).
  const palGuardado = palabras(perfil.data?.termino, perfil.data?.modo_cobro)
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
          cambios: {
            nombre: nombre.trim() || null,
            tarifa_estandar: tarifa,
            moneda_default: moneda,
            plantilla_whatsapp: plantilla.trim() || PLANTILLA_WHATSAPP_DEFECTO,
          },
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
      toast.success(`Ajustes guardados · ${formatMonto(tarifa, moneda)} ${palGuardado.porUnidad}`)
    } catch (e) {
      toast.error(`No se pudo guardar: ${mensajeError(e)}`)
    }
  }

  async function guardarProfesion() {
    const valor = profesion === 'otra' ? otra.trim() || 'otra' : profesion || null
    try {
      await guardar.mutateAsync([
        { tipo: 'actualizar', tabla: 'profiles', id: perfil.data!.id, cambios: { profesion: valor, termino, modo_cobro: modo } },
      ])
      toast.success(`Listo: ${pal.sesiones}, cobro ${pal.porUnidad}`)
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

  async function eliminarCuenta() {
    setBorrando(true)
    const { error } = await supabase.rpc('eliminar_mi_cuenta')
    if (error) {
      setBorrando(false)
      toast.error(`No se pudo eliminar la cuenta: ${mensajeError(error)}`)
      return
    }
    // El usuario ya no existe: alcanza con limpiar la sesión de este navegador.
    await supabase.auth.signOut({ scope: 'local' })
    toast.success('Tu cuenta y todos tus datos se eliminaron')
  }

  const fila = 'flex h-16 w-full items-center justify-between gap-3 bg-transparent p-0 text-base font-semibold'

  return (
    <section className="flex max-w-[720px] flex-col gap-4">
      <h1 className="m-0 mb-2 font-serif text-[clamp(38px,5cqi,52px)] leading-none font-normal">Ajustes</h1>

      <Tarjeta className="flex flex-col gap-[18px] p-[22px]">
        <h2 className="m-0 text-lg font-semibold">Tu profesión</h2>
        <CamposProfesion
          profesion={profesion}
          setProfesion={setProfesion}
          otra={otra}
          setOtra={setOtra}
          termino={termino}
          setTermino={setTermino}
          modo={modo}
          setModo={setModo}
        />
        <Boton alto="h-[50px]" className="self-start" cargando={guardar.isPending} onClick={guardarProfesion}>
          Guardar profesión
        </Boton>
      </Tarjeta>

      <Tarjeta className="flex flex-col gap-[18px] p-[22px]">
        <h2 className="m-0 text-lg font-semibold">Cobros por defecto</h2>
        <label data-tour="tarifa" className="flex flex-col gap-2 text-[15px] font-semibold">
          Tarifa estándar {palGuardado.porUnidad}
          <div className="flex h-14 items-center gap-2 rounded-[14px] border border-line bg-fondo px-4 focus-within:border-acc">
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
              ? `La usan ${conEstandar} ${conEstandar === 1 ? 'paciente' : 'pacientes'}. Si la cambiás, las ${palGuardado.sesiones} nuevas se cobran con la tarifa nueva; las ya cargadas conservan su precio.`
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
        <label className="flex flex-col gap-2 text-[15px] font-semibold">
          Mensaje de recordatorio por WhatsApp
          <textarea
            value={plantilla}
            rows={3}
            maxLength={500}
            onChange={(e) => setPlantilla(e.target.value)}
            className="rounded-[14px] border border-line bg-fondo px-4 py-3 text-base font-normal outline-none focus:border-acc"
          />
          <span className="text-sm font-normal text-ink2">
            Usá {'{nombre}'}, {'{mes}'} y {'{monto}'}. Así queda: “
            {completarPlantilla(plantilla, { nombre: 'Lucía', mes: 'octubre', monto: '$ 50.000,00' })}”
          </span>
        </label>
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

      <Tarjeta className="flex flex-col gap-3 p-[22px]">
        <h2 className="m-0 text-lg font-semibold">Tus datos en Excel</h2>
        <p className="m-0 text-[15px] leading-normal text-ink2">
          Descargá todo (pacientes, sesiones y pagos) como copia de seguridad. El archivo tiene el mismo formato que la plantilla:
          podés completarlo o corregirlo en Excel y volver a subirlo desde Importar, sin que se dupliquen datos.
        </p>
        <div className="flex flex-wrap gap-2">
          <DescargarExcel etiqueta="Descargar Excel" />
          <DescargarExcel vacia etiqueta="Planilla vacía" />
        </div>
      </Tarjeta>

      <Tarjeta className="px-[22px] py-2">
        <button type="button" onClick={iniciarTutorial} className={fila}>
          <span className="flex items-center gap-3">
            <Sparkles {...IC} />
            Ver tutorial
          </span>
          <ChevronRight {...IC} className="text-ink2" />
        </button>
        <button type="button" onClick={() => navegar('/importar')} className={`${fila} border-t border-line`}>
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
          <span className="flex min-w-0 items-center gap-2.5 font-semibold break-all">
            <FotoUsuario className="size-8 text-xs" />
            {session?.user.email}
          </span>
        </div>
        <button type="button" onClick={salir} className={`${fila} justify-start border-t border-line text-bad`}>
          <LogOut {...IC} />
          Cerrar sesión
        </button>
        <button
          type="button"
          onClick={() => { setTextoBorrar(''); setBorrar(true) }}
          className={`${fila} justify-start border-t border-line font-normal text-ink2`}
        >
          <Trash2 {...IC} />
          Eliminar mi cuenta
        </button>
      </Tarjeta>

      {borrar && (
        <Confirmar
          titulo="Eliminar tu cuenta"
          textoConfirmar="Eliminar para siempre"
          cargando={borrando}
          onCancelar={() => setBorrar(false)}
          onConfirmar={() => {
            if (textoBorrar.trim().toUpperCase() !== 'ELIMINAR') toast.error('Escribí ELIMINAR para confirmar.')
            else void eliminarCuenta()
          }}
        >
          <p className="m-0">
            Se borran tu cuenta, tus pacientes, sesiones y pagos. <strong className="text-ink">No se puede deshacer.</strong>
          </p>
          <p className="mt-3 mb-0">Si querés guardar una copia, descargá antes tus datos en Excel desde «Tus datos en Excel».</p>
          <label className="mt-4 flex flex-col gap-2 text-[15px] font-semibold text-ink">
            Para confirmar, escribí ELIMINAR
            <input
              value={textoBorrar}
              onChange={(e) => setTextoBorrar(e.target.value)}
              autoCapitalize="characters"
              autoComplete="off"
              className="h-[54px] w-full rounded-[14px] border border-line bg-surface px-4 text-[17px] font-normal outline-none focus:border-acc"
            />
          </label>
        </Confirmar>
      )}
    </section>
  )
}
