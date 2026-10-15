import { describe, expect, it } from 'vitest'
import {
  calcularSaldos, estadoSesion, fechasDelMes, pagadoPorSesion, periodoSugerido, tarifaVigente,
  type PagoSaldo, type SesionSaldo,
} from './saldos'

const ses = (fecha: string, monto = 50000, moneda: 'ARS' | 'USD' = 'ARS'): SesionSaldo => ({ fecha, monto, moneda })
const pago = (periodo: string, monto: number, moneda: 'ARS' | 'USD' = 'ARS'): PagoSaldo => ({ periodo, monto, moneda })

describe('calcularSaldos', () => {
  it('sin movimientos no devuelve monedas', () => {
    expect(calcularSaldos([], [])).toEqual([])
  })

  it('mes pagado completo', () => {
    const [ars] = calcularSaldos(
      [ses('2026-03-02'), ses('2026-03-09'), ses('2026-03-16'), ses('2026-03-23'), ses('2026-03-30')],
      [pago('2026-03-01', 250000)],
    )
    expect(ars.saldo).toBe(0)
    expect(ars.meses[0]).toMatchObject({ cargo: 250000, pagado: 250000, pendiente: 0, sesiones: 5, estado: 'pagado' })
  })

  it('pago parcial deja el mes en parcial', () => {
    const [ars] = calcularSaldos([ses('2026-03-02'), ses('2026-03-09')], [pago('2026-03-01', 60000)])
    expect(ars.saldo).toBe(40000)
    expect(ars.meses[0]).toMatchObject({ pendiente: 40000, estado: 'parcial' })
  })

  it('el sobrante de un pago cancela primero el mes impago más viejo', () => {
    const [ars] = calcularSaldos(
      [ses('2026-01-05'), ses('2026-02-02'), ses('2026-03-02')],
      [pago('2026-03-01', 100000)], // paga marzo y sobran 50.000
    )
    const [ene, feb, mar] = ars.meses
    expect(mar.estado).toBe('pagado')
    expect(ene).toMatchObject({ pagado: 50000, estado: 'pagado' })
    expect(feb).toMatchObject({ pagado: 0, estado: 'pendiente' })
    expect(ars.saldo).toBe(50000)
  })

  it('pago mayor a la deuda queda como saldo a favor', () => {
    const [ars] = calcularSaldos([ses('2026-03-02')], [pago('2026-03-01', 80000)])
    expect(ars.saldo).toBe(-30000)
    expect(ars.meses[0].estado).toBe('pagado')
  })

  it('pago adelantado de un mes sin sesiones', () => {
    const [ars] = calcularSaldos([], [pago('2026-04-01', 50000)])
    expect(ars.saldo).toBe(-50000)
    expect(ars.meses[0]).toMatchObject({ periodo: '2026-04-01', cargo: 0, estado: 'a_favor' })
  })

  it('ARS y USD nunca se mezclan', () => {
    const saldos = calcularSaldos(
      [ses('2026-03-02', 50000, 'ARS'), ses('2026-03-03', 40, 'USD')],
      [pago('2026-03-01', 100, 'USD')],
    )
    const ars = saldos.find((s) => s.moneda === 'ARS')!
    const usd = saldos.find((s) => s.moneda === 'USD')!
    expect(ars.saldo).toBe(50000)
    expect(ars.pagos).toBe(0)
    expect(usd.saldo).toBe(-60)
  })

  it('no acumula errores de redondeo con decimales', () => {
    const [ars] = calcularSaldos(
      [ses('2026-03-02', 0.1), ses('2026-03-09', 0.2)],
      [pago('2026-03-01', 0.3)],
    )
    expect(ars.saldo).toBe(0)
    expect(ars.meses[0].estado).toBe('pagado')
  })
})

describe('pagadoPorSesion', () => {
  const s = (id: string, fecha: string, monto = 50000) => ({ id, fecha, monto, moneda: 'ARS' as const })

  it('reparte lo pagado del mes en orden de fecha', () => {
    const m = pagadoPorSesion(
      [s('c', '2026-03-16'), s('a', '2026-03-02'), s('b', '2026-03-09')],
      [pago('2026-03-01', 75000)],
    )
    expect(m.get('a')).toBe(50000)
    expect(m.get('b')).toBe(25000)
    expect(m.get('c')).toBe(0)
    expect(estadoSesion(50000, m.get('a')!)).toBe('pagada')
    expect(estadoSesion(50000, m.get('b')!)).toBe('parcial')
    expect(estadoSesion(50000, m.get('c')!)).toBe('pendiente')
  })

  it('respeta el sobrante que va a meses viejos', () => {
    const m = pagadoPorSesion([s('ene', '2026-01-05'), s('mar', '2026-03-02')], [pago('2026-03-01', 100000)])
    expect(m.get('ene')).toBe(50000)
    expect(m.get('mar')).toBe(50000)
  })
})

describe('periodoSugerido', () => {
  it('propone el mes impago más viejo, o el mes del pago', () => {
    const saldos = calcularSaldos([ses('2026-01-05'), ses('2026-02-02')], [pago('2026-01-01', 50000)])
    expect(periodoSugerido(saldos, 'ARS', '2026-03-10')).toBe('2026-02-01')
    expect(periodoSugerido(saldos, 'USD', '2026-03-10')).toBe('2026-03-01')
  })
})

describe('tarifaVigente', () => {
  it('usa la estándar o la personalizada', () => {
    expect(tarifaVigente({ tipo_tarifa: 'estandar', tarifa_personalizada: null }, 50000)).toBe(50000)
    expect(tarifaVigente({ tipo_tarifa: 'personalizada', tarifa_personalizada: 40000 }, 50000)).toBe(40000)
  })
})

describe('fechasDelMes', () => {
  it('cuenta 4 o 5 lunes según el mes', () => {
    expect(fechasDelMes('2026-03-01', [1])).toEqual(['2026-03-02', '2026-03-09', '2026-03-16', '2026-03-23', '2026-03-30'])
    expect(fechasDelMes('2026-02-01', [1])).toHaveLength(4)
  })

  it('combina varios días por semana', () => {
    expect(fechasDelMes('2026-02-01', [1, 4])).toHaveLength(8)
  })
})
