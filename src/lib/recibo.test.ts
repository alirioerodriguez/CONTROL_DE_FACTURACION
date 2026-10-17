import { describe, expect, it } from 'vitest'
import type { Paciente, Pago, Perfil } from './datos'
import { enLetras, montoEnLetras, numeroRecibo, pdfRecibo } from './recibo'

describe('enLetras', () => {
  it('números chicos y casos especiales', () => {
    expect(enLetras(0)).toBe('cero')
    expect(enLetras(1)).toBe('uno')
    expect(enLetras(16)).toBe('dieciséis')
    expect(enLetras(21)).toBe('veintiuno')
    expect(enLetras(45)).toBe('cuarenta y cinco')
    expect(enLetras(100)).toBe('cien')
    expect(enLetras(101)).toBe('ciento uno')
    expect(enLetras(999)).toBe('novecientos noventa y nueve')
  })
  it('miles y millones con apócope', () => {
    expect(enLetras(1000)).toBe('mil')
    expect(enLetras(21000)).toBe('veintiún mil')
    expect(enLetras(25000)).toBe('veinticinco mil')
    expect(enLetras(150000)).toBe('ciento cincuenta mil')
    expect(enLetras(1000000)).toBe('un millón')
    expect(enLetras(2500000)).toBe('dos millones quinientos mil')
    expect(enLetras(31000000)).toBe('treinta y un millones')
    expect(enLetras(1234567)).toBe('un millón doscientos treinta y cuatro mil quinientos sesenta y siete')
  })
})

describe('montoEnLetras', () => {
  it('pesos y dólares con centavos', () => {
    expect(montoEnLetras(25000.5, 'ARS')).toBe('Son pesos veinticinco mil con 50/100')
    expect(montoEnLetras(21, 'ARS')).toBe('Son pesos veintiún con 00/100')
    expect(montoEnLetras(40, 'USD')).toBe('Son dólares estadounidenses cuarenta con 00/100')
  })
})

describe('pdfRecibo', () => {
  const pago = {
    id: 'a1b2c3d4-0000-0000-0000-000000000000',
    patient_id: 'p',
    fecha: '2026-10-16',
    periodo: '2026-10-01',
    monto: 50000,
    moneda: 'ARS',
    medio: 'transferencia',
    comprobante: 'factura_c',
    punto_venta: '00002',
    nro_factura: '00000123',
  } as Pago
  const paciente = { id: 'p', nombre: 'Lucía', apellido: 'Pérez' } as Paciente

  it('número de recibo estable', () => {
    expect(numeroRecibo(pago)).toBe('R-20261016-A1B2C3')
  })

  it('arma el PDF con los datos', async () => {
    const doc = await pdfRecibo(pago, paciente, { nombre: 'Lic. Ana Martínez' } as Perfil, 'sesiones')
    expect(doc.getNumberOfPages()).toBe(1)
    // Con las tipografías del diseño incrustadas (Figtree e Instrument Serif).
    expect(Object.keys(doc.getFontList())).toEqual(expect.arrayContaining(['Figtree', 'InstrumentSerif']))
    expect(doc.output().length).toBeGreaterThan(20000)
  })
})
