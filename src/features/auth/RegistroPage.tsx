import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Boton, Campo } from '../../components/ui'
import { mensajeError, supabase } from '../../lib/supabase'
import { AuthLayout } from './AuthLayout'

export function RegistroPage() {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [cargando, setCargando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function registrar(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      toast.error('La contraseña tiene que tener al menos 8 caracteres.')
      return
    }
    setCargando(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: window.location.origin },
    })
    if (!error && data.session && nombre.trim()) {
      await supabase.from('profiles').update({ nombre: nombre.trim() }).eq('id', data.session.user.id)
    }
    setCargando(false)
    if (error) {
      toast.error(mensajeError(error))
    } else if (!data.session) {
      setEnviado(true) // hace falta confirmar el mail
    } else {
      toast.success('¡Cuenta creada!')
    }
  }

  if (enviado) {
    return (
      <AuthLayout titulo="Revisá tu mail">
        <p className="text-stone-700 dark:text-stone-300">
          Te mandamos un link a <strong>{email}</strong> para confirmar la cuenta. Después podés ingresar.
        </p>
        <Link to="/" className="mt-4 block text-center text-sm text-teal-700 hover:underline dark:text-teal-400">Volver a ingresar</Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout titulo="Crear cuenta">
      <form onSubmit={registrar} className="space-y-4">
        <Campo etiqueta="Tu nombre" autoComplete="name" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <Campo etiqueta="Mail" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Campo etiqueta="Contraseña (mínimo 8 caracteres)" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <Boton type="submit" cargando={cargando} className="w-full">Crear cuenta</Boton>
      </form>
      <Link to="/" className="mt-5 block text-center text-sm text-stone-600 hover:underline dark:text-stone-400">Ya tengo cuenta</Link>
    </AuthLayout>
  )
}
