import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Boton, Campo } from '../../components/ui'
import { mensajeError, supabase } from '../../lib/supabase'
import { AuthLayout } from './AuthLayout'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [cargando, setCargando] = useState(false)

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setCargando(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setCargando(false)
    if (error) toast.error(mensajeError(error))
    else toast.success('¡Hola de nuevo!')
  }

  return (
    <AuthLayout titulo="Ingresar">
      <form onSubmit={entrar} className="space-y-4">
        <Campo etiqueta="Mail" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Campo etiqueta="Contraseña" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <Boton type="submit" cargando={cargando} className="w-full">Ingresar</Boton>
      </form>
      <div className="mt-5 flex flex-col items-center gap-2 text-sm">
        <Link to="/recuperar" className="text-teal-700 hover:underline dark:text-teal-400">Olvidé mi contraseña</Link>
        <Link to="/registro" className="text-stone-600 hover:underline dark:text-stone-400">¿No tenés cuenta? Creá una</Link>
      </div>
    </AuthLayout>
  )
}
