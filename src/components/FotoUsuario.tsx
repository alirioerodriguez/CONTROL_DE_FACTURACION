import { useState } from 'react'
import { useAuth } from '../features/auth/AuthProvider'
import { usePerfil } from '../lib/datos'
import { iniciales } from '../lib/formato'

/** Datos de la cuenta: nombre de Ajustes o, si no hay, el de Google; y la foto de Google si existe. */
// eslint-disable-next-line react-refresh/only-export-components
export function useUsuario() {
  const { session } = useAuth()
  const { data: perfil } = usePerfil()
  const meta = (session?.user.user_metadata ?? {}) as Record<string, unknown>
  const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const email = session?.user.email ?? ''
  return {
    email,
    nombre: texto(perfil?.nombre) ?? texto(meta.full_name) ?? texto(meta.name),
    foto: texto(meta.avatar_url) ?? texto(meta.picture),
  }
}

/** Foto de perfil (la de Google) o, si no hay, las iniciales. */
export function FotoUsuario({ className = 'size-10 text-[15px]' }: { className?: string }) {
  const { nombre, email, foto } = useUsuario()
  const [fallo, setFallo] = useState(false)
  if (foto && !fallo) {
    return (
      <img
        src={foto}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFallo(true)}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    )
  }
  return (
    <div className={`grid shrink-0 place-items-center rounded-full bg-acc-soft font-bold text-acc-strong ${className}`}>
      {iniciales(nombre ?? email.split('@')[0])}
    </div>
  )
}
