import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** false si faltan las variables de entorno (se muestra una pantalla de aviso). */
export const supabaseConfigurado = Boolean(url && anonKey)

export const supabase = createClient(
  url ?? 'http://localhost:54321',
  anonKey ?? 'falta-configurar',
)

/** Traduce los errores más comunes de Supabase Auth al castellano. */
export function mensajeError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error)
  const traducciones: Record<string, string> = {
    'Invalid login credentials': 'Mail o contraseña incorrectos.',
    'Email not confirmed': 'Todavía no confirmaste tu mail. Revisá tu casilla.',
    'User already registered': 'Ya existe una cuenta con ese mail.',
    'Password should be at least 6 characters': 'La contraseña tiene que tener al menos 6 caracteres.',
    'Failed to fetch': 'No hay conexión. Revisá internet e intentá de nuevo.',
  }
  for (const [en, es] of Object.entries(traducciones)) {
    if (msg.includes(en)) return es
  }
  return msg || 'Ocurrió un error inesperado.'
}
