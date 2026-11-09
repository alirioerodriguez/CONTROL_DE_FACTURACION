// Plan gratis hasta 8 pacientes activos y Pro por suscripción (estados/honorapp.md, «Cómo gano plata»).
// El cobro del Pro lo hace Mercado Pago desde la web: la app nunca toca plata de nadie.
// Todavía no hay suscripciones: mientras `cobroActivo` sea false, nadie queda limitado.

/** Bandera general de cobro: mientras esté en false, nadie queda limitado en los 8 pacientes activos. */
export const COBRO_ACTIVO = false
export const LIMITE_GRATIS = 8
export const PRECIO_PRO_MENSUAL_ARS = 6900
export const PRECIO_PRO_ANUAL_ARS = 69000

export interface EstadoPlan {
  esPro: boolean
  activos: number
  puedeSumarActivo: boolean
  quedanGratis: number
  mensaje: string
}

export function estadoPlan(p: {
  plan?: 'gratis' | 'pro' | null
  proHasta?: string | null
  activos: number
  ahora?: Date
  cobroActivo?: boolean
}): EstadoPlan {
  const cobroActivo = p.cobroActivo ?? COBRO_ACTIVO
  const plan = p.plan === 'pro' ? 'pro' : 'gratis'
  const ahora = (p.ahora ?? new Date()).getTime()
  const esPro = plan === 'pro' && (!p.proHasta || new Date(p.proHasta).getTime() > ahora)
  const quedanGratis = Math.max(0, LIMITE_GRATIS - p.activos)
  const puedeSumarActivo = !cobroActivo || esPro || p.activos < LIMITE_GRATIS
  const precio = `$ ${PRECIO_PRO_MENSUAL_ARS.toLocaleString('es-AR')}`
  const mensaje = esPro
    ? 'Plan Pro activo: pacientes ilimitados.'
    : puedeSumarActivo
      ? `Plan gratis: ${p.activos} de ${LIMITE_GRATIS} pacientes activos.`
      : `Llegaste a los ${LIMITE_GRATIS} pacientes activos del plan gratis. El Pro cuesta ${precio} por mes.`
  return { esPro, activos: p.activos, quedanGratis, puedeSumarActivo, mensaje }
}

/**
 * Evalúa si se puede guardar un paciente como activo (al crear uno nuevo o al reactivar uno inactivo).
 * Si el paciente ya estaba activo, o si se está guardando como inactivo, siempre devuelve `{ ok: true }`.
 */
export function puedeGuardarPacienteActivo(p: {
  plan?: 'gratis' | 'pro' | null
  proHasta?: string | null
  pacientes: { id: string; activo: boolean }[]
  pacienteActual?: { id: string; activo: boolean }
  activoNuevo: boolean
  cobroActivo?: boolean
  ahora?: Date
}): { ok: boolean; mensaje: string } {
  if (!p.activoNuevo || p.pacienteActual?.activo) {
    return { ok: true, mensaje: '' }
  }
  const otrosActivos = p.pacientes.filter((x) => x.activo && x.id !== p.pacienteActual?.id).length
  const est = estadoPlan({
    plan: p.plan,
    proHasta: p.proHasta,
    activos: otrosActivos,
    cobroActivo: p.cobroActivo,
    ahora: p.ahora,
  })
  return { ok: est.puedeSumarActivo, mensaje: est.puedeSumarActivo ? '' : est.mensaje }
}
