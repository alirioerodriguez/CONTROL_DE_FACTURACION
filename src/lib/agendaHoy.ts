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

// ---------------------------------------------------------------------
// Pantalla «Agenda de hoy»: qué reconfirmar, qué huecos se liberaron y lo que se guarda en el teléfono.
// ---------------------------------------------------------------------

type ConPaciente = Pick<Sesion, 'id' | 'patient_id' | 'fecha' | 'hora' | 'estado'>

const porHora = (a: ConPaciente, b: ConPaciente) => (a.hora ?? '99:99').localeCompare(b.hora ?? '99:99')

/** Sesiones de mañana para reconfirmar: las que no están canceladas, en orden de hora. */
export function paraReconfirmar<T extends ConPaciente>(sesiones: T[], manana: string): T[] {
  return sesiones.filter((s) => s.fecha === manana && s.estado !== 'cancelada').sort(porHora)
}

/** Huecos liberados: sesiones canceladas con hora, de hoy a 7 días, para ofrecérselas a la lista de espera. */
export function huecosLiberados<T extends ConPaciente>(sesiones: T[], hoy: string, hasta: string): T[] {
  return sesiones
    .filter((s) => s.estado === 'cancelada' && s.hora && s.fecha >= hoy && s.fecha <= hasta)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || porHora(a, b))
}

// La lista de espera y las reconfirmaciones quedan en este dispositivo (no van a la base): son datos de
// personas que todavía no son pacientes y marcas que solo sirven por un día.
type Almacen = Pick<Storage, 'getItem' | 'setItem'>
const CLAVE_ESPERA = 'honorapp_espera_v1'
const CLAVE_CONFIRMADAS = 'honorapp_confirmadas_v1'

function leerJson<T>(st: Almacen, clave: string, vacio: T): T {
  try {
    const v = JSON.parse(st.getItem(clave) ?? 'null')
    return v && typeof v === 'object' ? (v as T) : vacio
  } catch {
    return vacio
  }
}

export function leerEspera(userId: string, st: Almacen): EnEspera[] {
  const todo = leerJson<Record<string, EnEspera[]>>(st, CLAVE_ESPERA, {})
  return Array.isArray(todo[userId]) ? todo[userId] : []
}

export function guardarEspera(userId: string, lista: EnEspera[], st: Almacen): void {
  const todo = leerJson<Record<string, EnEspera[]>>(st, CLAVE_ESPERA, {})
  st.setItem(CLAVE_ESPERA, JSON.stringify({ ...todo, [userId]: lista }))
}

/** Ids de sesión marcadas como confirmadas. Se guardan con su fecha y se olvidan solas las de días pasados. */
export function leerConfirmadas(userId: string, hoy: string, st: Almacen): Set<string> {
  const todo = leerJson<Record<string, Record<string, string>>>(st, CLAVE_CONFIRMADAS, {})
  return new Set(Object.entries(todo[userId] ?? {}).filter(([, fecha]) => fecha >= hoy).map(([id]) => id))
}

export function marcarConfirmada(userId: string, sesionId: string, fecha: string, confirmada: boolean, hoy: string, st: Almacen): void {
  const todo = leerJson<Record<string, Record<string, string>>>(st, CLAVE_CONFIRMADAS, {})
  const mias = Object.fromEntries(Object.entries(todo[userId] ?? {}).filter(([, f]) => f >= hoy))
  if (confirmada) mias[sesionId] = fecha
  else delete mias[sesionId]
  st.setItem(CLAVE_CONFIRMADAS, JSON.stringify({ ...todo, [userId]: mias }))
}
