import { describe, expect, it } from 'vitest'
import { COBRO_ACTIVO, estadoPlan, LIMITE_GRATIS, puedeGuardarPacienteActivo } from './planFreemium'

const ochoActivos = Array.from({ length: LIMITE_GRATIS }, (_, i) => ({ id: `p${i}`, activo: true }))

describe('plan en el perfil y regla de 8 pacientes activos', () => {
  it('la bandera COBRO_ACTIVO está apagada por defecto y no corta a nadie', () => {
    expect(COBRO_ACTIVO).toBe(false)
    expect(estadoPlan({ plan: 'gratis', activos: 25 }).puedeSumarActivo).toBe(true)
    expect(
      puedeGuardarPacienteActivo({
        plan: 'gratis',
        pacientes: ochoActivos,
        activoNuevo: true,
      }).ok,
    ).toBe(true)
  })

  it('con cobroActivo prendido, frena el 9.º paciente activo en plan gratis pero deja editar los 8 actuales o crear inactivos', () => {
    const bloqueado = puedeGuardarPacienteActivo({
      plan: 'gratis',
      pacientes: ochoActivos,
      activoNuevo: true,
      cobroActivo: true,
    })
    expect(bloqueado.ok).toBe(false)
    expect(bloqueado.mensaje).toContain('8 pacientes activos')

    // Editar un paciente que ya era activo no se bloquea
    expect(
      puedeGuardarPacienteActivo({
        plan: 'gratis',
        pacientes: ochoActivos,
        pacienteActual: ochoActivos[0],
        activoNuevo: true,
        cobroActivo: true,
      }).ok,
    ).toBe(true)

    // Pasarlo a inactivo tampoco se bloquea
    expect(
      puedeGuardarPacienteActivo({
        plan: 'gratis',
        pacientes: ochoActivos,
        pacienteActual: ochoActivos[0],
        activoNuevo: false,
        cobroActivo: true,
      }).ok,
    ).toBe(true)
  })

  it('con plan Pro vigente permite superar los 8 pacientes activos', () => {
    expect(
      puedeGuardarPacienteActivo({
        plan: 'pro',
        proHasta: '2027-06-01T00:00:00Z',
        pacientes: ochoActivos,
        activoNuevo: true,
        cobroActivo: true,
        ahora: new Date('2026-11-09T12:00:00Z'),
      }).ok,
    ).toBe(true)
  })
})
