import { describe, expect, it } from 'vitest'
import { leerFecha, pistaColumna, type Pista } from './fechas'
import type { Hoja } from './leer'

const ar: Pista = { orden: 'dmy', anio: 2026 }
const hoja = (fechas: string[]): Hoja => ({ nombre: 'Hoja1', encabezados: ['Fecha'], filas: fechas.map((f, i) => ({ numero: i + 2, celdas: [f] })) })

describe('fechas mezcladas al importar', () => {
  it('lo argentino de siempre pasa sin nota', () => {
    expect(leerFecha('04/03/2026', ar)).toEqual({ iso: '2026-03-04' })
    expect(leerFecha('4-3-26', ar)).toEqual({ iso: '2026-03-04' })
    expect(leerFecha('2026-03-04', ar)).toEqual({ iso: '2026-03-04' })
    expect(leerFecha('04/03/2026 18:30', ar)).toEqual({ iso: '2026-03-04' })
    expect(leerFecha(' 04 / 03 / 2026 ', ar)).toEqual({ iso: '2026-03-04' })
  })
  it('mes/día imposible en día/mes se da vuelta y avisa', () => {
    const r = leerFecha('03/14/2026', ar)
    expect(r.iso).toBe('2026-03-14')
    expect(r.nota).toContain('venía mes/día')
  })
  it('si la columna viene en mes/día, las ambiguas se leen igual y se avisa', () => {
    const p = pistaColumna(hoja(['03/14/2026', '03/20/2026', '04/03/2026']), 0, '2026-10-25')
    expect(p.orden).toBe('mdy')
    const r = leerFecha('04/03/2026', p)
    expect(r.iso).toBe('2026-04-03')
    expect(r.nota).toContain('mes/día')
  })
  it('sin año usa el año más común de la columna', () => {
    const p = pistaColumna(hoja(['04/03/2025', '05/03/2025', '06/03']), 0, '2026-10-25')
    expect(p.anio).toBe(2025)
    expect(leerFecha('06/03', p)).toEqual({ iso: '2025-03-06', nota: '“06/03” se leyó como 06/03/2025 (sin año: se usó 2025)' })
  })
  it('entiende el mes en letras, en castellano o inglés', () => {
    expect(leerFecha('4 de marzo de 2026', ar).iso).toBe('2026-03-04')
    expect(leerFecha('4-mar-26', ar).iso).toBe('2026-03-04')
    expect(leerFecha('4 Dic 2025', ar).iso).toBe('2025-12-04')
    expect(leerFecha('Mar 4, 2026', ar).iso).toBe('2026-03-04')
    expect(leerFecha('4 marzo', ar).nota).toContain('sin año')
  })
  it('año primero y número de Excel como texto', () => {
    expect(leerFecha('2026/03/04', ar).iso).toBe('2026-03-04')
    expect(leerFecha('45720', ar).iso).toBe('2025-03-04')
  })
  it('lo que no es una fecha sigue siendo un error', () => {
    expect(leerFecha('próximo lunes', ar).iso).toBeNull()
    expect(leerFecha('31/02/2026', ar).iso).toBeNull()
    expect(leerFecha('15/15/2026', ar).iso).toBeNull()
  })
})
