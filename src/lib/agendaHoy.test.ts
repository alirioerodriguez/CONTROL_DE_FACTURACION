import { describe, expect, it } from 'vitest'
import { guardarEspera, huecosLiberados, leerConfirmadas, leerEspera, marcarConfirmada, paraReconfirmar, type EnEspera } from './agendaHoy'

function memoria() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}

const s = (id: string, fecha: string, hora: string | null, estado: 'normal' | 'ausente' | 'cancelada' = 'normal') => ({ id, patient_id: 'p' + id, fecha, hora, estado })

describe('pantalla agenda de hoy', () => {
  it('reconfirma solo las de mañana que siguen en pie, por hora y las sin hora al final', () => {
    const r = paraReconfirmar([s('a', '2026-11-10', '18:00'), s('b', '2026-11-10', null), s('c', '2026-11-10', '09:30'), s('d', '2026-11-10', '11:00', 'cancelada'), s('e', '2026-11-11', '08:00')], '2026-11-10')
    expect(r.map((x) => x.id)).toEqual(['c', 'a', 'b'])
  })

  it('los huecos son cancelaciones con hora entre hoy y el tope', () => {
    const r = huecosLiberados([s('a', '2026-11-09', '10:00', 'cancelada'), s('b', '2026-11-08', '10:00', 'cancelada'), s('c', '2026-11-12', null, 'cancelada'), s('d', '2026-11-11', '09:00', 'cancelada'), s('e', '2026-11-20', '09:00', 'cancelada'), s('f', '2026-11-10', '09:00')], '2026-11-09', '2026-11-16')
    expect(r.map((x) => x.id)).toEqual(['a', 'd'])
  })

  it('la lista de espera queda separada por usuaria y sobrevive a datos rotos', () => {
    const st = memoria()
    const ana: EnEspera = { id: '1', nombre: 'Ana', telefono: '11 5555-0000', dias: [1], franja: 'tarde', activo: true }
    guardarEspera('u1', [ana], st)
    guardarEspera('u2', [], st)
    expect(leerEspera('u1', st)).toEqual([ana])
    expect(leerEspera('u2', st)).toEqual([])
    st.setItem('honorapp_espera_v1', '{roto')
    expect(leerEspera('u1', st)).toEqual([])
  })

  it('las confirmaciones se olvidan cuando la fecha ya pasó', () => {
    const st = memoria()
    marcarConfirmada('u1', 'a', '2026-11-10', true, '2026-11-09', st)
    marcarConfirmada('u1', 'b', '2026-11-10', true, '2026-11-09', st)
    marcarConfirmada('u1', 'b', '2026-11-10', false, '2026-11-09', st)
    expect([...leerConfirmadas('u1', '2026-11-09', st)]).toEqual(['a'])
    expect([...leerConfirmadas('u1', '2026-11-11', st)]).toEqual([])
    expect([...leerConfirmadas('u2', '2026-11-09', st)]).toEqual([])
  })
})
