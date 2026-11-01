import { describe, expect, it } from 'vitest'
import { armarMailContadora, csvFacturas, mesAnterior } from '../../supabase/functions/facturas-contadora/mail'

const f = (numero: number, extra = {}) => ({
  punto_venta: 3, numero, fecha: '2026-10-15', receptor: 'Lucía Pérez', doc_tipo: 96, doc_numero: '30123456',
  total: 48000, moneda: 'ARS' as const, cotizacion: null, cae: '76451234567890', cae_vence: '2026-10-25', ...extra,
})

describe('mail de facturas a la contadora', () => {
  it('mes anterior, también en enero', () => {
    expect(mesAnterior('2026-11-01')).toEqual({ desde: '2026-10-01', hasta: '2026-11-01', nombre: 'octubre 2026' })
    expect(mesAnterior('2027-01-01')).toEqual({ desde: '2026-12-01', hasta: '2027-01-01', nombre: 'diciembre 2026' })
  })

  it('planilla con una fila por factura, en pesos y en dólares', () => {
    const csv = csvFacturas([f(124), f(125, { moneda: 'USD', total: 50, cotizacion: 1415.5, receptor: 'Ana; Gómez', doc_tipo: 99, doc_numero: '0' })])
    const filas = csv.replace('﻿', '').trim().split('\r\n')
    expect(filas).toHaveLength(3)
    expect(filas[1]).toBe('15/10/2026;Factura C;C 00003-00000124;Lucía Pérez;DNI;30123456;ARS;48000,00;1;48000,00;76451234567890;25/10/2026')
    expect(filas[2]).toContain('"Ana; Gómez";Sin identificar;;USD;50,00;1415,50;70775,00')
  })

  it('el mail dice cuántas, el total y adjunta la planilla', () => {
    const m = armarMailContadora({ nombre: 'Lic. Ana Gómez', cuit: '27-30123456-4' }, [f(124), f(125)], '2026-11-01')
    expect(m.asunto).toBe('Facturas de octubre 2026 · Lic. Ana Gómez')
    expect(m.texto).toContain('hizo 2 facturas en octubre 2026 por $ 96.000,00')
    expect(m.adjunto.nombre).toBe('facturas-2026-10-27301234564.csv')
    expect(m.html).toContain('C 00003-00000125')
  })
})
