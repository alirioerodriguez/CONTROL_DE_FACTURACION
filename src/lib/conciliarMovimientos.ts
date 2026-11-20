// «Conciliar el mes»: en vez de un comprobante por vez, la profesional sube el Excel o CSV de movimientos que exporta su
// banco o Mercado Pago (o pega varios comprobantes juntos) y la app propone, para cada ingreso, a qué paciente
// corresponde. Es lo que hoy obliga a abrir el Excel en la PC: cotejar depósito por depósito.
//
// No adivina el formato de cada banco: detecta las columnas por el encabezado y la profesional puede corregirlas.
// Funciones puras (sin base ni pantalla). Nada se registra solo: la profesional revisa y confirma.
// El detalle de los movimientos no se guarda (puede traer CBU y datos de terceros): solo el número de operación,
// si lo hay, para reconocer el pago si se vuelve a subir el mismo extracto.
import { leerComprobante, posibleDuplicado, sugerir, type DatosComprobante, type DeudaPaciente, type PacienteConciliar, type PagadorConocido, type Sugerencia } from './conciliar'
import { normalizar, parseMontoAR, type Moneda } from './formato'
import { leerFecha, pistaColumna } from './importar/fechas'
import type { Celda, Hoja } from './importar/leer'
import type { Pago } from './datos'

// ---------------------------------------------------------------------
// Columnas
// ---------------------------------------------------------------------

/** Índice de cada columna en la hoja; -1 si no está. */
export interface Columnas {
  fecha: number
  /** Descripción, concepto u origen: de ahí sale quién pagó. */
  detalle: number
  /** Importe del movimiento (con signo) o columna de créditos. */
  monto: number
  /** Columna de débitos, si el banco separa débitos y créditos. */
  debito: number
  /** Columna de moneda, si la hay. */
  moneda: number
  /** Número de operación, si viene en su propia columna. */
  referencia: number
}

const ENCABEZADOS: Record<keyof Columnas, RegExp> = {
  fecha: /^(fecha|fecha de (operacion|movimiento|origen|acreditacion|liberacion)|fecha mov|date|dia)\b/,
  detalle: /(descripcion|detalle|concepto|movimiento|origen|contraparte|nombre|ordenante|remitente|leyenda|referencia adicional)/,
  monto: /^(importe|monto|credito|creditos|ingreso|ingresos|haber|neto|monto neto|valor|amount|importe credito)\b/,
  debito: /^(debito|debitos|egreso|egresos|debe|importe debito)\b/,
  moneda: /^(moneda|divisa|currency)\b/,
  referencia: /(n(ro|umero)?\.? de (operacion|comprobante|transaccion)|operacion|comprobante|id de (operacion|transaccion)|referencia$)/,
}

/** Busca cada columna por su encabezado. La profesional puede cambiarlas en pantalla. */
export function adivinarColumnas(hoja: Hoja): Columnas {
  const encab = hoja.encabezados.map((e) => normalizar(String(e ?? '')).trim())
  const usadas = new Set<number>()
  const buscar = (campo: keyof Columnas): number => {
    const i = encab.findIndex((e, j) => !usadas.has(j) && ENCABEZADOS[campo].test(e))
    if (i >= 0) usadas.add(i)
    return i
  }
  // El orden importa: «Fecha de operación» no es la referencia, y «Importe débito» no es el monto.
  const fecha = buscar('fecha')
  const debito = buscar('debito')
  const monto = buscar('monto')
  const referencia = buscar('referencia')
  const moneda = buscar('moneda')
  const detalle = buscar('detalle')
  return { fecha, detalle, monto, debito, moneda, referencia }
}

// ---------------------------------------------------------------------
// Movimientos
// ---------------------------------------------------------------------

export interface Movimiento {
  /** Fila del archivo (o número de bloque si se pegó texto). */
  fila: number
  /** Texto del detalle, para mostrar. No se guarda. */
  detalle: string
  /** Lo que se leyó, en el mismo formato que un comprobante pegado. */
  datos: DatosComprobante
  /** Si la fecha se interpretó (no venía en dd/mm/aaaa). */
  notaFecha?: string
}

// Palabras de los extractos que no son el nombre de quien pagó.
const RUIDO = new Set([
  'transf', 'transferencia', 'transferencias', 'trf', 'trans', 'transfer', 'recibida', 'recibido', 'recib', 'inmed', 'inmediata',
  'proveed', 'proveedores', 'cred', 'credito', 'deb', 'debito', 'cvu', 'cbu', 'alias', 'de', 'del', 'desde', 'por', 'cobro', 'pago',
  'dinero', 'ingreso', 'acreditacion', 'acred', 'operacion', 'op', 'nro', 'n', 'mercado', 'mercadopago', 'mp', 'interbanking',
  'dif', 'titular', 'varios', 'cta', 'ctas', 'cuenta', 'cuil', 'cuit', 'dni', 'ref', 'referencia', 'banco', 'online', 'home',
  'banking', 'hb', 'debin', 'echeq', 'cheque', 'deposito', 'efectivo', 'ars', 'usd', 'en', 'pesos', 'dolares', 'a', 'y', 'e',
])

