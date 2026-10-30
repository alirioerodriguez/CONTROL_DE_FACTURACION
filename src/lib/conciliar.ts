// Conciliación rápida de transferencias: la profesional pega el texto de un comprobante (del homebanking, de Mercado
// Pago, de un mail o de un WhatsApp) y la app lo lee y sugiere a qué paciente corresponde.
//
// El caso difícil es el que hoy obliga a abrir el Excel: el paciente transfiere desde la cuenta de un familiar y el
// nombre del comprobante no es el suyo. Por eso, además del nombre, se usan el documento (DNI/CUIL), los pagadores ya
// conocidos («siempre paga la mamá») y el monto contra lo que cada paciente debe.
//
// Funciones puras, sin acceso a la base ni a la pantalla. Nada se registra solo: esto solo SUGIERE, y la profesional
// confirma. No guarda el texto pegado (puede traer CBU y datos de terceros): quien use esto no debería persistirlo.
import { hoyAR, normalizar, parseFechaAR, parseMontoAR, type Moneda } from './formato'
import type { Paciente, Pago } from './datos'

// ---------------------------------------------------------------------
// Lectura del comprobante
// ---------------------------------------------------------------------

export interface DatosComprobante {
  monto: number | null
  /** USD si el texto dice US$, U$S o USD; si no, ARS. null si no se encontró monto. */
  moneda: Moneda | null
  /** 'AAAA-MM-DD' */
  fecha: string | null
  /** Nombre de quien envía, tal como figura. */
  remitente: string | null
  /** DNI (7-8 dígitos) o CUIL/CUIT (11), solo dígitos. */
  documento: string | null
  /** Número de operación o de comprobante. */
  referencia: string | null
}

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9,
  octubre: 10, noviembre: 11, diciembre: 12,
}

const MONTO = '(\\d{1,3}(?:\\.\\d{3})+(?:,\\d{1,2})?|\\d+(?:,\\d{1,2})?)'
const CON_SIGNO = new RegExp(`(US\\$|U\\$S|USD|\\$)\\s*${MONTO}`, 'gi')
const PISTA_MONTO = /(importe|monto|recibiste|recibi[oó]|te\s+(?:transfirieron|transfiri[oó]|envi[oó]|pag[oó])|total|transferencia\s+por|acreditad[oa])/i
const NO_ES_EL_MONTO = /(saldo|disponible|comisi[oó]n|impuesto|retenci[oó]n|iva|l[ií]mite|costo)/i

function leerMonto(texto: string): { monto: number | null; moneda: Moneda | null } {
  const hallados: { monto: number; moneda: Moneda; pista: boolean }[] = []
  for (const m of texto.matchAll(CON_SIGNO)) {
    const antes = texto.slice(Math.max(0, (m.index ?? 0) - 40), m.index ?? 0)
    if (NO_ES_EL_MONTO.test(antes.slice(-24))) continue
    const monto = parseMontoAR(m[2])
    if (monto === null || monto <= 0) continue
    hallados.push({ monto, moneda: /^\$$/.test(m[1]) ? 'ARS' : 'USD', pista: PISTA_MONTO.test(antes) })
  }
  // «Importe: 25.000,00» sin signo de pesos.
  if (hallados.length === 0) {
    const m = new RegExp(`(?:importe|monto|total)\\s*(?:transferido|recibido)?\\s*[:\\-]?\\s*${MONTO}`, 'i').exec(texto)
    const monto = m ? parseMontoAR(m[1]) : null
    if (monto !== null && monto > 0) hallados.push({ monto, moneda: /\b(usd|d[oó]lares?)\b/i.test(texto) ? 'USD' : 'ARS', pista: true })
  }
  const elegido = hallados.find((h) => h.pista) ?? hallados[0]
  return elegido ? { monto: elegido.monto, moneda: elegido.moneda } : { monto: null, moneda: null }
}

function leerFecha(texto: string, hoy: string): string | null {
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(texto)
  if (iso) return parseFechaAR(iso[0])
  const num = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/.exec(texto)
  if (num) return parseFechaAR(`${num[1]}/${num[2]}/${num[3]}`)
  const larga = new RegExp(`\\b(\\d{1,2})\\s+de\\s+(${Object.keys(MESES).join('|')})(?:\\s+(?:de|del)\\s+(\\d{4}))?`, 'i').exec(texto)
  if (larga) return parseFechaAR(`${larga[1]}/${MESES[larga[2].toLowerCase()]}/${larga[3] ?? hoy.slice(0, 4)}`)
  return null
}

