import type { InputHTMLAttributes, ReactNode } from 'react'
import { Logo } from '../../components/Layout'

export function AuthLayout({ titulo, sub, children }: { titulo: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh bg-bg text-ink">
      <div className="hidden flex-1 flex-col justify-between gap-10 bg-acc-soft p-14 md:flex">
        <Logo />
        <div>
          <div className="max-w-[540px] font-serif text-[76px] leading-none text-balance">Tus cobros, en orden.</div>
          <p className="mt-[22px] max-w-[420px] text-[19px] leading-normal text-pretty text-ink2">
            Sesiones, pagos y saldos de tus pacientes en un solo lugar. Sin planillas.
          </p>
        </div>
        <div className="text-sm text-ink2">Pesos y dólares · Efectivo, transferencia y MercadoPago</div>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-auto px-6 py-8">
        <div className="flex w-full max-w-[380px] flex-col gap-6">
          <div className="md:hidden">
            <Logo />
          </div>
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="m-0 font-serif text-[44px] leading-none font-normal">{titulo}</h1>
              {sub && <div className="mt-2 text-[17px] leading-snug text-ink2">{sub}</div>}
            </div>
            {children}
          </div>
        </div>
      </div>
    </main>
  )
}

export function CampoAuth({ etiqueta, ...props }: InputHTMLAttributes<HTMLInputElement> & { etiqueta: string }) {
  return (
    <label className="flex flex-col gap-2 text-[15px] font-semibold">
      {etiqueta}
      <input
        {...props}
        className="h-[54px] w-full rounded-[14px] border border-line bg-surface px-4 text-[17px] font-normal outline-none focus:border-acc focus:shadow-[0_0_0_3px_var(--acc-soft)]"
      />
    </label>
  )
}

export const claseBotonAuth = 'h-14 w-full text-[17px]'
export const claseLinkAuth = 'self-center p-2 text-base font-semibold'
