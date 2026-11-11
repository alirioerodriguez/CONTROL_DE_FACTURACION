// Facturación electrónica con ARCA (ex AFIP): armado y lectura de los mensajes de WSAA y WSFEv1.
// Sin dependencias ni APIs de Deno: lo usa la función de Supabase (index.ts) y lo prueban los tests de la web
// (src/lib/wsfe.test.ts). La firma recibe node-forge por parámetro.
//
// Modelo: cada profesional DELEGA el servicio «Facturación Electrónica» al CUIT de honorapp en el
// Administrador de Relaciones de ARCA. honorapp entra a WSAA con SU certificado y factura con el CUIT de la
// profesional en el campo Auth.Cuit. Nunca se pide ni se guarda la clave fiscal. Ver docs/investigacion/arca.md.

export type Entorno = 'homo' | 'prod'

export const URLS: Record<Entorno, { wsaa: string; wsfe: string }> = {
  homo: { wsaa: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms', wsfe: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx' },
  prod: { wsaa: 'https://wsaa.afip.gov.ar/ws/services/LoginCms', wsfe: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx' },
}

export const FACTURA_C = 11
const NS = 'http://ar.gov.afip.dif.FEV1/'

// ---------------------------------------------------------------------
// Utilidades de XML (los mensajes son chicos y de forma fija: no hace falta un parser completo)
// ---------------------------------------------------------------------

export const escapar = (s: string | number) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export const desescapar = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#13;/g, '').replace(/&amp;/g, '&')

/** Contenido de la primera etiqueta `nombre` (con o sin prefijo de namespace). */
export function etiqueta(xml: string, nombre: string): string | null {
  const m = new RegExp(`<(?:[\\w-]+:)?${nombre}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${nombre}>`).exec(xml)
  return m ? m[1].trim() : null
}

/** Todas las apariciones de una etiqueta. */
export function etiquetas(xml: string, nombre: string): string[] {
  const re = new RegExp(`<(?:[\\w-]+:)?${nombre}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${nombre}>`, 'g')
  return [...xml.matchAll(re)].map((m) => m[1].trim())
}

/** 'AAAA-MM-DD' → 'AAAAMMDD' (formato de fechas de WSFEv1). */
export const fechaArca = (iso: string) => iso.slice(0, 10).replace(/-/g, '')
/** 'AAAAMMDD' → 'AAAA-MM-DD'. */
export const fechaIso = (arca: string) => `${arca.slice(0, 4)}-${arca.slice(4, 6)}-${arca.slice(6, 8)}`

/** Importes con punto decimal y 2 decimales, como los pide WSFEv1. */
export const importe = (n: number) => (Math.round(n * 100) / 100).toFixed(2)

// ---------------------------------------------------------------------
// WSAA: ticket de acceso (dura 12 horas; se guarda y se reusa)
// ---------------------------------------------------------------------

/** Fecha con zona horaria de Argentina (-03:00), como la espera WSAA. */
function conZona(ms: number): string {
  const d = new Date(ms - 3 * 3600_000)
  return d.toISOString().slice(0, 19) + '-03:00'
}

/** Pedido de ticket (TRA). Validez de 10 minutos para atrás y para adelante (tolera relojes desfasados). */
export function armarTRA(servicio: string, ahoraMs: number): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<loginTicketRequest version="1.0"><header>' +
    `<uniqueId>${Math.floor(ahoraMs / 1000)}</uniqueId>` +
    `<generationTime>${conZona(ahoraMs - 600_000)}</generationTime>` +
    `<expirationTime>${conZona(ahoraMs + 600_000)}</expirationTime>` +
    `</header><service>${escapar(servicio)}</service></loginTicketRequest>`
  )
}

