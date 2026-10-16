import { describe, expect, it } from 'vitest'
import { etiquetaProfesion, palabras, PROFESIONES } from './terminos'

describe('palabras', () => {
  it('psicología: sesión, por hora', () => {
    expect(palabras('sesion', 'hora')).toMatchObject({ sesion: 'sesión', Sesiones: 'Sesiones', porUnidad: 'por hora', sufijo: '/h', porHora: true })
  })

  it('nutrición: consulta, por consulta', () => {
    expect(palabras('consulta', 'sesion')).toMatchObject({
      sesion: 'consulta',
      sesiones: 'consultas',
      Sesion: 'Consulta',
      unidad: 'consulta',
      porUnidad: 'por consulta',
      sufijo: '/consulta',
      porHora: false,
    })
  })

  it('sin datos usa sesión por hora (cuentas viejas)', () => {
    expect(palabras().porUnidad).toBe('por hora')
  })
})

describe('profesiones', () => {
  it('cada una tiene su palabra y forma de cobro, y se muestra con su nombre', () => {
    expect(PROFESIONES.find((p) => p.v === 'nutricion')).toMatchObject({ termino: 'consulta', modo: 'sesion' })
    expect(PROFESIONES.find((p) => p.v === 'psicologia')).toMatchObject({ termino: 'sesion', modo: 'hora' })
    expect(etiquetaProfesion('kinesiologia')).toBe('Kinesiología')
    expect(etiquetaProfesion('Musicoterapia')).toBe('Musicoterapia') // "Otra" escrita a mano
    expect(etiquetaProfesion(null)).toBe('')
  })
})
