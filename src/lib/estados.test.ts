import { describe, expect, it } from 'vitest'
import { cobrables, estadoVisible, seCobra } from './estados'

const hoy = '2026-10-16'

describe('estadoVisible', () => {
  it('una normal futura está programada y una de hoy o anterior, realizada', () => {
    expect(estadoVisible({ fecha: '2026-10-17', estado: 'normal' }, hoy)).toBe('programada')
    expect(estadoVisible({ fecha: '2026-10-16', estado: 'normal' }, hoy)).toBe('realizada')
    expect(estadoVisible({ fecha: '2026-10-01' }, hoy)).toBe('realizada')
  })
  it('ausente y cancelada se respetan aunque la fecha sea futura', () => {
    expect(estadoVisible({ fecha: '2026-11-02', estado: 'ausente' }, hoy)).toBe('ausente')
    expect(estadoVisible({ fecha: '2026-11-02', estado: 'cancelada' }, hoy)).toBe('cancelada')
  })
})

describe('seCobra', () => {
  it('cobra realizadas y ausentes, no programadas ni canceladas', () => {
    expect(seCobra({ fecha: '2026-10-10', estado: 'normal' }, hoy)).toBe(true)
    expect(seCobra({ fecha: '2026-10-10', estado: 'ausente' }, hoy)).toBe(true)
    expect(seCobra({ fecha: '2026-10-30', estado: 'normal' }, hoy)).toBe(false)
    expect(seCobra({ fecha: '2026-10-10', estado: 'cancelada' }, hoy)).toBe(false)
  })
  it('filtra una lista', () => {
    const lista = [
      { fecha: '2026-10-05', estado: 'normal' as const },
      { fecha: '2026-10-12', estado: 'cancelada' as const },
      { fecha: '2026-10-26', estado: 'normal' as const },
    ]
    expect(cobrables(lista, hoy)).toEqual([lista[0]])
  })
})
