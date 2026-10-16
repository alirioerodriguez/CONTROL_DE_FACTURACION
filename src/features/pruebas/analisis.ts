// Cálculos del tablero de resultados de las pruebas. Funciones puras, con tests.
import type { Ejercicio } from './ejercicios'

export type EstadoEjercicio = 'en_curso' | 'logrado' | 'no_pude' | 'salteado'

export interface ResultadoEjercicio {
  estado: EstadoEjercicio
  /** Tiempo activo en milisegundos (sin contar cuando la app quedó en segundo plano). */
  ms: number
  inicio: string
  fin?: string
  /** 1 = muy fácil … 5 = muy difícil. */
  dificultad?: number
  comentario?: string
  /** Milisegundos en cada pantalla durante el ejercicio, por nombre de pantalla. */
  pantallas: Record<string, number>
}

export interface Encuesta {
  hoy?: string
  sirvio?: string[]
  costo?: string[]
  falto?: string[]
  recomendaria?: number
  pagaria?: string
  precio?: string
  comentario?: string
}

export interface FilaPrueba {
  id: string
  nombre: string | null
  dispositivo: string | null
  letra: number | null
  ejercicios: Record<string, ResultadoEjercicio>
  encuesta: Encuesta | null
  terminado: boolean
  created_at: string
}

export interface ResumenEjercicio {
  ejercicio: Ejercicio
  /** Personas que lo terminaron (logrado o no pudo). */
  hechos: number
  logrados: number
  noPudo: number
  salteados: number
  /** 0 a 1. null si nadie lo hizo. */
  tasaExito: number | null
  medianaMs: number | null
  dificultadPromedio: number | null
  comentarios: string[]
  /** Pantallas por las que pasaron, con el tiempo promedio por persona, de mayor a menor. */
  pantallas: { nombre: string; msPromedio: number }[]
  /** 0 (sin problemas) a 100 (muy problemático). Ordena qué arreglar primero. */
  puntaje: number | null
}

export function mediana(valores: number[]): number | null {
  if (!valores.length) return null
  const v = [...valores].sort((a, b) => a - b)
  const m = Math.floor(v.length / 2)
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2
}

/**
 * Puntaje de problema de un ejercicio, de 0 a 100:
 * 50 % por no lograrlo, 30 % por dificultad, 20 % por tardar más de lo esperado (tope: el triple).
 */
export function puntajeProblema(tasaExito: number, dificultad: number | null, medianaMs: number | null, esperadoS: number): number {
  const fracaso = 1 - tasaExito
  const dif = dificultad == null ? 0 : (dificultad - 1) / 4
  const demora = medianaMs == null ? 0 : Math.min(Math.max(medianaMs / 1000 / esperadoS - 1, 0), 2) / 2
  return Math.round(fracaso * 50 + dif * 30 + demora * 20)
}

export function resumirEjercicio(ejercicio: Ejercicio, filas: FilaPrueba[]): ResumenEjercicio {
  const resultados = filas.map((f) => f.ejercicios?.[ejercicio.id]).filter((r): r is ResultadoEjercicio => Boolean(r))
  const terminados = resultados.filter((r) => r.estado === 'logrado' || r.estado === 'no_pude')
  const logrados = terminados.filter((r) => r.estado === 'logrado').length
  const dificultades = terminados.map((r) => r.dificultad).filter((d): d is number => typeof d === 'number')
  const tiempos = terminados.map((r) => r.ms).filter((ms) => ms > 0)

  const totalPantallas: Record<string, number> = {}
  for (const r of terminados) {
    for (const [nombre, ms] of Object.entries(r.pantallas ?? {})) totalPantallas[nombre] = (totalPantallas[nombre] ?? 0) + ms
  }
  const pantallas = Object.entries(totalPantallas)
    .map(([nombre, ms]) => ({ nombre, msPromedio: ms / Math.max(terminados.length, 1) }))
    .sort((a, b) => b.msPromedio - a.msPromedio)

  const tasaExito = terminados.length ? logrados / terminados.length : null
  const dificultadPromedio = dificultades.length ? dificultades.reduce((a, b) => a + b, 0) / dificultades.length : null
  const medianaMs = mediana(tiempos)

  return {
    ejercicio,
    hechos: terminados.length,
    logrados,
    noPudo: terminados.length - logrados,
    salteados: resultados.filter((r) => r.estado === 'salteado').length,
    tasaExito,
    medianaMs,
    dificultadPromedio,
    comentarios: terminados.map((r) => r.comentario?.trim() ?? '').filter(Boolean),
    pantallas,
    puntaje: tasaExito == null ? null : puntajeProblema(tasaExito, dificultadPromedio, medianaMs, ejercicio.esperado),
  }
}

/** Todos los ejercicios resumidos, del más problemático al menos. Los que nadie hizo van al final. */
export function rankingProblemas(ejercicios: Ejercicio[], filas: FilaPrueba[]): ResumenEjercicio[] {
  return ejercicios
    .map((e) => resumirEjercicio(e, filas))
    .sort((a, b) => (b.puntaje ?? -1) - (a.puntaje ?? -1))
}

/** Cuántas personas eligieron cada opción de una pregunta (de una o varias respuestas). */
export function contarOpciones(filas: FilaPrueba[], clave: keyof Encuesta, opciones: readonly string[]): { opcion: string; votos: number }[] {
  const votos = new Map(opciones.map((o) => [o, 0]))
  for (const f of filas) {
    const r = f.encuesta?.[clave]
    for (const v of Array.isArray(r) ? r : r != null ? [r] : []) {
      if (typeof v === 'string' && votos.has(v)) votos.set(v, (votos.get(v) ?? 0) + 1)
    }
  }
  return [...votos].map(([opcion, n]) => ({ opcion, votos: n })).sort((a, b) => b.votos - a.votos)
}

/** NPS: % que pone 9 o 10 menos % que pone 0 a 6. null sin respuestas. */
export function nps(filas: FilaPrueba[]): { valor: number; respuestas: number } | null {
  const notas = filas.map((f) => f.encuesta?.recomendaria).filter((n): n is number => typeof n === 'number')
  if (!notas.length) return null
  const promotores = notas.filter((n) => n >= 9).length
  const detractores = notas.filter((n) => n <= 6).length
  return { valor: Math.round(((promotores - detractores) / notas.length) * 100), respuestas: notas.length }
}

/** '1 min 05 s' / '42 s' */
export function formatDuracion(ms: number | null): string {
  if (ms == null) return '—'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s} s`
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`
}
