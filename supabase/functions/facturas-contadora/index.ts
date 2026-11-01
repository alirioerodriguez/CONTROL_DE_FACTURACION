// Función de Supabase: el día 1 de cada mes le manda a la contadora las facturas que honorapp hizo en ARCA
// el mes anterior (tabla en el mail + planilla CSV), a quienes lo activaron en Ajustes → Facturar con ARCA.
// La llama pg_cron (ver supabase/schema.sql). Un mail por mes y por profesional como máximo
// (tabla facturas_contadora_enviadas). Usa el mismo SMTP que aviso-mensual (secreto SMTP_PASS).
import { createClient } from 'jsr:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.16'
import { armarMailContadora, mesAnterior, type FacturaMail } from './mail.ts'

const REMITENTE = 'honorapp.ar@gmail.com'
const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async () => {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  // Pública (la llama pg_cron): fuera de los primeros días del mes no hace nada. Del 2 al 3 reintenta.
  if (Number(hoy.slice(8)) > 3) return json({ ok: true, omitido: 'Solo se manda los primeros días del mes.' })
  const clave = Deno.env.get('SMTP_PASS')
  if (!clave) return json({ ok: false, mensaje: 'Falta el secreto SMTP_PASS.' }, 500)
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const mes = mesAnterior(hoy)

  const { data: perfiles, error } = await db
    .from('profiles')
    .select('id, nombre, cuit, contadora_email')
    .eq('arca_mail_contadora', true)
    .not('contadora_email', 'is', null)
  if (error) return json({ ok: false, mensaje: error.message }, 500)
  const { data: ya } = await db.from('facturas_contadora_enviadas').select('user_id').eq('periodo', mes.desde)
  const enviados = new Set((ya ?? []).map((f) => f.user_id))

  const smtp = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: REMITENTE, pass: clave } })
  let mandados = 0
  const errores: string[] = []
  for (const p of perfiles ?? []) {
    if (enviados.has(p.id)) continue
    const { data: facturas } = await db
      .from('facturas_arca')
      .select('punto_venta, numero, fecha, receptor, doc_tipo, doc_numero, total, moneda, cotizacion, cae, cae_vence')
      .eq('user_id', p.id)
      .eq('entorno', 'prod')
      .gte('fecha', mes.desde)
      .lt('fecha', mes.hasta)
      .order('fecha')
      .order('numero')
    if (!facturas?.length) continue // sin facturas ese mes, no se manda nada
    const { error: marca } = await db.from('facturas_contadora_enviadas').insert({ user_id: p.id, periodo: mes.desde })
    if (marca) continue // otra llamada ya lo está mandando
    const lista = facturas.map((f) => ({ ...f, total: Number(f.total), cotizacion: f.cotizacion == null ? null : Number(f.cotizacion) })) as FacturaMail[]
    const mail = armarMailContadora({ nombre: p.nombre, cuit: p.cuit }, lista, hoy)
    try {
      await smtp.sendMail({
        from: `honorapp <${REMITENTE}>`,
        to: p.contadora_email,
        subject: mail.asunto,
        html: mail.html,
        text: mail.texto,
        attachments: [{ filename: mail.adjunto.nombre, content: mail.adjunto.contenido, contentType: 'text/csv; charset=utf-8' }],
      })
      mandados++
    } catch (e) {
      await db.from('facturas_contadora_enviadas').delete().eq('user_id', p.id).eq('periodo', mes.desde)
      errores.push(e instanceof Error ? e.message : String(e))
    }
  }
  return json({ ok: errores.length === 0, mandados, errores: errores.slice(0, 3) }, errores.length ? 500 : 200)
})
