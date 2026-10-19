import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Link2, Send, Unlink, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Boton, IC, Spinner } from '../../components/ui'
import { formatFecha } from '../../lib/formato'
import { supabase } from '../../lib/supabase'

const MIS_CUENTAS = 'https://control-de-gastos-lyart-theta.vercel.app/'

interface CuentaMC {
  key: string
  nombre: string
  moneda: string | null
}
interface Estado {
  ok: boolean
  existe?: boolean
  enlazado?: boolean
  cuenta_ars?: string | null
  cuenta_usd?: string | null
  ultimo_envio?: string | null
  cuentas?: CuentaMC[]
  guardados?: number
  mensaje?: string
}

/** Llama a la función mis-cuentas (supabase/functions/mis-cuentas) y devuelve su respuesta, o tira el error con su mensaje. */
async function misCuentas(accion: string, extra: Record<string, unknown> = {}): Promise<Estado> {
  const { data, error } = await supabase.functions.invoke<Estado>('mis-cuentas', { body: { accion, ...extra } })
  if (error) {
    const cuerpo = await (error as { context?: Response }).context?.json?.().catch(() => null)
    throw new Error(cuerpo?.mensaje ?? 'No se pudo conectar con Mis Cuentas.')
  }
  if (!data?.ok) throw new Error(data?.mensaje ?? 'No se pudo conectar con Mis Cuentas.')
  return data
}

const diaAR = (ts: string) => new Date(ts).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })

/**
 * Tarjeta de Ajustes: Mis Cuentas, la app de gastos personales del mismo autor. Si hay una cuenta con el mismo mail,
 * se enlaza y los cobros de cada mes llegan allá como ingresos (solo totales, nada de pacientes).
 */