// Solo lo que se usa de node-forge (para no depender de sus tipos)
interface Forge {
  pki: { certificateFromPem(pem: string): unknown; privateKeyFromPem(pem: string): unknown; oids: Record<string, string> }
  pkcs7: { createSignedData(): FirmaPkcs7 }
  util: { createBuffer(s: string, enc?: string): unknown; encode64(s: string): string }
  asn1: { toDer(a: unknown): { getBytes(): string } }
  md: { sha256: { create(): unknown } }
}
interface FirmaPkcs7 {
  content: unknown
  addCertificate(c: unknown): void
  addSigner(s: unknown): void
  sign(o?: unknown): void
  toAsn1(): unknown
}

/** Firma el TRA con el certificado de honorapp: CMS (PKCS#7) con el contenido adentro, en base64. */
export function firmarTRA(tra: string, certPem: string, keyPem: string, forge: Forge): string {
  const p7 = forge.pkcs7.createSignedData()
  p7.content = forge.util.createBuffer(tra, 'utf8')
  const cert = forge.pki.certificateFromPem(certPem)
  p7.addCertificate(cert)
  p7.addSigner({
    key: forge.pki.privateKeyFromPem(keyPem),
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  })
  p7.sign()
  return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes())
}

export function sobreLoginCms(cmsBase64: string): string {
  return (
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">' +
    `<soapenv:Header/><soapenv:Body><wsaa:loginCms><wsaa:in0>${cmsBase64}</wsaa:in0></wsaa:loginCms></soapenv:Body></soapenv:Envelope>`
  )
}

export interface Ticket {
  token: string
  sign: string
  /** ISO */
  vence: string
}

/** Lee la respuesta de loginCms. Si ARCA devolvió un error, lo tira con su mensaje. */
export function leerTicket(respuesta: string): Ticket {
  const falla = etiqueta(respuesta, 'faultstring')
  if (falla) throw new Error(`ARCA (acceso): ${desescapar(falla)}`)
  const ret = etiqueta(respuesta, 'loginCmsReturn')
  if (!ret) throw new Error('ARCA (acceso): respuesta sin ticket')
  const xml = desescapar(ret)
  const token = etiqueta(xml, 'token')
  const sign = etiqueta(xml, 'sign')
  const vence = etiqueta(xml, 'expirationTime')
  if (!token || !sign || !vence) throw new Error('ARCA (acceso): ticket incompleto')
  return { token, sign, vence: new Date(vence).toISOString() }
}

// ---------------------------------------------------------------------
// WSFEv1
// ---------------------------------------------------------------------

export interface Auth {
  token: string
  sign: string
  /** CUIT de la profesional (la que factura), sin guiones. */
  cuit: string
}

const auth = (a: Auth) => `<Auth><Token>${escapar(a.token)}</Token><Sign>${escapar(a.sign)}</Sign><Cuit>${escapar(a.cuit)}</Cuit></Auth>`

const sobre = (cuerpo: string) =>
  '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' + `<soap:Body>${cuerpo}</soap:Body></soap:Envelope>`

/** Sobre SOAP y SOAPAction de un método de WSFEv1. */
export function pedidoWsfe(metodo: string, contenido: string): { cuerpo: string; soapAction: string } {
  return { cuerpo: sobre(`<${metodo} xmlns="${NS}">${contenido}</${metodo}>`), soapAction: NS + metodo }
}

export const pedidoDummy = () => pedidoWsfe('FEDummy', '')

export const pedidoUltimo = (a: Auth, puntoVenta: number, tipo = FACTURA_C) =>
  pedidoWsfe('FECompUltimoAutorizado', `${auth(a)}<PtoVta>${puntoVenta}</PtoVta><CbteTipo>${tipo}</CbteTipo>`)

export const pedidoCotizacion = (a: Auth, moneda: string) => pedidoWsfe('FEParamGetCotizacion', `${auth(a)}<MonId>${escapar(moneda)}</MonId>`)

export interface ErrorArca {
  codigo: string
  mensaje: string
}

