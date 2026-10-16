import { describe, expect, it } from 'vitest'
import { palabras } from '../../lib/terminos'
import { contarOpciones, formatDuracion, mediana, nps, puntajeProblema, rankingProblemas, resumirEjercicio, type FilaPrueba } from './analisis'
import { armarEjercicios, nombrePantalla } from './ejercicios'

const ejercicios = armarEjercicios(palabras('sesion', 'hora'))
const cargar = ejercicios.find((e) => e.id === 'paciente-estandar')!

function fila(id: string, ejercicios: FilaPrueba['ejercicios'], encuesta: FilaPrueba['encuesta'] = null): FilaPrueba {
  return { id, nombre: null, dispositivo: 'celular', letra: 1, ejercicios, encuesta, terminado: false, created_at: '2026-10-16' }
}

describe('mediana', () => {
  it('impar, par y vacío', () => {
    expect(mediana([3, 1, 2])).toBe(2)
    expect(mediana([4, 1, 3, 2])).toBe(2.5)
    expect(mediana([])).toBeNull()
  })
})

describe('puntajeProblema', () => {
  it('todo bien da 0', () => {
    expect(puntajeProblema(1, 1, 30_000, 60)).toBe(0)
  })
  it('nadie lo logró, muy difícil y el triple de tiempo da 100', () => {
    expect(puntajeProblema(0, 5, 180_000, 60)).toBe(100)
  })
  it('la demora tiene tope en el triple del tiempo esperado', () => {
    expect(puntajeProblema(1, 1, 600_000, 60)).toBe(20)
  })
})

describe('resumirEjercicio', () => {
  const filas = [
    fila('a', { 'paciente-estandar': { estado: 'logrado', ms: 60_000, inicio: '', dificultad: 2, comentario: 'fácil', pantallas: { Inicio: 10_000, Pacientes: 50_000 } } }),
    fila('b', { 'paciente-estandar': { estado: 'no_pude', ms: 180_000, inicio: '', dificultad: 5, comentario: '  ', pantallas: { Pacientes: 180_000 } } }),
    fila('c', { 'paciente-estandar': { estado: 'salteado', ms: 0, inicio: '', pantallas: {} } }),
    fila('d', {}),
  ]
  const r = resumirEjercicio(cargar, filas)

  it('cuenta logrados, no pudo y salteados por separado', () => {
    expect(r.hechos).toBe(2)
    expect(r.logrados).toBe(1)
    expect(r.noPudo).toBe(1)
    expect(r.salteados).toBe(1)
    expect(r.tasaExito).toBe(0.5)
  })
  it('promedia dificultad y saca la mediana de tiempo de quienes terminaron', () => {
    expect(r.dificultadPromedio).toBe(3.5)
    expect(r.medianaMs).toBe(120_000)
  })
  it('ignora comentarios vacíos', () => {
    expect(r.comentarios).toEqual(['fácil'])
  })
  it('ordena pantallas por tiempo promedio', () => {
    expect(r.pantallas[0]).toEqual({ nombre: 'Pacientes', msPromedio: 115_000 })
    expect(r.pantallas[1]).toEqual({ nombre: 'Inicio', msPromedio: 5_000 })
  })
})

describe('rankingProblemas', () => {
  it('pone primero el más problemático y al final los que nadie hizo', () => {
    const filas = [
      fila('a', {
        'paciente-estandar': { estado: 'logrado', ms: 30_000, inicio: '', dificultad: 1, pantallas: {} },
        'sesion-hoy': { estado: 'no_pude', ms: 90_000, inicio: '', dificultad: 4, pantallas: {} },
      }),
    ]
    const ranking = rankingProblemas(ejercicios, filas)
    expect(ranking[0].ejercicio.id).toBe('sesion-hoy')
    expect(ranking[1].ejercicio.id).toBe('paciente-estandar')
    expect(ranking[ranking.length - 1].puntaje).toBeNull()
  })
})

describe('encuesta', () => {
  const filas = [
    fila('a', {}, { sirvio: ['Recordatorios por WhatsApp', 'El tamaño de letra'], recomendaria: 10, hoy: 'Excel o planilla' }),
    fila('b', {}, { sirvio: ['Recordatorios por WhatsApp'], recomendaria: 5 }),
    fila('c', {}, { recomendaria: 8 }),
  ]
  it('cuenta votos de varias y de una respuesta', () => {
    const sirvio = contarOpciones(filas, 'sirvio', ['El tamaño de letra', 'Recordatorios por WhatsApp', 'Otra'])
    expect(sirvio[0]).toEqual({ opcion: 'Recordatorios por WhatsApp', votos: 2 })
    expect(sirvio.find((x) => x.opcion === 'Otra')?.votos).toBe(0)
    expect(contarOpciones(filas, 'hoy', ['Excel o planilla'])[0].votos).toBe(1)
  })
  it('NPS: promotores menos detractores', () => {
    expect(nps(filas)).toEqual({ valor: 0, respuestas: 3 })
    expect(nps([])).toBeNull()
  })
})

describe('formato y pantallas', () => {
  it('formatDuracion', () => {
    expect(formatDuracion(42_000)).toBe('42 s')
    expect(formatDuracion(65_000)).toBe('1 min 05 s')
    expect(formatDuracion(null)).toBe('—')
  })
  it('agrupa las fichas de paciente', () => {
    expect(nombrePantalla('/pacientes/abc-123')).toBe('Ficha de paciente')
    expect(nombrePantalla('/')).toBe('Inicio')
  })
  it('los ejercicios hablan de consultas si la profesión usa consulta', () => {
    const ej = armarEjercicios(palabras('consulta', 'sesion'))
    expect(ej.find((e) => e.id === 'sesion-hoy')?.instruccion).toContain('consulta')
  })
})
