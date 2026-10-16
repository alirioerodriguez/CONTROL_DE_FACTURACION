import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Alerta, Boton } from '../../components/ui'
import { mensajeError, supabase } from '../../lib/supabase'
import { AuthLayout, CampoAuth, claseBotonAuth, claseLinkAuth, errorDeRedireccion, IngresoGoogle } from './AuthLayout'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(errorDeRedireccion)

  async function entrar(e: FormEvent) {
    e.preventDefault()
    if (!/\S+@\S+\.\S+/.test(email)) return setError('Ingresá un mail válido.')
    if (!password) return setError('Ingresá tu contraseña.')
    setCargando(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setCargando(false)
    if (error) setError(mensajeError(error))
    else toast.success('¡Hola de nuevo!')
  }

  return (
    <AuthLayout titulo="Ingresá" sub="Con Google o con tu mail." presentacion>
      <IngresoGoogle onError={setError} />
      <form onSubmit={entrar} noValidate className="flex flex-col gap-5">
        <CampoAuth etiqueta="Mail" type="email" autoComplete="email" placeholder="vos@mail.com" value={email} onChange={(e) => { setEmail(e.target.value); setError('') }} />
        <CampoAuth etiqueta="Contraseña" type="password" autoComplete="current-password" placeholder="Tu contraseña" value={password} onChange={(e) => { setPassword(e.target.value); setError('') }} />
        {error && <Alerta>{error}</Alerta>}
        <Boton type="submit" cargando={cargando} className={claseBotonAuth}>
          {cargando ? 'Ingresando…' : 'Ingresar'}
        </Boton>
      </form>
      <Link to="/recuperar" className={`${claseLinkAuth} text-acc-strong`}>
        ¿Olvidaste tu contraseña?
      </Link>
      <Link to="/registro" className={`${claseLinkAuth} -mt-4 text-ink2`}>
        ¿No tenés cuenta? Creá una
      </Link>
    </AuthLayout>
  )
}