/** Errores (Errors/Err) y observaciones (Observaciones/Obs) de cualquier respuesta de WSFEv1. */
export function erroresArca(xml: string): { errores: ErrorArca[]; observaciones: ErrorArca[] } {
  const leer = (bloque: string | null, item: string) =>
    bloque ? etiquetas(bloque, item).map((e) => ({ codigo: etiqueta(e, 'Code') ?? '', mensaje: desescapar(etiqueta(e, 'Msg') ?? '') })) : []
  return { errores: leer(etiqueta(xml, 'Errors'), 'Err'), observaciones: leer(etiqueta(xml, 'Observaciones'), 'Obs') }
}

function fallaSoap(xml: string) {
  const f = etiqueta(xml, 'faultstring')
  if (f) throw new Error(`ARCA: ${desescapar(f)}`)
}

export function leerDummy(xml: string): { app: string; db: string; auth: string } {
  fallaSoap(xml)
  return { app: etiqueta(xml, 'AppServer') ?? '', db: etiqueta(xml, 'DbServer') ?? '', auth: etiqueta(xml, 'AuthServer') ?? '' }
}

/** Último número autorizado de ese punto de venta (0 si nunca se facturó). */
export function leerUltimo(xml: string): number {
  fallaSoap(xml)
  const { errores } = erroresArca(xml)
  if (errores.length) throw new Error(mensajeErrores(errores))
  return Number(etiqueta(xml, 'CbteNro') ?? 0)
}

export function leerCotizacion(xml: string): number {
  fallaSoap(xml)
  const { errores } = erroresArca(xml)
  if (errores.length) throw new Error(mensajeErrores(errores))
  const c = Number(etiqueta(xml, 'MonCotiz'))
  if (!(c > 0)) throw new Error('ARCA no devolvió la cotización del dólar')
  return c
}

// ---------------------------------------------------------------------
// Factura C
// ---------------------------------------------------------------------

/** Tipos de documento del receptor (tabla de ARCA). */
export const DOC = { CUIT: 80, CUIL: 86, DNI: 96, SIN: 99 } as const

/**
 * Tabla de condiciones frente al IVA del receptor (campo CondicionIVAReceptorId, obligatorio desde el 01/12/2026, RG 5616).
 * Copiada de una guía de terceros del 10/11/2026 que dice haberla comprobado con facturas reales (spomsolutions.com): NO se pudo
 * cotejar con la tabla oficial de ARCA, que solo se lee con el método FEParamGetCondicionIvaReceptor (hace falta acceso). Los códigos
 * 2, 3, 11, 12 y 14 no están. Antes de emitir en producción, correr `pedidoCondicionesIvaReceptor` en homologación y comparar.
 */
export const CONDICIONES_IVA_RECEPTOR: Record<number, string> = {
  1: 'IVA Responsable Inscripto',
  4: 'IVA Sujeto Exento',
  5: 'Consumidor Final',
  6: 'Responsable Monotributo',
  7: 'Sujeto No Categorizado',
  8: 'Proveedor del Exterior',
  9: 'Cliente del Exterior',
  10: 'IVA Liberado – Ley N° 19.640',
  13: 'Monotributista Social',
  15: 'IVA No Alcanzado',
  16: 'Monotributo Trabajador Independiente Promovido',
}

/** Pide a ARCA la tabla vigente de condiciones del receptor (opcionalmente solo las válidas para una clase de comprobante: 'A', 'B', 'C'…). */
export const pedidoCondicionesIvaReceptor = (a: Auth, claseCmp?: string) =>
  pedidoWsfe('FEParamGetCondicionIvaReceptor', `${auth(a)}${claseCmp ? `<ClaseCmp>${escapar(claseCmp)}</ClaseCmp>` : ''}`)

export interface CondicionIvaArca {
  id: number
  descripcion: string
  /** Clases de comprobante para las que vale (A, B, C…), si ARCA las informa. */
  clases: string[]
}

