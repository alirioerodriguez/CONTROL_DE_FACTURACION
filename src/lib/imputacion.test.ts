import { describe, expect, it } from 'vitest'
import { ticketDeImputacion } from './imputacion'
import { calcularSaldos } from './saldos'

const ses = (fecha: string, monto: number, moneda: 'ARS' | 'USD' = 'ARS') => ({ fecha, monto, moneda })
const pago = (periodo: string, monto: number, moneda: 'ARS' | 'USD' = 'ARS') => ({ periodo, monto, moneda })

// Tres meses de $ 30.000
const trimestre = [ses('2026-01-05', 30000), ses('2026-02-05', 30000), ses('2026-03-05', 30000)]

describe('ticketDeImputacion', () => {
  it('pago exacto de un mes: se cubre, queda pagado y se debe lo de los otros', () => {
    const t = ticketDeImputacion(trimestre, [], pago('2026-03-01', 30000))
    expect(t.pasos).toEqual([{ periodo: '2026-03-01', aplicado: 30000, pendienteAntes: 30000, pendienteDespues: 0, esElegido: true }])
    expect(t.aFavor).toBe(0)
    expect(t.debiaAntes).toBe(90000)
    expect(t.debeDespues).toBe(60000)
    expect(t.frases).toEqual([
      'Pago de $ 30.000,00 para marzo 2026.',
      'marzo 2026: se cubrieron $ 30.000,00 y quedó pagado.',
      'Antes debía $ 90.000,00. Ahora debe $ 60.000,00.',
    ])
  })

  it('pago parcial: se cubre una parte y se dice cuánto falta', () => {
    const t = ticketDeImputacion(trimestre, [], pago('2026-03-01', 10000))
    expect(t.pasos).toHaveLength(1)
    expect(t.pasos[0]).toMatchObject({ aplicado: 10000, pendienteAntes: 30000, pendienteDespues: 20000 })
    expect(t.frases[1]).toBe('marzo 2026: se cubrieron $ 10.000,00; todavía debe $ 20.000,00.')
    expect(t.debeDespues).toBe(80000)
  })

  it('pago de más: primero el mes elegido, después los más viejos, y lo que sobra queda a favor', () => {
    const t = ticketDeImputacion(trimestre, [], pago('2026-03-01', 100000))
    expect(t.pasos.map((p) => [p.periodo, p.aplicado, p.esElegido])).toEqual([
      ['2026-03-01', 30000, true],
      ['2026-01-01', 30000, false],
      ['2026-02-01', 30000, false],
    ])
    expect(t.aFavor).toBe(10000)
    expect(t.debeDespues).toBe(0)
    expect(t.frases).toEqual([
      'Pago de $ 100.000,00 para marzo 2026.',
      'marzo 2026: se cubrieron $ 30.000,00 y quedó pagado.',
      'enero 2026: se cubrieron $ 30.000,00 y quedó pagado. (Sobraba de este pago, por eso se aplicó a un mes más viejo.)',
      'febrero 2026: se cubrieron $ 30.000,00 y quedó pagado. (Sobraba de este pago, por eso se aplicó a un mes más viejo.)',
      'Sobraron $ 10.000,00: quedan a favor.',
      'Está al día y tiene $ 10.000,00 a favor.',
    ])
  })

  it('un pago que alcanza para un mes y parte del más viejo', () => {
    const t = ticketDeImputacion(trimestre, [], pago('2026-03-01', 45000))
    expect(t.pasos.map((p) => [p.periodo, p.aplicado, p.pendienteDespues])).toEqual([['2026-03-01', 30000, 0], ['2026-01-01', 15000, 15000]])
    expect(t.frases).toContain('enero 2026: se cubrieron $ 15.000,00; todavía debe $ 15.000,00.')
    expect(t.debeDespues).toBe(45000)
  })

  it('pago adelantado de un mes sin sesiones y sin deuda: todo queda a favor', () => {
    const t = ticketDeImputacion([ses('2026-01-05', 30000)], [pago('2026-01-01', 30000)], pago('2026-04-01', 25000))
    expect(t.pasos).toEqual([])
    expect(t.aFavor).toBe(25000)
    expect(t.frases).toEqual([
      'Pago de $ 25.000,00 para abril 2026.',
      'No había nada pendiente: todos los meses ya estaban pagos.',
      'Sobraron $ 25.000,00: quedan a favor.',
      'Está al día y tiene $ 25.000,00 a favor.',
    ])
  })

  it('un pago más cuando ya tenía saldo a favor: se suma a lo que ya había', () => {
    const t = ticketDeImputacion([ses('2026-01-05', 30000)], [pago('2026-01-01', 40000)], pago('2026-02-01', 10000))
    expect(t.aFavorAntes).toBe(10000)
    expect(t.aFavor).toBe(20000)
    expect(t.frases).toContain('Sobraron $ 10.000,00: quedan a favor (se suman a lo que ya tenía a favor).')
  })

  it('un pago que cubre lo que ya estaba cubierto por un sobrante anterior: se reacomoda y no se inventa deuda', () => {
    // Antes: un pago de $ 100.000 en marzo había saldado enero y febrero con lo que sobraba (y quedaban $ 10.000 a favor).
    const previos = [pago('2026-03-01', 100000)]
    const t = ticketDeImputacion(trimestre, previos, pago('2026-01-01', 10000))
    expect(t.debeDespues).toBe(0)
    expect(t.aFavor).toBe(20000)
    // Los tres meses siguen pagos: no hay pasos con plata nueva, solo más saldo a favor.
    expect(t.pasos.every((p) => p.pendienteDespues === 0)).toBe(true)
    expect(t.frases[t.frases.length - 1]).toBe('Está al día y tiene $ 20.000,00 a favor.')
  })

  it('USD y ARS no se mezclan', () => {
    const sesiones = [ses('2026-03-05', 30000), ses('2026-03-12', 40, 'USD')]
    const t = ticketDeImputacion(sesiones, [], pago('2026-03-01', 40, 'USD'))
    expect(t.moneda).toBe('USD')
    expect(t.pasos).toEqual([{ periodo: '2026-03-01', aplicado: 40, pendienteAntes: 40, pendienteDespues: 0, esElegido: true }])
    expect(t.frases[0]).toBe('Pago de US$ 40,00 para marzo 2026.')
    expect(t.debeDespues).toBe(0)
  })

  it('sin sesiones en esa moneda no se rompe', () => {
    const t = ticketDeImputacion([], [], pago('2026-03-01', 5000))
    expect(t.pasos).toEqual([])
    expect(t.aFavor).toBe(5000)
    expect(t.debiaAntes).toBe(0)
  })

  it('al centavo, sin errores de coma flotante', () => {
    const sesiones = [ses('2026-01-05', 33333.33), ses('2026-02-05', 33333.33), ses('2026-03-05', 33333.33)]
    const t = ticketDeImputacion(sesiones, [], pago('2026-03-01', 100000))
    expect(t.pasos.map((p) => p.aplicado)).toEqual([33333.33, 33333.33, 33333.33])
    expect(t.aFavor).toBe(0.01)
    expect(t.frases).toContain('Sobraron $ 0,01: quedan a favor.')
  })

  it('coincide siempre con calcularSaldos: lo que cambia por mes es exactamente la diferencia de saldos', () => {
    const casos = [pago('2026-03-01', 1), pago('2026-02-01', 45000), pago('2026-01-01', 90000), pago('2026-03-01', 200000), pago('2026-05-01', 7000)]
    for (const nuevo of casos) {
      const previos = [pago('2026-01-01', 12345.67)]
      const t = ticketDeImputacion(trimestre, previos, nuevo)
      const a = calcularSaldos(trimestre, previos)[0]
      const d = calcularSaldos(trimestre, [...previos, nuevo])[0]
      const sumaPasos = Math.round(t.pasos.reduce((s, p) => s + p.aplicado * 100, 0))
      const pagadoAntes = Math.round(a.meses.reduce((s, m) => s + m.pagado * 100, 0))
      const pagadoDespues = Math.round(d.meses.reduce((s, m) => s + m.pagado * 100, 0))
      expect(sumaPasos).toBe(pagadoDespues - pagadoAntes)
      expect(t.debeDespues).toBe(Math.max(0, d.saldo))
      expect(t.aFavor).toBe(Math.max(0, -d.saldo))
    }
  })
  it('con «ocultar montos» las frases usan el formateador que se le pasa y no muestran la plata', () => {
    const tapado = (_n: number, m: 'ARS' | 'USD') => `${m === 'USD' ? 'US$' : '$'} •••••`
    const t = ticketDeImputacion(trimestre, [], pago('2026-03-01', 100000), tapado)
    expect(t.frases.join(' ')).not.toMatch(/\d{2}\.\d{3}/)
    expect(t.frases[0]).toBe('Pago de $ ••••• para marzo 2026.')
    expect(t.aFavor).toBe(10000) // los números siguen siendo los reales
  })
})
