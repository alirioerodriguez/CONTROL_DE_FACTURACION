import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { leerTablaArca, montoArca } from '../../supabase/functions/actualizar-monotributo/arca'
import { CATEGORIAS, VIGENCIA_MONOTRIBUTO } from './monotributo'

// Copia real de la tabla de arca.gob.ar/monotributo/categorias.asp (valores desde el 1/08/2026).
const html = readFileSync(new URL('./fixtures/arca-categorias.html', import.meta.url), 'utf8')

describe('montoArca', () => {
  it('lee montos con puntos de miles y coma decimal', () => {
    expect(montoArca('$12.009.410,45 ')).toBe(12009410.45)
    expect(montoArca('$5.585,77')).toBe(5585.77)
    expect(montoArca('Hasta 30 m2')).toBeNull()
  })
})

describe('leerTablaArca', () => {
  const tabla = leerTablaArca(html)

  it('lee la vigencia y las 11 categorías', () => {
    expect(tabla.vigencia).toBe('2026-08-01')
    expect(tabla.categorias.map((c) => c.letra).join('')).toBe('ABCDEFGHIJK')
  })

  it('coincide con la tabla que tiene la app de respaldo', () => {
    expect(tabla.vigencia).toBe(VIGENCIA_MONOTRIBUTO)
    expect(tabla.categorias).toEqual(CATEGORIAS.map((c) => ({ letra: c.letra, tope: c.tope, cuota: c.cuota })))
  })

  it('falla con un mensaje claro si la página cambió', () => {
    expect(() => leerTablaArca('<html>otra cosa</html>')).toThrow(/fecha de vigencia/)
    const sinK = html.replace(/id="th_K_/, 'id="th_X_')
    expect(() => leerTablaArca(sinK)).toThrow(/categoría K/)
  })

  it('no acepta topes que no crecen', () => {
    const roto = html.replace('$17.595.182,74', '$1.595.182,74')
    expect(() => leerTablaArca(roto)).toThrow(/no crecen/)
  })
})
