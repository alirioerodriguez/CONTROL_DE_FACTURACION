import { ExternalLink, Wallet } from 'lucide-react'
import { IC } from '../../components/ui'

const MIS_CUENTAS = 'https://control-de-gastos-lyart-theta.vercel.app/'

/** Tarjeta de Ajustes que recomienda Mis Cuentas, la app de gastos personales del mismo autor. */
export function OtraApp() {
  return (
    <div className="flex flex-col gap-3 rounded-[1.375rem] bg-acc-soft p-[1.375rem] text-acc-strong">
      <h2 className="m-0 flex items-center gap-2.5 text-lg font-semibold">
        <Wallet {...IC} />
        ¿Te gustó honorapp?
      </h2>
      <p className="m-0 text-[0.9375rem] leading-normal">
        Para tus gastos personales tengo <strong>Mis Cuentas</strong>, una app de control de gastos. Así tenés los cobros del
        consultorio por un lado y tu plata personal por otro.
      </p>
      <a
        href={MIS_CUENTAS}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-12 items-center gap-2 self-start rounded-full bg-acc px-5 text-base font-semibold text-on-acc hover:bg-acc-strong"
      >
        <ExternalLink {...IC} />
        Conocer Mis Cuentas
      </a>
    </div>
  )
}