function leerDocumento(texto: string): string | null {
  const cuil = /\b(20|23|24|27|30|33|34)[-\s]?(\d{8})[-\s]?(\d)\b/.exec(texto)
  if (cuil) return `${cuil[1]}${cuil[2]}${cuil[3]}`
  const dni = /\bDNI\b[\s:.Nº°]*(\d{1,2}\.?\d{3}\.?\d{3})\b/i.exec(texto)
  if (dni) return dni[1].replace(/\./g, '')
  return null
}

function leerReferencia(texto: string): string | null {
  const m = /(?:n[uú]mero\s+de\s+operaci[oó]n|operaci[oó]n|comprobante|referencia|c[oó]digo\s+de\s+transferencia|nro\.?)\s*(?:n[º°.]?\s*)?[:#]?\s*([A-Z0-9][A-Z0-9-]{5,})/i.exec(texto)
  return m ? m[1] : null
}

const PALABRA = "[A-ZÁÉÍÓÚÜÑ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ'’.-]*"
const NOMBRE = new RegExp(`^[\\s:–-]*(${PALABRA}(?:[ \\t]+(?:(?:de|del|la|las|los|y)[ \\t]+)*${PALABRA}){0,4})`)
const NO_ES_PERSONA = /^(banco|mercado|cuenta|cbu|cvu|caja|santander|galicia|bbva|macro|naci[oó]n|provincia|brubank|uala|ual[aá]|naranja|personal pay|transferencia|importe|monto|fecha|alias)\b/i
const COLA = new Set(['por', 'el', 'la', 'en', 'cuil', 'cuit', 'dni', 'cbu', 'cvu', 'para', 'con', 'desde', 'hoy', 'ayer', 'de', 'del', 'y', 'a'])

/** Saca del final las palabras que no son parte del nombre («… Garcia Cuil»). */
function limpiarNombre(n: string): string | null {
  const palabras = n.trim().split(/\s+/)
  while (palabras.length && COLA.has(normalizar(palabras[palabras.length - 1]).replace(/[.]/g, ''))) palabras.pop()
  const r = palabras.join(' ').replace(/[.,;:]+$/, '')
  return r.length >= 3 && !NO_ES_PERSONA.test(r) ? r : null
}

function nombreDespues(texto: string, clave: RegExp): string | null {
  const re = new RegExp(clave.source, clave.flags.includes('g') ? clave.flags : `${clave.flags}g`)
  for (const m of texto.matchAll(re)) {
    const resto = texto.slice((m.index ?? 0) + m[0].length)
    const n = NOMBRE.exec(resto)
    const limpio = n ? limpiarNombre(n[1]) : null
    if (limpio) return limpio
  }
  return null
}

function leerRemitente(texto: string): string | null {
  return (
    // «Ordenante: GARCIA MARIA ELENA», «Origen: …», «Enviado por …»
    nombreDespues(texto, /\b(?:ordenante|remitente|emisor|titular(?:\s+(?:de\s+la\s+)?cuenta)?(?:\s+origen)?|origen|enviado\s+por|transferido\s+por|de\s+parte\s+de|cuenta\s+origen|nombre\s+del\s+ordenante)\b\s*[:-]?/i) ??
    // «Te transfirió Juan Pérez $ 25.000»
    // (`\b` de JavaScript no toma la «ó» como letra, así que se usa una mirada hacia adelante)
    nombreDespues(texto, /\bte\s+(?:transfiri[oó]|envi[oó]|pag[oó]|deposit[oó])(?=\s)/i) ??
    // «Recibiste $ 25.000 de Maria Elena Garcia»
    nombreDespues(texto, /\b(?:recibiste|recibi[oó]|recibida|acreditaci[oó]n|transferencia\s+recibida)(?=[\s:,.])[^\n]{0,60}?\bde\b/i)
  )
}

/** Lee lo que se pueda del texto de un comprobante. Lo que no encuentra queda en null: nunca inventa. */
export function leerComprobante(texto: string, hoy: string = hoyAR()): DatosComprobante {
  const { monto, moneda } = leerMonto(texto)
  return { monto, moneda, fecha: leerFecha(texto, hoy), remitente: leerRemitente(texto), documento: leerDocumento(texto), referencia: leerReferencia(texto) }
}

// ---------------------------------------------------------------------
// Sugerencia de paciente
// ---------------------------------------------------------------------

/** Un pagador que ya se asoció con un paciente (la mamá, el hermano). Se arma con `aprenderPagador`. */
export interface PagadorConocido {
  /** Nombre del remitente tal como figura en los comprobantes. */
  nombre: string
  patient_id: string
}

/** Lo que cada paciente debe hoy, para ayudar a decidir cuando el nombre no alcanza. */
export interface DeudaPaciente {
  moneda: Moneda
  /** Total que debe. */
  total: number
  /** Lo que debe cada mes impago (para reconocer «pagó marzo»). */
  porMes: number[]
}

export type PacienteConciliar = Pick<Paciente, 'id' | 'nombre' | 'apellido' | 'dni' | 'cuil_cuit' | 'moneda' | 'activo'>

export interface Candidato {
  patient_id: string
  /** 0 a 100. */
  puntaje: number
  /** Por qué se lo sugiere, en castellano, para mostrarle a la profesional. */
  motivos: string[]
}

export interface Sugerencia {
  candidatos: Candidato[]
  /** «alta»: coincide el documento o un pagador conocido y nadie más se le acerca. «media»: nombre parecido. «baja»: no alcanza. */
  confianza: 'alta' | 'media' | 'baja'
}

const CONECTORES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e'])
const palabras = (t: string) =>
  normalizar(t)
    .split(/[^a-z0-9ñ]+/)
    .filter((p) => p.length > 0 && !CONECTORES.has(p))
const mismoNombre = (a: string, b: string) => {
  const x = palabras(a).sort().join(' ')
  return x.length > 0 && x === palabras(b).sort().join(' ')
}

const soloDigitos = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '')
/** ¿El documento del comprobante es el del paciente? El CUIL lleva el DNI en el medio: 27-12345678-4. */
function mismoDocumento(doc: string, p: PacienteConciliar): boolean {
  const dni = soloDigitos(p.dni).padStart(8, '0')
  const cuil = soloDigitos(p.cuil_cuit)
  if (doc.length === 11) return (cuil.length === 11 && doc === cuil) || (dni.length === 8 && dni !== '00000000' && doc.slice(2, 10) === dni)
  return dni !== '00000000' && doc.padStart(8, '0') === dni
}

