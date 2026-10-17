import { describe, expect, it } from 'vitest'
import type { Paciente, Pago } from './datos'
import { datosFactura, documentoReceptor, pagosParaFacturar, textoFactura } from './facturar'

const pac = (id: string, nombre: string, extra: Partial<Paciente> = {}) => ({ id, nombre, apellido: null, dni: null, cuil_cuit: null, condicion_iva: null, domicilio: null, ...extra }) as Paciente
const pago = (id: string, patient_id: string, fecha: string, monto: number, comprobante: Pago['comprobante'] = 'sin_comprobante', moneda: Pago['moneda'] = 'ARS') =>
  ({ id, patient_id, fecha, periodo: `${fecha.slice(0, 7)}-01`, monto, moneda, comprobante }) as Pago

const pacientes = [pac('a', 'Lucía', { apellido: 'Pérez', dni: '30.123.456' }), pac('b', 'Ana', { cuil_cuit: '27-30123456-4', condicion_iva: 'Monotributo' })]
const pagos = [
  pago('1', 'a', '2026-09-10', 50000),
  pago('2', 'a', '2026-10-05', 50000, 'factura_c'),
  pago('3', 'b', '2026-10-03', 40000, 'recibo'),
  pago('4', 'b', '2026-10-08', 60, 'sin_comprobante', 'USD'),
  pago('5', 'a', '2026-03-01', 10000),
]

describe('pagosParaFacturar', () => {
  it('solo los que no tienen Factura C, desde el mes elegido, por mes de pago', () => {
    const r = pagosParaFacturar(pagos, pacientes, '2026-05-01')
    expect(r.map((m) => [m.periodo, m.items.map((i) => i.pago.id), m.total])).toEqual([
      ['2026-10-01', ['3', '4'], { ARS: 40000, USD: 60 }],
      ['2026-09-01', ['1'], { ARS: 50000, USD: 0 }],
    ])
  })
})

describe('datos para ARCA', () => {
  it('documento: CUIT antes que DNI, solo números', () => {
    expect(documentoReceptor(pacientes[0])).toEqual({ tipo: 'DNI', numero: '30123456' })
    expect(documentoReceptor(pacientes[1])).toEqual({ tipo: 'CUIT', numero: '27301234564' })
    expect(documentoReceptor(pac('c', 'X'))).toBeNull()
  })

  it('texto para copiar', () => {
    expect(textoFactura({ pago: pagos[0], paciente: pacientes[0] }, 'sesiones')).toBe(
      [
        'Concepto: Servicios',
        'Período facturado: 01/09/2026 al 30/09/2026',
        'Condición frente al IVA: Consumidor final',
        'Receptor: Lucía Pérez',
        'DNI: 30123456',
        'Descripción: Honorarios profesionales: sesiones de septiembre 2026',
        'Importe: $ 50.000,00',
      ].join('\n'),
    )
  })

  it('en dólares avisa la moneda', () => {
    const d = datosFactura({ pago: pagos[3], paciente: pacientes[1] }, 'sesiones')
    expect(d[d.length - 1].etiqueta).toBe('Moneda')
    expect(d.find((x) => x.etiqueta === 'Condición frente al IVA')?.valor).toBe('Monotributo')
  })

  it('si pagó la obra social, la factura va a su nombre', () => {
    const conOS = { ...pacientes[0], obra_social: 'OSDE 310', nro_afiliado: '61-1' }
    const d = datosFactura({ pago: { ...pagos[0], pagador: 'obra_social' }, paciente: conOS }, 'sesiones')
    expect(d.find((x) => x.etiqueta === 'Receptor')?.valor).toBe('OSDE 310')
    expect(d.find((x) => x.etiqueta === 'Descripción')?.valor).toBe(
      'Honorarios profesionales: sesiones de septiembre 2026 · Lucía Pérez, afiliado N.º 61-1',
    )
  })
})
