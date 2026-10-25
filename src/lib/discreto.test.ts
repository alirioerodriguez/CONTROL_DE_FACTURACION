import { afterEach, describe, expect, it } from 'vitest'
import { cambiarMontosOcultos, verMonto, verPartes } from './discreto'
import { formatMonto } from './formato'

describe('ocultar montos', () => {
  afterEach(() => cambiarMontosOcultos(false))

  it('muestra el monto normal si no están ocultos', () => {
    expect(verMonto(25000.5, 'ARS')).toBe('$ 25.000,50')
  })

  it('tapa el número pero deja la moneda', () => {
    cambiarMontosOcultos(true)
    expect(verMonto(25000.5, 'ARS')).toBe('$ •••••')
    expect(verMonto(50, 'USD')).toBe('US$ •••••')
    expect(verPartes(25000.5, 'ARS')).toEqual({ entero: '$ •••••', decimales: '' })
  })

  it('no toca lo que sale de la pantalla (WhatsApp, PDF, Excel)', () => {
    cambiarMontosOcultos(true)
    expect(formatMonto(25000.5, 'ARS')).toBe('$ 25.000,50')
  })
})
