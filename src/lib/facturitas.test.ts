import { describe, expect, it } from 'vitest'
import type { Paciente, Pago } from './datos'
import type { ParaFacturar } from './facturar'
import { COLUMNAS_FACTURITAS, cruzarResumen, filasFacturitas, numeroFactura } from './facturitas'
import { armarHoja } from './importar/leer'

const pac = (id: string, nombre: string, extra: Partial<Paciente> = {}) =>
  ({ id, nombre, apellido: null, dni: null, cuil_cuit: null, condicion_iva: null, obra_social: null, nro_afiliado: null, ...extra }) as Paciente
const pago = (id: string, patient_id: string, fecha: string, monto: number, extra: Partial<Pago> = {}) =>
  ({ id, patient_id, fecha, periodo: `${fecha.slice(0, 7)}-01`, monto, moneda: 'ARS', comprobante: 'sin_comprobante', pagador: 'paciente', ...extra }) as Pago

const lucia = pac('a', 'Lucía', { apellido: 'Pérez', dni: '30.123.456' })
const ana = pac('b', 'Ana', { apellido: 'Gómez', obra_social: 'OSDE 310', nro_afiliado: '61-1' })
const items: ParaFacturar[] = [
  { pago: pago('1', 'a', '2026-10-05', 50000), paciente: lucia },
  { pago: pago('2', 'b', '2026-10-06', 50000, { pagador: 'obra_social' }), paciente: ana },
  { pago: pago('3', 'a', '2026-10-20', 40000), paciente: lucia },
]

describe('planilla para Facturitas', () => {
  it('una fila por pago, con receptor y período', () => {
    const [f1, f2] = filasFacturitas(items, 'sesiones')
    const col = (t: string) => COLUMNAS_FACTURITAS.findIndex((c) => c.titulo === t)
    expect(f1[col('Fecha')]).toBe('2026-10-05')
    expect(f1[col('Tipo de documento')]).toBe('DNI')
    expect(f1[col('Número de documento')]).toBe('30123456')
    expect(f1[col('Nombre o razón social')]).toBe('Lucía Pérez')
    expect(f1[col('Precio unitario')]).toBe(50000)
    expect(f1[col('Período hasta')]).toBe('2026-10-31')
    expect(f1[col('Descripción')]).toBe('Honorarios profesionales: sesiones de octubre 2026')
    // Si pagó la obra social, la factura va a su nombre.
    expect(f2[col('Nombre o razón social')]).toBe('OSDE 310')
    expect(f2[col('Descripción')]).toContain('Ana Gómez, afiliado N.º 61-1')
  })
})

describe('resumen de Facturitas', () => {
  it('número de factura con el formato de la app', () => {
    expect(numeroFactura('2', '123')).toBe('C 00002-00000123')
    expect(numeroFactura('', '0002-00000123')).toBe('C 0002-00000123')
    expect(numeroFactura('', 'C 0002-00000123')).toBe('C 0002-00000123')
  })

  it('cruza por importe y fecha, y desempata por nombre', () => {
    const hoja = armarHoja('Resumen', [
      ['Fecha', 'Punto de venta', 'Número', 'Cliente', 'Importe total'],
      ['06/10/2026', 2, 15, 'OSDE 310', '50.000,00'],
      ['05/10/2026', 2, 14, 'Lucía Pérez', 50000],
      ['20/10/2026', 2, 16, 'Lucía Pérez', 40000],
      ['21/10/2026', 2, 17, 'Otro', 99999],
    ])
    const r = cruzarResumen(hoja, items)
    expect(r.columnasFaltantes).toEqual([])
    expect(r.sinCruzar).toBe(1)
    expect(r.coincidencias.map((c) => [c.item.pago.id, c.numero])).toEqual([
      ['2', 'C 00002-00000015'],
      ['1', 'C 00002-00000014'],
      ['3', 'C 00002-00000016'],
    ])
  })

  it('avisa si faltan columnas', () => {
    const hoja = armarHoja('X', [['Cliente', 'Monto'], ['Lucía', 1]])
    expect(cruzarResumen(hoja, items).columnasFaltantes).toEqual(['fecha', 'número de comprobante'])
  })
})
