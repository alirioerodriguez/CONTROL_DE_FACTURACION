import { describe, expect, it } from 'vitest'
import type { Paciente, Pago, Sesion } from './datos'
import { mesesEntre, reporteContadora, reporteMes } from './reportes'

const pac = (id: string, nombre: string) => ({ id, nombre, apellido: null, activo: true }) as Paciente
let n = 0
const ses = (patient_id: string, fecha: string, monto: number, moneda: 'ARS' | 'USD' = 'ARS') =>
  ({ id: `s${++n}`, patient_id, fecha, monto, moneda }) as Sesion
const pago = (
  patient_id: string,
  fecha: string,
  monto: number,
  extra: Partial<Pago> = {},
): Pago => ({ id: `p${++n}`, patient_id, fecha, periodo: `${fecha.slice(0, 7)}-01`, monto, moneda: 'ARS', medio: 'transferencia', nro_factura: null, ...extra }) as Pago

const pacientes = [pac('a', 'Lucía'), pac('b', 'Martín')]

describe('reporteMes', () => {
  it('arma una fila por paciente y moneda con el estado de cada sesión', () => {
    const r = reporteMes(
      '2026-10-01',
      pacientes,
      [ses('a', '2026-10-05', 50000), ses('a', '2026-10-12', 50000), ses('b', '2026-10-07', 40, 'USD'), ses('b', '2026-09-07', 40, 'USD')],
      [pago('a', '2026-10-13', 70000), pago('b', '2026-10-02', 40, { moneda: 'USD', periodo: '2026-09-01' })],
    )
    expect(r.filas.map((f) => [f.nombre, f.moneda, f.facturado, f.cobrado, f.pendiente])).toEqual([
      ['Lucía', 'ARS', 100000, 70000, 30000],
      ['Martín', 'USD', 40, 0, 40],
    ])
    expect(r.filas[0].sesiones.map((s) => s.estado)).toEqual(['pagada', 'parcial'])
    expect(r.totales).toEqual([
      { moneda: 'ARS', sesiones: 2, facturado: 100000, cobrado: 70000, pendiente: 30000 },
      { moneda: 'USD', sesiones: 1, facturado: 40, cobrado: 0, pendiente: 40 },
    ])
  })

  it('un mes sin sesiones no tiene filas', () => {
    expect(reporteMes('2026-11-01', pacientes, [], [])).toEqual({ filas: [], totales: [] })
  })
})

describe('reporteContadora', () => {
  const pagos = [
    pago('a', '2026-09-03', 50000, { medio: 'efectivo' }),
    pago('a', '2026-10-05', 50000, { nro_factura: 'C 0002-00000123' }),
    pago('b', '2026-10-10', 30000, { medio: 'mercadopago' }),
    pago('b', '2026-10-11', 40, { moneda: 'USD' }),
    pago('a', '2025-09-01', 99999), // fuera de los últimos 12 meses
  ]

  it('agrupa por mes de pago, moneda y medio, con cantidad de facturas', () => {
    const r = reporteContadora('2026-09-01', '2026-10-01', '2026-10-16', pacientes, pagos)
    expect(r.meses.map((m) => m.periodo)).toEqual(['2026-09-01', '2026-10-01'])
    const oct = r.meses[1].porMoneda
    expect(oct.ARS).toMatchObject({ total: 80000, cantidad: 2, conFactura: 1 })
    expect(oct.ARS.medios).toEqual({ efectivo: 0, transferencia: 50000, mercadopago: 30000, otro: 0 })
    expect(oct.USD.total).toBe(40)
    expect(r.meses[1].pagos.map((p) => p.paciente)).toEqual(['Lucía', 'Martín', 'Martín'])
    expect(r.totales.ARS.total).toBe(130000)
    expect(r.cantidadPagos).toBe(4)
  })

  it('suma los últimos 12 meses hasta hoy', () => {
    const r = reporteContadora('2026-10-01', '2026-10-01', '2026-10-16', pacientes, pagos)
    expect(r.rango12).toEqual({ desde: '2025-11-01', hasta: '2026-10-01' })
    expect(r.ultimos12.ARS.total).toBe(130000)
    expect(r.ultimos12.USD.total).toBe(40)
  })

  it('lista los meses entre dos fechas', () => {
    expect(mesesEntre('2025-11-01', '2026-02-01')).toEqual(['2025-11-01', '2025-12-01', '2026-01-01', '2026-02-01'])
    expect(mesesEntre('2026-05-01', '2026-04-01')).toEqual([])
  })
})
