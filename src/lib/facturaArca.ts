// Factura electrónica con ARCA desde honorapp: llamadas a la función arca-factura, las facturas emitidas y su PDF.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import QRCode from 'qrcode'
import { linkQr, numeroFactura } from '../../supabase/functions/arca-factura/wsfe'
import type { Perfil } from './datos'
import type { Factura } from './facturar'
import { formatFecha, formatMonto, hoyAR } from './formato'
import { compartirPdf, linkMail, type ResultadoCompartir } from './compartir'
import { formatCuil } from './documentos'
import { C, caja, etiqueta, franja, linea, montoGrande, nuevoPdf, pie, texto, type Pdf } from './pdfEstilo'
import { montoEnLetras } from './recibo'
import { supabase } from './supabase'

export interface FacturaArca {
  id: string
  patient_id: string | null
  punto_venta: number
  numero: number
  fecha: string
  desde: string
  hasta: string
  total: number
  moneda: 'ARS' | 'USD'
  cotizacion: number | null
  doc_tipo: number
  doc_numero: string
  condicion_iva: number
  receptor: string
  descripcion: string
  cae: string
  cae_vence: string
  entorno: 'homo' | 'prod'
}

export type ResultadoEmision = { ok: true; numero: string; cae: string; factura_id: string | null; aviso?: string } | { ok: false; error: string }

/** CUIT de honorapp, el que la profesional pone en ARCA al delegar. Sin cargar: la función todavía no está disponible. */
export const CUIT_HONORAPP = (import.meta.env.VITE_ARCA_CUIT as string | undefined) ?? ''

const CLAVE = ['facturas-arca'] as const

/** true si la profesional conectó honorapp con ARCA (Ajustes → Facturar con ARCA). */
export const arcaListo = (perfil: Perfil | undefined) => !!perfil?.arca_punto_venta && !!perfil?.arca_conectado_at

/** Las de obra social se siguen haciendo a mano (honorapp no guarda el CUIT de la obra social). */
export const automatizable = (f: Factura) => f.pagador !== 'obra_social'

async function llamar<T>(cuerpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('arca-factura', { body: cuerpo })
  if (error) {
    // El mensaje útil viene en el cuerpo de la respuesta
    const ctx = (error as { context?: Response }).context
    const detalle = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null
    throw new Error(detalle?.error ?? error.message)
  }
  return data as T
}

/** Comprueba que honorapp puede facturar por la profesional. Devuelve el último número autorizado. */
export const probarArca = () => llamar<{ ok: true; entorno: string; ultimo: string }>({ accion: 'probar' })

/** Pide el CAE de cada factura, en orden. Cada una dice si salió o por qué no. */
export async function emitirFacturas(facturas: { pagos: string[]; descripcion: string }[]): Promise<ResultadoEmision[]> {
  const r = await llamar<{ resultados: ResultadoEmision[] }>({ accion: 'emitir', facturas })
  return r.resultados
}

export function useFacturasArca() {
  return useQuery({
    queryKey: CLAVE,
    queryFn: async () => {
      const { data, error } = await supabase.from('facturas_arca').select('*').order('fecha', { ascending: false }).order('numero', { ascending: false }).limit(500)
      if (error) throw error
      return (data ?? []).map((f) => ({ ...f, total: Number(f.total), cotizacion: f.cotizacion == null ? null : Number(f.cotizacion) })) as FacturaArca[]
    },
  })
}

export function useRefrescarFacturas() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: CLAVE })
}

// ---------------------------------------------------------------------
// PDF de la Factura C (con el QR que pide ARCA)
// ---------------------------------------------------------------------

const CONDICION: Record<number, string> = { 1: 'IVA Responsable Inscripto', 4: 'IVA Sujeto Exento', 5: 'Consumidor Final', 6: 'Responsable Monotributo' }
const DOC: Record<number, string> = { 80: 'CUIT', 86: 'CUIL', 96: 'DNI', 99: '' }

export const nombreArchivo = (f: FacturaArca) => `factura-${numeroFactura(f.punto_venta, f.numero).replace(/\s/g, '-')}.pdf`

