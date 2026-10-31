import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, FileText, LogOut, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Logo } from '../../components/Layout'
import { Boton, Confirmar, EstadoError, EstadoVacio, Esqueleto, Tarjeta, Titulo } from '../../components/ui'
import { aceptarInvitacion, datosClienta, invitacionPendiente, olvidarInvitacion, useClientas, useDejarClienta, type Clienta } from '../../lib/estudio'
import { capitalizar, formatPeriodo, hoyAR, periodoDe, sumarMeses } from '../../lib/formato'
import { mesesEntre } from '../../lib/reportes'
import { mensajeError, supabase } from '../../lib/supabase'

/** Panel de la contadora (Modo Estudio Contable): sus clientas en honorapp y el reporte de cada una. */
export function EstudioPage() {
  const navegar = useNavigate()
  const clientas = useClientas()
  const actual = periodoDe(hoyAR())
  const [desde, setDesde] = useState(sumarMeses(actual, -1))
  const [hasta, setHasta] = useState(sumarMeses(actual, -1))
  const [bajando, setBajando] = useState<string | null>(null)
  const aceptando = useRef(false)

  // Si llegó con un link de invitación (o lo abrió antes de ingresar), se acepta.
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('invitacion') ?? invitacionPendiente()
    if (!token || aceptando.current) return
    aceptando.current = true
    aceptarInvitacion(token)
      .then((nombre) => {
        toast.success(`Listo: ya podés ver los cobros de ${nombre}`)
        clientas.refetch()
      })
      .catch((e) => toast.error(mensajeError(e)))
      .finally(() => {
        olvidarInvitacion()
        navegar('/estudio', { replace: true })
      })
  }, [clientas, navegar])

  const opcionesMes = useMemo(() => mesesEntre(sumarMeses(actual, -35), actual).reverse(), [actual])
  const etiquetaMes = (p: string) => capitalizar(formatPeriodo(p))

  async function bajar(c: Clienta, tipo: 'xlsx' | 'pdf') {
    setBajando(`${c.profesional_id}-${tipo}`)
    try {
      const d = await datosClienta(c.profesional_id)
      const m = await import('../../lib/exportar')
      const op = { iniciales: d.solo_iniciales }
      if (tipo === 'xlsx') await m.exportarContadoraXlsx(desde, hasta, d.perfil, d.pacientes, d.pagos, op)
      else await m.exportarContadoraPdf(desde, hasta, d.perfil, d.pacientes, d.pagos, op)
      toast.success(`Reporte de ${c.nombre ?? c.email} descargado`)
    } catch (e) {
      toast.error(`No se pudo descargar: ${mensajeError(e)}`)
    } finally {
      setBajando(null)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[56rem] flex-col gap-6 bg-fondo px-5 py-6 text-ink md:px-8">
      <header className="flex items-center justify-between gap-3">
        <Logo />
        <div className="flex gap-2">
          <Boton variante="borde" alto="h-11" onClick={() => navegar('/')}>
            Mi honorapp
          </Boton>
          <Boton variante="borde" alto="h-11" icono={LogOut} onClick={() => supabase.auth.signOut()}>
            Salir
          </Boton>
        </div>
      </header>

      <Titulo sub="Las profesionales que te dieron acceso. Solo podés ver y descargar: no podés cambiar nada.">Estudio contable</Titulo>

      <Tarjeta className="flex flex-wrap items-end gap-3 p-4">
        <label className="flex flex-col gap-1 text-sm text-ink2">
          Desde
          <select className="h-11 rounded-[0.75rem] border border-line bg-fondo px-3 text-base text-ink" value={desde} onChange={(e) => setDesde(e.target.value)}>
            {opcionesMes.map((p) => <option key={p} value={p}>{etiquetaMes(p)}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink2">
          Hasta
          <select className="h-11 rounded-[0.75rem] border border-line bg-fondo px-3 text-base text-ink" value={hasta} onChange={(e) => setHasta(e.target.value)}>
            {opcionesMes.map((p) => <option key={p} value={p}>{etiquetaMes(p)}</option>)}
          </select>
        </label>
        {desde > hasta && <span className="pb-2.5 text-sm text-bad">«Desde» tiene que ser antes que «Hasta».</span>}
      </Tarjeta>

      {clientas.isLoading ? (
        <Esqueleto que="tus clientas" tarjetas />
      ) : clientas.isError ? (
        <EstadoError que="tus clientas" reintentar={() => clientas.refetch()} />
      ) : !clientas.data?.length ? (
        <EstadoVacio icono={Users} titulo="Todavía no tenés clientas">
          Cuando una profesional te mande su link de honorapp, abrilo con esta cuenta y aparece acá.
        </EstadoVacio>
      ) : (
        <div className="flex flex-col gap-3">
          {clientas.data.map((c) => (
            <FilaClienta key={c.profesional_id} c={c} bajando={bajando} deshabilitado={desde > hasta} bajar={bajar} />
          ))}
        </div>
      )}
    </main>
  )
}

function FilaClienta({
  c,
  bajando,
  deshabilitado,
  bajar,
}: {
  c: Clienta
  bajando: string | null
  deshabilitado: boolean
  bajar: (c: Clienta, tipo: 'xlsx' | 'pdf') => void
}) {
  const dejar = useDejarClienta()
  const [confirmando, setConfirmando] = useState(false)
  return (
    <Tarjeta className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <div className="truncate text-[1.0625rem] font-semibold">{c.nombre || c.email}</div>
        <div className="text-sm text-ink2">
          {[c.cuit && `CUIT ${c.cuit}`, c.monotributo_categoria && c.monotributo_categoria !== 'no' && `Monotributo ${c.monotributo_categoria}`, c.solo_iniciales && 'Pacientes con iniciales']
            .filter(Boolean)
            .join(' · ') || c.email}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Boton alto="h-11" variante="borde" icono={Download} disabled={deshabilitado} cargando={bajando === `${c.profesional_id}-xlsx`} onClick={() => bajar(c, 'xlsx')}>
          Excel
        </Boton>
        <Boton alto="h-11" icono={FileText} disabled={deshabilitado} cargando={bajando === `${c.profesional_id}-pdf`} onClick={() => bajar(c, 'pdf')}>
          PDF
        </Boton>
        <Boton
          alto="h-11"
          variante="borde"
          cargando={dejar.isPending}
          onClick={() => setConfirmando(true)}
        >
          Dejar
        </Boton>
      </div>
      {confirmando && (
        <Confirmar
          titulo="Dejar de ver sus cobros"
          textoConfirmar="Dejar"
          cargando={dejar.isPending}
          onCancelar={() => setConfirmando(false)}
          onConfirmar={() =>
            dejar.mutate(c.profesional_id, {
              onSuccess: () => toast.success('Listo, ya no la ves'),
              onError: (e) => toast.error(`No se pudo: ${mensajeError(e)}`),
            })
          }
        >
          Dejás de ver los cobros de {c.nombre || c.email}. Para volver, te tiene que mandar un link nuevo.
        </Confirmar>
      )}
    </Tarjeta>
  )
}
