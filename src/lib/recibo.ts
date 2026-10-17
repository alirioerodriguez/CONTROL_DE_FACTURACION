// Recibo de pago para el paciente (PDF). No es un comprobante fiscal: lo dice el propio documento.
import { ETIQUETA_MEDIO, nombreCompleto, type Paciente, type Pago, type Perfil } from './datos'
import { formatFecha, formatMonto, formatPeriodo, hoyAR, numeroWhatsApp } from './formato'
import { C, caja, etiqueta, franja, linea, montoGrande, nuevoPdf, pie, texto } from './pdfEstilo'
import { etiquetaProfesion } from './terminos'

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
  const p = await nuevoPdf()

  franja(p)
  etiqueta(p, 'Comprobante de pago', 62, 78)
  texto(p, 'Recibo de pago', 62, 128, { t: 54, serif: true })
  texto(p, [perfil?.nombre, `Honorarios de ${formatPeriodo(pago.periodo)}`].filter(Boolean).join(' · '), 62, 160, { t: 16, color: C.gris })
  texto(p, 'N.º', 677, 82, { t: 14.5, color: C.gris, alinear: 'right' })
  texto(p, numeroRecibo(pago), 863, 82, { t: 14.5, peso: 'semibold', alinear: 'right' })
  texto(p, 'Fecha', 677, 105, { t: 14.5, color: C.gris, alinear: 'right' })
  texto(p, formatFecha(pago.fecha), 863, 105, { t: 14.5, peso: 'semibold', alinear: 'right' })
  linea(p, 62, 200, 863)

  texto(p, 'Recibí de', 62, 262, { t: 16, color: C.gris })
  texto(p, nombreCompleto(paciente), 62, 300, { t: 25, peso: 'bold', ancho: 380 })
  texto(p, 'Profesional', 481, 262, { t: 16, color: C.gris })
  texto(p, perfil?.nombre || 'Profesional', 481, 298, { t: 22, peso: 'semibold', ancho: 373 })
  const detalle = [etiquetaProfesion(perfil?.profesion), perfil?.matricula].filter(Boolean).join(' · ')
  if (detalle) texto(p, detalle, 481, 329, { t: 16, color: C.gris, ancho: 373 })

  caja(p, 62, 380, 801, 204, C.fondoVerde)
  etiqueta(p, 'Importe recibido', 99, 434, C.verdeEtiqueta, 15)
  montoGrande(p, pago.monto, pago.moneda, 99, 509, 64)
  texto(p, montoEnLetras(pago.monto, pago.moneda), 99, 548, { t: 17, color: C.gris, ancho: 727 })

  const filas: [string, string][] = [
    ['Concepto', `Honorarios por ${unidad} de ${formatPeriodo(pago.periodo)}`],
    ['Medio de pago', ETIQUETA_MEDIO[pago.medio]],
  ]
  if (pago.nro_factura) filas.push(['Factura', [pago.punto_venta, pago.nro_factura].filter(Boolean).join('-')])
  let y = 664
  for (const [k, v] of filas) {
    texto(p, k, 62, y, { t: 19, color: C.gris })
    texto(p, v, 281, y, { t: 19, ancho: 573 })
    linea(p, 62, y + 29, 863)
    y += 59
  }

  linea(p, 493, 1106, 863, [200, 200, 195])
  texto(p, perfil?.nombre || 'Profesional', 493, 1138, { t: 19, peso: 'semibold', ancho: 361 })
  texto(p, 'Firma y aclaración', 493, 1170, { t: 15, color: C.gris })

  pie(p, ['Comprobante de pago. No válido como factura.', `Generado con honorapp el ${formatFecha(hoyAR())}`], 62, 863)
  return p.doc
}

export async function descargarRecibo(pago: Pago, paciente: Paciente, perfil: Perfil | undefined, unidad: string) {
  const doc = await pdfRecibo(pago, paciente, perfil, unidad)
  doc.save(`recibo-${numeroRecibo(pago)}.pdf`)
}

/** Texto que acompaña al recibo cuando se comparte. */
export function mensajeRecibo(pago: Pago, paciente: Paciente, perfil: Perfil | undefined): string {
  const firma = perfil?.nombre ? `\n${perfil.nombre}` : ''
  return `Hola ${paciente.nombre}, te paso el recibo del pago de ${formatMonto(pago.monto, pago.moneda)} (honorarios de ${formatPeriodo(pago.periodo)}). ¡Gracias!${firma}`
}

/** Link para abrir WhatsApp con el mensaje (al número del paciente si lo tiene). */
export function linkWhatsAppRecibo(pago: Pago, paciente: Paciente, perfil: Perfil | undefined): string {
  const numero = numeroWhatsApp(paciente.telefono)
  return `https://wa.me/${numero ?? ''}?text=${encodeURIComponent(mensajeRecibo(pago, paciente, perfil))}`
}

/** Link mailto con asunto y cuerpo (al mail del paciente si lo tiene). */
export function linkMailRecibo(pago: Pago, paciente: Paciente, perfil: Perfil | undefined): string {
  const asunto = `Recibo de pago · ${formatPeriodo(pago.periodo)}`
  const cuerpo = `${mensajeRecibo(pago, paciente, perfil)}\n\n(El recibo va adjunto en PDF.)`
  return `mailto:${encodeURIComponent(paciente.email ?? '')}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`
}

/**
 * Comparte el PDF con el menú del celular (WhatsApp, mail, etc.).
 * Devuelve 'sin-soporte' si el navegador no puede compartir archivos (la mayoría de las computadoras).
 */
export async function compartirRecibo(
  pago: Pago,
  paciente: Paciente,
  perfil: Perfil | undefined,
  unidad: string,
): Promise<'compartido' | 'cancelado' | 'sin-soporte'> {
  if (typeof navigator === 'undefined' || !navigator.canShare) return 'sin-soporte'
  const doc = await pdfRecibo(pago, paciente, perfil, unidad)
  const archivo = new File([doc.output('blob')], `recibo-${numeroRecibo(pago)}.pdf`, { type: 'application/pdf' })
  if (!navigator.canShare({ files: [archivo] })) return 'sin-soporte'
  try {
    await navigator.share({ files: [archivo], title: 'Recibo de pago', text: mensajeRecibo(pago, paciente, perfil) })
    return 'compartido'
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'cancelado'
    throw e
  }
}
