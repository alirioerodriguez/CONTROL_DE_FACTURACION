import { describe, expect, it } from 'vitest'
import { armarAviso, monto } from '../../supabase/functions/aviso-mensual/aviso'
import { formatMonto } from './formato'

describe('mail mensual', () => {
  it('los montos salen igual que en la app', () => {
    for (const n of [0, 5, 1234.5, 25000, 1234567.891, 86666.66]) {
      expect(monto(n, 'ARS')).toBe(formatMonto(n, 'ARS'))
      expect(monto(n, 'USD')).toBe(formatMonto(n, 'USD'))
    }
  })

  it('resume el mes anterior con lo que le deben', () => {
    const r = { nombre: 'Lic. Ana Martínez', termino: 'sesion', deuda_ars: 86666.66, deuda_usd: 40, pacientes_deben: 2, cobrado_ars: 10000, cobrado_usd: 0 }
    const m = armarAviso(r, '2026-11-01')
    expect(m.asunto).toBe('Tu resumen de octubre 2026 · honorapp')
    expect(m.texto).toContain('Hola, Ana:')
    expect(m.texto).toContain('Te deben $ 86.666,66 y US$ 40,00 entre 2 pacientes.')
    expect(m.texto).toContain('En octubre cobraste $ 10.000,00.')
    expect(m.html).toContain('Ver quién debe')
  })

  it('enero resume diciembre del año anterior; sin deudas, todo al día', () => {
    const m = armarAviso({ nombre: null, termino: null, deuda_ars: 0, deuda_usd: 0, pacientes_deben: 0, cobrado_ars: 0, cobrado_usd: 0 }, '2027-01-01')
    expect(m.asunto).toBe('Tu resumen de diciembre 2026 · honorapp')
    expect(m.texto).toContain('Nadie te debe nada: todo al día.')
    expect(m.texto).toContain('En diciembre no registraste cobros.')
  })
})
