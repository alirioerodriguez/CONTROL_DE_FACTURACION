// Formato argentino para toda la app: montos, fechas y meses.
// Las fechas de negocio se manejan como texto 'AAAA-MM-DD' (tipo date de
// Postgres) para no arrastrar problemas de zona horaria.

export type Moneda = 'ARS' | 'USD'

export const ZONA_AR = 'America/Argentina/Buenos_Aires'

const numeroAR = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** 25000.5 → "$ 25.000,50" · USD → "US$ 25.000,50" */
export function formatMonto(monto: number, moneda: Moneda): string {
  const prefijo = moneda === 'USD' ? 'US$' : '$'
  const signo = monto < 0 ? '-' : ''
  return `${signo}${prefijo} ${numeroAR.format(Math.abs(monto))}`
}

/**
 * Interpreta un monto escrito a la argentina: "25.000,50", "$ 25.000",
 * "25000", "25000,5". Devuelve null si no es un número válido.
 * Un número que llega como number (por ejemplo, desde Excel) se respeta.
 */
export function parseMontoAR(valor: unknown): number | null {
  if (typeof valor === 'number') return Number.isFinite(valor) ? redondear2(valor) : null
  if (typeof valor !== 'string') return null
  let texto = valor.trim().replace(/US\$|\$|ARS|USD|\s/gi, '')
  if (texto === '') return null
  const negativo = texto.startsWith('-')
  if (negativo) texto = texto.slice(1)

  if (texto.includes(',')) {
    // Coma decimal: los puntos son separadores de miles.
    if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(texto)) return null
    texto = texto.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(texto)) {
    // "25.000" o "1.250.000": puntos de miles, sin decimales.
    texto = texto.replace(/\./g, '')
  } else if (!/^\d+(\.\d{1,2})?$/.test(texto)) {
    return null
  }
  const n = Number(texto)
  if (!Number.isFinite(n)) return null
  return redondear2(negativo ? -n : n)
}

export function redondear2(n: number): number {
  return Math.round(n * 100) / 100
}

/** '2026-03-04' → '04/03/2026' */
export function formatFecha(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

/**
 * Interpreta una fecha dd/mm/aaaa (también d/m/aa, con - o .), una fecha
 * ISO, un Date (Excel) o un número de serie de Excel. Devuelve 'AAAA-MM-DD'
 * o null si no es una fecha real.
 */
export function parseFechaAR(valor: unknown): string | null {
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null
    // Excel guarda fechas sin hora; exceljs las entrega en UTC.
    return isoDesdePartes(valor.getUTCFullYear(), valor.getUTCMonth() + 1, valor.getUTCDate())
  }
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor) || valor < 1) return null
    const ms = Math.round((valor - 25569) * 86400000) // serie de Excel → epoch
    const f = new Date(ms)
    return isoDesdePartes(f.getUTCFullYear(), f.getUTCMonth() + 1, f.getUTCDate())
  }
  if (typeof valor !== 'string') return null
  const texto = valor.trim()

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto)
  if (iso) return isoDesdePartes(+iso[1], +iso[2], +iso[3])

  const ar = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(texto)
  if (!ar) return null
  let anio = +ar[3]
  if (ar[3].length === 2) anio += 2000
  return isoDesdePartes(anio, +ar[2], +ar[1])
}

function isoDesdePartes(anio: number, mes: number, dia: number): string | null {
  if (mes < 1 || mes > 12 || dia < 1 || anio < 1900 || anio > 2200) return null
  const f = new Date(Date.UTC(anio, mes - 1, dia))
  if (f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== dia) return null
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/** Fecha de hoy en Argentina, 'AAAA-MM-DD'. */
export function hoyAR(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_AR }).format(ahora)
}

