import { describe, expect, it } from 'vitest'
import type { Paciente, Pago, Perfil, Sesion } from './datos'
import { agendaDeCobrosHoy, linkRecordatorio, mensajeRecordatorio, porRecordar, textoMeses } from './recordatorios'

const pac = (id: string, nombre: string, telefono: string | null = null) => ({ id, nombre, telefono }) as Paciente
const ses = (id: string, patient_id: string, fecha: string, monto: number, moneda: 'ARS' | 'USD' = 'ARS') =>
  ({ id, patient_id, fecha, monto, moneda, horas: 1, tarifa_hora: monto, estado: 'normal' }) as Sesion
const pago = (patient_id: string, periodo: string, monto: number) => ({ id: 'g', patient_id, periodo, monto, moneda: 'ARS' }) as Pago

const pacientes = [pac('a', 'Lucía Pérez', '11 5423-8812'), pac('b', 'Ana Gómez'), pac('c', 'Sofía Ruiz')]
const sesiones = [
  ses('1', 'a', '2026-09-07', 50000),
  ses('2', 'a', '2026-10-05', 50000),
  ses('3', 'b', '2026-10-06', 40000),
  ses('4', 'c', '2026-10-06', 40000),
]
const pagos = [pago('c', '2026-10-01', 40000)]

describe('porRecordar', () => {
  it('lista solo a quien debe, primero la deuda más vieja', () => {
    const r = porRecordar(pacientes, sesiones, pagos, '2026-10-17')
    expect(r.map((x) => [x.paciente.id, x.deuda.ARS, x.meses])).toEqual([
      ['a', 100000, ['2026-09-01', '2026-10-01']],
      ['b', 40000, ['2026-10-01']],
    ])
  })

  it('no cuenta las sesiones que todavía no pasaron', () => {
    expect(porRecordar(pacientes, sesiones, pagos, '2026-10-04')[0].deuda.ARS).toBe(50000)
  })
})

describe('mensaje', () => {
  const perfil = { plantilla_whatsapp: 'Hola {nombre}, te recuerdo {mes}: {monto}.', datos_pago: 'alias ana.psi' } as Perfil

  it('textoMeses', () => {
    expect(textoMeses(['2026-10-01'])).toBe('octubre')
    expect(textoMeses(['2026-08-01', '2026-09-01', '2026-10-01'])).toBe('agosto, septiembre y octubre')
    expect(textoMeses(['2025-12-01', '2026-01-01'])).toBe('diciembre 2025 y enero 2026')
  })

  it('completa la plantilla con todos los meses y los datos de pago', () => {
    const [lucia, ana] = porRecordar(pacientes, sesiones, pagos, '2026-10-17')
    expect(mensajeRecordatorio(lucia, perfil)).toBe(
      'Hola Lucía, te recuerdo septiembre y octubre: $ 100.000,00.\n\nDatos para el pago: alias ana.psi',
    )
    expect(linkRecordatorio(lucia, perfil)).toMatch(/^https:\/\/wa\.me\/5491154238812\?text=/)
    expect(linkRecordatorio(ana, perfil)).toBeNull()
  })
})

describe('agendaDeCobrosHoy', () => {
  const hoy = '2026-10-17'
  const conHora = (id: string, patient_id: string, fecha: string, hora: string | null, estado: 'normal' | 'cancelada' = 'normal') =>
    ({ ...ses(id, patient_id, fecha, 40000), hora, estado }) as Sesion
  it('solo quienes tienen cita hoy y deben, por hora', () => {
    const s = [
      conHora('1', 'a', '2026-10-05', null),
      conHora('2', 'a', hoy, '18:00'),
      conHora('3', 'b', '2026-10-06', null),
      conHora('4', 'b', hoy, '09:30'),
      conHora('5', 'c', hoy, '10:00'),
    ]
    const r = agendaDeCobrosHoy(pacientes, s, [pago('c', '2026-10-01', 40000)], hoy)
    expect(r.map((x) => x.paciente.id)).toEqual(['b', 'a'])
  })
  it('ignora la cita cancelada de hoy y la de otro día', () => {
    const s = [conHora('1', 'a', '2026-10-05', null), conHora('2', 'a', hoy, '18:00', 'cancelada'), conHora('3', 'b', '2026-10-16', '10:00')]
    expect(agendaDeCobrosHoy(pacientes, s, [], hoy)).toEqual([])
  })
})
