// Estilo común de los PDF (recibo y reporte para contadora), según los diseños de
// docs/diseno/pdf/ (Recibo HonorApp.pdf y Reporte Contadora HonorApp.pdf).
// Las medidas se piensan en "px de diseño" (hoja de 923 px de ancho) y se pasan a puntos A4.
import type { jsPDF as JsPDF } from 'jspdf'
import { formatMonto, type Moneda } from './formato'

type RGB = [number, number, number]

export const C = {
  verde: [85, 127, 105] as RGB,
  verdeEtiqueta: [78, 122, 96] as RGB,
  tinta: [30, 36, 32] as RGB,
  gris: [93, 102, 96] as RGB,
  grisClaro: [150, 156, 152] as RGB,
  linea: [227, 226, 219] as RGB,
  fondoVerde: [237, 242, 238] as RGB,
  fondoNeutro: [243, 242, 238] as RGB,
  aviso: [143, 100, 24] as RGB,
  blanco: [255, 255, 255] as RGB,
}

/** Ancho de la hoja del diseño, en px. */
const ANCHO_DISENO = 923

export interface Pdf {
  doc: JsPDF
  /** px de diseño → puntos. */
  k: number
  serif: string
  sans: string
  /** true si se cargaron Figtree e Instrument Serif (si no, Helvetica). */
  conFuentes: boolean
}

const FUENTES: { archivo: string; nombre: string; estilo: string }[] = [
  { archivo: 'figtree-400.ttf', nombre: 'Figtree', estilo: 'normal' },
  { archivo: 'figtree-600.ttf', nombre: 'Figtree', estilo: 'semibold' },
  { archivo: 'figtree-700.ttf', nombre: 'Figtree', estilo: 'bold' },
  { archivo: 'instrument-serif.ttf', nombre: 'InstrumentSerif', estilo: 'normal' },
]

let cache: Promise<Record<string, string> | null> | null = null

function aBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

/** Lee las fuentes de /fuentes (en el navegador) o de public/fuentes (en los tests). null si no se pudo. */
async function leerFuentes(): Promise<Record<string, string> | null> {
  try {
    const salida: Record<string, string> = {}
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      for (const f of FUENTES) {
        const res = await fetch(`/fuentes/${f.archivo}`)
        if (!res.ok) return null
        salida[f.archivo] = aBase64(await res.arrayBuffer())
      }
    } else {
      const fs = await import(/* @vite-ignore */ 'node:' + 'fs')
      for (const f of FUENTES) salida[f.archivo] = fs.readFileSync(`public/fuentes/${f.archivo}`).toString('base64')
    }
    return salida
  } catch {
    return null
  }
}

export async function nuevoPdf(): Promise<Pdf> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const k = doc.internal.pageSize.getWidth() / ANCHO_DISENO
  cache ??= leerFuentes()
  const fuentes = await cache
  if (!fuentes) return { doc, k, serif: 'times', sans: 'helvetica', conFuentes: false }
  for (const f of FUENTES) {
    doc.addFileToVFS(f.archivo, fuentes[f.archivo])
    doc.addFont(f.archivo, f.nombre, f.estilo)
  }
  return { doc, k, serif: 'InstrumentSerif', sans: 'Figtree', conFuentes: true }
}

type Peso = 'normal' | 'semibold' | 'bold'

export interface OpcionesTexto {
  /** Tamaño en px de diseño. */
  t: number
  peso?: Peso
  serif?: boolean
  color?: RGB
  alinear?: 'left' | 'right' | 'center'
  /** Espaciado entre letras en px de diseño (para las etiquetas en mayúsculas). */
  espaciado?: number
  ancho?: number
}

