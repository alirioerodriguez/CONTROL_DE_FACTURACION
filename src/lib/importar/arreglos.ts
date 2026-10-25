// Correcciones hechas en pantalla antes de importar.
import type { Hoja } from './leer'

/** Arreglos hechos en pantalla: «hoja|fila|columna» → valor nuevo. No tocan el archivo, solo lo que se importa. */
export type Arreglos = Record<string, string>
export const claveArreglo = (hoja: string, fila: number, columna: number) => `${hoja}|${fila}|${columna}`

export function aplicarArreglos(hojas: Hoja[], arreglos: Arreglos): Hoja[] {
  if (!Object.keys(arreglos).length) return hojas
  return hojas.map((h) => ({
    ...h,
    filas: h.filas.map((f) => {
      let celdas = f.celdas
      for (let i = 0; i < Math.max(celdas.length, h.encabezados.length); i++) {
        const k = claveArreglo(h.nombre, f.numero, i)
        if (k in arreglos) {
          if (celdas === f.celdas) celdas = [...f.celdas]
          celdas[i] = arreglos[k].trim() || null
        }
      }
      return celdas === f.celdas ? f : { ...f, celdas }
    }),
  }))
}
