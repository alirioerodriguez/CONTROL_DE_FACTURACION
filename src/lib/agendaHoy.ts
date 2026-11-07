// Agenda de hoy: reconfirmar el turno 24 h antes, ofrecer el hueco de una cancelación a la lista de espera y
// contar las faltas del año. Todo arma mensajes para mandar a mano por WhatsApp: sin seña, sin cobro anticipado
// y sin la API paga de Meta.
import type { Sesion } from './datos'
import { palabras, type Termino } from './terminos'

export type Franja = 'manana' | 'tarde' | 'cualquiera'

export interface EnEspera {
  id: string
  nombre: string
  telefono: string
  /** 1 = lunes … 6 = sábado. Vacío = cualquier día. */
  dias: number[]
  franja: Franja
  activo: boolean
}

const primerNombre = (nombre: string) => nombre.trim().split(/\s+/)[0] || nombre

/** Antes de las 13 es mañana; desde las 13, tarde. */
export function franjaDe(horaHm: string): 'manana' | 'tarde' {
  const hh = Number(horaHm.split(':')[0])
  return Number.isFinite(hh) && hh < 13 ? 'manana' : 'tarde'
}

/** «Hola Lucía, ¿cómo estás? Te escribo para confirmar nuestra sesión de mañana martes a las 18:00 hs. ¡Gracias!» */
export function mensajeReconfirmacion(nombrePaciente: string, cuando: string, horaHm: string, termino: Termino = 'sesion'): string {
  const p = palabras(termino)
  return `Hola ${primerNombre(nombrePaciente)}, ¿cómo estás? Te escribo para confirmar nuestra ${p.sesion} de ${cuando} a las ${horaHm} hs. ¡Gracias!`
}

/**
 * Cuando alguien cancela: quién de la lista de espera puede tomar el hueco, primero los que coinciden en día y
 * franja. Quien no coincide en nada no aparece.
 */
export function candidatosParaHueco(lista: EnEspera[], diaSemana: number, horaHm: string, cuando: string, termino: Termino = 'sesion') {
  const franja = franjaDe(horaHm)
  const p = palabras(termino)
  return lista
    .filter((c) => c.activo)
    .map((c) => {
      const dia = c.dias.length === 0 || c.dias.includes(diaSemana)
      const hora = c.franja === 'cualquiera' || c.franja === franja
      const puntaje = (dia ? 2 : 0) + (hora ? 1 : 0)
      const mensaje = `Hola ${primerNombre(c.nombre)}, ¿cómo estás? Se liberó un horario para ${p.sesion} ${cuando} a las ${horaHm} hs. Avisame si te queda bien tomarlo.`
      return { ...c, puntaje, mensaje }
    })
    .filter((c) => c.puntaje > 0)
    .sort((a, b) => b.puntaje - a.puntaje)
}

/** Faltas (sesiones «ausente») de cada paciente en un año: para que la profesional decida según su regla. */
export function faltasEnElAnio(sesiones: Pick<Sesion, 'patient_id' | 'fecha' | 'estado'>[], anio: number): Map<string, number> {
  const prefijo = `${anio}-`
  const conteo = new Map<string, number>()
  for (const s of sesiones) {
    if (s.estado !== 'ausente' || !s.fecha.startsWith(prefijo)) continue
    conteo.set(s.patient_id, (conteo.get(s.patient_id) ?? 0) + 1)
  }
  return conteo
}