/** Quién pagó, a partir del detalle de un extracto («TRANSF. RECIBIDA - PEREZ JUAN CARLOS - CUIL 20-...»). */
export function remitenteDeDetalle(detalle: string): string | null {
  const directo = leerComprobante(detalle).remitente
  if (directo) return directo
  const palabras = detalle
    .replace(/\d+/g, ' ')
    .split(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ'’]+/)
    .filter((p) => p.length >= 2 && !RUIDO.has(normalizar(p)))
  if (palabras.length < 2) return null
  return palabras.slice(0, 5).join(' ')
}

const texto = (c: Celda | undefined): string => (c == null ? '' : c instanceof Date ? '' : String(c).trim())

/**
 * Los ingresos de la hoja con las columnas elegidas. Se saltean los egresos (monto negativo o con débito), los ceros y
 * las filas sin fecha o sin monto. Devuelve también cuántas filas se dejaron de lado, para mostrarlo.
 */
export function movimientosDeHoja(hoja: Hoja, col: Columnas, hoy: string, monedaPorDefecto: Moneda = 'ARS'): { movimientos: Movimiento[]; ignorados: number } {
  const pista = pistaColumna(hoja, col.fecha, hoy)
  const movimientos: Movimiento[] = []
  let ignorados = 0
  for (const { numero, celdas } of hoja.filas) {
    const monto = col.monto >= 0 ? parseMontoAR(celdas[col.monto] as unknown) : null
    const debito = col.debito >= 0 ? parseMontoAR(celdas[col.debito] as unknown) : null
    const fecha = col.fecha >= 0 ? leerFecha(celdas[col.fecha] ?? null, pista) : { iso: null }
    if (monto == null || monto <= 0 || (debito != null && debito !== 0) || !fecha.iso) {
      ignorados++
      continue
    }
    const detalle = texto(celdas[col.detalle])
    const leido = leerComprobante(detalle, hoy)
    const monedaCelda = normalizar(texto(celdas[col.moneda]))
    const moneda: Moneda = /usd|u\$s|us\$|dolar/.test(monedaCelda) ? 'USD' : /ars|peso|\$/.test(monedaCelda) ? 'ARS' : monedaPorDefecto
    const referencia = texto(celdas[col.referencia]) || leido.referencia
    movimientos.push({
      fila: numero,
      detalle,
      datos: { monto, moneda, fecha: fecha.iso, remitente: remitenteDeDetalle(detalle), documento: leido.documento, referencia: referencia || null },
      ...(fecha.nota ? { notaFecha: fecha.nota } : {}),
    })
  }
  return { movimientos, ignorados }
}

/** Varios comprobantes pegados juntos (de WhatsApp o del mail), separados por una línea en blanco. */
export function movimientosDeTexto(textoPegado: string, hoy: string): Movimiento[] {
  return textoPegado
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length >= 8)
    .map((bloque, i) => ({ fila: i + 1, detalle: bloque.replace(/\s+/g, ' ').slice(0, 160), datos: leerComprobante(bloque, hoy) }))
    .filter((m) => m.datos.monto !== null && m.datos.monto > 0)
}

// ---------------------------------------------------------------------
// Propuesta
// ---------------------------------------------------------------------

export interface Propuesta {
  mov: Movimiento
  sugerencia: Sugerencia
  /** Paciente propuesto (solo si la confianza no es baja). La profesional lo puede cambiar. */
  elegido: string | null
  /** Ya hay un pago así cargado para el paciente propuesto. */
  yaCargado: boolean
}

/** Para cada movimiento, el paciente más probable con la misma lógica que «Pegar un comprobante». */
export function proponer(
  movs: Movimiento[],
  pacientes: PacienteConciliar[],
  extras: { conocidos?: PagadorConocido[]; deudas?: Record<string, DeudaPaciente>; pagos?: Pick<Pago, 'patient_id' | 'monto' | 'moneda' | 'fecha' | 'observaciones'>[] } = {},
): Propuesta[] {
  return movs.map((mov) => {
    const sugerencia = sugerir(mov.datos, pacientes, extras)
    const elegido = sugerencia.confianza !== 'baja' ? (sugerencia.candidatos[0]?.patient_id ?? null) : null
    return { mov, sugerencia, elegido, yaCargado: elegido ? posibleDuplicado(mov.datos, extras.pagos ?? [], elegido) : false }
  })
}

// ---------------------------------------------------------------------
// Id estable del pago
// ---------------------------------------------------------------------

/**
 * Un id fijo para el pago de cada movimiento: si se sube dos veces el mismo extracto, la base reconoce el pago y no lo
 * duplica. Sale de la profesional, la fecha, el monto, la moneda, la operación (o el detalle) y el orden entre
 * movimientos idénticos (dos transferencias iguales el mismo día son dos pagos). Formato UUID.
 */
export async function idDePago(userId: string, mov: Movimiento, ordinal: number): Promise<string> {
  const d = mov.datos
  const base = [userId, d.fecha, d.monto?.toFixed(2), d.moneda, d.referencia ?? normalizar(mov.detalle).replace(/\s+/g, ' '), ordinal].join('|')
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(base)))
  const b = hash.slice(0, 16)
  b[6] = (b[6] & 0x0f) | 0x50 // versión 5 (por nombre)
  b[8] = (b[8] & 0x3f) | 0x80 // variante RFC 4122
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** Orden de cada movimiento entre los idénticos (misma fecha, monto, moneda y detalle u operación). */
export function ordinales(movs: Movimiento[]): number[] {
  const vistos = new Map<string, number>()
  return movs.map((m) => {
    const k = [m.datos.fecha, m.datos.monto, m.datos.moneda, m.datos.referencia ?? normalizar(m.detalle)].join('|')
    const n = vistos.get(k) ?? 0
    vistos.set(k, n + 1)
    return n
  })
}
