import { toast } from 'sonner'
import { Boton } from '../../components/ui'
import { mensajeError, supabase } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'

// Fase 1: solo cerrar sesión. Tarifa, datos fiscales, backup y modo oscuro llegan en la fase 5.
export function AjustesPage() {
  const { session } = useAuth()

  async function salir() {
    const { error } = await supabase.auth.signOut()
    if (error) toast.error(mensajeError(error))
    else toast.success('Sesión cerrada.')
  }

  return (
    <section>
      <h1 className="mb-6 text-2xl font-semibold">Ajustes</h1>
      <div className="rounded-2xl bg-white p-5 ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
        <p className="text-sm text-stone-500">Ingresaste como</p>
        <p className="mb-4 font-medium">{session?.user.email}</p>
        <Boton variante="secundario" onClick={salir}>Cerrar sesión</Boton>
      </div>
    </section>
  )
}
