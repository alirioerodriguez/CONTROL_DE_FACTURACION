import { describe, expect, it } from 'vitest'
import type { Paciente, Pago, Perfil, Sesion } from './datos'
import { datosWidgets, nombreCorto } from './widgetsApp'

const pac = (id: string, nombre: string, apellido: string | null) => ({ id, nombre, apellido, moneda: 'ARS', activo: true }) as unknown as Paciente
const ses = (id: string, pid: string, fecha: string, monto: number, hora: string | null = null, estado = 'normal') =>
  ({ id, patient_id: pid, fecha, hora, horas: 1, tarifa_hora: monto, monto, moneda: 'ARS', estado }) as unknown as Sesion
const pago = (id: string, pid: string, fecha: string, monto: number, moneda = 'ARS') =>
  ({ id, patient_id: pid, fecha, periodo: `${fecha.slice(0, 7)}-01`, monto, moneda }) as unknown as Pago
const perfil = (cat: string | null = 'D') => ({ id: 'u', monotributo_categoria: cat, tipo_cambio_usd: null }) as unknown as Perfil

const pacientes = [pac('juan', 'Juan Carlos', 'Pérez'), pac('ana', 'Ana', 'Gómez'), pac('tomi', 'Tomás', null)]
const sesiones = [
  ses('s1', 'juan', '2026-10-06', 45000),
  ses('s2', 'juan', '2026-11-03', 45000),
  ses('s3', 'ana', '2026-11-04', 30000),
  ses('s4', 'tomi', '2026-11-05', 25000),
  // hoy: 10:00 ya pasó, 15:00 es la próxima, 18:00 después, y una cancelada que no cuenta
  ses('h1', 'ana', '2026-11-20', 30000, '10:00:00'),
  ses('h2', 'juan', '2026-11-20', 45000, '15:00:00'),
  ses('h3', 'tomi', '2026-11-20', 25000, '18:00:00'),
  ses('h4', 'tomi', '2026-11-20', 25000, '12:00:00', 'cancelada'),
]
const pagos = [pago('p1', 'tomi', '2026-11-06', 25000), pago('p2', 'ana', '2026-11-10', 100, 'USD')]
const op = { hoy: '2026-11-20', ahora: '14:20', oculto: false, iniciales: false }
const d = datosWidgets({ perfil: perfil(), pacientes, sesiones, pagos }, op)

describe('widgets del celular', () => {
  it('nombres cortos: nombre e inicial del apellido, o solo iniciales', () => {
    expect(nombreCorto(pacientes[0], false)).toBe('Juan P.')
    expect(nombreCorto(pacientes[0], true)).toBe('J. P.')
    expect(nombreCorto(pacientes[2], false)).toBe('Tomás')
  })

  it('cobros del mes: pesos y dólares por separado', () => {
    expect(d.mes).toBe('noviembre')
    expect(d.cobros.cobrado).toMatch(/25\.000/)
    expect(d.cobros.usd).toMatch(/US\$\s?100/)
    expect(d.cobros.pct).toBeGreaterThan(0)
    expect(d.cobros.pct).toBeLessThan(100)
  })

  it('quién debe: de lo que más debe a lo que menos, con los meses', () => {
    expect(d.deben.lista[0]).toMatchObject({ nombre: 'Juan P.', meses: 'oct y nov', variosMeses: true })
    expect(d.deben.lista[0].monto).toMatch(/135\.000/) // oct, nov y la de hoy (cuenta como en Inicio)
    expect(d.deben.lista.map((x) => x.nombre)).toContain('Ana G.')
    expect(d.deben.variosMeses).toBe(1)
  })

  it('hoy: por hora, lo pasado hecho, la próxima marcada y sin las canceladas', () => {
    expect(d.hoy.dia).toBe('viernes 20')
    expect(d.hoy.turnos.map((t) => t.hora)).toEqual(['10:00', '15:00', '18:00'])
    expect(d.hoy.turnos[0].hecho).toBe(true)
    expect(d.hoy.turnos[1]).toMatchObject({ proxima: true, enMin: 40 })
    expect(d.hoy.faltan).toBe(2)
  })

  it('monotributo: solo si lo usa', () => {
    expect(d.mono).toMatchObject({ categoria: 'D', estado: 'bien', recat: 'enero' })
    expect(datosWidgets({ perfil: perfil('no'), pacientes, sesiones, pagos }, op).mono).toBeNull()
  })

  it('«ocultar montos» tapa todas las cifras y «solo iniciales» los nombres', () => {
    const o = datosWidgets({ perfil: perfil(), pacientes, sesiones, pagos }, { ...op, oculto: true, iniciales: true })
    expect([o.cobros.cobrado, o.cobros.esperado, o.cobros.deben, o.cobros.usd, o.deben.total, o.mono?.cobrado]).toEqual(Array(6).fill('•••••'))
    expect(o.deben.lista.every((x) => x.monto === '•••••')).toBe(true)
    expect(o.deben.lista[0].nombre).toBe('J. P.')
    expect(o.hoy.turnos[1].nombre).toBe('J. P.')
  })
})
