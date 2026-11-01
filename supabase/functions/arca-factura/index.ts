// Función de Supabase: factura electrónica con ARCA.
//   POST { accion: 'probar' }                         → revisa que honorapp pueda facturar por la profesional
//   POST { accion: 'emitir', facturas: [{ pagos, descripcion }] } → pide el CAE de cada Factura C y marca los pagos
// La llama la web con la sesión de la profesional (Authorization: Bearer <jwt>). Lee sus datos con SU sesión
// (las reglas de la base aplican igual, incluido el doble factor) y guarda el CAE con la clave de servicio.
//
// Secretos (Supabase → Edge Functions → Secrets):
//   ARCA_ENTORNO = homo | prod
//   ARCA_CERT    = certificado de honorapp (PEM, o el PEM en base64)
//   ARCA_KEY     = clave privada de ese certificado (PEM, o en base64)
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import forge from 'npm:node-forge@1.4.2'
import {
  armarTRA,
  condicionIvaReceptor,
  documento,
  firmarTRA,
  leerCae,
  leerCotizacion,
  leerTicket,
  leerUltimo,
  mensajeErrores,
  numeroFactura,
  pedidoCotizacion,
  pedidoFacturaC,
  pedidoUltimo,
  sobreLoginCms,
  URLS,
  type Auth,
  type Entorno,
} from './wsfe.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const entorno = (Deno.env.get('ARCA_ENTORNO') === 'prod' ? 'prod' : 'homo') as Entorno
const pem = (v: string | undefined) => {
  const t = (v ?? '').trim()
  return t.startsWith('-----') ? t : t ? atob(t) : ''
}

/** Hoy en Argentina, 'AAAA-MM-DD'. */
const hoyAR = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10)
const finDeMes = (periodo: string) => {
  const [a, m] = periodo.split('-').map(Number)
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10)
}

async function soap(url: string, cuerpo: string, soapAction: string): Promise<string> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: soapAction }, body: cuerpo })
  return await r.text()
}

/** Ticket de acceso de honorapp: se reusa mientras dure (ARCA no da otro si hay uno vigente). */
async function ticket(admin: SupabaseClient): Promise<{ token: string; sign: string }> {
  const servicio = `wsfe:${entorno}`
  const { data } = await admin.from('arca_tickets').select('token, sign, vence').eq('servicio', servicio).maybeSingle()
  if (data && new Date(data.vence).getTime() > Date.now() + 5 * 60_000) return data
  const cert = pem(Deno.env.get('ARCA_CERT'))
  const key = pem(Deno.env.get('ARCA_KEY'))
  if (!cert || !key) throw new Error('honorapp todavía no tiene su certificado de ARCA cargado')
  const cms = firmarTRA(armarTRA('wsfe', Date.now()), cert, key, forge as never)
  const t = leerTicket(await soap(URLS[entorno].wsaa, sobreLoginCms(cms), ''))
  await admin.from('arca_tickets').upsert({ servicio, ...t })
  return t
}

