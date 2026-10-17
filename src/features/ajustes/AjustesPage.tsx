import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ClipboardList, FileSpreadsheet, LogOut, Moon, Sparkles, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { DescargarExcel } from '../../components/DescargarExcel'
import { FotoUsuario } from '../../components/FotoUsuario'
import { Boton, Campo, Confirmar, EstadoError, Esqueleto, IC, Segmentado, Tarjeta } from '../../components/ui'
import { useGuardar, usePacientes, usePerfil } from '../../lib/datos'
import {
  completarPlantilla, formatMonto, montoParaInput, parseMontoAR, PLANTILLA_WHATSAPP_DEFECTO, type Moneda,
} from '../../lib/formato'
import { mensajeError, supabase } from '../../lib/supabase'
import { cambiarLetra, cambiarTema, letraActual, TAMANOS_LETRA, temaActual, type Tema } from '../../lib/tema'
import { useAuth } from '../auth/AuthProvider'
import { CamposProfesion } from '../tutorial/Bienvenida'
import { MonotributoAjustes } from './MonotributoAjustes'
import { CalendarioAjustes } from './CalendarioAjustes'
import { OpcionesAjustes } from './OpcionesAjustes'
import { OtraApp } from './OtraApp'
import { useTutorial } from '../tutorial/Tutorial'
import { etiquetaProfesion, palabras, PROFESIONES, type ModoCobro, type Termino } from '../../lib/terminos'

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
  const [datosPago, setDatosPago] = useState('')
  const [matricula, setMatricula] = useState('')
  const [mailContadora, setMailContadora] = useState('')
  const [tema, setTema] = useState<Tema>(temaActual())
  const [profesion, setProfesion] = useState('')
  const [otra, setOtra] = useState('')
  const [termino, setTermino] = useState<Termino>('sesion')
  const [modo, setModo] = useState<ModoCobro>('hora')
  const [editandoProfesion, setEditandoProfesion] = useState(false)
  const [letra, setLetra] = useState(letraActual())
  const [borrar, setBorrar] = useState(false)
  const [textoBorrar, setTextoBorrar] = useState('')
  const [borrando, setBorrando] = useState(false)
  const pal = palabras(termino, modo)

  function cargarProfesion() {
    if (!perfil.data) return
    const prof = perfil.data.profesion ?? ''
    const conocida = PROFESIONES.some((x) => x.v === prof)
    setProfesion(prof && !conocida ? 'otra' : prof)
    setOtra(prof && !conocida && prof !== 'otra' ? prof : '')
    setTermino(perfil.data.termino)
    setModo(perfil.data.modo_cobro)
  }

  useEffect(() => {
    if (!perfil.data) return
    setNombre(perfil.data.nombre ?? '')
    setTarifaTxt(perfil.data.tarifa_estandar ? montoParaInput(perfil.data.tarifa_estandar) : '')
    setMoneda(perfil.data.moneda_default)
    setPlantilla(perfil.data.plantilla_whatsapp || PLANTILLA_WHATSAPP_DEFECTO)
    setDatosPago(perfil.data.datos_pago ?? '')
    setMatricula(perfil.data.matricula ?? '')
    setMailContadora(perfil.data.contadora_email ?? '')
    cargarProfesion()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil.data])

  if (perfil.isPending) return <Esqueleto que="los ajustes" />
  if (perfil.error) return <EstadoError que="los ajustes" reintentar={() => perfil.refetch()} />

  // Vocabulario guardado (la tarjeta de profesión puede tener cambios sin guardar).
  const palGuardado = palabras(perfil.data?.termino, perfil.data?.modo_cobro)
  const conEstandar = pacientes.filter((p) => p.tipo_tarifa === 'estandar').length

  async function guardarCobros() {
    const mail = mailContadora.trim()
    if (mail && !/^[^s@]+@[^s@]+.[^s@]+$/.test(mail)) {
      toast.error('Revisá el mail de tu contadora: tiene que ser como nombre@ejemplo.com')
      return
    }
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
            datos_pago: datosPago.trim() || null,
            matricula: matricula.trim() || null,
            contadora_email: mail || null,
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
      setEditandoProfesion(false)
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
    <section className="flex max-w-[45rem] flex-col gap-4">
      <h1 className="m-0 mb-2 font-serif text-[clamp(2.375rem,5cqi,3.25rem)] leading-none font-normal">Ajustes</h1>

      <Tarjeta className="flex flex-col gap-[1.125rem] p-[1.375rem]">
        <h2 className="m-0 text-lg font-semibold">Tamaño de letra</h2>
        <p className="m-0 text-[0.9375rem] leading-normal text-ink2">
          Agrandá todo para leer más cómodo. Se guarda en este dispositivo.
        </p>
        <div role="radiogroup" aria-label="Tamaño de letra" className="grid grid-cols-5 gap-2">
          {TAMANOS_LETRA.map((t) => (
            <button
              key={t.n}
              type="button"
              role="radio"
              aria-checked={letra === t.n}
              aria-label={t.nombre}
              title={t.nombre}
              onClick={() => {
                cambiarLetra(t.n)
                setLetra(t.n)
              }}
              className={`flex h-16 items-center justify-center rounded-2xl border font-serif leading-none ${
                letra === t.n ? 'border-ink bg-ink text-fondo' : 'border-line bg-surface text-ink hover:bg-surface2'
              }`}
              style={{ fontSize: `${1 + t.n * 0.25}rem` }}
            >
              A
            </button>
          ))}
        </div>
        <div className="text-base font-semibold">{TAMANOS_LETRA[letra - 1]?.nombre}</div>
      </Tarjeta>

      <Tarjeta className="flex flex-col gap-[1.125rem] p-[1.375rem]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 text-lg font-semibold">Tu profesión</h2>
          {perfil.data?.profesion && !editandoProfesion && (
            <Boton variante="suave" alto="h-11" className="px-4" onClick={() => setEditandoProfesion(true)}>
              Cambiar
            </Boton>
          )}
        </div>
        {perfil.data?.profesion && !editandoProfesion ? (
          <div className="flex flex-col gap-1">
            <div className="text-xl font-semibold first-letter:uppercase">{etiquetaProfesion(perfil.data.profesion)}</div>
            <div className="text-[0.9375rem] text-ink2">
              Le decís «{palGuardado.sesion}» a cada encuentro · Cobrás {palGuardado.porUnidad}
            </div>
          </div>
        ) : (
          <>
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
            <div className="flex flex-wrap gap-2">
              <Boton alto="h-[3.125rem]" cargando={guardar.isPending} onClick={guardarProfesion}>
                Guardar profesión
              </Boton>
              {perfil.data?.profesion && (
                <Boton
                  variante="suave"
                  alto="h-[3.125rem]"
                  onClick={() => {
                    cargarProfesion()
                    setEditandoProfesion(false)
                  }}
                >
                  Cancelar
                </Boton>
              )}
            </div>
          </>
        )}
      </Tarjeta>

      <Tarjeta className="flex flex-col gap-[1.125rem] p-[1.375rem]">
        <h2 className="m-0 text-lg font-semibold">Cobros por defecto</h2>
        <label data-tour="tarifa" className="flex flex-col gap-2 text-[0.9375rem] font-semibold">
          Tarifa estándar {palGuardado.porUnidad}
          <div className="flex h-14 items-center gap-2 rounded-[0.875rem] border border-line bg-fondo px-4 focus-within:border-acc">
            <span className="text-xl font-medium text-ink2">{moneda === 'USD' ? 'US$' : '$'}</span>
            <input
              inputMode="decimal"
              value={tarifaTxt}
              placeholder="0"
              onChange={(e) => setTarifaTxt(e.target.value.replace(/[^\d.,]/g, ''))}
              className="min-w-0 flex-1 border-none bg-transparent text-[1.375rem] font-semibold tabular outline-none"
            />
          </div>
          <span className="text-sm font-normal text-ink2">
            {conEstandar
              ? `La usan ${conEstandar} ${conEstandar === 1 ? 'paciente' : 'pacientes'}. Si la cambiás, las ${palGuardado.sesiones} nuevas se cobran con la tarifa nueva; las ya cargadas conservan su precio.`
              : 'Los pacientes con tarifa estándar usan este valor.'}
          </span>
        </label>
        <div className="flex flex-col gap-2 text-[0.9375rem] font-semibold">
          Moneda
          <Segmentado
            opciones={[
              { v: 'ARS' as Moneda, l: 'Pesos · ARS' },
              { v: 'USD' as Moneda, l: 'Dólares · USD' },
            ]}
            valor={moneda}
            onCambio={setMoneda}
            className="max-w-[17.5rem]"
          />
        </div>
        <Campo etiqueta="Tu nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Lic. Ana Martínez" />
        <Campo
          etiqueta="Matrícula"
          opcional
          id="matricula"
          value={matricula}
          maxLength={60}
          onChange={(e) => setMatricula(e.target.value)}
          placeholder="Ej. M.P. 12345 (aparece en el recibo)"
        />
        <Campo
          etiqueta="Datos para el pago"
          opcional
          id="datos-pago"
          value={datosPago}
          maxLength={300}
          onChange={(e) => setDatosPago(e.target.value)}
          placeholder="Alias, CBU o link de Mercado Pago"
        />
        <Campo
          etiqueta="Mail de tu contadora"
          opcional
          id="mail-contadora"
          type="email"
          inputMode="email"
          autoComplete="off"
          value={mailContadora}
          maxLength={200}
          onChange={(e) => setMailContadora(e.target.value)}
          placeholder="Para mandarle el reporte desde la pantalla Contadora"
        />
        <label className="flex flex-col gap-2 text-[0.9375rem] font-semibold">
          Mensaje de recordatorio por WhatsApp
          <textarea
            value={plantilla}
            rows={3}
            maxLength={500}
            onChange={(e) => setPlantilla(e.target.value)}
            className="rounded-[0.875rem] border border-line bg-fondo px-4 py-3 text-base font-normal outline-none focus:border-acc"
          />
          <span className="text-sm font-normal whitespace-pre-line text-ink2">
            Usá {'{nombre}'}, {'{mes}'}, {'{monto}'} y {'{pago}'} (tus datos para el pago; si no lo ponés, van al final). Así queda: “
            {completarPlantilla(plantilla, { nombre: 'Lucía', mes: 'octubre', monto: '$ 50.000,00', pago: datosPago })}”
          </span>
        </label>
        <Boton alto="h-[3.125rem]" className="self-start" cargando={guardar.isPending} onClick={guardarCobros}>
          Guardar cambios
        </Boton>
      </Tarjeta>

      {perfil.data && <MonotributoAjustes perfil={perfil.data} />}

      {perfil.data && <OpcionesAjustes perfil={perfil.data} />}

      {perfil.data && <CalendarioAjustes perfil={perfil.data} />}

      <Tarjeta className="px-[1.375rem] py-2">
        <button type="button" role="switch" aria-checked={tema === 'dark'} onClick={alternarTema} className={fila}>
          <span className="flex items-center gap-3">
            <Moon {...IC} />
            Modo oscuro
          </span>
          <span
            className={`flex h-8 w-[3.25rem] rounded-full p-[0.1875rem] transition-colors ${
              tema === 'dark' ? 'justify-end bg-acc' : 'justify-start bg-line'
            }`}
          >
            <span className="size-[1.625rem] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)]" />
          </span>
        </button>
      </Tarjeta>

      <Tarjeta className="flex flex-col gap-3 p-[1.375rem]">
        <h2 className="m-0 text-lg font-semibold">Tus datos en Excel</h2>
        <p className="m-0 text-[0.9375rem] leading-normal text-ink2">
          Descargá todo (pacientes, sesiones y pagos) como copia de seguridad. El archivo tiene el mismo formato que la plantilla:
          podés completarlo o corregirlo en Excel y volver a subirlo desde Importar, sin que se dupliquen datos.
        </p>
        <div className="flex flex-wrap gap-2">
          <DescargarExcel etiqueta="Descargar Excel" />
          <DescargarExcel vacia etiqueta="Planilla vacía" />
        </div>
      </Tarjeta>

      <Tarjeta className="px-[1.375rem] py-2">
        <button type="button" onClick={iniciarTutorial} className={fila}>
          <span className="flex items-center gap-3">
            <Sparkles {...IC} />
            Ver tutorial
          </span>
          <ChevronRight {...IC} className="text-ink2" />
        </button>
        <button type="button" onClick={() => navegar('/pruebas')} className={`${fila} border-t border-line`}>
          <span className="flex items-center gap-3">
            <ClipboardList {...IC} />
            Probá honorapp y ayudanos a mejorarla
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

      <OtraApp />

      <Tarjeta className="px-[1.375rem] py-2">
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
          <label className="mt-4 flex flex-col gap-2 text-[0.9375rem] font-semibold text-ink">
            Para confirmar, escribí ELIMINAR
            <input
              value={textoBorrar}
              onChange={(e) => setTextoBorrar(e.target.value)}
              autoCapitalize="characters"
              autoComplete="off"
              className="h-[3.375rem] w-full rounded-[0.875rem] border border-line bg-surface px-4 text-[1.0625rem] font-normal outline-none focus:border-acc"
            />
          </label>
        </Confirmar>
      )}
    </section>
  )
}
