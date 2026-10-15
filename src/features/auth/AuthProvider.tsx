import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

interface AuthState {
  session: Session | null
  cargando: boolean
  /** true cuando se entró desde el link de "recuperar contraseña". */
  recuperando: boolean
  terminarRecuperacion: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [cargando, setCargando] = useState(true)
  const [recuperando, setRecuperando] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCargando(false)
    })
    const { data } = supabase.auth.onAuthStateChange((evento, nueva) => {
      setSession(nueva)
      if (evento === 'PASSWORD_RECOVERY') setRecuperando(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider
      value={{ session, cargando, recuperando, terminarRecuperacion: () => setRecuperando(false) }}
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
