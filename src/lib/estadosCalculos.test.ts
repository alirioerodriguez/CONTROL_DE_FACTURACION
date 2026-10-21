import { describe, expect, it } from 'vitest'
import type { Paciente, Pago, Sesion } from './datos'
import { resumenMes } from './inicio'
import { reporteMes } from './reportes'
import { deudaDe, saldosDe } from './resumen'

const hoy = '2026-10-16'
const paciente = { id: 'p', nombre: 'Lucía', apellido: 'Pérez', activo: true } as Paciente

function sesion(id: string, fecha: string, estado: Sesion['estado'] = 'normal'): Sesion {
  return { id, patient_id: 'p', fecha, horas: 1, tarifa_hora: 10000, monto: 10000, moneda: 'ARS', observaciones: null, estado, hora: null }
}

// Octubre: una realizada, una ausente, una cancelada y una programada (después de hoy).
const sesiones = [
  sesion('r', '2026-10-05'),
  sesion('a', '2026-10-12', 'ausente'),
  sesion('c', '2026-10-14', 'cancelada'),
  sesion('f', '2026-10-26'),
]
const pagos: Pago[] = []

describe('estados en los cálculos', () => {
  it('el saldo solo suma realizadas y ausentes', () => {
    expect(deudaDe(saldosDe('p', sesiones, pagos, hoy)).ARS).toBe(20000)
  })

  it('Inicio muestra lo programado aparte del pendiente', () => {
    const r = resumenMes('2026-10-01', [paciente], sesiones, pagos, hoy)
    expect(r.pendiente.ARS).toBe(20000)
    expect(r.programado.ARS).toBe(10000)
    expect(r.impagas.map((i) => i.sesion.id).sort()).toEqual(['a', 'r'])
    expect(r.sesionesDelMes).toBe(3)
  })

  it('el reporte del mes factura solo lo cobrable pero lista todas', () => {
    const { filas, totales } = reporteMes('2026-10-01', [paciente], sesiones, pagos, hoy)
    expect(filas[0].facturado).toBe(20000)
    expect(filas[0].sesiones.map((s) => s.estado)).toEqual(['pendiente', 'pendiente', 'cancelada', 'programada'])
    expect(filas[0].sesiones[1].ausente).toBe(true)
    expect(totales[0].sesiones).toBe(2)
  })

  it('un pago adelantado del mes cubre las realizadas y queda a favor el resto hasta que lleguen las programadas', () => {
    const conPago: Pago[] = [
      { id: 'g', patient_id: 'p', fecha: '2026-10-01', periodo: '2026-10-01', monto: 30000, moneda: 'ARS' } as Pago,
    ]
    expect(deudaDe(saldosDe('p', sesiones, conPago, hoy)).ARS).toBe(0)
    expect(deudaDe(saldosDe('p', sesiones, conPago, '2026-10-31')).ARS).toBe(0)
  })
})
