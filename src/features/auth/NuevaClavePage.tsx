import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Alerta, Boton } from '../../components/ui'
import { mensajeError, supabase } from '../../lib/supabase'
import { AuthLayout, CampoAuth, claseBotonAuth } from './AuthLayout'
import { useAuth } from './AuthProvider'

export function NuevaClavePage() {
  const { terminarRecuperacion } = useAuth()
  const [password, setPassword] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) return setError('La contraseña tiene que tener al menos 8 caracteres.')
    setCargando(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    setCargando(false)
    if (error) {
      setError(mensajeError(error))
    } else {
      toast.success('Contraseña actualizada')
      terminarRecuperacion()
    }
  }

  return (
    <AuthLayout titulo="Contraseña nueva" sub="Elegí una de al menos 8 caracteres.">
      <form onSubmit={guardar} noValidate className="flex flex-col gap-5">
        <CampoAuth etiqueta="Contraseña nueva" type="password" autoComplete="new-password" value={password} onChange={(e) => { setPassword(e.target.value); setError('') }} />
        {error && <Alerta>{error}</Alerta>}
        <Boton type="submit" cargando={cargando} className={claseBotonAuth}>
          {cargando ? 'Guardando…' : 'Guardar'}
        </Boton>
      </form>
    </AuthLayout>
  )
}
