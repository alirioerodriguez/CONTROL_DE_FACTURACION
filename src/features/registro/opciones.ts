import type { Opcion } from '../../components/ui'
import { montoParaInput } from '../../lib/formato'

/** Duraciones típicas de sesión, más la actual si es otra. */
export function opcionesHoras(actual: number): Opcion<number>[] {
  const base = [1, 1.5, 2]
  const valores = base.includes(actual) ? base : [...base, actual].sort((a, b) => a - b)
  return valores.map((v) => ({ v, l: `${montoParaInput(v)} h` }))
}
