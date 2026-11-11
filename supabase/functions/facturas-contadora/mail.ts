// Mail del día 1 a la contadora: las facturas que honorapp hizo en ARCA el mes anterior, con una planilla
// (CSV) adjunta lista para cargar. Sin dependencias: lo prueba src/lib/mailContadora.test.ts.
import { monto } from '../aviso-mensual/aviso.ts'

export interface FacturaMail {
  punto_venta: number
  numero: number
  fecha: string
  receptor: string
  doc_tipo: number
  doc_numero: string
  total: number
  moneda: 'ARS' | 'USD'
  cotizacion: number | null
  cae: string
  cae_vence: string
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DOC: Record<number, string> = { 80: 'CUIT', 86: 'CUIL', 96: 'DNI', 99: 'Sin identificar' }
const escapar = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const fecha = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const nro = (f: FacturaMail) => `C ${String(f.punto_venta).padStart(5, '0')}-${String(f.numero).padStart(8, '0')}`

/** Mes anterior a `hoy` ('AAAA-MM-DD'): { desde, hasta (excluido), nombre }. */
export function mesAnterior(hoy: string): { desde: string; hasta: string; nombre: string } {
  const [a, m] = hoy.split('-').map(Number)
  const am = m === 1 ? a - 1 : a
  const mm = m === 1 ? 12 : m - 1
  return { desde: `${am}-${String(mm).padStart(2, '0')}-01`, hasta: `${a}-${String(m).padStart(2, '0')}-01`, nombre: `${MESES[mm - 1]} ${am}` }
}

/** Planilla para la contadora: una fila por factura, separada por punto y coma (Excel en castellano). */
export function csvFacturas(facturas: FacturaMail[]): string {
  const celda = (v: string | number) => {
    const t = String(v)
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  const num = (n: number) => n.toFixed(2).replace('.', ',')
  const filas = [
    ['Fecha', 'Tipo', 'Número', 'Receptor', 'Tipo doc.', 'Documento', 'Moneda', 'Importe', 'Cotización', 'Importe en pesos', 'CAE', 'Vto. CAE'],
    ...facturas.map((f) => [
      fecha(f.fecha), 'Factura C', nro(f), f.receptor, DOC[f.doc_tipo] ?? String(f.doc_tipo), f.doc_tipo === 99 ? '' : f.doc_numero,
      f.moneda, num(f.total), f.moneda === 'USD' && f.cotizacion ? num(f.cotizacion) : '1',
      num(f.moneda === 'USD' && f.cotizacion ? Math.round(f.total * f.cotizacion * 100) / 100 : f.total), f.cae, fecha(f.cae_vence),
    ]),
  ]
  // BOM para que Excel lea bien los acentos
  return '﻿' + filas.map((r) => r.map(celda).join(';')).join('\r\n') + '\r\n'
}

export function armarMailContadora(profesional: { nombre: string | null; cuit: string | null }, facturas: FacturaMail[], hoy: string) {
  const mes = mesAnterior(hoy)
  const quien = profesional.nombre || 'Tu clienta'
  const tot = (m: 'ARS' | 'USD') => facturas.filter((f) => f.moneda === m).reduce((s, f) => s + f.total, 0)
  const totales = [tot('ARS') > 0 ? monto(tot('ARS'), 'ARS') : '', tot('USD') > 0 ? monto(tot('USD'), 'USD') : ''].filter(Boolean).join(' y ')
  const cuantas = facturas.length === 1 ? '1 factura' : `${facturas.length} facturas`
  const asunto = `Facturas de ${mes.nombre} · ${quien}`
  const archivo = `facturas-${mes.desde.slice(0, 7)}-${(profesional.cuit ?? '').replace(/\D/g, '') || 'clienta'}.csv`
  const pie = `Te llega porque ${quien} lo activó en honorapp. Las facturas las emitió ARCA (cada una tiene su CAE). Si preferís no recibirlo, pedile que lo apague en Ajustes.`
  const texto = [
    'Hola:',
    '',
    `${quien}${profesional.cuit ? ` (CUIT ${profesional.cuit})` : ''} hizo ${cuantas} en ${mes.nombre} por ${totales}.`,
    'Va adjunta la planilla con número, receptor, importe y CAE de cada una.',
    '',
    ...facturas.map((f) => `${fecha(f.fecha)} · ${nro(f)} · ${f.receptor} · ${monto(f.total, f.moneda)} · CAE ${f.cae}`),
    '',
    pie,
  ].join('\n')
  const filas = facturas
    .map((f) => `<tr><td style="padding:6px 8px;border-top:1px solid #E3E2DB">${fecha(f.fecha)}</td><td style="padding:6px 8px;border-top:1px solid #E3E2DB">${nro(f)}</td><td style="padding:6px 8px;border-top:1px solid #E3E2DB">${escapar(f.receptor)}</td><td style="padding:6px 8px;border-top:1px solid #E3E2DB;text-align:right;white-space:nowrap">${monto(f.total, f.moneda)}</td></tr>`)
    .join('')
  const html = `<!doctype html><html lang="es"><body style="margin:0;padding:24px 12px;background:#F5F4F0;font-family:Helvetica,Arial,sans-serif;color:#1E2420">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#FFFFFF;border:1px solid #E3E2DB;border-radius:22px;padding:28px">
<tr><td style="font-family:Georgia,serif;font-size:26px;padding-bottom:8px">Facturas de ${escapar(mes.nombre)}</td></tr>
<tr><td style="font-size:16px;line-height:1.5;color:#5D6660;padding-bottom:16px">${escapar(quien)}${profesional.cuit ? ` · CUIT ${escapar(profesional.cuit)}` : ''} hizo ${cuantas} por <b style="color:#1E2420">${escapar(totales)}</b>. Va adjunta la planilla con el CAE de cada una.</td></tr>
<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px"><tr style="color:#5D6660;text-align:left"><th style="padding:6px 8px">Fecha</th><th style="padding:6px 8px">Número</th><th style="padding:6px 8px">Receptor</th><th style="padding:6px 8px;text-align:right">Importe</th></tr>${filas}</table></td></tr>
<tr><td style="font-size:13px;line-height:1.5;color:#5D6660;border-top:1px solid #E3E2DB;padding-top:16px;margin-top:16px">${escapar(pie)}</td></tr>
</table></body></html>`
  return { asunto, texto, html, adjunto: { nombre: archivo, contenido: csvFacturas(facturas) } }
}
