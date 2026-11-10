import { describe, expect, it } from 'vitest'
import { encolar, leerCola, pendientesDe, sincronizar, type Almacen } from './cola'

function almacen(): Almacen & { datos: Map<string, string> } {
  const datos = new Map<string, string>()
  return { datos, getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => void datos.set(k, v) }
}
const fila = { patient_id: 'p1', monto: 25000, moneda: 'ARS', fecha: '2026-11-10' }

describe('cola de borradores', () => {
  it('guarda cada pago con un id único y lo conserva entre lecturas', () => {
    const a = almacen()
    const b1 = encolar(a, 'u1', fila)
    const b2 = encolar(a, 'u1', fila)
    expect(b1.id).not.toBe(b2.id)
    expect(leerCola(a)).toHaveLength(2)
    expect(b1.fila.id).toBe(b1.id)
  })
  it('un doble toque con el mismo id no repite el borrador', () => {
    const a = almacen()
    encolar(a, 'u1', { ...fila, id: 'fijo' })
    encolar(a, 'u1', { ...fila, id: 'fijo' })
    expect(leerCola(a)).toHaveLength(1)
  })
  it('separa por cuenta', () => {
    const a = almacen()
    encolar(a, 'u1', fila)
    encolar(a, 'u2', fila)
    expect(pendientesDe(a, 'u1')).toHaveLength(1)
  })
  it('aguanta contenido roto', () => {
    const a = almacen()
    a.setItem('cola_borradores_pagos', '{no es json')
    expect(leerCola(a)).toEqual([])
    a.setItem('cola_borradores_pagos', JSON.stringify([{ x: 1 }, null]))
    expect(leerCola(a)).toEqual([])
  })
})

describe('sincronizar', () => {
  it('saca de la cola los que salen bien y deja los que fallan con un intento más', async () => {
    const a = almacen()
    encolar(a, 'u1', { ...fila, id: 'a' })
    encolar(a, 'u1', { ...fila, id: 'b' })
    encolar(a, 'u2', { ...fila, id: 'c' })
    const r = await sincronizar(a, 'u1', async (b) => {
      if (b.id === 'b') throw new Error('sin red')
    })
    expect(r).toEqual({ enviados: ['a'], fallidos: ['b'] })
    const resto = leerCola(a)
    expect(resto.map((b) => b.id)).toEqual(['b', 'c'])
    expect(resto[0].intentos).toBe(1)
  })
  it('un segundo envío no manda lo que ya salió', async () => {
    const a = almacen()
    encolar(a, 'u1', { ...fila, id: 'a' })
    const vistos: string[] = []
    const enviar = async (b: { id: string }) => void vistos.push(b.id)
    await sincronizar(a, 'u1', enviar)
    await sincronizar(a, 'u1', enviar)
    expect(vistos).toEqual(['a'])
  })
})
