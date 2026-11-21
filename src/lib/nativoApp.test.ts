import { describe, expect, it } from 'vitest'
import type { Paciente, Pago, Perfil, Sesion } from './datos'
import { datosInicioNativo, datosPacientesNativo } from './nativoApp'

const pac = (id: string, nombre: string, apellido: string | null, extra: Partial<Paciente> = {}) =>
  ({ id, nombre, apellido, moneda: 'ARS', activo: true, obra_social: null, frecuencia: null, ...extra }) as unknown as Paciente
const ses = (id: string, pid: string, fecha: string, monto: number, hora: string | null = null, estado = 'normal') =>
  ({ id, patient_id: pid, fecha, hora, horas: 1, tarifa_hora: monto, monto, moneda: 'ARS', estado }) as unknown as Sesion
const pago = (id: string, pid: string, fecha: string, monto: number) =>
  ({ id, patient_id: pid, fecha, periodo: `${fecha.slice(0, 7)}-01`, monto, moneda: 'ARS' }) as unknown as Pago
const perfil = { id: 'u', nombre: 'Silvi', monotributo_categoria: null, tipo_cambio_usd: null } as unknown as Perfil

const pacientes = [pac('juan', 'Juan', 'Pérez', { obra_social: 'OSDE' }), pac('ana', 'Ana', 'Gómez'), pac('tomi', 'Tomás', null, { activo: false })]
const sesiones = [
  ses('s1', 'juan', '2026-10-06', 45000),
  ses('s2', 'juan', '2026-11-03', 45000),
  ses('s3', 'ana', '2026-11-04', 30000),
  ses('h1', 'ana', '2026-11-20', 30000, '10:00:00'),
  ses('h2', 'juan', '2026-11-20', 45000, '15:00:00'),
  ses('h3', 'ana', '2026-11-20', 30000, '12:00:00', 'cancelada'),
]
const pagos = [pago('p1', 'ana', '2026-11-10', 60000)]
const op = { hoy: '2026-11-20', ahora: '14:20', oculto: false }

describe('pantallas nativas de la app', () => {
  const d = datosInicioNativo({ perfil, pacientes, sesiones, pagos }, op)

  it('Inicio: los turnos de hoy llevan el nombre del paciente, por hora y sin las canceladas', () => {
    expect(d.hoy.turnos.map((t) => [t.hora, t.paciente, t.hecho, t.proxima])).toEqual([
      ['10:00', 'Ana Gómez', true, false],
      ['15:00', 'Juan Pérez', false, true],
    ])
    expect(d.hoy.turnos[1].pacienteId).toBe('juan')
  })

  it('Inicio: quién debe, con nombre y de más a menos', () => {
    expect(d.deben.lista[0]).toMatchObject({ id: 'juan', nombre: 'Juan Pérez', variosMeses: true })
    expect(d.deben.lista[0].monto).toMatch(/135\.000/)
    expect(d.nombre).toBe('Silvi')
  })

  it('«ocultar montos» tapa las cifras', () => {
    const o = datosInicioNativo({ perfil, pacientes, sesiones, pagos }, { ...op, oculto: true })
    expect(o.deben.lista.every((x) => x.monto.includes('•••••'))).toBe(true)
    expect(o.cobros.cobrado).toContain('•••••')
  })

  it('Pacientes: activos primero, por nombre, con lo que deben', () => {
    const l = datosPacientesNativo({ pacientes, sesiones, pagos }, op)
    expect(l.map((p) => p.nombre)).toEqual(['Ana Gómez', 'Juan Pérez', 'Tomás'])
    expect(l[1]).toMatchObject({ sub: 'OSDE', debe: true })
    expect(l[2].sub).toBe('inactivo')
  })
})
