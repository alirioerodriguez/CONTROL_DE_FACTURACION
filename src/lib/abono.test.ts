import { describe, expect, it } from 'vitest'
import { aplicarAbono } from './abono'
import type { Paciente, Sesion } from './datos'
import { saldosDe } from './resumen'

const ses = (id: string, patient_id: string, fecha: string, estado: Sesion['estado'] = 'normal') =>
  ({ id, patient_id, fecha, horas: 1, tarifa_hora: 30000, monto: 30000, moneda: 'ARS', estado }) as Sesion

const conAbono = { id: 'a', moneda: 'ARS', abono_mensual: 100000 } as Paciente
const sinAbono = { id: 'b', moneda: 'ARS', abono_mensual: null } as Paciente

describe('aplicarAbono', () => {
  const sesiones = [
    ses('1', 'a', '2026-10-05'),
    ses('2', 'a', '2026-10-12'),
    ses('3', 'a', '2026-10-19', 'cancelada'),
    ses('4', 'a', '2026-10-26'),
    ses('5', 'a', '2026-11-02'),
    ses('6', 'b', '2026-10-05'),
  ]
  const r = aplicarAbono(sesiones, [conAbono, sinAbono])
  const monto = (id: string) => r.find((s) => s.id === id)!.monto

  it('reparte el abono entre las sesiones del mes, al centavo', () => {
    expect([monto('1'), monto('2'), monto('4')]).toEqual([33333.33, 33333.33, 33333.34])
    expect(monto('5')).toBe(100000)
  })

  it('no toca canceladas ni pacientes sin abono', () => {
    expect(monto('3')).toBe(30000)
    expect(monto('6')).toBe(30000)
  })

  it('el saldo del mes completo es el abono', () => {
    const s = saldosDe('a', r, [], '2026-10-31')
    expect(s[0].meses.map((m) => [m.periodo, m.cargo])).toEqual([['2026-10-01', 100000]])
  })

  it('sin pacientes con abono devuelve lo mismo', () => {
    expect(aplicarAbono(sesiones, [sinAbono])).toBe(sesiones)
  })
})
