import { usePerfil } from '../lib/datos'
import { terminosPais, type TerminosPais } from '../lib/pais'
import { palabras, type Palabras } from '../lib/terminos'

/** Vocabulario de la cuenta ("sesión" o "consulta", por hora o por sesión). */
export function usePalabras(): Palabras {
  const { data: perfil } = usePerfil()
  return palabras(perfil?.termino, perfil?.modo_cobro)
}

/** Etiquetas fiscales y de documentos según el país del perfil ('AR' por defecto). */
export function usePais(): TerminosPais {
  const { data: perfil } = usePerfil()
  return terminosPais(perfil?.pais)
}
