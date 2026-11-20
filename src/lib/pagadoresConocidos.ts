// Lo que comparten «Pegar un comprobante» y «Conciliar el mes»: los pagadores ya confirmados («siempre paga la mamá»)
// y lo que debe cada paciente, para que el monto ayude a sugerir.
import { aprenderPagador, type DatosComprobante, type DeudaPaciente, type PacienteConciliar, type PagadorConocido } from './conciliar'
import type { Paciente, Pago, Sesion } from './datos'
import { saldosDe } from './resumen'
import { guardarPreferencia, preferencia } from './tema'

const CLAVE = 'pagadores_conocidos'

/** Lo que debe cada paciente hoy (total y por mes impago). */
export function deudasDe(pacientes: Paciente[], sesiones: Sesion[], pagos: Pago[]): Record<string, DeudaPaciente> {
  const deudas: Record<string, DeudaPaciente> = {}
  for (const p of pacientes) {
    const s = saldosDe(p.id, sesiones, pagos).find((x) => x.moneda === p.moneda)
    if (s) deudas[p.id] = { moneda: p.moneda, total: Math.max(0, s.saldo), porMes: s.meses.filter((m) => m.pendiente > 0).map((m) => m.pendiente) }
  }
  return deudas
}

/** Los pagadores que la profesional ya confirmó. Quedan solo en este navegador. */
export function leerConocidos(): PagadorConocido[] {
  try {
    const v = JSON.parse(preferencia<string>(CLAVE, '[]'))
    return Array.isArray(v) ? v.filter((k) => k && typeof k.nombre === 'string' && typeof k.patient_id === 'string') : []
  } catch {
    return []
  }
}

/** Recuerda a quién pagó por cada paciente confirmado (para reconocerlo solo la próxima vez). */
export function recordarPagadores(confirmados: { datos: DatosComprobante; paciente: PacienteConciliar }[]): void {
  let conocidos = leerConocidos()
  for (const c of confirmados) conocidos = aprenderPagador(c.datos, c.paciente, conocidos)
  guardarPreferencia(CLAVE, JSON.stringify(conocidos))
}
