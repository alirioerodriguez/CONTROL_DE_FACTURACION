import { describe, expect, it } from 'vitest'
import type { Paciente, Pago, Sesion } from './datos'
import {
  armarFacturas,
  datosFactura,
  documentoReceptor,
  facturaDePago,
  montoParaArca,
  numeroSiguiente,
  pagosParaFacturar,
  pantallasArca,
  textoFactura,
} from './facturar'

const pac = (id: string, nombre: string, extra: Partial<Paciente> = {}) => ({ id, nombre, apellido: null, dni: null, cuil_cuit: null, condicion_iva: null, domicilio: null, ...extra }) as Paciente
const pago = (id: string, patient_id: string, fecha: string, monto: number, comprobante: Pago['comprobante'] = 'sin_comprobante', moneda: Pago['moneda'] = 'ARS', extra: Partial<Pago> = {}) =>
  ({ id, patient_id, fecha, periodo: `${fecha.slice(0, 7)}-01`, monto, moneda, comprobante, pagador: 'paciente', ...extra }) as Pago
const ses = (patient_id: string, fecha: string, estado: Sesion['estado'] = 'normal', moneda: Sesion['moneda'] = 'ARS') => ({ id: fecha, patient_id, fecha, moneda, estado }) as Sesion
const pal = { sesion: 'sesión', sesiones: 'sesiones' }

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

describe('una factura por paciente por mes', () => {
  const [lucia, ana] = pacientes
  const items = [
    { pago: pago('a1', 'a', '2026-10-02', 30000), paciente: lucia },
    { pago: pago('b1', 'b', '2026-10-03', 20000), paciente: ana },
    { pago: pago('a2', 'a', '2026-10-16', 30000), paciente: lucia },
    { pago: pago('a3', 'a', '2026-10-20', 40, 'sin_comprobante', 'USD'), paciente: lucia },
    { pago: pago('a4', 'a', '2026-10-21', 25000, 'sin_comprobante', 'ARS', { pagador: 'obra_social' }), paciente: lucia },
  ]
  const sesiones = [ses('a', '2026-10-02'), ses('a', '2026-10-09', 'ausente'), ses('a', '2026-10-16'), ses('a', '2026-10-23', 'cancelada'), ses('a', '2026-09-25')]

  it('suma los pagos del mes y cuenta las sesiones', () => {
    const fs = armarFacturas(items, true, sesiones)
    const lu = fs.find((f) => f.paciente.id === 'a' && f.moneda === 'ARS' && f.pagador === 'paciente')!
    expect(lu.pagos.map((p) => p.id)).toEqual(['a1', 'a2'])
    expect(lu.monto).toBe(60000)
    expect(lu.sesiones).toBe(3) // la ausente se cobra; la cancelada y la de septiembre no
    expect(datosFactura(lu, pal).find((d) => d.etiqueta === 'Descripción')?.valor).toBe('Honorarios profesionales: 3 sesiones de octubre 2026')
    expect(datosFactura(lu, pal).find((d) => d.etiqueta === 'Período facturado')?.valor).toBe('01/10/2026 al 31/10/2026')
  })

  it('nunca junta monedas ni paciente con obra social', () => {
    const fs = armarFacturas(items, true, sesiones)
    expect(fs.map((f) => f.pagos.map((p) => p.id))).toEqual([['a1', 'a2'], ['b1'], ['a3'], ['a4']])
  })

  it('por pago, una factura por cada uno (sin número de sesiones)', () => {
    const fs = armarFacturas(items, false, sesiones)
    expect(fs).toHaveLength(5)
    expect(fs[0].sesiones).toBeUndefined()
  })

  it('una sola sesión va en singular', () => {
    const [f] = armarFacturas([items[1]], true, [ses('b', '2026-10-03')])
    expect(datosFactura(f, pal).find((d) => d.etiqueta === 'Descripción')?.valor).toBe('Honorarios profesionales: 1 sesión de octubre 2026')
  })
})

