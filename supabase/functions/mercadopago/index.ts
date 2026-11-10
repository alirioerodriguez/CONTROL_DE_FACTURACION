// Función de Supabase para el cobro de honorapp Pro con Mercado Pago:
// 1. Si la llama la app con JWT de la usuaria (`accion: 'crear-suscripcion'`), crea la suscripción en Mercado Pago
//    con `external_reference = user.id` y devuelve el `init_point` para pagar en la web.
// 2. Si la llama el webhook de Mercado Pago, verifica la firma HMAC-SHA256 (`MP_WEBHOOK_SECRET`), consulta el pago o
//    la suscripción en la API oficial de Mercado Pago (`MP_ACCESS_TOKEN`) y recién cuando el pago está `approved`
//    actualiza `profiles.plan = 'pro'` y `profiles.pro_hasta` usando `service_role`.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  evaluarPagoConfirmadoMP,
  evaluarSuscripcionMP,
  PRECIO_PRO_ANUAL_ARS,
  PRECIO_PRO_MENSUAL_ARS,
  verificarFirmaMP,
  type PagoConsultadoMP,
  type SuscripcionConsultadaMP,
} from './mp.ts'

const URL_APP = 'https://control-de-facturacion-eight.vercel.app'
const API_MP = 'https://api.mercadopago.com'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature, x-request-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

async function consultarMP<T>(ruta: string, token: string): Promise<T> {
  const r = await fetch(`${API_MP}${ruta}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  if (!r.ok) throw new Error(`Mercado Pago respondió ${r.status} en ${ruta}`)
  return (await r.json()) as T
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ ok: false, mensaje: 'Método no permitido.' }, 405)

  const mpToken = Deno.env.get('MP_ACCESS_TOKEN')
  const mpSecret = Deno.env.get('MP_WEBHOOK_SECRET')
  if (!mpToken) return json({ ok: false, mensaje: 'El cobro con Mercado Pago todavía no está configurado.' }, 503)

  const url = new URL(req.url)
  let cuerpo: Record<string, unknown> = {}
  try {
    cuerpo = (await req.json()) as Record<string, unknown>
  } catch {
    return json({ ok: false, mensaje: 'Cuerpo inválido.' }, 400)
  }

  // -------------------------------------------------------------------
  // Caso 1: La usuaria autenticada pide crear el link de suscripción
  // -------------------------------------------------------------------
  if (cuerpo.accion === 'crear-suscripcion') {
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader) return json({ ok: false, mensaje: 'Tenés que ingresar con tu cuenta.' }, 401)
    const dbUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: u } = await dbUser.auth.getUser()
    if (!u.user || !u.user.email) return json({ ok: false, mensaje: 'Sesión inválida.' }, 401)

    const anual = cuerpo.frecuencia === 'anual'
    const r = await fetch(`${API_MP}/preapproval`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mpToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: anual ? 'honorapp Pro · Plan anual' : 'honorapp Pro · Plan mensual',
        external_reference: u.user.id,
        payer_email: u.user.email,
        auto_recurring: {
          frequency: anual ? 12 : 1,
          frequency_type: 'months',
          transaction_amount: anual ? PRECIO_PRO_ANUAL_ARS : PRECIO_PRO_MENSUAL_ARS,
          currency_id: 'ARS',
        },
        back_url: `${URL_APP}/ajustes`,
        status: 'pending',
      }),
    })
    const data = (await r.json().catch(() => null)) as { init_point?: string; message?: string } | null
    if (!r.ok || !data?.init_point) {
      return json({ ok: false, mensaje: data?.message ?? 'No se pudo iniciar la suscripción en Mercado Pago.' }, 502)
    }
    return json({ ok: true, init_point: data.init_point })
  }

  // -------------------------------------------------------------------
  // Caso 2: Aviso (webhook) de Mercado Pago — exige firma válida
  // -------------------------------------------------------------------
  if (!mpSecret) return json({ ok: false, mensaje: 'Falta MP_WEBHOOK_SECRET.' }, 503)

  const dataObj = (cuerpo.data ?? {}) as Record<string, unknown>
  const dataId = String(url.searchParams.get('data.id') ?? url.searchParams.get('id') ?? dataObj.id ?? '')
  const tipo = String(url.searchParams.get('type') ?? url.searchParams.get('topic') ?? cuerpo.type ?? cuerpo.topic ?? '')

  const firma = await verificarFirmaMP({
    xSignature: req.headers.get('x-signature'),
    xRequestId: req.headers.get('x-request-id'),
    dataId,
    secreto: mpSecret,
  })
  if (!firma.ok) {
    return json({ ok: false, mensaje: firma.motivo ?? 'Firma inválida.' }, 401)
  }

  const dbAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  try {
    if (tipo === 'payment' || tipo === 'subscription_authorized_payment' || tipo === 'authorized_payment') {
      const rutaPago = tipo === 'payment' ? `/v1/payments/${encodeURIComponent(dataId)}` : `/authorized_payments/${encodeURIComponent(dataId)}`
      const pago = await consultarMP<PagoConsultadoMP>(rutaPago, mpToken)
      let suscripcion: SuscripcionConsultadaMP | null = null
      if (pago.preapproval_id) {
        suscripcion = await consultarMP<SuscripcionConsultadaMP>(`/preapproval/${encodeURIComponent(pago.preapproval_id)}`, mpToken).catch(() => null)
      }
      const userIdCandidato = pago.external_reference ?? suscripcion?.external_reference ?? ''
      const { data: perfilActual } = userIdCandidato
        ? await dbAdmin.from('profiles').select('pro_hasta').eq('id', userIdCandidato).maybeSingle()
        : { data: null }

      const decision = evaluarPagoConfirmadoMP(pago, suscripcion, perfilActual?.pro_hasta)
      if (decision.accion === 'activar_pro') {
        const { error } = await dbAdmin
          .from('profiles')
          .update({
            plan: 'pro',
            pro_hasta: decision.proHasta,
            ...(decision.mpPreapprovalId ? { mp_preapproval_id: decision.mpPreapprovalId } : {}),
          })
          .eq('id', decision.userId)
        if (error) throw new Error(error.message)
        return json({ ok: true, accion: 'activar_pro', pro_hasta: decision.proHasta })
      }
      return json({ ok: true, omitido: decision.motivo })
    }

    if (tipo === 'subscription_preapproval' || tipo === 'preapproval') {
      const suscripcion = await consultarMP<SuscripcionConsultadaMP>(`/preapproval/${encodeURIComponent(dataId)}`, mpToken)
      const decision = evaluarSuscripcionMP(suscripcion)
      if (decision.accion === 'guardar_suscripcion') {
        await dbAdmin.from('profiles').update({ mp_preapproval_id: decision.mpPreapprovalId }).eq('id', decision.userId)
        return json({ ok: true, accion: 'guardar_suscripcion' })
      }
      return json({ ok: true, omitido: decision.motivo })
    }

    return json({ ok: true, omitido: `Evento no procesado: ${tipo}` })
  } catch (e) {
    console.error(e)
    return json({ ok: false, mensaje: 'No se pudo verificar el aviso con Mercado Pago.' }, 502)
  }
})
