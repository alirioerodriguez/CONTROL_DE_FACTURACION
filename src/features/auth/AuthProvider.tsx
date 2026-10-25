import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

interface AuthState {
  session: Session | null
  cargando: boolean
  /** true cuando se entró desde el link de "recuperar contraseña". */
  recuperando: boolean
  terminarRecuperacion: () => void
  /** true si la cuenta tiene doble factor y esta sesión todavía no hizo el segundo paso. */
  faltaSegundoPaso: boolean
  /** Volver a mirar el nivel de la sesión (después de verificar el código). */
  revisarSegundoPaso: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [cargando, setCargando] = useState(true)
  const [recuperando, setRecuperando] = useState(false)
  const [faltaSegundoPaso, setFaltaSegundoPaso] = useState(false)

  async function revisarSegundoPaso() {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    setFaltaSegundoPaso(!!data && data.nextLevel === 'aal2' && data.currentLevel !== 'aal2')
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      if (data.session) await revisarSegundoPaso()
      setCargando(false)
    })
    const { data } = supabase.auth.onAuthStateChange((evento, nueva) => {
      setSession(nueva)
      if (evento === 'PASSWORD_RECOVERY') setRecuperando(true)
      // Fuera del callback: dentro de onAuthStateChange no se deben esperar otras llamadas de auth.
      if (nueva) setTimeout(() => { revisarSegundoPaso() }, 0)
      else setFaltaSegundoPaso(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider
      value={{ session, cargando, recuperando, terminarRecuperacion: () => setRecuperando(false), faltaSegundoPaso, revisarSegundoPaso }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fuera de AuthProvider')
  return ctx
}
