// Arma el calendario (formato iCalendar / .ics) con las sesiones, para suscribirse desde Google Calendar,
// el calendario del iPhone u Outlook. Por privacidad solo van las iniciales del paciente.

export interface SesionCalendario {
  id: string
  fecha: string // AAAA-MM-DD
  estado: string // 'normal' | 'ausente' (las canceladas no se mandan)
  nombre: string
  apellido: string | null
}

/** 'Lucía Pérez' → 'L. P.' */
export function inicialesDe(nombre: string, apellido: string | null): string {
  return `${nombre} ${apellido ?? ''}`
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => `${p[0].toLocaleUpperCase('es-AR')}.`)
    .join(' ')
}

const sinGuiones = (fecha: string) => fecha.replace(/-/g, '')

function diaSiguiente(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** Escapa texto según RFC 5545. */
const escapar = (t: string) => t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')

export function armarIcs(sesiones: SesionCalendario[], palabra: string, ahora: Date = new Date()): string {
  const sello = ahora.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const eventos = sesiones.map((s) =>
    [
      'BEGIN:VEVENT',
      `UID:${s.id}@honorapp`,
      `DTSTAMP:${sello}`,
      `DTSTART;VALUE=DATE:${sinGuiones(s.fecha)}`,
      `DTEND;VALUE=DATE:${sinGuiones(diaSiguiente(s.fecha))}`,
      `SUMMARY:${escapar(`${palabra} · ${inicialesDe(s.nombre, s.apellido)}${s.estado === 'ausente' ? ' (ausente)' : ''}`)}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    ].join('\r\n'),
  )
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//honorapp//calendario//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapar(`honorapp · ${palabra === 'Consulta' ? 'consultas' : 'sesiones'}`)}`,
    'X-WR-TIMEZONE:America/Argentina/Buenos_Aires',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    ...eventos,
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}
