// Recibo de pago para el paciente (PDF). No es un comprobante fiscal: lo dice el propio documento.
import { ETIQUETA_MEDIO, nombreCompleto, type Paciente, type Pago, type Perfil } from './datos'
import { capitalizar, formatFecha, formatMonto, formatPeriodo, hoyAR } from './formato'

const UNIDADES = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve']
const DIEZ_A_VEINTINUEVE = [
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
  'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve',
]
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos']

function hasta999(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cien'
  const c = Math.floor(n / 100)
  const r = n % 100
  let resto = ''
  if (r < 10) resto = UNIDADES[r]
  else if (r < 30) resto = DIEZ_A_VEINTINUEVE[r - 10]
  else resto = DECENAS[Math.floor(r / 10)] + (r % 10 ? ` y ${UNIDADES[r % 10]}` : '')
  return [CENTENAS[c], resto].filter(Boolean).join(' ')
}

/** «uno» se apocopa delante de «mil», «millón» o «pesos»: veintiún mil, un millón. */
const apocopar = (t: string) => t.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un')

/** 1234567 → 'un millón doscientos treinta y cuatro mil quinientos sesenta y siete'. Enteros hasta 999.999.999.999. */
export function enLetras(n: number): string {
  const entero = Math.floor(Math.abs(n))
  if (entero === 0) return 'cero'
  const millones = Math.floor(entero / 1_000_000)
  const miles = Math.floor((entero % 1_000_000) / 1000)
  const resto = entero % 1000
  const partes: string[] = []
  if (millones) {
    partes.push(millones === 1 ? 'un millón' : `${apocopar(millonesEnLetras(millones))} millones`)
  }
  if (miles) partes.push(miles === 1 ? 'mil' : `${apocopar(hasta999(miles))} mil`)
  if (resto) partes.push(hasta999(resto))
  return partes.join(' ')
}

function millonesEnLetras(n: number): string {
  const miles = Math.floor(n / 1000)
  const resto = n % 1000
  return [miles ? (miles === 1 ? 'mil' : `${apocopar(hasta999(miles))} mil`) : '', hasta999(resto)].filter(Boolean).join(' ')
}

/** '$ 25.000,50' en letras: 'Son pesos veinticinco mil con 50/100'. */
export function montoEnLetras(monto: number, moneda: 'ARS' | 'USD'): string {
  const entero = Math.floor(monto)
  const centavos = Math.round((monto - entero) * 100)
  const nombre = moneda === 'USD' ? 'dólares estadounidenses' : 'pesos'
  return `Son ${nombre} ${apocopar(enLetras(entero))} con ${String(centavos).padStart(2, '0')}/100`
}

/** Número de recibo corto y estable a partir del id del pago. */
export function numeroRecibo(pago: Pago): string {
  return `R-${pago.fecha.replace(/-/g, '')}-${pago.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`
}

export async function pdfRecibo(pago: Pago, paciente: Paciente, perfil: Perfil | undefined, unidad: string) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a5' })
  const ancho = doc.internal.pageSize.getWidth()
  const verde: [number, number, number] = [85, 127, 105]
  const gris: [number, number, number] = [93, 102, 96]
  const tinta: [number, number, number] = [30, 36, 32]
  let y = 44

  doc.setFillColor(...verde).rect(0, 0, ancho, 8, 'F')
  doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(...tinta).text('Recibo de pago', 32, y)
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...gris)
  doc.text(`Nº ${numeroRecibo(pago)}`, ancho - 32, y - 8, { align: 'right' })
  doc.text(`Fecha: ${formatFecha(pago.fecha)}`, ancho - 32, y + 4, { align: 'right' })

  y += 28
  doc.setFontSize(10).setTextColor(...gris).text('Recibí de', 32, y)
  doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...tinta).text(nombreCompleto(paciente), 32, y + 16)

  y += 46
  doc.setFillColor(238, 237, 231).roundedRect(32, y, ancho - 64, 62, 8, 8, 'F')
  doc.setFont('helvetica', 'bold').setFontSize(22).setTextColor(...tinta).text(formatMonto(pago.monto, pago.moneda), 46, y + 28)
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...gris)
  doc.text(doc.splitTextToSize(montoEnLetras(pago.monto, pago.moneda), ancho - 92), 46, y + 46)

  y += 86
  const filas: [string, string][] = [
    ['Concepto', `Honorarios por ${unidad} de ${capitalizar(formatPeriodo(pago.periodo))}`],
    ['Medio de pago', ETIQUETA_MEDIO[pago.medio]],
  ]
  if (pago.nro_factura) filas.push(['Factura', [pago.punto_venta, pago.nro_factura].filter(Boolean).join('-')])
  for (const [k, v] of filas) {
    doc.setFontSize(10).setTextColor(...gris).text(k, 32, y)
    doc.setTextColor(...tinta).text(doc.splitTextToSize(v, ancho - 160), 128, y)
    y += 20
  }

  y += 30
  doc.setDrawColor(200, 200, 195).line(ancho - 200, y, ancho - 32, y)
  doc.setFontSize(10).setTextColor(...tinta).text(perfil?.nombre || 'Profesional', ancho - 32, y + 14, { align: 'right' })

  const pie = doc.internal.pageSize.getHeight() - 28
  doc.setFontSize(7.5).setTextColor(...gris)
  doc.text('Comprobante de pago. No válido como factura.', 32, pie)
  doc.text(`Generado con honorapp el ${formatFecha(hoyAR())}`, ancho - 32, pie, { align: 'right' })
  return doc
}

export async function descargarRecibo(pago: Pago, paciente: Paciente, perfil: Perfil | undefined, unidad: string) {
  const doc = await pdfRecibo(pago, paciente, perfil, unidad)
  doc.save(`recibo-${numeroRecibo(pago)}.pdf`)
}
