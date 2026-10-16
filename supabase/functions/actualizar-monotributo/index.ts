// Función de Supabase: lee los topes del monotributo de la página de ARCA y los guarda en
// public.monotributo_categorias. La llama pg_cron todos los días (ver supabase/schema.sql).
// Si la página cambió y no se puede leer, no toca nada y deja el error en monotributo_revisiones.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { leerTablaArca } from './arca.ts'

const URL_ARCA = 'https://www.arca.gob.ar/monotributo/categorias.asp'

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async () => {
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Si alguien la llama muchas veces seguidas, no se le pide a ARCA más de una vez por hora.
  const { data: ultima } = await db
    .from('monotributo_revisiones')
    .select('fecha')
    .eq('ok', true)
    .gte('fecha', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .limit(1)
  if (ultima?.length) return json({ ok: true, omitido: 'Ya se revisó en la última hora.' })

  try {
    const res = await fetch(URL_ARCA, { headers: { 'User-Agent': 'honorapp (control del tope del monotributo)' } })
    if (!res.ok) throw new Error(`ARCA respondió ${res.status}.`)
    const tabla = leerTablaArca(await res.text())

    const { data: actual } = await db.from('monotributo_categorias').select('vigencia').limit(1).maybeSingle()
    // Nunca se vuelve a valores más viejos que los guardados.
    if (actual && tabla.vigencia < actual.vigencia) {
      throw new Error(`ARCA muestra una vigencia (${tabla.vigencia}) anterior a la guardada (${actual.vigencia}).`)
    }
    const cambio = !actual || tabla.vigencia !== actual.vigencia

    const { error } = await db.from('monotributo_categorias').upsert(
      tabla.categorias.map((c) => ({ ...c, vigencia: tabla.vigencia, actualizado: new Date().toISOString() })),
    )
    if (error) throw new Error(`No se pudo guardar: ${error.message}`)

    await db.from('monotributo_revisiones').insert({ ok: true, vigencia: tabla.vigencia, cambio })
    return json({ ok: true, vigencia: tabla.vigencia, cambio })
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e)
    await db.from('monotributo_revisiones').insert({ ok: false, mensaje })
    return json({ ok: false, mensaje }, 500)
  }
})
