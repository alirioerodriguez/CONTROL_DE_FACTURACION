import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check, Eye, EyeOff } from 'lucide-react'
import { Logo } from '../../components/Layout'
import { IC, Spinner } from '../../components/ui'
import { mensajeError, supabase } from '../../lib/supabase'

const QUE_HACE = [
  'Anotás sesiones y pagos, en pesos y en dólares.',
  'Ves de un vistazo quién te debe.',
  'Mandás el recordatorio por WhatsApp.',
  'Descargás el reporte del mes para tu contadora.',
]

export function AuthLayout({
  titulo,
  sub,
  presentacion = false,
  children,
}: {
  titulo: string
  sub?: ReactNode
  /** En el celular, muestra arriba qué es honorapp (en la compu ya lo dice el panel verde). */
  presentacion?: boolean
  children: ReactNode
}) {
  return (
    <main className="flex min-h-dvh bg-fondo text-ink">
      <div className="hidden flex-1 flex-col justify-between gap-10 bg-acc-soft p-14 md:flex">
        <Logo />
        <div>
          <div className="max-w-[33.75rem] font-serif text-[4.75rem] leading-none text-balance">Tus cobros, en orden.</div>
          <ul className="mt-[1.375rem] flex max-w-[27.5rem] flex-col gap-2.5 text-[1.1875rem] leading-snug text-ink2">
            {QUE_HACE.map((t) => (
              <li key={t} className="flex items-start gap-2.5">
                <Check {...IC} className="mt-1 shrink-0 text-acc-strong" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="text-sm text-ink2">Gratis · No es historia clínica: solo datos de cobro</div>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-auto px-6 py-8">
        <div className="flex w-full max-w-[23.75rem] flex-col gap-6">
          <div className="md:hidden">
            <Logo />
          </div>
          {presentacion && (
            <div className="rounded-[1.375rem] bg-acc-soft px-5 py-4 md:hidden">
              <div className="font-serif text-[1.75rem] leading-tight">Tus cobros, en orden.</div>
              <ul className="mt-2.5 flex flex-col gap-1.5 text-[0.9375rem] leading-snug text-ink2">
                {QUE_HACE.map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <Check {...IC} className="mt-0.5 shrink-0 text-acc-strong" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="m-0 font-serif text-[2.75rem] leading-none font-normal">{titulo}</h1>
              {sub && <div className="mt-2 text-[1.0625rem] leading-snug text-ink2">{sub}</div>}
            </div>
            {children}
          </div>
          <div className="text-center text-sm text-ink2">
            <Link to="/privacidad" className="text-ink2">Privacidad</Link> · <Link to="/terminos" className="text-ink2">Términos y condiciones</Link>
          </div>
        </div>
      </div>
    </main>
  )
}

export function CampoAuth({
  etiqueta,
  ayuda,
  type,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; ayuda?: string }) {
  const esClave = type === 'password'
  const [visible, setVisible] = useState(false)
  const input = (
    <input
      {...props}
      type={esClave && visible ? 'text' : type}
      className={`h-[3.375rem] w-full rounded-[0.875rem] border border-line bg-surface px-4 text-[1.0625rem] font-normal outline-none focus:border-acc focus:shadow-[0_0_0_3px_var(--acc-soft)] ${esClave ? 'pr-14' : ''}`}
    />
  )
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-2 text-[0.9375rem] font-semibold">
        {etiqueta}
        {esClave ? (
          <span className="relative">
            {input}
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute inset-y-0 right-1 grid w-12 place-items-center text-ink2 hover:text-ink"
            >
              {visible ? <EyeOff {...IC} /> : <Eye {...IC} />}
            </button>
          </span>
        ) : (
          input
        )}
      </label>
      {ayuda && <span className="text-sm leading-snug text-ink2">{ayuda}</span>}
    </div>
  )
}

/** "Continuar con Google" + separador "o". Devuelve el error si no pudo arrancar. */
export function IngresoGoogle({ onError }: { onError: (mensaje: string) => void }) {
  const [cargando, setCargando] = useState(false)

  async function entrar() {
    setCargando(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      // select_account: Google siempre muestra el selector, para elegir qué cuenta usar o entrar con otra.
      options: { redirectTo: window.location.origin, queryParams: { prompt: 'select_account' } },
    })
    // Si salió bien, el navegador ya se está yendo a Google.
    if (error) {
      setCargando(false)
      onError(mensajeError(error))
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={entrar}
        disabled={cargando}
        className="flex h-14 w-full items-center justify-center gap-3 rounded-full border border-line bg-surface text-[1.0625rem] font-semibold hover:bg-surface2 disabled:opacity-60"
      >
        {cargando ? <Spinner /> : <LogoGoogle />}
        Continuar con Google
      </button>
      <div className="-mt-2 text-center text-sm text-ink2">De Google solo usamos tu nombre y tu mail.</div>
      <div className="flex items-center gap-3 text-sm text-ink2">
        <span className="h-px flex-1 bg-line" />o con tu mail<span className="h-px flex-1 bg-line" />
      </div>
    </>
  )
}

function LogoGoogle() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

/** Error que Supabase deja en la URL cuando falla el ingreso con Google. */
// eslint-disable-next-line react-refresh/only-export-components
export function errorDeRedireccion(): string {
  const params = new URLSearchParams(window.location.search + '&' + window.location.hash.replace(/^#/, ''))
  const desc = params.get('error_description')
  return desc ? `No se pudo ingresar con Google: ${desc.replace(/\+/g, ' ')}` : ''
}

export const claseBotonAuth = 'h-14 w-full text-[1.0625rem]'
export const claseLinkAuth = 'self-center p-2 text-base font-semibold'
