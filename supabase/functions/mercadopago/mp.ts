// Lógica pura de verificación y procesamiento de avisos (webhooks) de Mercado Pago para honorapp Pro.
// Sin dependencias externas: corre en Deno (Edge Function) y en Vitest (src/lib/mercadopago.test.ts).
//
// Reglas de seguridad que nunca se rompen:
// 1. Verificar siempre la firma HMAC-SHA256 del encabezado `x-signature` con `MP_WEBHOOK_SECRET` y ventana de tiempo.
// 2. Nunca creer en el cuerpo del aviso ni en lo que mande el navegador: consultar el pago o suscripción a la API
//    de Mercado Pago y activar `plan = 'pro'` únicamente cuando el pago figura `approved`.

export const PRECIO_PRO_MENSUAL_ARS = 6900
export const PRECIO_PRO_ANUAL_ARS = 69000
const VENTANA_FIRMA_SEG = 300 // 5 minutos de tolerancia para evitar ataques de repetición
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface FirmaCabecera {
  ts: number
  v1: string
}

/** Extrae `ts` y `v1` del encabezado `x-signature: ts=1704908010,v1=618c85...`. */
export function leerCabeceraFirma(xSignature: string | null | undefined): FirmaCabecera | null {
  if (!xSignature) return null
  let ts = NaN
  let v1 = ''
  for (const parte of xSignature.split(',')) {
    const [k, v] = parte.split('=').map((s) => s.trim())
    if (k === 'ts') ts = Number(v)
    if (k === 'v1' && /^[0-9a-f]{64}$/i.test(v ?? '')) v1 = v.toLowerCase()
  }
  if (!Number.isFinite(ts) || ts <= 0 || !v1) return null
  return { ts, v1 }
}

/**
 * Manifiesto oficial de Mercado Pago para firmar webhooks:
 * `id:[data.id en minúscula];request-id:[x-request-id];ts:[ts];`
 */
export function armarManifiestoMP(dataId: string, requestId: string, ts: number): string {
  const idLimpio = dataId.trim().toLowerCase()
  const reqLimpio = requestId.trim()
  if (!idLimpio || !reqLimpio || !Number.isFinite(ts)) return ''
  return `id:${idLimpio};request-id:${reqLimpio};ts:${ts};`
}

export async function hmacSha256Hex(secreto: string, mensaje: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const buf = await crypto.subtle.sign('HMAC', key, enc.encode(mensaje))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Comparación en tiempo constante para no filtrar la firma por tiempo de respuesta. */
export function compararSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

/** Verifica la firma del webhook de Mercado Pago y que el timestamp no sea viejo. */
export async function verificarFirmaMP(p: {
  xSignature: string | null | undefined
  xRequestId: string | null | undefined
  dataId: string | null | undefined
  secreto: string
  ahoraMs?: number
}): Promise<{ ok: boolean; motivo?: string }> {
  if (!p.secreto) return { ok: false, motivo: 'Falta el secreto del webhook' }
  const parsed = leerCabeceraFirma(p.xSignature)
  if (!parsed) return { ok: false, motivo: 'Encabezado x-signature inválido o ausente' }
  if (!p.xRequestId?.trim() || !p.dataId?.trim()) {
    return { ok: false, motivo: 'Faltan x-request-id o data.id' }
  }
  const ahoraSeg = Math.floor((p.ahoraMs ?? Date.now()) / 1000)
  if (Math.abs(ahoraSeg - parsed.ts) > VENTANA_FIRMA_SEG) {
    return { ok: false, motivo: 'Firma vencida fuera de la ventana de 5 minutos' }
  }
  const manifiesto = armarManifiestoMP(p.dataId, p.xRequestId, parsed.ts)
  const esperada = await hmacSha256Hex(p.secreto, manifiesto)
  if (!compararSeguro(esperada, parsed.v1)) {
    return { ok: false, motivo: 'La firma HMAC no coincide' }
  }
  return { ok: true }
}

export interface PagoConsultadoMP {
  id: string | number
  status?: string
  transaction_amount?: number
  currency_id?: string
  external_reference?: string | null
  date_approved?: string | null
  preapproval_id?: string | null
}

export interface SuscripcionConsultadaMP {
  id: string
  status?: string
  external_reference?: string | null
  auto_recurring?: {
    frequency?: number
    frequency_type?: string
    transaction_amount?: number
    currency_id?: string
  }
}

export type DecisionWebhook =
  | { accion: 'activar_pro'; userId: string; proHasta: string; mpPreapprovalId: string | null }
  | { accion: 'guardar_suscripcion'; userId: string; mpPreapprovalId: string }
  | { accion: 'ignorar'; motivo: string }

/**
 * Decide qué cambio hacer en `profiles` a partir del pago real consultado en la API de Mercado Pago.
 * NUNCA activa Pro si el pago no está `approved`.
 */
export function evaluarPagoConfirmadoMP(
  pago: PagoConsultadoMP,
  suscripcion?: SuscripcionConsultadaMP | null,
  proHastaActual?: string | null,
  ahora = new Date(),
): DecisionWebhook {
  if (pago.status !== 'approved') {
    return { accion: 'ignorar', motivo: `El pago no está aprobado (estado: ${pago.status ?? 'desconocido'})` }
  }
  const moneda = pago.currency_id ?? suscripcion?.auto_recurring?.currency_id
  if (moneda !== 'ARS') {
    return { accion: 'ignorar', motivo: `Moneda no válida: ${moneda ?? 'sin moneda'}` }
  }
  const monto = Number(pago.transaction_amount ?? 0)
  if (!(monto >= PRECIO_PRO_MENSUAL_ARS)) {
    return { accion: 'ignorar', motivo: `Monto insuficiente: ${monto}` }
  }
  const ref = (pago.external_reference ?? suscripcion?.external_reference ?? '').trim()
  if (!UUID_RE.test(ref)) {
    return { accion: 'ignorar', motivo: 'external_reference no es un UUID de usuaria válido' }
  }
  const esAnual =
    (suscripcion?.auto_recurring?.frequency === 12 && suscripcion?.auto_recurring?.frequency_type === 'months') ||
    monto >= PRECIO_PRO_ANUAL_ARS
  const dias = esAnual ? 370 : 35
  const baseMs = Math.max(
    ahora.getTime(),
    pago.date_approved ? new Date(pago.date_approved).getTime() || ahora.getTime() : ahora.getTime(),
    proHastaActual ? new Date(proHastaActual).getTime() || 0 : 0,
  )
  const proHasta = new Date(baseMs + dias * 86_400_000).toISOString()
  return {
    accion: 'activar_pro',
    userId: ref,
    proHasta,
    mpPreapprovalId: suscripcion?.id ?? pago.preapproval_id ?? null,
  }
}

/**
 * Un aviso de suscripción (`subscription_preapproval`) por sí solo NO activa Pro: solo registra el ID de la
 * suscripción en el perfil, y espera a que llegue el aviso de pago aprobado (`payment` / `authorized_payment`).
 */
export function evaluarSuscripcionMP(s: SuscripcionConsultadaMP): DecisionWebhook {
  const ref = (s.external_reference ?? '').trim()
  if (!UUID_RE.test(ref) || !s.id) {
    return { accion: 'ignorar', motivo: 'Suscripción sin external_reference válido' }
  }
  return { accion: 'guardar_suscripcion', userId: ref, mpPreapprovalId: s.id }
}