describe('datos para ARCA', () => {
  it('documento: CUIT antes que DNI, solo números', () => {
    expect(documentoReceptor(pacientes[0])).toEqual({ tipo: 'DNI', numero: '30123456' })
    expect(documentoReceptor(pacientes[1])).toEqual({ tipo: 'CUIT', numero: '27301234564' })
    expect(documentoReceptor(pac('c', 'X'))).toBeNull()
  })

  it('texto para copiar', () => {
    expect(textoFactura(facturaDePago({ pago: pagos[0], paciente: pacientes[0] }), pal)).toBe(
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
    const d = datosFactura(facturaDePago({ pago: pagos[3], paciente: pacientes[1] }), pal)
    expect(d[d.length - 1].etiqueta).toBe('Moneda')
    expect(d.find((x) => x.etiqueta === 'Condición frente al IVA')?.valor).toBe('Monotributo')
  })

  it('si pagó la obra social, la factura va a su nombre', () => {
    const conOS = { ...pacientes[0], obra_social: 'OSDE 310', nro_afiliado: '61-1' }
    const d = datosFactura(facturaDePago({ pago: { ...pagos[0], pagador: 'obra_social' }, paciente: conOS }), pal)
    expect(d.find((x) => x.etiqueta === 'Receptor')?.valor).toBe('OSDE 310')
    expect(d.find((x) => x.etiqueta === 'Descripción')?.valor).toBe('Honorarios profesionales: sesiones de septiembre 2026 · Lucía Pérez, afiliado N.º 61-1')
  })
})

describe('modo ARCA', () => {
  const f = facturaDePago({ pago: pagos[0], paciente: pacientes[0] })

  it('las pantallas de Comprobantes en línea, en orden', () => {
    expect(pantallasArca(f, pal, '2026-10-20').map((p) => p.titulo)).toEqual([
      'Punto de venta y tipo de comprobante',
      'Datos de emisión',
      'Datos del receptor',
      'Datos de la operación',
      'Resumen',
    ])
  })

  it('resalta solo lo que cambia y pliega lo de siempre', () => {
    const campos = pantallasArca(f, pal, '2026-10-20').flatMap((p) => p.campos)
    const cambian = campos.filter((c) => c.cambia).map((c) => c.etiqueta)
    expect(cambian).toEqual(['Período facturado desde', 'Período facturado hasta', 'Tipo de documento', 'Número', 'Apellido y nombre', 'Producto / Servicio', 'Precio unitario', 'Importe total'])
    const fijos = campos.filter((c) => !c.cambia).map((c) => c.valor)
    expect(fijos).toEqual(expect.arrayContaining(['Servicios', 'Consumidor final', 'Contado', 'Factura C']))
  })

  it('copia los valores como los pide ARCA', () => {
    const campos = pantallasArca(f, pal, '2026-10-20').flatMap((p) => p.campos)
    const copia = (e: string) => campos.find((c) => c.etiqueta === e)?.copiar
    expect(copia('Número')).toBe('30123456')
    expect(copia('Período facturado desde')).toBe('01/09/2026')
    expect(copia('Precio unitario')).toBe('50000')
    expect(copia('Tipo de documento')).toBeUndefined() // se elige en una lista
    expect(copia('Importe total')).toBeUndefined()
    expect(montoParaArca(1234.5)).toBe('1234,50')
  })

  it('en dólares la moneda extranjera aparece resaltada', () => {
    const usd = facturaDePago({ pago: pagos[3], paciente: pacientes[1] })
    const emision = pantallasArca(usd, pal, '2026-10-20')[1].campos
    expect(emision.find((c) => c.etiqueta === 'Moneda extranjera')?.cambia).toBe(true)
  })

  it('propone el número siguiente', () => {
    expect(numeroSiguiente('C 00002-00000123')).toBe('C 00002-00000124')
    expect(numeroSiguiente('C 0002-00000999')).toBe('C 0002-00001000')
    expect(numeroSiguiente('sin número')).toBe('')
  })
})