/** Respuesta de FEParamGetCondicionIvaReceptor → lista (una fila por condición, juntando las clases). Estructura sin confirmar: probar en homologación. */
export function leerCondicionesIvaReceptor(xml: string): CondicionIvaArca[] {
  fallaSoap(xml)
  const { errores } = erroresArca(xml)
  if (errores.length) throw new Error(mensajeErrores(errores))
  const porId = new Map<number, CondicionIvaArca>()
  for (const fila of etiquetas(xml, 'CondicionIvaReceptor')) {
    const id = Number(etiqueta(fila, 'Id'))
    if (!Number.isInteger(id)) continue
    const previa = porId.get(id) ?? { id, descripcion: desescapar(etiqueta(fila, 'Desc') ?? ''), clases: [] }
    const clase = etiqueta(fila, 'Cmp_Clase')
    if (clase && !previa.clases.includes(clase)) previa.clases.push(clase)
    porId.set(id, previa)
  }
  if (!porId.size) throw new Error('ARCA no devolvió condiciones del receptor')
  return [...porId.values()].sort((a, b) => a.id - b.id)
}

/** ¿El código que vamos a mandar está en la tabla de ARCA (y, si la informó, vale para esa clase)? */
export function condicionValida(id: number, tabla: CondicionIvaArca[], clase?: string): boolean {
  const c = tabla.find((x) => x.id === id)
  return !!c && (!clase || !c.clases.length || c.clases.includes(clase))
}

/** Condición frente al IVA del receptor → código de ARCA (obligatorio desde la RG 5616). */
export function condicionIvaReceptor(condicion: string | null | undefined): number {
  const c = (condicion ?? '').toLowerCase()
  if (c.includes('responsable inscripto')) return 1
  if (c.includes('exento')) return 4
  if (c.includes('monotribut')) return 6
  return 5 // consumidor final
}

/** Documento a partir de lo que tiene cargado el paciente: CUIT/CUIL (11 dígitos), DNI, o sin documento. */
export function documento(cuilCuit: string | null | undefined, dni: string | null | undefined): { tipo: number; numero: string } {
  const cuit = (cuilCuit ?? '').replace(/\D/g, '')
  if (cuit.length === 11) return { tipo: /^(20|23|24|27)/.test(cuit) ? DOC.CUIL : DOC.CUIT, numero: cuit }
  const d = (dni ?? '').replace(/\D/g, '')
  if (d.length >= 7 && d.length <= 8) return { tipo: DOC.DNI, numero: d }
  return { tipo: DOC.SIN, numero: '0' }
}

export interface DatosFactura {
  puntoVenta: number
  numero: number
  /** 'AAAA-MM-DD' */
  fecha: string
  /** Servicios prestados: período facturado. */
  desde: string
  hasta: string
  /** Vencimiento del pago (servicios): la fecha de la factura. */
  vencePago: string
  total: number
  moneda: 'ARS' | 'USD'
  /** Pesos por dólar (solo USD). */
  cotizacion?: number
  doc: { tipo: number; numero: string }
  condicionIva: number
}

/** Pedido de CAE para una Factura C de servicios (concepto 2). En la C no se discrimina IVA: neto = total. */
export function pedidoFacturaC(a: Auth, f: DatosFactura) {
  const usd = f.moneda === 'USD'
  const det =
    `<Concepto>2</Concepto><DocTipo>${f.doc.tipo}</DocTipo><DocNro>${escapar(f.doc.numero)}</DocNro>` +
    `<CbteDesde>${f.numero}</CbteDesde><CbteHasta>${f.numero}</CbteHasta><CbteFch>${fechaArca(f.fecha)}</CbteFch>` +
    `<ImpTotal>${importe(f.total)}</ImpTotal><ImpTotConc>0.00</ImpTotConc><ImpNeto>${importe(f.total)}</ImpNeto>` +
    `<ImpOpEx>0.00</ImpOpEx><ImpTrib>0.00</ImpTrib><ImpIVA>0.00</ImpIVA>` +
    `<FchServDesde>${fechaArca(f.desde)}</FchServDesde><FchServHasta>${fechaArca(f.hasta)}</FchServHasta><FchVtoPago>${fechaArca(f.vencePago)}</FchVtoPago>` +
    `<MonId>${usd ? 'DOL' : 'PES'}</MonId><MonCotiz>${usd ? String(f.cotizacion) : '1'}</MonCotiz>` +
    (usd ? '<CanMisMonExt>S</CanMisMonExt>' : '') +
    `<CondicionIVAReceptorId>${f.condicionIva}</CondicionIVAReceptorId>`
  return pedidoWsfe(
    'FECAESolicitar',
    `${auth(a)}<FeCAEReq><FeCabReq><CantReg>1</CantReg><PtoVta>${f.puntoVenta}</PtoVta><CbteTipo>${FACTURA_C}</CbteTipo></FeCabReq>` +
      `<FeDetReq><FECAEDetRequest>${det}</FECAEDetRequest></FeDetReq></FeCAEReq>`,
  )
}

