import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { toast } from 'sonner'
import { Alerta, Boton, IC } from '../../components/ui'
import { mensajeError, supabase } from '../../lib/supabase'
import { AuthLayout, CampoAuth, claseBotonAuth, claseLinkAuth } from './AuthLayout'

export function RegistroPage() {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [enviado, setEnviado] = useState(false)

  async function registrar(e: FormEvent) {
    e.preventDefault()
    if (!/\S+@\S+\.\S+/.test(email)) return setError('Ingresá un mail válido.')
    if (password.length < 8) return setError('La contraseña tiene que tener al menos 8 caracteres.')
    setCargando(true)
    setError('')
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: window.location.origin },
    })
    if (!error && data.session && nombre.trim()) {
      await supabase.from('profiles').update({ nombre: nombre.trim() }).eq('id', data.session.user.id)
    }
    setCargando(false)
    if (error) setError(mensajeError(error))
    else if (!data.session) setEnviado(true) // hace falta confirmar el mail
    else toast.success('¡Cuenta creada!')
  }

  if (enviado) {
    return (
      <AuthLayout titulo="Revisá tu mail">
        <div className="-order-1 grid size-14 place-items-center rounded-[18px] bg-acc-soft text-[26px] text-acc-strong">
          <Check {...IC} />
        </div>
        <div className="text-[17px] leading-normal text-ink2">
          Te mandamos un link a <strong className="text-ink">{email}</strong> para confirmar la cuenta. Después podés
          ingresar. Tu nombre lo cargás en Ajustes.
        </div>
        <Link to="/" className="flex h-14 items-center justify-center rounded-full bg-surface2 text-[17px] font-semibold hover:bg-line">
          Volver a ingresar
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout titulo="Creá tu cuenta" sub="Gratis. Solo vos ves tus datos.">
      <form onSubmit={registrar} noValidate className="flex flex-col gap-5">
        <CampoAuth etiqueta="Tu nombre" autoComplete="name" placeholder="Ej. Lic. Ana Martínez" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <CampoAuth etiqueta="Mail" type="email" autoComplete="email" placeholder="vos@mail.com" value={email} onChange={(e) => { setEmail(e.target.value); setError('') }} />
        <CampoAuth etiqueta="Contraseña" type="password" autoComplete="new-password" placeholder="Mínimo 8 caracteres" value={password} onChange={(e) => { setPassword(e.target.value); setError('') }} />
        {error && <Alerta>{error}</Alerta>}
        <Boton type="submit" cargando={cargando} className={claseBotonAuth}>
          {cargando ? 'Creando…' : 'Crear cuenta'}
        </Boton>
      </form>
      <Link to="/" className={`${claseLinkAuth} text-ink2`}>
        Ya tengo cuenta
      </Link>
    </AuthLayout>
  )
}