/** Compara el nombre del remitente con el del paciente. */
function puntajeNombre(remitente: string, p: PacienteConciliar): { puntos: number; motivo: string } | null {
  const rem = new Set(palabras(remitente))
  const propias = palabras(`${p.nombre} ${p.apellido ?? ''}`)
  if (propias.length === 0) return null
  const enComun = propias.filter((x) => rem.has(x))
  if (enComun.length === propias.length) return { puntos: 80, motivo: 'el nombre del comprobante es el del paciente' }
  const apellidos = palabras(p.apellido ?? '')
  const nombres = palabras(p.nombre)
  const apellidoCoincide = apellidos.length > 0 && apellidos.every((x) => rem.has(x))
  const nombreCoincide = nombres.length > 0 && nombres.every((x) => rem.has(x))
  if (apellidoCoincide && nombreCoincide) return { puntos: 80, motivo: 'el nombre del comprobante es el del paciente' }
  if (apellidoCoincide) return { puntos: 35, motivo: 'mismo apellido: ¿lo pagó un familiar?' }
  if (nombreCoincide && nombres.length > 1) return { puntos: 30, motivo: 'mismo nombre' }
  if (nombreCoincide) return { puntos: 15, motivo: 'mismo nombre de pila' }
  return null
}

/**
 * Ordena a los pacientes según cuánto se parecen al comprobante. Devuelve hasta 5 candidatos con puntaje > 0.
 * - Documento igual (DNI o CUIL): 100, sin dudas.
 * - Pagador conocido (la mamá que ya pagó antes): 90.
 * - Nombre: 80 si es el del paciente, 35 si solo coincide el apellido, 15 si solo el nombre de pila.
 * - El monto suma 25 si es justo lo que el paciente debe, o 20 si es lo de un mes; resta 30 si la moneda es otra.
 */
