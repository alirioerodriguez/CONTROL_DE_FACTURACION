import { describe, expect, it } from 'vitest'
import type { Pago } from './datos'
import { categoriaPara, CATEGORIAS, controlTope, proximaRecategorizacion, ventana12Meses } from './monotributo'

function pago(fecha: string, monto: number, moneda: 'ARS' | 'USD' = 'ARS'): Pago {
  return {
    id: fecha + monto,
    patient_id: 'p',
    fecha,
    periodo: fecha.slice(0, 8) + '01',
    monto,
    moneda,
    medio: 'transferencia',
    comprobante: 'sin_comprobante',
    punto_venta: null,
    nro_factura: null,
    session_id: null,
    observaciones: null,
    pagador: 'paciente',
  }
}

describe('tabla', () => {
  it('tiene las 11 categorías con topes crecientes', () => {
    expect(CATEGORIAS.map((c) => c.letra).join('')).toBe('ABCDEFGHIJK')
    for (let i = 1; i < CATEGORIAS.length; i++) expect(CATEGORIAS[i].tope).toBeGreaterThan(CATEGORIAS[i - 1].tope)
  })
})

describe('categoriaPara', () => {
  it('elige la más baja que alcanza, con el tope incluido', () => {
    expect(categoriaPara(0)?.letra).toBe('A')
    expect(categoriaPara(12_009_410.45)?.letra).toBe('A')
    expect(categoriaPara(12_009_410.46)?.letra).toBe('B')
    expect(categoriaPara(30_000_000)?.letra).toBe('D')
  })
  it('null si supera la K', () => {
    expect(categoriaPara(200_000_000)).toBeNull()
  })
})

describe('ventana y recategorización', () => {
  it('12 meses que terminan en el mes actual', () => {
    expect(ventana12Meses('2026-10-16')).toEqual({ desde: '2025-11-01', hasta: '2026-10-01' })
  })
  it('después de julio, la próxima es en enero con lo cobrado hasta diciembre', () => {
    expect(proximaRecategorizacion('2026-10-16')).toEqual({ mes: '2027-01-01', hastaCuando: '2026-12-31', esteMes: false })
  })
  it('antes de julio, la próxima es en julio', () => {
    expect(proximaRecategorizacion('2026-03-02')).toEqual({ mes: '2026-07-01', hastaCuando: '2026-06-30', esteMes: false })
  })
  it('en enero y julio avisa que es este mes', () => {
    expect(proximaRecategorizacion('2027-01-10').esteMes).toBe(true)
    expect(proximaRecategorizacion('2026-07-05')).toEqual({ mes: '2026-07-01', hastaCuando: '2026-06-30', esteMes: true })
  })
})

describe('controlTope', () => {
  const hoy = '2026-10-16'

  it('suma solo los pagos de los últimos 12 meses y hasta hoy', () => {
    const pagos = [pago('2025-10-31', 9_000_000), pago('2025-11-01', 1_000_000), pago('2026-10-16', 500_000), pago('2026-10-20', 7_000_000)]
    const c = controlTope(pagos, 'A', null, hoy)
    expect(c.ars).toBe(1_500_000)
    expect(c.total).toBe(1_500_000)
    expect(c.estado).toBe('bien')
  })

  it('avisa cerca del tope desde el 80 %', () => {
    const c = controlTope([pago('2026-05-10', 10_000_000)], 'A', null, hoy)
    expect(c.uso).toBeCloseTo(0.8327, 3)
    expect(c.estado).toBe('cerca')
    expect(c.margen).toBe(2_009_410.45)
  })

  it('pasado el tope sugiere la categoría siguiente', () => {
    const c = controlTope([pago('2026-05-10', 13_000_000)], 'A', null, hoy)
    expect(c.estado).toBe('pasado')
    expect(c.sugerida?.letra).toBe('B')
    expect(c.margen).toBe(0)
  })

  it('sin tipo de cambio, los dólares quedan aparte y se avisa', () => {
    const c = controlTope([pago('2026-05-10', 1_000_000), pago('2026-06-10', 500, 'USD')], 'A', null, hoy)
    expect(c.usd).toBe(500)
    expect(c.total).toBe(1_000_000)
    expect(c.faltaTipoCambio).toBe(true)
  })

  it('con tipo de cambio, los dólares se suman convertidos', () => {
    const c = controlTope([pago('2026-05-10', 1_000_000), pago('2026-06-10', 500, 'USD')], 'A', 1500, hoy)
    expect(c.total).toBe(1_750_000)
    expect(c.faltaTipoCambio).toBe(false)
  })

  it('sin categoría elegida igual sugiere una, sin porcentaje', () => {
    const c = controlTope([pago('2026-05-10', 20_000_000)], null, null, hoy)
    expect(c.elegida).toBeNull()
    expect(c.uso).toBeNull()
    expect(c.sugerida?.letra).toBe('C')
  })

  it('si supera la K queda fuera del monotributo', () => {
    expect(controlTope([pago('2026-05-10', 130_000_000)], 'K', null, hoy).estado).toBe('fuera')
  })

  it('suma en centavos sin errores de redondeo', () => {
    const pagos = Array.from({ length: 10 }, (_, i) => pago(`2026-0${(i % 9) + 1}-10`, 0.1))
    expect(controlTope(pagos, 'A', null, hoy).ars).toBe(1)
  })
})