async function wsfe(p: { cuerpo: string; soapAction: string }) {
  return await soap(URLS[entorno].wsfe, p.cuerpo, p.soapAction)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Solo POST' }, 405)

  const jwt = req.headers.get('Authorization') ?? ''
  const url = Deno.env.get('SUPABASE_URL')!
  const usuaria = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: jwt } } })
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: u } = await usuaria.auth.getUser()
  if (!u.user) return json({ error: 'Tenés que ingresar de nuevo' }, 401)

  let pedido: { accion?: string; facturas?: { pagos: string[]; descripcion: string }[] }
  try {
    pedido = await req.json()
  } catch {
    return json({ error: 'Pedido inválido' }, 400)
  }

  const { data: perfil, error: errPerfil } = await usuaria.from('profiles').select('nombre, cuit, arca_punto_venta').eq('id', u.user.id).single()
  if (errPerfil || !perfil) return json({ error: 'No se pudo leer tu perfil' }, 403)
  const cuit = (perfil.cuit ?? '').replace(/\D/g, '')
  if (cuit.length !== 11) return json({ error: 'Cargá tu CUIT en Ajustes para facturar' }, 400)
  if (!perfil.arca_punto_venta) return json({ error: 'Cargá en Ajustes el punto de venta de web services de ARCA' }, 400)
  const pv = perfil.arca_punto_venta as number

  try {
    const t = await ticket(admin)
    const auth: Auth = { ...t, cuit }

    if (pedido.accion === 'probar') {
      const ultimo = leerUltimo(await wsfe(pedidoUltimo(auth, pv)))
      await admin.from('profiles').update({ arca_conectado_at: new Date().toISOString() }).eq('id', u.user.id)
      return json({ ok: true, entorno, ultimo: numeroFactura(pv, ultimo) })
    }

    if (pedido.accion !== 'emitir' || !Array.isArray(pedido.facturas) || !pedido.facturas.length || pedido.facturas.length > 60) {
      return json({ error: 'Pedido inválido' }, 400)
    }

    const resultados: unknown[] = []
    let cotizacion: number | null = null
    let ultimo = leerUltimo(await wsfe(pedidoUltimo(auth, pv)))

    // De a una, en orden: la numeración de ARCA es correlativa
    for (const f of pedido.facturas) {
      try {
        const ids = [...new Set((f.pagos ?? []).filter((x) => typeof x === 'string'))].slice(0, 100)
        if (!ids.length) throw new Error('Factura sin pagos')
        const { data: pagos, error } = await usuaria
          .from('payments')
          .select('id, patient_id, fecha, periodo, monto, moneda, comprobante, pagador, patients!inner(id, nombre, apellido, dni, cuil_cuit, condicion_iva)')
          .in('id', ids)
        if (error || !pagos || pagos.length !== ids.length) throw new Error('No se encontraron todos los pagos')
        if (pagos.some((p) => p.comprobante === 'factura_c')) throw new Error('Algún pago ya tiene factura')
        if (new Set(pagos.map((p) => `${p.patient_id}|${p.moneda}`)).size > 1) throw new Error('Una factura no puede juntar pacientes ni monedas distintas')
        if (pagos.some((p) => p.pagador === 'obra_social')) throw new Error('Las facturas a obras sociales todavía se hacen en ARCA a mano')

        const pac = pagos[0].patients as unknown as { id: string; nombre: string; apellido: string | null; dni: string | null; cuil_cuit: string | null; condicion_iva: string | null }
        const moneda = pagos[0].moneda as 'ARS' | 'USD'
        if (moneda === 'USD' && cotizacion === null) cotizacion = leerCotizacion(await wsfe(pedidoCotizacion(auth, 'DOL')))
        const total = Math.round(pagos.reduce((s, p) => s + Number(p.monto), 0) * 100) / 100
        const periodos = pagos.map((p) => p.periodo as string).sort()
        const fecha = hoyAR()
        const datos = {
          puntoVenta: pv,
          numero: ultimo + 1,
          fecha,
          desde: periodos[0],
          hasta: finDeMes(periodos[periodos.length - 1]),
          vencePago: fecha,
          total,
          moneda,
          cotizacion: moneda === 'USD' ? cotizacion! : undefined,
          doc: documento(pac.cuil_cuit, pac.dni),
          condicionIva: condicionIvaReceptor(pac.condicion_iva),
        }
        let r = leerCae(await wsfe(pedidoFacturaC(auth, datos)))
        // Si otra factura tomó el número al mismo tiempo, se pide el último de nuevo y se reintenta una vez
        if (!r.ok && r.errores.some((e) => e.codigo === '10016')) {
          ultimo = leerUltimo(await wsfe(pedidoUltimo(auth, pv)))
          r = leerCae(await wsfe(pedidoFacturaC(auth, { ...datos, numero: ultimo + 1 })))
        }
        if (!r.ok) throw new Error(mensajeErrores(r.errores))
        ultimo = r.numero

        const receptor = [pac.nombre, pac.apellido].filter(Boolean).join(' ')
        const { data: fac, error: errFac } = await admin
          .from('facturas_arca')
          .insert({
            user_id: u.user.id, patient_id: pac.id, punto_venta: pv, numero: r.numero, fecha, desde: datos.desde, hasta: datos.hasta,
            total, moneda, cotizacion: datos.cotizacion ?? null, doc_tipo: datos.doc.tipo, doc_numero: datos.doc.numero,
            condicion_iva: datos.condicionIva, receptor, descripcion: String(f.descripcion ?? '').slice(0, 300) || 'Honorarios profesionales',
            cae: r.cae, cae_vence: r.vence, entorno,
          })
          .select('id')
          .single()
        // El CAE ya existe en ARCA: aunque falle guardar acá, se devuelve para que la profesional no la haga de nuevo
        const numero = numeroFactura(pv, r.numero)
        await admin
          .from('payments')
          .update({ comprobante: 'factura_c', nro_factura: numero, punto_venta: String(pv), cae: r.cae, factura_id: fac?.id ?? null })
          .in('id', ids)
          .eq('user_id', u.user.id)
        resultados.push({ ok: true, numero, cae: r.cae, vence: r.vence, factura_id: fac?.id ?? null, aviso: errFac ? 'La factura se hizo pero no se pudo guardar el PDF' : undefined })
      } catch (e) {
        resultados.push({ ok: false, error: e instanceof Error ? e.message : String(e) })
      }
    }
    return json({ ok: true, entorno, resultados })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 502)
  }
})
