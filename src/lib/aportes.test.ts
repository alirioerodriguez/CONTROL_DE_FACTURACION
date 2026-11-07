import { describe, expect, it } from 'vitest'
import { candidatosParaHueco, faltasEnElAnio, franjaDe, mensajeReconfirmacion, type EnEspera } from './agendaHoy'
import { estadoPlan, LIMITE_GRATIS } from './planFreemium'
import { encolar, leerCola, sincronizar } from './colaOffline'

function memoria() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}

describe('agenda de hoy', () => {
  it('arma la reconfirmación con la palabra de cada profesión y sin hablar de seña', () => {
    const s = mensajeReconfirmacion('Lucía Fernández', 'mañana miércoles', '18:00')
    expect(s).toContain('Hola Lucía')
    expect(s).toContain('nuestra sesión de mañana miércoles a las 18:00 hs')
    expect(s.toLowerCase()).not.toContain('seña')
    expect(mensajeReconfirmacion('Tomás Ruiz', 'mañana jueves', '10:30', 'clase')).toContain('nuestra clase')
  })

  it('ofrece el hueco primero a quien coincide en día y franja', () => {
    const lista: EnEspera[] = [
      { id: 'a', nombre: 'Ana Mañana', telefono: '1', dias: [2], franja: 'manana', activo: true },
      { id: 'b', nombre: 'Sofía Viernes', telefono: '2', dias: [5], franja: 'tarde', activo: true },
      { id: 'c', nombre: 'Cualquiera Día', telefono: '3', dias: [], franja: 'manana', activo: true },
      { id: 'd', nombre: 'Inactiva', telefono: '4', dias: [5], franja: 'tarde', activo: false },
    ]
    const r = candidatosParaHueco(lista, 5, '17:00', 'hoy viernes')
    expect(r.map((c) => c.id)).toEqual(['b', 'c'])
    expect(r[0].mensaje).toContain('hoy viernes a las 17:00 hs')
    expect(franjaDe('12:59')).toBe('manana')
    expect(franjaDe('13:00')).toBe('tarde')
  })

  it('cuenta solo las faltas del año pedido', () => {
    const m = faltasEnElAnio(
      [
        { patient_id: 'p1', fecha: '2025-11-10', estado: 'ausente' },
        { patient_id: 'p1', fecha: '2026-03-14', estado: 'ausente' },
        { patient_id: 'p1', fecha: '2026-08-22', estado: 'ausente' },
        { patient_id: 'p1', fecha: '2026-09-01', estado: 'cancelada' },
        { patient_id: 'p2', fecha: '2026-09-01', estado: 'normal' },
      ],
      2026,
    )
    expect(m.get('p1')).toBe(2)
    expect(m.has('p2')).toBe(false)
  })
})

describe('plan gratis', () => {
  it('corta en 8 activos solo cuando el cobro esté activo', () => {
    expect(estadoPlan({ plan: 'gratis', activos: LIMITE_GRATIS, cobroActivo: true }).puedeSumarActivo).toBe(false)
    expect(estadoPlan({ plan: 'gratis', activos: LIMITE_GRATIS }).puedeSumarActivo).toBe(true)
    expect(estadoPlan({ plan: 'gratis', activos: 6, cobroActivo: true }).quedanGratis).toBe(2)
  })

  it('un Pro vencido vuelve a contar como gratis', () => {
    const ahora = new Date('2026-11-07T12:00:00Z')
    expect(estadoPlan({ plan: 'pro', proHasta: '2026-12-01T00:00:00Z', activos: 20, ahora, cobroActivo: true }).esPro).toBe(true)
    const vencido = estadoPlan({ plan: 'pro', proHasta: '2026-10-01T00:00:00Z', activos: 20, ahora, cobroActivo: true })
    expect(vencido.esPro).toBe(false)
    expect(vencido.mensaje).toContain('$ 6.900')
  })
})

describe('cola sin señal', () => {
  const base = { userId: 'u1', tipo: 'pago' as const, pacienteId: 'p1', fecha: '2026-11-06', moneda: 'ARS' as const, monto: 25000 }

  it('no duplica un borrador con la misma clave', () => {
    const st = memoria()
    encolar({ ...base, clave: 'k1' }, st)
    encolar({ ...base, clave: 'k1' }, st)
    expect(leerCola('u1', st)).toHaveLength(1)
  })

  it('al sincronizar descarta lo que el servidor ya tenía y guarda lo que falló', async () => {
    const st = memoria()
    encolar({ ...base, clave: 'nuevo' }, st)
    encolar({ ...base, clave: 'ya-estaba' }, st)
    encolar({ ...base, clave: 'falla' }, st)
    encolar({ ...base, userId: 'otra', clave: 'ajeno' }, st)
    const r = await sincronizar('u1', async (b) => {
      if (b.clave === 'falla') throw new Error('sin red')
      return b.clave === 'ya-estaba' ? 'repetido' : 'creado'
    }, st)
    expect(r).toEqual({ enviados: 1, repetidos: 1, pendientes: 1 })
    const quedan = leerCola('u1', st)
    expect(quedan[0].clave).toBe('falla')
    expect(quedan[0].intentos).toBe(1)
    expect(leerCola('otra', st)).toHaveLength(1)
  })
})
