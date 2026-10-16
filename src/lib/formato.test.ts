import { describe, expect, it } from 'vitest'
import {
  etiquetaDia, fechaLarga, formatFecha, formatMonto, formatPeriodo, hoyAR, iniciales, normalizar,
  completarPlantilla, formatCompacto, numeroWhatsApp, parseFechaAR, parseMontoAR, partesMonto, periodoDe, plural, sumarDias, sumarMeses,
} from './formato'

describe('formatMonto', () => {
  it('formatea pesos y dólares a la argentina', () => {
    expect(formatMonto(25000, 'ARS')).toBe('$ 25.000,00')
    expect(formatMonto(50, 'USD')).toBe('US$ 50,00')
    expect(formatMonto(1250000.5, 'ARS')).toBe('$ 1.250.000,50')
    expect(formatMonto(-3000, 'ARS')).toBe('-$ 3.000,00')
  })
})

describe('parseMontoAR', () => {
  it.each([
    ['25.000,50', 25000.5],
    ['25.000', 25000],
    ['1.250.000', 1250000],
    ['25000', 25000],
    ['25000,5', 25000.5],
    ['$ 25.000,00', 25000],
    ['US$ 50', 50],
    ['50.5', 50.5],
    [' 200000 ', 200000],
    [25000, 25000],
  ])('%s → %s', (entrada, esperado) => {
    expect(parseMontoAR(entrada)).toBe(esperado)
  })

  it.each(['', 'abc', '25,000.50', '1.2.3', '25.00.0', null, undefined])('rechaza %s', (entrada) => {
    expect(parseMontoAR(entrada)).toBeNull()
  })
})

describe('partesMonto', () => {
  it('separa los centavos', () => {
    expect(partesMonto(248000, 'ARS')).toEqual({ entero: '$ 248.000', decimales: ',00' })
    expect(partesMonto(90, 'USD')).toEqual({ entero: 'US$ 90', decimales: '' })
    expect(partesMonto(90.5, 'USD')).toEqual({ entero: 'US$ 90', decimales: ',50' })
  })
})

describe('textos', () => {
  it('etiquetas de fecha', () => {
    expect(etiquetaDia('2026-10-15')).toBe('Jue 15 oct')
    expect(fechaLarga('2026-10-15')).toBe('Jueves 15 de octubre')
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('iniciales, búsqueda y plural', () => {
    expect(iniciales('Lucía Fernández')).toBe('LF')
    expect(normalizar('Lucía')).toBe('lucia')
    expect(plural(1, 'sesión', 'sesiones')).toBe('1 sesión')
    expect(plural(3, 'sesión', 'sesiones')).toBe('3 sesiones')
  })
})

describe('formatCompacto y plantilla', () => {
  it('abrevia montos para el gráfico', () => {
    expect(formatCompacto(248000, 'ARS')).toBe('$ 248 mil')
    expect(formatCompacto(1250000, 'ARS')).toBe('$ 1,3 M')
    expect(formatCompacto(90, 'USD')).toBe('US$ 90')
    expect(formatCompacto(0, 'ARS')).toBe('')
  })

  it('completa la plantilla del recordatorio', () => {
    expect(
      completarPlantilla('Hola {nombre}, debés {monto} de {mes}. {Nombre}', {
        nombre: 'Lucía',
        mes: 'octubre',
        monto: '$ 50.000,00',
      }),
    ).toBe('Hola Lucía, debés $ 50.000,00 de octubre. Lucía')
    expect(completarPlantilla('', { nombre: 'Ana', mes: 'mayo', monto: '$ 1' })).toContain('Hola Ana')
  })
})

describe('numeroWhatsApp', () => {
  it.each([
    ['11 5423-8812', '5491154238812'],
    ['011 5423-8812', '5491154238812'],
    ['11 15 5423-8812', '5491154238812'],
    ['341 558-2201', '5493415582201'],
    ['5491154238812', '5491154238812'],
    ['54 11 5423 8812', '5491154238812'],
    ['+34 612 44 81 90', '34612448190'],
  ])('%s → %s', (entrada, esperado) => {
    expect(numeroWhatsApp(entrada)).toBe(esperado)
  })

  it('sin teléfono no hay link', () => {
    expect(numeroWhatsApp('')).toBeNull()
    expect(numeroWhatsApp('123')).toBeNull()
    expect(numeroWhatsApp(null)).toBeNull()
  })
})

describe('fechas', () => {
  it('parsea dd/mm/aaaa y variantes', () => {
    expect(parseFechaAR('04/03/2026')).toBe('2026-03-04')
    expect(parseFechaAR('4/3/26')).toBe('2026-03-04')
    expect(parseFechaAR('4-3-2026')).toBe('2026-03-04')
    expect(parseFechaAR('2026-03-04')).toBe('2026-03-04')
  })

  it('acepta fechas de Excel (Date y número de serie)', () => {
    expect(parseFechaAR(new Date('2026-03-04T00:00:00.000Z'))).toBe('2026-03-04')
    expect(parseFechaAR(46085)).toBe('2026-03-04')
  })

  it('rechaza fechas que no existen', () => {
    expect(parseFechaAR('31/02/2026')).toBeNull()
    expect(parseFechaAR('13/13/2026')).toBeNull()
    expect(parseFechaAR('03/04')).toBeNull()
    expect(parseFechaAR('hola')).toBeNull()
  })

  it('formatea y agrupa por mes', () => {
    expect(formatFecha('2026-03-04')).toBe('04/03/2026')
    expect(periodoDe('2026-03-17')).toBe('2026-03-01')
    expect(formatPeriodo('2026-03-01')).toBe('marzo 2026')
    expect(sumarMeses('2026-11-01', 3)).toBe('2027-02-01')
    expect(sumarMeses('2026-01-01', -1)).toBe('2025-12-01')
  })

  it('calcula hoy en hora argentina', () => {
    // 02:00 UTC del 1/4 todavía es 31/3 en Argentina (UTC-3).
    expect(hoyAR(new Date('2026-04-01T02:00:00Z'))).toBe('2026-03-31')
  })
})
