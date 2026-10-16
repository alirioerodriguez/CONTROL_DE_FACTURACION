import { usePerfil } from '../lib/datos'
import { palabras, type Palabras } from '../lib/terminos'

/** Vocabulario de la cuenta ("sesión" o "consulta", por hora o por sesión). */
export function usePalabras(): Palabras {
  const { data: perfil } = usePerfil()
  return palabras(perfil?.termino, perfil?.modo_cobro)
}
