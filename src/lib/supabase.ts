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
    'Failed to fetch': 'Se cortó la conexión. Revisá internet y volvé a tocar Guardar: no se duplica nada.',
    'NetworkError': 'Se cortó la conexión. Revisá internet y volvé a tocar Guardar: no se duplica nada.',
  }
  for (const [en, es] of Object.entries(traducciones)) {
    if (msg.includes(en)) return es
  }
  // Reglas de la base (supabase/schema.sql): se explican en castellano en vez del mensaje técnico.
  const regla = msg.match(/violates check constraint "([^"]+)"/)?.[1]
  if (regla) {
    if (regla.endsWith('_largo')) return 'Uno de los textos es demasiado largo. Acortalo y probá de nuevo.'
    if (/fecha|periodo|alta/.test(regla)) return 'Revisá la fecha: tiene que estar entre el año 2000 y el 2100.'
    if (/horas/.test(regla)) return 'Las horas tienen que ser más de 0 y hasta 24.'
    if (/monto|tarifa|abono/.test(regla)) return 'Revisá el monto: tiene que ser mayor a 0.'
    return 'Algún dato no es válido. Revisalo y probá de nuevo.'
  }
  return msg || 'Ocurrió un error inesperado.'
}