/** '2026-03-17' → '2026-03-01' */
export function periodoDe(fechaIso: string): string {
  return `${fechaIso.slice(0, 7)}-01`
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** '2026-03-01' → 'marzo 2026' */
export function formatPeriodo(periodo: string): string {
  const [a, m] = periodo.split('-')
  return `${MESES[+m - 1]} ${a}`
}

/**
 * Separa la parte entera de los centavos para mostrarlos más chicos,
 * como en el diseño: "$ 248.000" + ",00". En USD sin centavos no hay decimales.
 */
export function partesMonto(monto: number, moneda: Moneda): { entero: string; decimales: string } {
  if (moneda === 'USD' && Number.isInteger(monto)) {
    return { entero: `US$ ${new Intl.NumberFormat('es-AR').format(monto)}`, decimales: '' }
  }
  const texto = formatMonto(monto, moneda)
  const i = texto.lastIndexOf(',')
  return { entero: texto.slice(0, i), decimales: texto.slice(i) }
}

/** Para escribir un monto en un campo: 25000 → "25.000", 25000.5 → "25.000,5". */
export function montoParaInput(monto: number): string {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(monto)
}

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const DIAS_LARGOS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function diaSemana(fechaIso: string): number {
  const [a, m, d] = fechaIso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay()
}

/** '2026-10-15' → 'Jue 15 oct' */
export function etiquetaDia(fechaIso: string): string {
  const [, m, d] = fechaIso.split('-').map(Number)
  return capitalizar(`${DIAS_CORTOS[diaSemana(fechaIso)]} ${d} ${MESES_CORTOS[m - 1]}`)
}

/** '2026-10-15' → 'Jueves 15 de octubre' */
export function fechaLarga(fechaIso: string): string {
  const [, m, d] = fechaIso.split('-').map(Number)
  return `${DIAS_LARGOS[diaSemana(fechaIso)]} ${d} de ${MESES[m - 1]}`
}

/** Nombre del mes de un periodo: '2026-10-01' → 'octubre'. */
export function nombreMes(periodo: string): string {
  return MESES[Number(periodo.slice(5, 7)) - 1]
}

/** Abreviatura del mes: '2026-10-01' → 'oct'. */
export function mesCorto(periodo: string): string {
  return MESES_CORTOS[Number(periodo.slice(5, 7)) - 1]
}

export const NOMBRES_DIAS = DIAS_CORTOS

export function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** 'Lucía Fernández' → 'LF' */
export function iniciales(nombre: string): string {
  return nombre
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/** Para buscar sin importar tildes ni mayúsculas. */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** plural(1, 'sesión', 'sesiones') → '1 sesión' */
export function plural(n: number, singular: string, pluralTexto: string): string {
  return `${n} ${n === 1 ? singular : pluralTexto}`
}

/** Suma (o resta) días a una fecha 'AAAA-MM-DD'. */
export function sumarDias(fechaIso: string, dias: number): string {
  const [a, m, d] = fechaIso.split('-').map(Number)
  const f = new Date(Date.UTC(a, m - 1, d + dias))
  return f.toISOString().slice(0, 10)
}

/**
 * Número para wa.me a partir de lo que se cargó: "11 5423-8812" → "5491154238812".
 * Si ya tiene código de país (empieza con 54 y tiene 12-13 dígitos, o se
 * escribió con +), se respeta. Devuelve null si no hay suficientes dígitos.
 */
export function numeroWhatsApp(telefono: string | null | undefined): string | null {
  if (!telefono) return null
  const conMas = telefono.trim().startsWith('+')
  let d = telefono.replace(/\D/g, '')
  if (d.length < 8) return null
  if (conMas) return d
  if (d.startsWith('549') && d.length >= 12) return d
  if (d.startsWith('54') && d.length >= 12) return `549${d.slice(2)}`
  d = d.replace(/^0/, '') // 011 → 11
  if (d.length === 12 && d.slice(2, 4) === '15') d = d.slice(0, 2) + d.slice(4) // 11 15 xxxx → 11 xxxx
  return `549${d}`
}

/** Monto abreviado para gráficos: "$ 248 mil", "$ 1,2 M", "US$ 90". */
export function formatCompacto(monto: number, moneda: Moneda): string {
  if (!monto) return ''
  if (moneda === 'USD') return `US$ ${new Intl.NumberFormat('es-AR').format(Math.round(monto))}`
  if (monto >= 1e6) return `$ ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(monto / 1e6)} M`
  if (monto >= 1000) return `$ ${Math.round(monto / 1000)} mil`
  return `$ ${Math.round(monto)}`
}

export const PLANTILLA_WHATSAPP_DEFECTO =
  'Hola {nombre}, ¿cómo estás? Te escribo para recordarte el pago de {mes}: {monto}. ¡Gracias!'

/** Completa la plantilla del recordatorio: {nombre}, {mes} y {monto}. */
export function completarPlantilla(
  plantilla: string,
  valores: { nombre: string; mes: string; monto: string },
): string {
  return (plantilla || PLANTILLA_WHATSAPP_DEFECTO)
    .replace(/\{nombre\}/gi, valores.nombre)
    .replace(/\{mes\}/gi, valores.mes)
    .replace(/\{monto\}/gi, valores.monto)
}

/** Suma (o resta) meses a un periodo 'AAAA-MM-01'. */
export function sumarMeses(periodo: string, cantidad: number): string {
  const [a, m] = periodo.split('-').map(Number)
  const total = a * 12 + (m - 1) + cantidad
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`
}
