// Lógica pura del «Modo pasillo» (mayores de 60): 3 acciones por paciente («Vino hoy», «Pagó», «Resumen»).
import type { Paciente, Sesion } from './datos'
import { formatMonto, hoyAR, redondear2 } from './formato'
import { debeAlgo, type Deuda } from './resumen'
import { tarifaVigente } from './saldos'

export const ACCIONES_PASILLO = ['Vino hoy', 'Pagó', 'Resumen'] as const

/** true si el paciente ya tiene una sesión no cancelada cargada en la fecha indicada. */
export function yaVinoEnFecha(sesiones: Pick<Sesion, 'estado' | 'fecha' | 'patient_id'>[], pacienteId: string, fecha: string = hoyAR()): boolean {
  return sesiones.some((s) => s.patient_id === pacienteId && s.fecha === fecha && s.estado !== 'cancelada')
}

/** Arma la fila de sesión para registrar «Vino hoy» con un toque. */
export function armarSesionVinoHoy(
  paciente: Pick<Paciente, 'horas_por_sesion' | 'id' | 'moneda' | 'tarifa_personalizada' | 'tipo_tarifa'>,
  tarifaEstandar: number,
  porHora: boolean,
  fecha: string = hoyAR(),
  id: string = crypto.randomUUID(),
) {
  const horas = porHora ? paciente.horas_por_sesion : 1
  const tarifa = redondear2(tarifaVigente(paciente, tarifaEstandar))
  return {
    id,
    idempotency_key: id,
    patient_id: paciente.id,
    fecha,
    hora: null,
    horas,
    tarifa_hora: tarifa,
    moneda: paciente.moneda,
    estado: 'normal' as const,
  }
}

/** Texto corto del resumen de un paciente para compartir o copiar desde «Resumen». */
export function textoResumenPasillo(nombre: string, deuda: Deuda): string {
  const primer = nombre.trim().split(/\s+/)[0] || nombre
  if (!debeAlgo(deuda)) return `Hola ${primer}, estás al día con tus sesiones. ¡Gracias!`
  const partes = (['ARS', 'USD'] as const)
    .filter((m) => deuda[m] > 0)
    .map((m) => formatMonto(deuda[m], m))
    .join(' y ')
  return `Hola ${primer}, ¿cómo estás? Te paso el resumen de tu saldo pendiente: ${partes}. ¡Gracias!`
}
