// Plan gratis hasta 8 pacientes activos y Pro por suscripción (estados/honorapp.md, «Cómo gano plata»).
// El cobro del Pro lo hace Mercado Pago desde la web: la app nunca toca plata de nadie.
// Todavía no hay suscripciones: mientras `cobroActivo` sea false, nadie queda limitado.

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
  plan: 'gratis' | 'pro'
  proHasta?: string | null
  activos: number
  ahora?: Date
  cobroActivo?: boolean
}): EstadoPlan {
  const ahora = (p.ahora ?? new Date()).getTime()
  const esPro = p.plan === 'pro' && (!p.proHasta || new Date(p.proHasta).getTime() > ahora)
  const quedanGratis = Math.max(0, LIMITE_GRATIS - p.activos)
  const puedeSumarActivo = !p.cobroActivo || esPro || p.activos < LIMITE_GRATIS
  const precio = `$ ${PRECIO_PRO_MENSUAL_ARS.toLocaleString('es-AR')}`
  const mensaje = esPro
    ? 'Plan Pro activo: pacientes ilimitados.'
    : puedeSumarActivo
      ? `Plan gratis: ${p.activos} de ${LIMITE_GRATIS} pacientes activos.`
      : `Llegaste a los ${LIMITE_GRATIS} pacientes activos del plan gratis. El Pro cuesta ${precio} por mes.`
  return { esPro, activos: p.activos, puedeSumarActivo, quedanGratis, mensaje }
}
