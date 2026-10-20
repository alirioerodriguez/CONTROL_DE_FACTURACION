import { describe, expect, it } from 'vitest'
import type { Paciente } from './datos'
import {
  coincideDocumento, cuilCoincideConDni, cuilValido, dniValido, formatCuil, formatDni, normalizarDocumentos, pacienteConMismoDocumento,
  sugerirCuil,
} from './documentos'

describe('DNI', () => {
  it('acepta 7 u 8 números, con o sin puntos', () => {
    expect(dniValido('30123456')).toBe(true)
    expect(dniValido('30.123.456')).toBe(true)
    expect(dniValido('5123456')).toBe(true)
    expect(dniValido('123456')).toBe(false)
    expect(dniValido('301234567')).toBe(false)
    expect(dniValido('')).toBe(false)
  })
  it('se muestra con puntos', () => {
    expect(formatDni('30123456')).toBe('30.123.456')
    expect(formatDni('5123456')).toBe('5.123.456')
    expect(formatDni(null)).toBe('')
  })
})

describe('CUIL / CUIT', () => {
  it('valida el dígito verificador', () => {
    expect(cuilValido('20-12345678-6')).toBe(true)
    expect(cuilValido('20123456786')).toBe(true)
    expect(cuilValido('20-12345678-5')).toBe(false)
    expect(cuilValido('20-30123456-3')).toBe(true)
    expect(cuilValido('27-30123456-8')).toBe(true)
  })
  it('rechaza prefijos desconocidos y largos incorrectos', () => {
    expect(cuilValido('21-12345678-6')).toBe(false)
    expect(cuilValido('20-1234567-6')).toBe(false)
  })
  it('se muestra XX-XXXXXXXX-X, también mientras se escribe', () => {
    expect(formatCuil('20123456786')).toBe('20-12345678-6')
    expect(formatCuil('20')).toBe('20')
    expect(formatCuil('201')).toBe('20-1')
    expect(formatCuil('2012345678')).toBe('20-12345678')
    expect(formatCuil('201234567861')).toBe('20-12345678-6')
  })
  it('sugiere el CUIL a partir del DNI', () => {
    expect(sugerirCuil('12.345.678', 'M')).toBe('20-12345678-6')
    expect(sugerirCuil('30123456', 'F')).toBe('27-30123456-8')
    expect(sugerirCuil('123', 'F')).toBeNull()
  })
  it('si el dígito da 10 usa el prefijo 23', () => {
    const m = sugerirCuil('10000005', 'M')
    const f = sugerirCuil('10000002', 'F')
    expect(m).toBe('23-10000005-9')
    expect(f).toBe('23-10000002-4')
    expect(cuilValido(m!)).toBe(true)
    expect(cuilValido(f!)).toBe(true)
  })
  it('DNI de 7 números: lleva un cero adelante en el CUIL', () => {
    const c = sugerirCuil('5123456', 'M')!
    expect(c.slice(3, 11)).toBe('05123456')
    expect(cuilValido(c)).toBe(true)
    expect(cuilCoincideConDni(c, '5.123.456')).toBe(true)
  })
  it('avisa si el CUIL no lleva el DNI del paciente', () => {
    expect(cuilCoincideConDni('20-12345678-6', '12345678')).toBe(true)
    expect(cuilCoincideConDni('20-12345678-6', '30123456')).toBe(false)
    expect(cuilCoincideConDni('30-12345678-1', '30123456')).toBe(true)
    expect(cuilCoincideConDni('', '30123456')).toBe(true)
  })
})

const pac = (id: string, extra: Partial<Paciente> = {}) => ({ id, nombre: id, dni: null, cuil_cuit: null, ...extra }) as Paciente

describe('pacientes', () => {
  const lista = [pac('a', { dni: '30123456' }), pac('b', { cuil_cuit: '20-12345678-6' })]
  it('encuentra otro paciente con el mismo DNI o CUIL', () => {
    expect(pacienteConMismoDocumento(lista, 'dni', '30.123.456')?.id).toBe('a')
    expect(pacienteConMismoDocumento(lista, 'dni', '30.123.456', 'a')).toBeUndefined()
    expect(pacienteConMismoDocumento(lista, 'cuil_cuit', '20123456786')?.id).toBe('b')
    expect(pacienteConMismoDocumento(lista, 'dni', '')).toBeUndefined()
  })
  it('busca por número de documento', () => {
    expect(coincideDocumento(lista[0], '30.123')).toBe(true)
    expect(coincideDocumento(lista[1], '12345678')).toBe(true)
    expect(coincideDocumento(lista[0], '12')).toBe(false)
    expect(coincideDocumento(lista[0], 'ana 301')).toBe(false)
  })
})

describe('importar', () => {
  it('normaliza DNI y CUIL con forma correcta y deja el resto como vino', () => {
    expect(normalizarDocumentos('30.123.456', '27 30123456 8')).toEqual({ dni: '30123456', cuil_cuit: '27-30123456-8' })
    expect(normalizarDocumentos('pasaporte AB123', null)).toEqual({ dni: 'pasaporte AB123', cuil_cuit: null })
  })
})