/** Escribe un texto en coordenadas de diseño (x, y = línea de base). */
export function texto(p: Pdf, s: string | string[], x: number, y: number, o: OpcionesTexto) {
  const { doc, k } = p
  const peso = p.conFuentes ? (o.peso ?? 'normal') : o.peso === 'normal' || !o.peso ? 'normal' : 'bold'
  doc.setFont(o.serif ? p.serif : p.sans, o.serif ? 'normal' : peso)
  doc.setFontSize(o.t * k)
  doc.setTextColor(...(o.color ?? C.tinta))
  const contenido = o.ancho ? doc.splitTextToSize(Array.isArray(s) ? s.join(' ') : s, o.ancho * k) : s
  doc.text(contenido, x * k, y * k, { align: o.alinear ?? 'left', charSpace: (o.espaciado ?? 0) * k })
}

/** Etiqueta chica en mayúsculas y espaciada (COMPROBANTE, IMPORTE RECIBIDO…). */
export function etiqueta(p: Pdf, s: string, x: number, y: number, color: RGB = C.verdeEtiqueta, t = 13) {
  texto(p, s.toUpperCase(), x, y, { t, peso: 'semibold', color, espaciado: 1.6 })
}

export function linea(p: Pdf, x1: number, y: number, x2: number, color: RGB = C.linea, grosor = 1.2) {
  p.doc.setDrawColor(...color).setLineWidth(grosor * p.k).line(x1 * p.k, y * p.k, x2 * p.k, y * p.k)
}

export function caja(p: Pdf, x: number, y: number, w: number, h: number, color: RGB, radio = 22) {
  p.doc.setFillColor(...color).roundedRect(x * p.k, y * p.k, w * p.k, h * p.k, radio * p.k, radio * p.k, 'F')
}

/** Monto con los centavos más chicos y grises: $ 125.000,00. Devuelve el ancho en px de diseño. */
export function montoGrande(p: Pdf, monto: number, moneda: Moneda, x: number, y: number, t: number) {
  const completo = formatMonto(monto, moneda)
  const i = completo.lastIndexOf(',')
  const entero = completo.slice(0, i)
  const decimales = completo.slice(i)
  texto(p, entero, x, y, { t, peso: 'bold' })
  p.doc.setFont(p.sans, 'bold').setFontSize(t * p.k)
  const anchoEntero = p.doc.getTextWidth(entero) / p.k
  texto(p, decimales, x + anchoEntero, y, { t: t * 0.5, peso: 'semibold', color: C.gris })
}

/** Logo de honorapp (h con tilde de cobro) en vector, grilla de 48. */
export function logo(p: Pdf, x: number, y: number, tam: number, conNombre = true) {
  const { doc, k } = p
  const u = (tam / 48) * k
  doc.setFillColor(...C.verde).roundedRect(x * k, y * k, 48 * u, 48 * u, 12 * u, 12 * u, 'F')
  doc.setDrawColor(...C.blanco).setLineWidth(4.4 * u).setLineCap('round').setLineJoin('round')
  doc.lines([[0, 28]], x * k + 16 * u, y * k + 10 * u, [u, u], 'S')
  doc.lines(
    [
      [0, -5, 3.5, -8, 7.5, -8],
      [4, 0, 7.5, 3, 7.5, 8],
      [0, 6],
      [5, -5],
    ],
    x * k + 16 * u,
    y * k + 27 * u,
    [u, u],
    'S',
  )
  doc.setLineCap('butt').setLineJoin('miter')
  if (conNombre) texto(p, 'honorapp', x + tam * 1.35, y + tam * 0.72, { t: tam * 0.6, peso: 'bold', espaciado: -0.3 })
}

/** Franja verde arriba de cada hoja. */
export function franja(p: Pdf) {
  p.doc.setFillColor(...C.verde).rect(0, 0, p.doc.internal.pageSize.getWidth(), 14 * p.k, 'F')
}

/** Pie: línea, logo y textos a la derecha (al fondo de la hoja), entre los márgenes x1 y x2. */
export function pie(p: Pdf, lineas: string[], x1 = 69, x2 = 854) {
  const alto = p.doc.internal.pageSize.getHeight() / p.k
  linea(p, x1, alto - 106, x2)
  logo(p, x1, alto - 76, 36)
  lineas.forEach((l, i) => texto(p, l, x2, alto - 58 + i * 22, { t: 13.5, color: C.gris, alinear: 'right' }))
}
