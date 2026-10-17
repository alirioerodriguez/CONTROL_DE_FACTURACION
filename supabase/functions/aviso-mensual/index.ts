// Función de Supabase: el día 1 de cada mes manda el resumen a quienes lo prendieron en Ajustes.
// La llama pg_cron (ver supabase/schema.sql). Manda un mail por mes y por usuaria como máximo
// (tabla avisos_enviados), así que llamarla de más no repite mails.
// Necesita el secreto SMTP_PASS (contraseña de aplicación de honorapp.ar@gmail.com) en Edge Functions → Secrets.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.16'
import { armarAviso } from './aviso.ts'

const REMITENTE = 'honorapp.ar@gmail.com'

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async () => {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  const periodo = `${hoy.slice(0, 7)}-01`
  // La función es pública (la llama pg_cron sin credenciales): fuera de los primeros días del mes no hace nada,
  // así nadie puede adelantar el resumen. Del 2 al 3 sirve para reintentar si el día 1 falló.
  if (Number(hoy.slice(8)) > 3) return json({ ok: true, omitido: 'Solo se manda los primeros días del mes.' })

  const clave = Deno.env.get('SMTP_PASS')
  if (!clave) return json({ ok: false, mensaje: 'Falta el secreto SMTP_PASS.' }, 500)
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: filas, error } = await db.rpc('resumen_aviso_mensual', { p_hoy: hoy })
  if (error) return json({ ok: false, mensaje: error.message }, 500)
  const { data: yaEnviados } = await db.from('avisos_enviados').select('user_id').eq('periodo', periodo)
  const enviados = new Set((yaEnviados ?? []).map((f) => f.user_id))

  const smtp = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: REMITENTE, pass: clave } })
  let mandados = 0
  const errores: string[] = []
  for (const f of filas ?? []) {
    if (enviados.has(f.user_id) || !f.email) continue
    // Se marca antes de mandar: si dos llamadas corren juntas, solo una manda.
    const { error: marca } = await db.from('avisos_enviados').insert({ user_id: f.user_id, periodo })
    if (marca) continue
    const mail = armarAviso(
      { ...f, deuda_ars: Number(f.deuda_ars), deuda_usd: Number(f.deuda_usd), cobrado_ars: Number(f.cobrado_ars), cobrado_usd: Number(f.cobrado_usd) },
      hoy,
    )
    try {
      await smtp.sendMail({ from: `honorapp <${REMITENTE}>`, to: f.email, subject: mail.asunto, html: mail.html, text: mail.texto })
      mandados++
    } catch (e) {
      // Si falló, se desmarca para que el próximo intento lo vuelva a probar.
      await db.from('avisos_enviados').delete().eq('user_id', f.user_id).eq('periodo', periodo)
      errores.push(e instanceof Error ? e.message : String(e))
    }
  }
  return json({ ok: errores.length === 0, mandados, errores: errores.slice(0, 3) }, errores.length ? 500 : 200)
})
