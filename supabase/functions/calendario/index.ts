// Función de Supabase: calendario privado con las sesiones (.ics), para suscribirse desde Google Calendar.
// Se entra con el link de Ajustes (…/calendario?t=<calendario_token>). Sin el token correcto no devuelve nada.
// Manda desde 2 meses atrás hasta 4 meses adelante, sin las canceladas, con solo las iniciales del paciente.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { armarIcs } from './ics.ts'

const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const corrimiento = (dias: number) => new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10)

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get('t') ?? ''
  if (!TOKEN.test(token)) return new Response('Link inválido', { status: 404 })

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: perfil } = await db.from('profiles').select('id, termino').eq('calendario_token', token).maybeSingle()
  if (!perfil) return new Response('Link inválido', { status: 404 })

  const { data, error } = await db
    .from('sessions')
    .select('id, fecha, hora, horas, estado, patients!inner(nombre, apellido)')
    .eq('user_id', perfil.id)
    .neq('estado', 'cancelada')
    .gte('fecha', corrimiento(-62))
    .lte('fecha', corrimiento(124))
    .order('fecha')
  if (error) return new Response('No se pudo armar el calendario', { status: 500 })

  const sesiones = (data ?? []).map((s) => {
    const p = s.patients as unknown as { nombre: string; apellido: string | null }
    return { id: s.id, fecha: s.fecha, hora: s.hora, horas: Number(s.horas), estado: s.estado, nombre: p.nombre, apellido: p.apellido }
  })
  const ics = armarIcs(sesiones, perfil.termino === 'consulta' ? 'Consulta' : 'Sesión')
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="honorapp.ics"',
      'Cache-Control': 'private, max-age=900',
    },
  })
})
