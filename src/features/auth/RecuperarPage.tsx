import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Boton, Campo } from '../../components/ui'
import { mensajeError, supabase } from '../../lib/supabase'
import { AuthLayout } from './AuthLayout'

export function RecuperarPage() {
  const [email, setEmail] = useState('')
  const [cargando, setCargando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setCargando(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    })
    setCargando(false)
    if (error) toast.error(mensajeError(error))
    else setEnviado(true)
  }

  return (
    <AuthLayout titulo="Recuperar contraseña">
      {enviado ? (
        <p className="text-stone-700 dark:text-stone-300">
          Si <strong>{email}</strong> tiene una cuenta, te llega un mail con un link para elegir una contraseña nueva.
        </p>
      ) : (
        <form onSubmit={enviar} className="space-y-4">
          <Campo etiqueta="Mail" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Boton type="submit" cargando={cargando} className="w-full">Enviarme el link</Boton>
        </form>
      )}
      <Link to="/" className="mt-5 block text-center text-sm text-stone-600 hover:underline dark:text-stone-400">Volver a ingresar</Link>
    </AuthLayout>
  )
}
