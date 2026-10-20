import { describe, expect, it } from 'vitest'
import type { Paciente, Pago } from './datos'
import type { ParaFacturar } from './facturar'
import { armarHoja, leerCsv } from './importar/leer'
import { cruzarMisComprobantes, encabezadoMisComprobantes, leerMisComprobantes } from './misComprobantes'

const pac = (id: string, nombre: string, extra: Partial<Paciente> = {}) =>
  ({ id, nombre, apellido: null, dni: null, cuil_cuit: null, condicion_iva: null, obra_social: null, nro_afiliado: null, ...extra }) as Paciente
const pago = (id: string, patient_id: string, fecha: string, monto: number, extra: Partial<Pago> = {}) =>
  ({ id, patient_id, fecha, periodo: `${fecha.slice(0, 7)}-01`, monto, moneda: 'ARS', comprobante: 'sin_comprobante', pagador: 'paciente', ...extra }) as Pago

// Encabezado de Mis Comprobantes Emitidos: el mismo del CSV real de Recibidos, con los datos del receptor en lugar de los del emisor.
const ENCABEZADO =
  '"Fecha de Emisión";"Tipo de Comprobante";"Punto de Venta";"Número Desde";"Número Hasta";"Cód. Autorización";"Tipo Doc. Receptor";"Nro. Doc. Receptor";"Denominación Receptor";"Tipo Cambio";"Moneda";"Imp. Neto Gravado IVA 0%";"IVA 2,5%";"Imp. Neto Gravado IVA 2,5%";"IVA 5%";"Imp. Neto Gravado IVA 5%";"IVA 10,5%";"Imp. Neto Gravado IVA 10,5%";"IVA 21%";"Imp. Neto Gravado IVA 21%";"IVA 27%";"Imp. Neto Gravado IVA 27%";"Imp. Neto Gravado Total";"Imp. Neto No Gravado";"Imp. Op. Exentas";"Otros Tributos";"Total IVA";"Imp. Total"'
const ceros = Array(16).fill('0,00').join(';')
const fila = (fecha: string, tipo: number, pv: number, nro: number, tipoDoc: number, doc: string, nombre: string, total: string, moneda = '$', cambio = '1,00') =>
  `${fecha};${tipo};${pv};${nro};${nro};75000000000000;${tipoDoc};${doc};${nombre};${cambio};${moneda};${ceros};${total}`

const lucia = pac('a', 'Lucía', { apellido: 'Pérez', dni: '30.123.456' })
const ana = pac('b', 'Ana', { apellido: 'Gómez', cuil_cuit: '27-30999888-1' })
const items: ParaFacturar[] = [
  { pago: pago('1', 'a', '2026-10-02', 30000), paciente: lucia },
  { pago: pago('2', 'a', '2026-10-16', 30000), paciente: lucia },
  { pago: pago('3', 'b', '2026-10-05', 30000), paciente: ana },
  { pago: pago('4', 'b', '2026-10-06', 80, { moneda: 'USD' }), paciente: ana },
]

async function hoja(...filas: string[]) {
  const [h] = await leerCsv([ENCABEZADO, ...filas].join('\n'), 'mis comprobantes')
  return h
}

describe('Mis Comprobantes → Emitidos', () => {
  it('lee las Facturas C con su número y deja afuera las notas de crédito', async () => {
    const r = leerMisComprobantes(await hoja(fila('2026-10-31', 11, 2, 45, 96, '30123456', 'PEREZ LUCIA', '60000,00'), fila('2026-10-31', 13, 2, 3, 96, '30123456', 'PEREZ LUCIA', '1000,00')))
    expect(r.error).toBeNull()
    expect(r.otros).toBe(1)
    expect(r.comprobantes).toEqual([
      { fecha: '2026-10-31', numero: 'C 00002-00000045', documento: '30123456', receptor: 'PEREZ LUCIA', moneda: 'ARS', total: 60000, totalEnMoneda: 60000 },
    ])
  })

  it('cruza una factura mensual con todos los pagos del mes y una por pago con uno solo', async () => {
    const r = cruzarMisComprobantes(
      await hoja(
        fila('2026-10-31', 11, 2, 45, 96, '30123456', 'PEREZ LUCIA', '60000,00'),
        fila('2026-10-06', 11, 2, 46, 86, '27309998881', 'GOMEZ ANA', '30000,00'),
      ),
      items,
    )
    expect(r.coincidencias.map((c) => [c.factura.pagos.map((p) => p.id), c.comprobante.numero])).toEqual([
      [['3'], 'C 00002-00000046'],
      [['1', '2'], 'C 00002-00000045'],
    ])
    expect(r.sinCruzar).toBe(0)
  })

  it('el documento decide: mismo importe pero otro DNI no se marca', async () => {
    const r = cruzarMisComprobantes(await hoja(fila('2026-10-05', 11, 2, 47, 96, '11222333', 'OTRA PERSONA', '30000,00')), items)
    expect(r.coincidencias).toHaveLength(0)
    expect(r.sinCruzar).toBe(1)
  })

  it('el DNI de la factura sirve aunque la paciente tenga CUIL', async () => {
    const r = cruzarMisComprobantes(await hoja(fila('2026-10-05', 11, 2, 48, 96, '30999888', 'GOMEZ ANA', '30000,00')), items)
    expect(r.coincidencias.map((c) => c.factura.pagos[0].id)).toEqual(['3'])
  })

  it('en dólares compara con el total dividido por el tipo de cambio', async () => {
    const r = cruzarMisComprobantes(await hoja(fila('2026-10-07', 11, 2, 49, 80, '27309998881', 'GOMEZ ANA', '96000,00', 'DOL', '1200,000000')), items)
    expect(r.coincidencias.map((c) => [c.factura.pagos[0].id, c.factura.moneda])).toEqual([['4', 'USD']])
  })

  it('fuera de fecha no coincide', async () => {
    const r = cruzarMisComprobantes(await hoja(fila('2027-01-20', 11, 2, 50, 96, '30123456', 'PEREZ LUCIA', '30000,00')), items)
    expect(r.coincidencias).toHaveLength(0)
  })

  it('el Excel con un título arriba del encabezado también se lee', () => {
    const encabezado = ENCABEZADO.split(';').map((e) => e.replace(/"/g, ''))
    const datos = fila('2026-10-06', 11, 2, 46, 86, '27309998881', 'GOMEZ ANA', '30000,00').split(';')
    const h = armarHoja('Mis Comprobantes', [['Mis Comprobantes Emitidos - CUIT 20111111112'], encabezado, datos], encabezadoMisComprobantes)
    expect(leerMisComprobantes(h).comprobantes.map((c) => c.numero)).toEqual(['C 00002-00000046'])
  })

  it('avisa si suben el de Recibidos', () => {
    const h = armarHoja('x', [['Fecha de Emisión', 'Tipo de Comprobante', 'Número Desde', 'Denominación Emisor', 'Imp. Total']])
    expect(leerMisComprobantes(h).error).toMatch(/Recibidos/)
  })
})