export function sugerir(
  c: DatosComprobante,
  pacientes: PacienteConciliar[],
  extras: { conocidos?: PagadorConocido[]; deudas?: Record<string, DeudaPaciente> } = {},
): Sugerencia {
  const { conocidos = [], deudas = {} } = extras
  const candidatos: Candidato[] = []
  for (const p of pacientes) {
    let puntaje = 0
    const motivos: string[] = []
    if (c.documento && mismoDocumento(c.documento, p)) {
      puntaje = 100
      motivos.push('el DNI o CUIL del comprobante es el del paciente')
    } else if (c.remitente && conocidos.some((k) => k.patient_id === p.id && mismoNombre(k.nombre, c.remitente!))) {
      puntaje = 90
      motivos.push(`${c.remitente} ya pagó antes por este paciente`)
    } else if (c.remitente) {
      const n = puntajeNombre(c.remitente, p)
      if (n) {
        puntaje = n.puntos
        motivos.push(n.motivo)
      }
    }
    const d = deudas[p.id]
    // El monto solo ayuda a desempatar: sin otra coincidencia (documento, pagador o nombre) no sugiere a nadie.
    if (puntaje > 0 && c.monto !== null && d && d.moneda === (c.moneda ?? 'ARS')) {
      if (Math.abs(d.total - c.monto) < 0.01 && d.total > 0) {
        puntaje += 25
        motivos.push('el monto es justo lo que debe')
      } else if (d.porMes.some((m) => Math.abs(m - c.monto!) < 0.01 && m > 0)) {
        puntaje += 20
        motivos.push('el monto es lo de un mes')
      }
    }
    if (c.moneda && puntaje > 0 && p.moneda !== c.moneda) {
      puntaje -= 30
      motivos.push(`el paciente paga en ${p.moneda} y el comprobante es en ${c.moneda}`)
    }
    if (!p.activo && puntaje > 0) puntaje -= 10
    puntaje = Math.max(0, Math.min(100, puntaje))
    if (puntaje > 0) candidatos.push({ patient_id: p.id, puntaje, motivos })
  }
  candidatos.sort((a, b) => b.puntaje - a.puntaje)
  const mejores = candidatos.slice(0, 5)
  const [primero, segundo] = mejores
  const confianza: Sugerencia['confianza'] =
    primero && primero.puntaje >= 90 && (!segundo || primero.puntaje - segundo.puntaje >= 20)
      ? 'alta'
      : primero && primero.puntaje >= 60 && (!segundo || primero.puntaje - segundo.puntaje >= 20)
        ? 'media'
        : 'baja'
  return { candidatos: mejores, confianza }
}

// ---------------------------------------------------------------------
// Para no registrar dos veces el mismo pago y para recordar a la mamá
// ---------------------------------------------------------------------

/**
 * ¿Ya hay un pago así cargado? Sí si el monto y la moneda son los mismos y, además, coincide la referencia anotada o la fecha.
 * Mira solo los pagos del paciente indicado. `Pago` no guarda la referencia: si la profesional la anota en observaciones, se detecta.
 */
export function posibleDuplicado(c: DatosComprobante, pagos: Pick<Pago, 'patient_id' | 'monto' | 'moneda' | 'fecha' | 'observaciones'>[], patient_id: string): boolean {
  if (c.monto === null) return false
  return pagos.some(
    (p) =>
      p.patient_id === patient_id &&
      Math.abs(p.monto - c.monto!) < 0.01 &&
      (c.moneda === null || p.moneda === c.moneda) &&
      ((c.referencia !== null && (p.observaciones ?? '').toUpperCase().includes(c.referencia.toUpperCase())) || (c.fecha !== null && p.fecha === c.fecha)),
  )
}

/**
 * Cuando la profesional confirma que un comprobante es de cierto paciente, recuerda el nombre del remitente: la próxima
 * vez que pague la mamá, se reconoce sola. No agrega nada si el remitente ya es el propio paciente o si ya estaba.
 */
export function aprenderPagador(c: DatosComprobante, paciente: PacienteConciliar, conocidos: PagadorConocido[]): PagadorConocido[] {
  if (!c.remitente) return conocidos
  if (puntajeNombre(c.remitente, paciente)?.puntos === 80) return conocidos
  if (conocidos.some((k) => k.patient_id === paciente.id && mismoNombre(k.nombre, c.remitente!))) return conocidos
  return [...conocidos, { nombre: c.remitente, patient_id: paciente.id }]
}
