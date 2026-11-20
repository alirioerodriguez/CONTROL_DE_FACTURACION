import { afterEach, describe, expect, it } from 'vitest'
import { opcionesHoras } from './opciones'
import { montoParaInput } from '../../lib/formato'

describe('opciones de horas', () => {
  afterEach(() => {
    // Restablecer cualquier estado o configuración después de cada prueba
  })

  it('genera opciones típicas', () => {
    expect(opcionesHoras(2)).toMatchInlineSnapshot(`
      [
        {
          "l": "1 h",
          "v": 1,
        },
        {
          "l": "1,5 h",
          "v": 1.5,
        },
        {
          "l": "2 h",
          "v": 2,
        },
      ]
    `)
  })

  it('agrega la duración actual si no es típica', () => {
    expect(opcionesHoras(2.5)).toMatchInlineSnapshot(`
      [
        {
          "l": "1 h",
          "v": 1,
        },
        {
          "l": "1,5 h",
          "v": 1.5,
        },
        {
          "l": "2 h",
          "v": 2,
        },
        {
          "l": "2,5 h",
          "v": 2.5,
        },
      ]
    `)
  })

  it('ordena las opciones de menor a mayor', () => {
    expect(opcionesHoras(0.5)).toMatchInlineSnapshot(`
      [
        {
          "l": "0,5 h",
          "v": 0.5,
        },
        {
          "l": "1 h",
          "v": 1,
        },
        {
          "l": "1,5 h",
          "v": 1.5,
        },
        {
          "l": "2 h",
          "v": 2,
        },
      ]
    `)
  })

  it('maneja duración negativa', () => {
    expect(opcionesHoras(-1)).toMatchInlineSnapshot(`
      [
        {
          "l": "-1 h",
          "v": -1,
        },
        {
          "l": "1 h",
          "v": 1,
        },
        {
          "l": "1,5 h",
          "v": 1.5,
        },
        {
          "l": "2 h",
          "v": 2,
        },
      ]
    `)
  })

  it('maneja duración con decimales', () => {
    expect(opcionesHoras(1.25)).toMatchInlineSnapshot(`
      [
        {
          "l": "1 h",
          "v": 1,
        },
        {
          "l": "1,25 h",
          "v": 1.25,
        },
        {
          "l": "1,5 h",
          "v": 1.5,
        },
        {
          "l": "2 h",
          "v": 2,
        },
      ]
    `)
  })

  it('maneja duración con cero', () => {
    expect(opcionesHoras(0)).toMatchInlineSnapshot(`
      [
        {
          "l": "0 h",
          "v": 0,
        },
        {
          "l": "1 h",
          "v": 1,
        },
        {
          "l": "1,5 h",
          "v": 1.5,
        },
        {
          "l": "2 h",
          "v": 2,
        },
      ]
    `)
  })

  it('maneja duración vacía', () => {
    expect(opcionesHoras(undefined as any)).toMatchInlineSnapshot(`
      [
        {
          "l": "1 h",
          "v": 1,
        },
        {
          "l": "1,5 h",
          "v": 1.5,
        },
        {
          "l": "2 h",
          "v": 2,
        },
        {
          "l": "NaN h",
          "v": undefined,
        },
      ]
    `)
  })

  it('maneja duración con texto', () => {
    expect(opcionesHoras('dos' as any)).toMatchInlineSnapshot(`
      [
        {
          "l": "1 h",
          "v": 1,
        },
        {
          "l": "1,5 h",
          "v": 1.5,
        },
        {
          "l": "2 h",
          "v": 2,
        },
        {
          "l": "NaN h",
          "v": "dos",
        },
      ]
    `)
  })
})
