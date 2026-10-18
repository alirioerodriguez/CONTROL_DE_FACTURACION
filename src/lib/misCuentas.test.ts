import { describe, expect, it } from 'vitest'
import { totalesPorMes } from '../../supabase/functions/mis-cuentas/totales'

describe('totales para Mis Cuentas', () => {
  it('12 meses por moneda, también en cero, sin mezclar monedas', () => {
    const t = totalesPorMes(
      [
        { fecha: '2026-10-05', monto: '50000.00', moneda: 'ARS' },
        { fecha: '2026-10-20', monto: 25000.5, moneda: 'ARS' },
        { fecha: '2026-10-07', monto: 50, moneda: 'USD' },
        { fecha: '2026-09-30', monto: 1000, moneda: 'ARS' },
      ],
      '2026-10-18',
    )
    expect(t).toHaveLength(24)
    expect(t[0]).toEqual({ periodo: '2025-11-01', moneda: 'ARS', total: 0 })
    expect(t.slice(-4)).toEqual([
      { periodo: '2026-09-01', moneda: 'ARS', total: 1000 },
      { periodo: '2026-09-01', moneda: 'USD', total: 0 },
      { periodo: '2026-10-01', moneda: 'ARS', total: 75000.5 },
      { periodo: '2026-10-01', moneda: 'USD', total: 50 },
    ])
  })
})