export function OtraApp() {
  const qc = useQueryClient()
  const estado = useQuery({ queryKey: ['mis-cuentas'], queryFn: () => misCuentas('estado'), retry: false, staleTime: 60_000 })
  const [eligiendo, setEligiendo] = useState(false)
  const [ars, setArs] = useState('')
  const [usd, setUsd] = useState('')

  const accion = useMutation({
    mutationFn: ({ nombre, extra }: { nombre: string; extra?: Record<string, unknown> }) => misCuentas(nombre, extra),
    onSettled: () => qc.invalidateQueries({ queryKey: ['mis-cuentas'] }),
  })

  async function hacer(nombre: string, ok: (r: Estado) => string, extra?: Record<string, unknown>) {
    try {
      const r = await accion.mutateAsync({ nombre, extra })
      toast.success(ok(r))
      setEligiendo(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  const e = estado.data
  const cuentas = e?.cuentas ?? []

  // Sin enlazar todavía: sugiere la primera cuenta en pesos (y una en dólares si hay).
  useEffect(() => {
    if (!e?.existe || e.enlazado) return
    const lista = e.cuentas ?? []
    setArs(lista.find((c) => (c.moneda ?? 'ARS') === 'ARS')?.key ?? '')
    setUsd(lista.find((c) => c.moneda === 'USD' || c.moneda === 'USDT')?.key ?? '')
  }, [e])

  const nombreCuenta = (k?: string | null) => cuentas.find((c) => c.key === k)?.nombre ?? k
  const abrirEleccion = () => {
    setArs(e?.cuenta_ars ?? cuentas.find((c) => (c.moneda ?? 'ARS') === 'ARS')?.key ?? '')
    setUsd(e?.cuenta_usd ?? '')
    setEligiendo(true)
  }
  const selector = (etiqueta: string, valor: string, set: (v: string) => void, opcional: boolean) => (
    <label className="flex flex-1 basis-56 flex-col gap-1.5 text-sm font-semibold">
      {etiqueta}
      <select
        value={valor}
        onChange={(ev) => set(ev.target.value)}
        className="h-12 cursor-pointer rounded-xl border border-acc/30 bg-surface px-3 text-base font-normal text-ink"
      >
        {opcional && <option value="">No mandar</option>}
        {cuentas.map((c) => (
          <option key={c.key} value={c.key}>
            {c.nombre}
            {c.moneda ? ` (${c.moneda})` : ''}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <div data-tour="mis-cuentas" className="flex flex-col gap-3 rounded-[1.375rem] bg-acc-soft p-[1.375rem] text-acc-strong">
      <h2 className="m-0 flex items-center gap-2.5 text-lg font-semibold">
        <Wallet {...IC} />
        Mis Cuentas
      </h2>

      {estado.isLoading ? (
        <div className="flex items-center gap-2 text-[0.9375rem]">
          <Spinner /> Buscando tu cuenta de Mis Cuentas…
        </div>
      ) : estado.error || !e?.existe ? (
        <>
          <p className="m-0 text-[0.9375rem] leading-normal">
            Para tus gastos personales tengo <strong>Mis Cuentas</strong>, una app de control de gastos. Si te creás una cuenta con el
            mismo mail que usás acá, se enlazan y lo que cobrás en honorapp llega allá como ingreso. Así tenés los cobros del
            consultorio por un lado y tu plata personal por otro.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={MIS_CUENTAS}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full min-h-12 items-center justify-center gap-2 py-1.5 text-center leading-tight rounded-full bg-acc px-5 text-base font-semibold text-on-acc hover:bg-acc-strong"
            >
              <ExternalLink {...IC} className="shrink-0" />
              Conocer Mis Cuentas
            </a>
            {!estado.isLoading && (
              <Boton variante="texto" alto="h-12" className="text-acc-strong" onClick={() => void estado.refetch()}>
                Ya me creé la cuenta
              </Boton>
            )}
          </div>
          {estado.error && <p className="m-0 text-sm opacity-80">{(estado.error as Error).message}</p>}
        </>
      ) : !e.enlazado || eligiendo ? (
        <>
          <p className="m-0 text-[0.9375rem] leading-normal">
            {e.enlazado
              ? 'Elegí en qué cuentas de Mis Cuentas caen tus cobros.'
              : 'Encontramos tu cuenta de Mis Cuentas con el mismo mail. Elegí en qué cuentas caen tus cobros: llega un ingreso por mes y por moneda, sin datos de pacientes.'}
          </p>
          <div className="flex flex-wrap gap-3">
            {selector('Pesos', ars, setArs, true)}
            {selector('Dólares', usd, setUsd, true)}
          </div>
          <div className="flex flex-wrap gap-2">
            <Boton
              icono={Link2}
              cargando={accion.isPending}
              disabled={!ars && !usd}
              onClick={() => hacer('enlazar', () => 'Listo: honorapp y Mis Cuentas quedaron enlazadas', { cuenta_ars: ars || null, cuenta_usd: usd || null })}
            >
              {e.enlazado ? 'Guardar' : 'Enlazar'}
            </Boton>
            {eligiendo && (
              <Boton variante="texto" alto="h-[3.25rem]" className="text-acc-strong" onClick={() => setEligiendo(false)}>
                Cancelar
              </Boton>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="m-0 text-[0.9375rem] leading-normal">
            <strong>Enlazada.</strong> Tus cobros llegan como ingresos
            {e.cuenta_ars ? ` a ${nombreCuenta(e.cuenta_ars)} (pesos)` : ''}
            {e.cuenta_ars && e.cuenta_usd ? ' y' : ''}
            {e.cuenta_usd ? ` a ${nombreCuenta(e.cuenta_usd)} (dólares)` : ''}, uno por mes. Solo viajan los totales, nunca los
            pacientes.
            {e.ultimo_envio ? ` Último envío: ${formatFecha(diaAR(e.ultimo_envio))}.` : ' Todavía no mandaste nada.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Boton
              icono={Send}
              cargando={accion.isPending && accion.variables?.nombre === 'enviar'}
              onClick={() => hacer('enviar', (r) => `Enviado a Mis Cuentas: ${r.guardados ?? 0} ${r.guardados === 1 ? 'mes' : 'meses'} con cobros`)}
            >
              Enviar a Mis Cuentas
            </Boton>
            <Boton variante="texto" alto="h-[3.25rem]" className="text-acc-strong" onClick={abrirEleccion}>
              Cambiar cuentas
            </Boton>
            <Boton
              variante="texto"
              alto="h-[3.25rem]"
              icono={Unlink}
              className="text-acc-strong"
              cargando={accion.isPending && accion.variables?.nombre === 'desenlazar'}
              onClick={() => hacer('desenlazar', () => 'Listo: se desenlazó. Lo ya enviado queda en Mis Cuentas.')}
            >
              Desenlazar
            </Boton>
          </div>
          <p className="m-0 text-sm leading-snug opacity-80">Manda los últimos 12 meses. Si corregiste un pago, volvé a enviar y se actualiza.</p>
        </>
      )}
    </div>
  )
}

