import { describe, expect, it } from 'vitest'
import { armarIcs, inicialesDe } from '../../supabase/functions/calendario/ics'

describe('calendario .ics', () => {
  it('iniciales', () => {
    expect(inicialesDe('Lucía', 'Pérez')).toBe('L. P.')
    expect(inicialesDe('ana maría', null)).toBe('A. M.')
  })

  it('un evento de día completo por sesión, solo con iniciales', () => {
    const ics = armarIcs(
      [
        { id: 's1', fecha: '2026-10-31', estado: 'normal', nombre: 'Lucía', apellido: 'Pérez' },
        { id: 's2', fecha: '2026-11-02', estado: 'ausente', nombre: 'Ana', apellido: 'Gómez' },
      ],
      'Sesión',
      new Date('2026-10-17T12:00:00Z'),
    )
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics).toContain('UID:s1@honorapp\r\nDTSTAMP:20261017T120000Z\r\nDTSTART;VALUE=DATE:20261031\r\nDTEND;VALUE=DATE:20261101')
    expect(ics).toContain('SUMMARY:Sesión · L. P.\r\n')
    expect(ics).toContain('SUMMARY:Sesión · A. G. (ausente)')
    expect(ics).not.toContain('Lucía')
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
  })
})
