import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { Alerta, Boton, IC } from '../../components/ui'
import { mensajeError, supabase } from '../../lib/supabase'
import { AuthLayout, CampoAuth, claseBotonAuth, claseLinkAuth } from './AuthLayout'

export function RecuperarPage() {
  const [email, setEmail] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [enviado, setEnviado] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!/\S+@\S+\.\S+/.test(email)) return setError('Ingresá un mail válido.')
    setCargando(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    })
    setCargando(false)
    if (error) setError(mensajeError(error))
    else setEnviado(true)
  }

  if (enviado) {
    return (
      <AuthLayout titulo="Revisá tu mail">
        <div className="-order-1 grid size-14 place-items-center rounded-[18px] bg-acc-soft text-[26px] text-acc-strong">
          <Check {...IC} />
        </div>
        <div className="text-[17px] leading-normal text-ink2">
          Si <strong className="text-ink">{email}</strong> tiene una cuenta, te llega un link para crear una contraseña
          nueva.
        </div>
        <Link to="/" className="flex h-14 items-center justify-center rounded-full bg-surface2 text-[17px] font-semibold hover:bg-line">
          Volver a ingresar
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout titulo="Recuperar clave" sub="Te mandamos un link para crear una contraseña nueva.">
      <form onSubmit={enviar} noValidate className="flex flex-col gap-5">
        <CampoAuth etiqueta="Mail" type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setError('') }} />
        {error && <Alerta>{error}</Alerta>}
        <Boton type="submit" cargando={cargando} className={claseBotonAuth}>
          {cargando ? 'Enviando…' : 'Enviar link'}
        </Boton>
      </form>
      <Link to="/" className={`${claseLinkAuth} text-ink2`}>
        Volver a ingresar
      </Link>
    </AuthLayout>
  )
}
