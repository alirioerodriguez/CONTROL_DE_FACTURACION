import { describe, expect, it } from 'vitest'
import { armarSugerencia } from './sugerencia'

describe('«Queremos escucharte»', () => {
  it('arma la sugerencia limpia, con el mail opcional', () => {
    const r = armarSugerencia({ tipo: 'idea', texto: '  Ver el total del año  ', mail: '', web: '' })
    expect(r).toEqual({ cuerpo: { app: 'honorapp', tipo: 'idea', texto: 'Ver el total del año', mail: null, web: '', version: 'web' } })
  })

  it('avisa si el mensaje es muy corto o el mail está mal escrito', () => {
    expect(armarSugerencia({ tipo: 'otra', texto: 'a', mail: '', web: '' })).toHaveProperty('error')
    expect(armarSugerencia({ tipo: 'idea', texto: 'Buena app', mail: 'ana@', web: '' })).toHaveProperty('error')
    expect(armarSugerencia({ tipo: 'idea', texto: 'x'.repeat(2001), mail: '', web: '' })).toHaveProperty('error')
  })
})
