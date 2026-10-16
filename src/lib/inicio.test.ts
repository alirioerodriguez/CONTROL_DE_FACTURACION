import { describe, expect, it } from 'vitest'
import type { Paciente, Pago, Sesion } from './datos'
import { resumenMes } from './inicio'

const pac = (id: string, activo = true) => ({ id, activo }) as Paciente
let n = 0
const ses = (patient_id: string, fecha: string, monto: number, moneda: 'ARS' | 'USD' = 'ARS') =>
  ({ id: `s${++n}`, patient_id, fecha, monto, moneda, horas: 1, tarifa_hora: monto }) as Sesion
const pago = (patient_id: string, fecha: string, periodo: string, monto: number, moneda: 'ARS' | 'USD' = 'ARS') =>
  ({ id: `p${++n}`, patient_id, fecha, periodo, monto, moneda, medio: 'transferencia' }) as Pago

describe('resumenMes', () => {
  const pacientes = [pac('a'), pac('b'), pac('c', false)]
  const sesiones = [
    ses('a', '2026-10-05', 50000),
    ses('a', '2026-10-12', 50000),
    ses('b', '2026-10-07', 40, 'USD'),
    ses('b', '2026-09-07', 40, 'USD'),
  ]
  const pagos = [
    pago('a', '2026-10-13', '2026-10-01', 70000),
    pago('b', '2026-10-02', '2026-09-01', 40, 'USD'),
    pago('a', '2026-08-20', '2026-08-01', 10000),
  ]
  const r = resumenMes('2026-10-01', pacientes, sesiones, pagos)

  it('suma lo cobrado en el mes por fecha de pago y por moneda', () => {
    expect(r.cobrado).toEqual({ ARS: 70000, USD: 40 })
    expect(r.cantPagos).toEqual({ ARS: 1, USD: 1 })
  })

  it('calcula lo pendiente de las sesiones del mes', () => {
    // a: 100.000 de sesiones, 70.000 pagados (más 10.000 a favor de agosto, que cancela 10.000 más).
    expect(r.pendiente.ARS).toBe(20000)
    expect(r.pendiente.USD).toBe(40)
  })

  it('cuenta pacientes y lista las sesiones impagas de la más nueva a la más vieja', () => {
    expect(r.pacientesConSesiones).toBe(2)
    expect(r.pacientesActivos).toBe(2)
    expect(r.impagas.map((i) => [i.sesion.fecha, i.debe, i.estado])).toEqual([
      ['2026-10-12', 20000, 'parcial'],
      ['2026-10-07', 40, 'pendiente'],
    ])
  })

  it('arma 6 barras terminando en el mes elegido', () => {
    expect(r.barras.map((b) => b.periodo)).toEqual([
      '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01',
    ])
    expect(r.barras[3].cobrado.ARS).toBe(10000)
    expect(r.barras[5].cobrado).toEqual({ ARS: 70000, USD: 40 })
  })
})
