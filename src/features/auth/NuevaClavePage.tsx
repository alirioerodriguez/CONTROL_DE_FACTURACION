import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Boton, Campo } from '../../components/ui'
import { mensajeError, supabase } from '../../lib/supabase'
import { AuthLayout } from './AuthLayout'
import { useAuth } from './AuthProvider'

export function NuevaClavePage() {
  const { terminarRecuperacion } = useAuth()
  const [password, setPassword] = useState('')
  const [cargando, setCargando] = useState(false)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      toast.error('La contraseña tiene que tener al menos 8 caracteres.')
      return
    }
    setCargando(true)
    const { error } = await supabase.auth.updateUser({ password })
    setCargando(false)
    if (error) {
      toast.error(mensajeError(error))
    } else {
      toast.success('Contraseña actualizada.')
      terminarRecuperacion()
    }
  }

  return (
    <AuthLayout titulo="Elegí una contraseña nueva">
      <form onSubmit={guardar} className="space-y-4">
        <Campo etiqueta="Contraseña nueva" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <Boton type="submit" cargando={cargando} className="w-full">Guardar</Boton>
      </form>
    </AuthLayout>
  )
}
