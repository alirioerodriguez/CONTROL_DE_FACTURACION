import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { toast } from 'sonner'
import { Alerta, Boton, IC } from '../../components/ui'
import { mensajeError, supabase } from '../../lib/supabase'
import { AuthLayout, CampoAuth, claseBotonAuth, claseLinkAuth, IngresoGoogle } from './AuthLayout'

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
      // El nombre viaja en los metadatos y el trigger lo guarda en el perfil.
      options: { emailRedirectTo: window.location.origin, data: { full_name: nombre.trim() } },
    })
    setCargando(false)
    if (error) setError(mensajeError(error))
    else if (!data.session) setEnviado(true) // hace falta confirmar el mail
    else toast.success('¡Cuenta creada!')
  }

  if (enviado) {
    return (
      <AuthLayout titulo="Revisá tu mail">
        <div className="-order-1 grid size-14 place-items-center rounded-[1.125rem] bg-acc-soft text-[1.625rem] text-acc-strong">
          <Check {...IC} />
        </div>
        <div className="text-[1.0625rem] leading-normal text-ink2">
          Te mandamos un mail a <strong className="text-ink">{email}</strong>. Abrilo y tocá «Confirmar mi cuenta» para
          activarla. Si no lo ves en unos minutos, fijate en Spam o Correo no deseado y marcalo como «No es spam».
        </div>
        <Link to="/ingresar" className="flex h-14 items-center justify-center rounded-full bg-surface2 text-[1.0625rem] font-semibold hover:bg-line">
          Volver a ingresar
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout titulo="Creá tu cuenta" sub="Gratis. Tus datos son privados: ninguna otra cuenta puede verlos." presentacion>
      <IngresoGoogle onError={setError} />
      <form onSubmit={registrar} noValidate className="flex flex-col gap-5">
        <CampoAuth etiqueta="Tu nombre" autoComplete="name" placeholder="Ej. Lic. Ana Martínez" ayuda="Aparece en el saludo y en el reporte para tu contadora." value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <CampoAuth etiqueta="Mail" type="email" autoComplete="email" placeholder="vos@mail.com" value={email} onChange={(e) => { setEmail(e.target.value); setError('') }} />
        <CampoAuth etiqueta="Contraseña" type="password" autoComplete="new-password" ayuda="Mínimo 8 caracteres." value={password} onChange={(e) => { setPassword(e.target.value); setError('') }} />
        {error && <Alerta>{error}</Alerta>}
        <ul className="flex flex-col gap-1.5 text-[0.9375rem] text-ink2">
          {['Gratis, sin tarjeta.', 'No es historia clínica: solo datos de cobro.', 'Descargás o borrás tus datos cuando quieras.'].map((t) => (
            <li key={t} className="flex items-start gap-2">
              <Check {...IC} className="mt-0.5 shrink-0 text-acc-strong" />
              {t}
            </li>
          ))}
        </ul>
        <Boton type="submit" cargando={cargando} className={claseBotonAuth}>
          {cargando ? 'Creando…' : 'Crear cuenta'}
        </Boton>
        <p className="-mt-1 text-center text-sm leading-snug text-ink2">
          Al crear tu cuenta, con tu mail o con Google, aceptás los <Link to="/terminos" className="underline">Términos y condiciones</Link> y
          la <Link to="/privacidad" className="underline">Política de privacidad</Link>.
        </p>
      </form>
      <Link to="/ingresar" className={`${claseLinkAuth} text-ink2`}>
        Ya tengo cuenta
      </Link>
    </AuthLayout>
  )
}
