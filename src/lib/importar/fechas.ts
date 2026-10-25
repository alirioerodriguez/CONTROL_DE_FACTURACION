// Fechas «como vengan» al importar: planillas armadas a mano mezclan 04/03/2026, 4-mar-26, 2026/03/04,
// fechas sin año o con hora, y a veces el orden mes/día de un Excel en inglés. Lo que se entiende fuera del
// formato argentino se devuelve con una nota para que la profesional lo revise antes de importar.
import { formatFecha, parseFechaAR } from '../formato'
import type { Celda, Hoja } from './leer'

export type Orden = 'dmy' | 'mdy'
export interface Pista {
  /** Cómo leer 03/04: día/mes (lo normal) o mes/día si el resto de la columna viene así. */
  orden: Orden
  /** Año para las fechas que no lo traen (el más común de la columna). */
  anio: number
}
export interface Lectura {
  iso: string | null
  /** Presente si la fecha se interpretó (no venía en dd/mm/aaaa). */
  nota?: string
}

const MESES: Record<string, number> = {
  ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7, ago: 8, aug: 8,
  sep: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12,
}
const mesDe = (t: string): number | undefined => MESES[t.slice(0, 3).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')]

function iso(anio: number, mes: number, dia: number): string | null {
  if (anio < 100) anio += 2000
  return parseFechaAR(`${dia}/${mes}/${anio}`)
}

/** Las dos partes de una fecha numérica de tres números con barras, guiones o puntos (sin el año primero). */
function partes(t: string): [number, number, number | null] | null {
  const m = /^(\d{1,2})\s*[/.\-\\]\s*(\d{1,2})(?:\s*[/.\-\\]\s*(\d{2}|\d{4}))?$/.exec(t)
  return m ? [+m[1], +m[2], m[3] ? +m[3] : null] : null
}

/** Mira toda la columna para decidir el orden de las fechas ambiguas y el año que falta. */
export function pistaColumna(hoja: Hoja, columna: number, hoy: string): Pista {
  let dmy = 0, mdy = 0
  const anios = new Map<number, number>()
  for (const { celdas } of hoja.filas) {
    const c = columna >= 0 ? celdas[columna] : null
    if (c instanceof Date) {
      anios.set(c.getUTCFullYear(), (anios.get(c.getUTCFullYear()) ?? 0) + 1)
      continue
    }
    if (typeof c !== 'string') continue
    const p = partes(limpiar(c))
    if (!p) continue
    if (p[0] > 12 && p[1] <= 12) dmy++
    if (p[1] > 12 && p[0] <= 12) mdy++
    if (p[2] != null) {
      const a = p[2] < 100 ? p[2] + 2000 : p[2]
      anios.set(a, (anios.get(a) ?? 0) + 1)
    }
  }
  const anio = [...anios.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? +hoy.slice(0, 4)
  return { orden: mdy > dmy ? 'mdy' : 'dmy', anio }
}

/** Saca la hora ("04/03/2026 10:30", "2026-03-04T10:30") y espacios de más. */
function limpiar(t: string): string {
  return t.trim().replace(/[T\s]+\d{1,2}:\d{2}(:\d{2})?(\s*(hs?|am|pm|a\.\s?m\.|p\.\s?m\.))?$/i, '').replace(/\s+/g, ' ').trim()
}

export function leerFecha(valor: Celda, pista: Pista): Lectura {
  if (valor == null || typeof valor === 'boolean') return { iso: null }
  if (valor instanceof Date || typeof valor === 'number') {
    const r = parseFechaAR(valor)
    if (r || typeof valor !== 'number') return { iso: r }
  }
  const original = String(valor).trim()
  const t = limpiar(original)
  const nota = (r: string | null, como: string): Lectura => (r ? { iso: r, nota: `“${original}” se leyó como ${formatFecha(r)} (${como})` } : { iso: null })

  const p = partes(t)
  if (p) {
    const [a, b, anioTxt] = p
    const anio = anioTxt ?? pista.anio
    const sinAnio = anioTxt == null ? `sin año: se usó ${anio}` : ''
    const dmy = iso(anio, b, a), mdy = iso(anio, a, b)
    // Ambigua (los dos números ≤ 12): manda el orden de la columna.
    if (dmy && mdy && a !== b) {
      if (pista.orden === 'mdy') return nota(mdy, ['mes/día como el resto de la columna', sinAnio].filter(Boolean).join(', '))
      return sinAnio ? nota(dmy, sinAnio) : { iso: dmy }
    }
    if (dmy) return sinAnio ? nota(dmy, sinAnio) : { iso: dmy }
    if (mdy) return nota(mdy, ['venía mes/día', sinAnio].filter(Boolean).join(', '))
    return { iso: null }
  }

  // Si la limpieza (hora) cambió algo, lo estricto puede funcionar ahora: no hace falta avisar por la hora.
  const estricta = parseFechaAR(t)
  if (estricta) return { iso: estricta }

  // Año primero con barras o puntos: 2026/03/04.
  let m = /^(\d{4})\s*[/.\\]\s*(\d{1,2})\s*[/.\\]\s*(\d{1,2})$/.exec(t)
  if (m) return nota(iso(+m[1], +m[2], +m[3]), 'año/mes/día')

  // Con el mes en letras: "4 de marzo de 2026", "4-mar-26", "4 mar", "Mar 4, 2026", "marzo 4 2026".
  m = /^(\d{1,2})(?:\s*de)?[\s\-/.]*([a-záéíóú]{3,})\.?(?:[\s\-/.,]*(?:de\s*)?(\d{2}|\d{4}))?$/i.exec(t)
  if (m && mesDe(m[2])) return nota(iso(m[3] ? +m[3] : pista.anio, mesDe(m[2])!, +m[1]), m[3] ? 'mes en letras' : `sin año: se usó ${pista.anio}`)
  m = /^([a-záéíóú]{3,})\.?\s*(\d{1,2})(?:[\s,]+(\d{2}|\d{4}))?$/i.exec(t)
  if (m && mesDe(m[1])) return nota(iso(m[3] ? +m[3] : pista.anio, mesDe(m[1])!, +m[2]), m[3] ? 'mes en letras' : `sin año: se usó ${pista.anio}`)

  // Número de serie de Excel guardado como texto (ej. "45720").
  if (/^\d{5}$/.test(t) && +t > 30000 && +t < 80000) return nota(parseFechaAR(+t), 'número de fecha de Excel')
  return { iso: null }
}
