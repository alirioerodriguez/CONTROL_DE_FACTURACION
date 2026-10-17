// Estado de cada sesión. En la base se guarda 'normal', 'ausente' o 'cancelada'; la app deriva si una
// normal está programada (fecha futura) o realizada (fecha de hoy o anterior). Así una sesión generada
// para todo el mes pasa sola a realizada al llegar su día, sin procesos programados.
import { hoyAR } from './formato'

export type EstadoGuardado = 'normal' | 'ausente' | 'cancelada'
export type EstadoVisible = 'programada' | 'realizada' | 'ausente' | 'cancelada'

export const ETIQUETA_ESTADO: Record<EstadoVisible, string> = {
  programada: 'Programada',
  realizada: 'Realizada',
  ausente: 'Ausente',
  cancelada: 'Cancelada',
}

/** Lo que explica cada opción al elegirla. */
export const AYUDA_ESTADO: Record<EstadoGuardado, string> = {
  normal: 'Se hace (o se hizo) como estaba previsto.',
  ausente: 'El paciente faltó sin avisar: se cobra igual.',
  cancelada: 'No se hizo y no se cobra.',
}

interface ConEstado {
  fecha: string
  estado?: EstadoGuardado | null
}

export function estadoVisible(s: ConEstado, hoy: string = hoyAR()): EstadoVisible {
  if (s.estado === 'ausente') return 'ausente'
  if (s.estado === 'cancelada') return 'cancelada'
  return s.fecha > hoy ? 'programada' : 'realizada'
}

/** Solo las realizadas y las ausentes generan deuda. Las programadas todavía no; las canceladas nunca. */
export function seCobra(s: ConEstado, hoy: string = hoyAR()): boolean {
  const e = estadoVisible(s, hoy)
  return e === 'realizada' || e === 'ausente'
}

export function cobrables<T extends ConEstado>(sesiones: T[], hoy: string = hoyAR()): T[] {
  return sesiones.filter((s) => seCobra(s, hoy))
}
