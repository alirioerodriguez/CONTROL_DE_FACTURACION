// Función de Supabase: enlace con Mis Cuentas (app de gastos personales). La llama la app con la sesión de la usuaria.
// Toma el mail verificado de la cuenta y habla con la función «honorapp» del proyecto de Mis Cuentas usando la clave
// secreta compartida ENLACE_SECRETO. A Mis Cuentas solo viajan el mail y los totales por mes: nada de pacientes.
// Acciones: estado, enlazar, desenlazar, enviar.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { totalesPorMes } from './totales.ts'

const MIS_CUENTAS = 'https://qrtypgsyyxioakqibwmz.supabase.co/functions/v1/honorapp'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const secreto = Deno.env.get('ENLACE_SECRETO')
  if (!secreto) return json({ ok: false, mensaje: 'El enlace con Mis Cuentas todavía no está configurado.' }, 503)

  // La usuaria, por su sesión (verify_jwt ya validó el token).
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: u } = await db.auth.getUser()
  const email = u.user?.email
  if (!u.user || !email || !u.user.email_confirmed_at) return json({ ok: false, mensaje: 'Tu mail no está confirmado.' }, 403)

  let cuerpo: { accion?: string; cuenta_ars?: string | null; cuenta_usd?: string | null }
  try {
    cuerpo = await req.json()
  } catch {
    return json({ ok: false, mensaje: 'Pedido inválido.' }, 400)
  }

  const llamar = async (datos: Record<string, unknown>) => {
    const r = await fetch(MIS_CUENTAS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-enlace-secreto': secreto },
      body: JSON.stringify({ ...datos, email }),
    })
    return json(await r.json().catch(() => ({ ok: false, mensaje: 'Mis Cuentas no respondió.' })), r.status)
  }

  switch (cuerpo.accion) {
    case 'estado':
      return llamar({ accion: 'estado' })
    case 'enlazar':
      return llamar({ accion: 'enlazar', cuenta_ars: cuerpo.cuenta_ars ?? null, cuenta_usd: cuerpo.cuenta_usd ?? null })
    case 'desenlazar':
      return llamar({ accion: 'desenlazar' })
    case 'enviar': {
      const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
      const desde = `${new Date(Date.UTC(Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)) - 12, 1)).toISOString().slice(0, 10)}`
      // Con la sesión de la usuaria: RLS garantiza que solo se leen sus pagos.
      const { data: pagos, error } = await db.from('payments').select('fecha, monto, moneda').gte('fecha', desde)
      if (error) return json({ ok: false, mensaje: error.message }, 500)
      return llamar({ accion: 'recibir', totales: totalesPorMes(pagos ?? [], hoy) })
    }
    default:
      return json({ ok: false, mensaje: 'Acción desconocida.' }, 400)
  }
})