async function dibujar(p: Pdf, f: FacturaArca, perfil: Perfil | undefined) {
  const numero = numeroFactura(f.punto_venta, f.numero)
  franja(p)
  // Letra del comprobante en el centro, como piden las normas de ARCA
  caja(p, 421, 40, 82, 82, C.fondoNeutro, 14)
  texto(p, 'C', 462, 104, { t: 58, peso: 'bold', alinear: 'center' })
  texto(p, 'Cód. 011', 462, 140, { t: 12, color: C.gris, alinear: 'center' })
  etiqueta(p, 'Original', 62, 70)
  texto(p, 'Factura', 62, 122, { t: 48, serif: true })
  texto(p, 'N.º', 677, 82, { t: 14.5, color: C.gris, alinear: 'right' })
  texto(p, numero, 863, 82, { t: 14.5, peso: 'semibold', alinear: 'right' })
  texto(p, 'Fecha', 677, 105, { t: 14.5, color: C.gris, alinear: 'right' })
  texto(p, formatFecha(f.fecha), 863, 105, { t: 14.5, peso: 'semibold', alinear: 'right' })
  linea(p, 62, 170, 863)

  // Emisor
  texto(p, perfil?.nombre || 'Profesional', 62, 214, { t: 22, peso: 'semibold', ancho: 380 })
  const emisor = [
    perfil?.cuit ? `CUIT ${formatCuil(perfil.cuit)}` : '',
    'Responsable Monotributo',
    (perfil as { domicilio_fiscal?: string | null } | undefined)?.domicilio_fiscal ?? '',
  ].filter(Boolean)
  emisor.forEach((l, i) => texto(p, l, 62, 244 + i * 22, { t: 15, color: C.gris, ancho: 380 }))

  // Receptor
  texto(p, 'Para', 481, 214, { t: 15, color: C.gris })
  texto(p, f.receptor, 481, 244, { t: 20, peso: 'semibold', ancho: 373 })
  const receptor = [DOC[f.doc_tipo] && f.doc_numero !== '0' ? `${DOC[f.doc_tipo]} ${f.doc_tipo === 96 ? f.doc_numero : formatCuil(f.doc_numero)}` : '', CONDICION[f.condicion_iva] ?? '']
  receptor.filter(Boolean).forEach((l, i) => texto(p, l, 481, 272 + i * 22, { t: 15, color: C.gris, ancho: 373 }))

  // Detalle
  const filas: [string, string][] = [
    ['Concepto', f.descripcion],
    ['Período facturado', `${formatFecha(f.desde)} al ${formatFecha(f.hasta)}`],
    ['Vencimiento del pago', formatFecha(f.fecha)],
    ['Condición de venta', 'Contado'],
  ]
  if (f.moneda === 'USD' && f.cotizacion) filas.push(['Moneda', `Dólares · cotización ARCA ${formatMonto(f.cotizacion, 'ARS')}`])
  let y = 360
  for (const [k, v] of filas) {
    texto(p, k, 62, y, { t: 17, color: C.gris })
    texto(p, v, 300, y, { t: 17, ancho: 560 })
    linea(p, 62, y + 26, 863)
    y += 54
  }

  caja(p, 62, y + 10, 801, 170, C.fondoVerde)
  etiqueta(p, 'Importe total', 99, y + 60, C.verdeEtiqueta, 15)
  montoGrande(p, f.total, f.moneda, 99, y + 128, 56)
  texto(p, montoEnLetras(f.total, f.moneda), 99, y + 162, { t: 15, color: C.gris, ancho: 727 })

  // CAE y QR
  const yCae = y + 240
  const qr = await QRCode.toDataURL(
    linkQr(
      { fecha: f.fecha, cuit: (perfil?.cuit ?? '').replace(/\D/g, ''), puntoVenta: f.punto_venta, numero: f.numero, total: f.total, moneda: f.moneda, cotizacion: f.cotizacion ?? undefined, doc: { tipo: f.doc_tipo, numero: f.doc_numero }, cae: f.cae },
      (s) => btoa(s),
    ),
    { margin: 0, width: 256 },
  )
  p.doc.addImage(qr, 'PNG', 62 * p.k, yCae * p.k, 150 * p.k, 150 * p.k)
  texto(p, 'Comprobante autorizado por ARCA', 240, yCae + 30, { t: 16, peso: 'semibold' })
  texto(p, `CAE N.º ${f.cae}`, 240, yCae + 62, { t: 16 })
  texto(p, `Vencimiento del CAE: ${formatFecha(f.cae_vence)}`, 240, yCae + 90, { t: 16, color: C.gris })
  if (f.entorno === 'homo') texto(p, 'PRUEBA · SIN VALIDEZ FISCAL', 240, yCae + 130, { t: 20, peso: 'bold', color: C.aviso })

  pie(p, [`Factura electrónica hecha con honorapp el ${formatFecha(hoyAR())}`], 62, 863)
}

/** PDF de una o varias facturas (una por hoja). */
export async function pdfFacturas(facturas: FacturaArca[], perfil: Perfil | undefined) {
  const p = await nuevoPdf()
  for (let i = 0; i < facturas.length; i++) {
    if (i) p.doc.addPage()
    await dibujar(p, facturas[i], perfil)
  }
  return p.doc
}

export async function descargarFacturas(facturas: FacturaArca[], perfil: Perfil | undefined, nombre?: string) {
  const doc = await pdfFacturas(facturas, perfil)
  doc.save(nombre ?? (facturas.length === 1 ? nombreArchivo(facturas[0]) : `facturas-${hoyAR()}.pdf`))
}

export function mensajeFactura(f: FacturaArca, perfil: Perfil | undefined): string {
  const firma = perfil?.nombre ? `\n${perfil.nombre}` : ''
  return `Hola, te paso la factura ${numeroFactura(f.punto_venta, f.numero)} por ${formatMonto(f.total, f.moneda)}. ¡Gracias!${firma}`
}

/** Comparte con el menú del celular. En la computadora: 'sin-soporte' (se descarga y se abre el mail). */
export async function compartirFacturas(facturas: FacturaArca[], perfil: Perfil | undefined, texto: string, para?: string | null): Promise<ResultadoCompartir> {
  const doc = await pdfFacturas(facturas, perfil)
  const archivo = facturas.length === 1 ? nombreArchivo(facturas[0]) : `facturas-${hoyAR()}.pdf`
  const r = typeof navigator !== 'undefined' && 'canShare' in navigator ? await compartirPdf(doc.output('blob'), archivo, 'Factura', texto) : 'sin-soporte'
  if (r === 'sin-soporte') {
    doc.save(archivo)
    window.open(linkMail(para, facturas.length === 1 ? `Factura ${numeroFactura(facturas[0].punto_venta, facturas[0].numero)}` : 'Facturas del mes', `${texto}\n\n(Va adjunta en PDF.)`), '_blank', 'noopener')
  }
  return r
}
