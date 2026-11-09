import { describe, expect, it } from 'vitest'
import {
  armarManifiestoMP,
  evaluarPagoConfirmadoMP,
  evaluarSuscripcionMP,
  hmacSha256Hex,
  PRECIO_PRO_ANUAL_ARS,
  PRECIO_PRO_MENSUAL_ARS,
  verificarFirmaMP,
} from '../../supabase/functions/mercadopago/mp'

const USER_ID = '00000000-0000-4000-a000-00000000000a'
const SECRETO = 'secreto_webhook_mp_prueba'

describe('webhook de Mercado Pago: firma y confirmación de pago', () => {
  it('verifica una firma HMAC-SHA256 válida y rechaza firmas adulteradas, vacías o vencidas', async () => {
    const ts = 1762689600
    const requestId = 'req-12345'
    const dataId = '99887766'
    const manifiesto = armarManifiestoMP(dataId, requestId, ts)
    expect(manifiesto).toBe('id:99887766;request-id:req-12345;ts:1762689600;')

    const v1 = await hmacSha256Hex(SECRETO, manifiesto)
    const ok = await verificarFirmaMP({
      xSignature: `ts=${ts},v1=${v1}`,
      xRequestId: requestId,
      dataId,
      secreto: SECRETO,
      ahoraMs: ts * 1000 + 10_000,
    })
    expect(ok).toEqual({ ok: true })

    // Firma con otro secreto o adulterada: rechazada
    const mala = await verificarFirmaMP({
      xSignature: `ts=${ts},v1=${'a'.repeat(64)}`,
      xRequestId: requestId,
      dataId,
      secreto: SECRETO,
      ahoraMs: ts * 1000,
    })
    expect(mala.ok).toBe(false)

    // Firma fuera de la ventana de 5 minutos: rechazada
    const vencida = await verificarFirmaMP({
      xSignature: `ts=${ts},v1=${v1}`,
      xRequestId: requestId,
      dataId,
      secreto: SECRETO,
      ahoraMs: (ts + 600) * 1000,
    })
    expect(vencida.ok).toBe(false)
  })

  it('nunca activa Pro si el pago no está approved o si la suscripción solo fue creada', () => {
    // Una suscripción recién creada/autorizada sin pago confirmado solo guarda el id de suscripción
    const sub = evaluarSuscripcionMP({ id: 'pre_123', status: 'authorized', external_reference: USER_ID })
    expect(sub).toEqual({ accion: 'guardar_suscripcion', userId: USER_ID, mpPreapprovalId: 'pre_123' })

    // Un pago pendiente o rechazado se ignora
    const pendiente = evaluarPagoConfirmadoMP({
      id: 1,
      status: 'pending',
      transaction_amount: PRECIO_PRO_MENSUAL_ARS,
      currency_id: 'ARS',
      external_reference: USER_ID,
    })
    expect(pendiente.accion).toBe('ignorar')

    const rechazado = evaluarPagoConfirmadoMP({
      id: 2,
      status: 'rejected',
      transaction_amount: PRECIO_PRO_MENSUAL_ARS,
      currency_id: 'ARS',
      external_reference: USER_ID,
    })
    expect(rechazado.accion).toBe('ignorar')
  })

  it('activa Pro por 35 días en pago mensual aprobado y por 370 días en pago anual aprobado', () => {
    const ahora = new Date('2026-11-09T12:00:00.000Z')
    const mensual = evaluarPagoConfirmadoMP(
      {
        id: 10,
        status: 'approved',
        transaction_amount: PRECIO_PRO_MENSUAL_ARS,
        currency_id: 'ARS',
        external_reference: USER_ID,
        date_approved: '2026-11-09T12:00:00.000Z',
      },
      null,
      null,
      ahora,
    )
    expect(mensual).toEqual({
      accion: 'activar_pro',
      userId: USER_ID,
      proHasta: '2026-12-14T12:00:00.000Z',
      mpPreapprovalId: null,
    })

    const anual = evaluarPagoConfirmadoMP(
      {
        id: 11,
        status: 'approved',
        transaction_amount: PRECIO_PRO_ANUAL_ARS,
        currency_id: 'ARS',
        preapproval_id: 'pre_anual',
      },
      {
        id: 'pre_anual',
        external_reference: USER_ID,
        auto_recurring: { frequency: 12, frequency_type: 'months', transaction_amount: PRECIO_PRO_ANUAL_ARS, currency_id: 'ARS' },
      },
      null,
      ahora,
    )
    expect(anual).toEqual({
      accion: 'activar_pro',
      userId: USER_ID,
      proHasta: '2027-11-14T12:00:00.000Z',
      mpPreapprovalId: 'pre_anual',
    })
  })
})