export type ResultadoCae =
  | { ok: true; cae: string; vence: string; numero: number; observaciones: ErrorArca[] }
  | { ok: false; errores: ErrorArca[] }

/** Lee la respuesta de FECAESolicitar: aprobada (A) con CAE, o rechazada con los motivos de ARCA. */
export function leerCae(xml: string): ResultadoCae {
  fallaSoap(xml)
  const { errores, observaciones } = erroresArca(xml)
  const det = etiqueta(xml, 'FECAEDetResponse') ?? ''
  const resultado = etiqueta(det, 'Resultado') ?? etiqueta(xml, 'Resultado')
  const cae = etiqueta(det, 'CAE')
  if (resultado === 'A' && cae) {
    return { ok: true, cae, vence: fechaIso(etiqueta(det, 'CAEFchVto') ?? ''), numero: Number(etiqueta(det, 'CbteDesde')), observaciones }
  }
  const motivos = [...errores, ...observaciones]
  return { ok: false, errores: motivos.length ? motivos : [{ codigo: '', mensaje: 'ARCA rechazó la factura sin explicar el motivo' }] }
}

/** Errores de ARCA en castellano claro para la profesional (los más comunes); el resto, tal cual. */
export function mensajeErrores(errores: ErrorArca[]): string {
  return errores
    .map((e) => {
      if (e.codigo === '600' || /no autorizado|not authorized|Computador no autorizado/i.test(e.mensaje))
        return 'honorapp todavía no tiene permiso para facturar por vos: revisá que delegaste «Facturación Electrónica» en ARCA'
      if (e.codigo === '602' || /punto de venta/i.test(e.mensaje)) return `Punto de venta: ${e.mensaje}`
      if (e.codigo === '10016') return 'El número de factura ya se usó (otra factura se hizo al mismo tiempo). Probá de nuevo.'
      return e.codigo ? `${e.mensaje} (código ${e.codigo})` : e.mensaje
    })
    .join(' · ')
}

/** Link del código QR obligatorio en el comprobante (RG 4892). */
export function linkQr(d: {
  fecha: string
  cuit: string
  puntoVenta: number
  numero: number
  total: number
  moneda: 'ARS' | 'USD'
  cotizacion?: number
  doc: { tipo: number; numero: string }
  cae: string
}, base64: (s: string) => string): string {
  const datos = {
    ver: 1,
    fecha: d.fecha,
    cuit: Number(d.cuit),
    ptoVta: d.puntoVenta,
    tipoCmp: FACTURA_C,
    nroCmp: d.numero,
    importe: Math.round(d.total * 100) / 100,
    moneda: d.moneda === 'USD' ? 'DOL' : 'PES',
    ctz: d.moneda === 'USD' ? d.cotizacion ?? 1 : 1,
    tipoDocRec: d.doc.tipo,
    nroDocRec: Number(d.doc.numero),
    tipoCodAut: 'E',
    codAut: Number(d.cae),
  }
  return `https://www.afip.gob.ar/fe/qr/?p=${base64(JSON.stringify(datos))}`
}

/** 'C 00002-00000123' */
export const numeroFactura = (puntoVenta: number, numero: number) =>
  `C ${String(puntoVenta).padStart(5, '0')}-${String(numero).padStart(8, '0')}`
