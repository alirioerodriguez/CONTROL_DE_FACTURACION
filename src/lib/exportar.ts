// Exportación a Excel (.xlsx) y PDF. Las librerías se cargan recién al exportar.
import type { Worksheet } from 'exceljs'
import { ETIQUETA_MEDIO, nombreCompleto, type Paciente, type Pago, type Perfil, type Sesion } from './datos'
import { capitalizar, formatFecha, formatMonto, formatPeriodo, hoyAR, periodoDe, type Moneda } from './formato'
import { MEDIOS, reporteContadora, reporteMes } from './reportes'
import { tarifaVigente } from './saldos'

type Fila = (string | number | Date | null)[]
type Tipo = 'texto' | 'monto' | 'fecha' | 'numero'
interface Columna {
  titulo: string
  ancho?: number
  tipo?: Tipo
}

const FORMATO_MONTO = '#,##0.00'
const FORMATO_FECHA = 'dd/mm/yyyy'

/** 'AAAA-MM-DD' → Date en UTC (Excel la muestra como fecha, sin corrimiento de zona). */
const fechaExcel = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d))
}

function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

async function libroNuevo() {
  const { default: ExcelJS } = await import('exceljs')
  const libro = new ExcelJS.Workbook()
  libro.creator = 'honorapp'
  libro.created = new Date()
  return libro
}

function tabla(hoja: Worksheet, columnas: Columna[], filas: Fila[], filasTotal: Fila[] = []) {
  hoja.columns = columnas.map((c) => ({ header: c.titulo, width: c.ancho ?? 16 }))
  const enc = hoja.getRow(1)
  enc.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  enc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF557F69' } }
  hoja.views = [{ state: 'frozen', ySplit: 1 }]
  for (const f of filas) hoja.addRow(f)
  for (const f of filasTotal) {
    const r = hoja.addRow(f)
    r.font = { bold: true }
    r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEDE7' } }
  }
  columnas.forEach((c, i) => {
    const col = hoja.getColumn(i + 1)
    if (c.tipo === 'monto') col.numFmt = FORMATO_MONTO
    if (c.tipo === 'fecha') col.numFmt = FORMATO_FECHA
  })
}

async function guardarLibro(libro: Awaited<ReturnType<typeof libroNuevo>>, nombre: string) {
  const datos = await libro.xlsx.writeBuffer()
  descargar(new Blob([datos], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nombre)
}

const mesArchivo = (periodo: string) => periodo.slice(0, 7)

// ---------------------------------------------------------------------
// Reporte del mes
// ---------------------------------------------------------------------

export async function exportarReporteMes(periodo: string, pacientes: Paciente[], sesiones: Sesion[], pagos: Pago[]) {
  const r = reporteMes(periodo, pacientes, sesiones, pagos)
  const libro = await libroNuevo()
  const hoja = libro.addWorksheet(capitalizar(formatPeriodo(periodo)))
  tabla(
    hoja,
    [
      { titulo: 'Paciente', ancho: 28 },
      { titulo: 'Moneda', ancho: 9 },
      { titulo: 'Sesiones', ancho: 10, tipo: 'numero' },
      { titulo: 'Fechas', ancho: 34 },
      { titulo: 'Facturado', tipo: 'monto' },
      { titulo: 'Cobrado', tipo: 'monto' },
      { titulo: 'Pendiente', tipo: 'monto' },
    ],
    r.filas.map((f) => [
      f.nombre,
      f.moneda,
      f.sesiones.length,
      f.sesiones.map((s) => formatFecha(s.fecha).slice(0, 5)).join(' '),
      f.facturado,
      f.cobrado,
      f.pendiente,
    ]),
    r.totales.map((t) => [`Total ${t.moneda}`, t.moneda, t.sesiones, '', t.facturado, t.cobrado, t.pendiente]),
  )
  await guardarLibro(libro, `honorapp-${mesArchivo(periodo)}.xlsx`)
}

// ---------------------------------------------------------------------
// Reporte para contadora
// ---------------------------------------------------------------------

const COMPROBANTE: Record<Pago['comprobante'], string> = {
  factura_c: 'Factura C',
  recibo: 'Recibo',
  sin_comprobante: 'Sin comprobante',
}

function titulosRango(desde: string, hasta: string) {
  return desde === hasta
    ? capitalizar(formatPeriodo(desde))
    : `${capitalizar(formatPeriodo(desde))} a ${formatPeriodo(hasta)}`
}

export async function exportarContadoraXlsx(desde: string, hasta: string, perfil: Perfil | undefined, pacientes: Paciente[], pagos: Pago[]) {
  const r = reporteContadora(desde, hasta, hoyAR(), pacientes, pagos)
  const libro = await libroNuevo()

  const resumen = libro.addWorksheet('Por mes')
  const filas: Fila[] = []
  for (const m of r.meses) {
    for (const moneda of ['ARS', 'USD'] as Moneda[]) {
      const a = m.porMoneda[moneda]
      if (!a.cantidad) continue
      filas.push([capitalizar(formatPeriodo(m.periodo)), moneda, ...MEDIOS.map((x) => a.medios[x]), a.total, `${a.conFactura} / ${a.cantidad}`])
    }
  }
  const totales = (['ARS', 'USD'] as Moneda[])
    .filter((m) => r.totales[m].cantidad)
    .map((m) => ['Total del período', m, ...MEDIOS.map((x) => r.totales[m].medios[x]), r.totales[m].total, `${r.totales[m].conFactura} / ${r.totales[m].cantidad}`] as Fila)
  tabla(
    resumen,
    [
      { titulo: 'Mes', ancho: 18 },
      { titulo: 'Moneda', ancho: 9 },
      ...MEDIOS.map((x) => ({ titulo: ETIQUETA_MEDIO[x], tipo: 'monto' as Tipo })),
      { titulo: 'Total', tipo: 'monto' },
      { titulo: 'Con factura', ancho: 12 },
    ],
    filas,
    totales,
  )
  resumen.addRow([])
  resumen.addRow([`Últimos 12 meses (${formatPeriodo(r.rango12.desde)} – ${formatPeriodo(r.rango12.hasta)})`]).font = { bold: true }
  for (const m of ['ARS', 'USD'] as Moneda[]) {
    const fila = resumen.addRow([m, null, null, null, null, null, r.ultimos12[m].total])
    fila.getCell(7).numFmt = FORMATO_MONTO
  }

  const detalle = libro.addWorksheet('Pagos')
  tabla(
    detalle,
    [
      { titulo: 'Fecha de pago', ancho: 13, tipo: 'fecha' },
      { titulo: 'Mes imputado', ancho: 16 },
      { titulo: 'Paciente', ancho: 28 },
      { titulo: 'Moneda', ancho: 9 },
      { titulo: 'Medio de pago', ancho: 15 },
      { titulo: 'Comprobante', ancho: 16 },
      { titulo: 'Punto de venta', ancho: 14 },
      { titulo: 'Nº de factura', ancho: 18 },
      { titulo: 'Monto', tipo: 'monto' },
    ],
    r.meses.flatMap((m) =>
      m.pagos.map(({ pago: p, paciente }) => [
        fechaExcel(p.fecha),
        capitalizar(formatPeriodo(p.periodo)),
        paciente,
        p.moneda,
        ETIQUETA_MEDIO[p.medio],
        COMPROBANTE[p.comprobante],
        p.punto_venta,
        p.nro_factura,
        p.monto,
      ]),
    ),
  )

  const datos = libro.addWorksheet('Profesional')
  datos.columns = [{ width: 24 }, { width: 40 }]
  ;[
    ['Profesional', perfil?.nombre ?? ''],
    ['Mail', perfil?.email ?? ''],
    ['Período', titulosRango(desde, hasta)],
    ['Generado', formatFecha(hoyAR())],
  ].forEach((f) => datos.addRow(f))

  await guardarLibro(libro, `contadora-${mesArchivo(desde)}-a-${mesArchivo(hasta)}.xlsx`)
}

/** Arma el PDF para la contadora (separado de la descarga para poder probarlo). */
export async function pdfContadora(desde: string, hasta: string, perfil: Perfil | undefined, pacientes: Paciente[], pagos: Pago[]) {
  const r = reporteContadora(desde, hasta, hoyAR(), pacientes, pagos)
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const verde: [number, number, number] = [85, 127, 105]
  let y = 48

  doc.setFont('helvetica', 'bold').setFontSize(18).text('Reporte de cobros', 40, y)
  y += 20
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(93, 102, 96)
  const linea = [perfil?.nombre, titulosRango(desde, hasta), `Generado el ${formatFecha(hoyAR())}`].filter(Boolean).join(' · ')
  doc.text(linea, 40, y)
  y += 16
  doc.text(
    `Últimos 12 meses (${formatPeriodo(r.rango12.desde)} – ${formatPeriodo(r.rango12.hasta)}): ${formatMonto(r.ultimos12.ARS.total, 'ARS')} · ${formatMonto(r.ultimos12.USD.total, 'USD')}`,
    40,
    y,
  )
  doc.setTextColor(30, 36, 32)

  const cuerpo: string[][] = []
  for (const m of r.meses) {
    for (const moneda of ['ARS', 'USD'] as Moneda[]) {
      const a = m.porMoneda[moneda]
      if (!a.cantidad) continue
      cuerpo.push([capitalizar(formatPeriodo(m.periodo)), moneda, ...MEDIOS.map((x) => formatMonto(a.medios[x], moneda)), formatMonto(a.total, moneda), `${a.conFactura}/${a.cantidad}`])
    }
  }
  const pie = (['ARS', 'USD'] as Moneda[])
    .filter((m) => r.totales[m].cantidad)
    .map((m) => ['Total', m, ...MEDIOS.map((x) => formatMonto(r.totales[m].medios[x], m)), formatMonto(r.totales[m].total, m), `${r.totales[m].conFactura}/${r.totales[m].cantidad}`])

  autoTable(doc, {
    startY: y + 18,
    head: [['Mes', 'Moneda', ...MEDIOS.map((x) => ETIQUETA_MEDIO[x]), 'Total', 'Fact.']],
    body: cuerpo,
    foot: pie,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: verde },
    footStyles: { fillColor: [238, 237, 231], textColor: [30, 36, 32] },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
  })

  const finTabla = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  doc.setFont('helvetica', 'bold').setFontSize(12).text('Detalle de pagos', 40, finTabla + 30)
  autoTable(doc, {
    startY: finTabla + 40,
    head: [['Fecha', 'Paciente', 'Medio', 'Comprobante', 'Nº de factura', 'Monto']],
    body: r.meses.flatMap((m) =>
      m.pagos.map(({ pago: p, paciente }) => [
        formatFecha(p.fecha),
        paciente,
        ETIQUETA_MEDIO[p.medio],
        COMPROBANTE[p.comprobante],
        [p.punto_venta, p.nro_factura].filter(Boolean).join('-') || '—',
        formatMonto(p.monto, p.moneda),
      ]),
    ),
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: verde },
    columnStyles: { 5: { halign: 'right' } },
  })

  return doc
}

export async function exportarContadoraPdf(desde: string, hasta: string, perfil: Perfil | undefined, pacientes: Paciente[], pagos: Pago[]) {
  const doc = await pdfContadora(desde, hasta, perfil, pacientes, pagos)
  doc.save(`contadora-${mesArchivo(desde)}-a-${mesArchivo(hasta)}.pdf`)
}

// ---------------------------------------------------------------------
// Backup completo: mismo formato que la plantilla, se puede volver a importar
// ---------------------------------------------------------------------

/** Arma el libro del backup (separado de la descarga para poder probarlo). */
export async function libroBackup(perfil: Perfil | undefined, pacientes: Paciente[], sesiones: Sesion[], pagos: Pago[]) {
  const libro = await libroNuevo()
  const tarifaEstandar = perfil?.tarifa_estandar ?? 0

  // Cada paciente necesita un ID para enlazar sesiones y pagos.
  const usados = new Set(pacientes.map((p) => p.codigo).filter(Boolean))
  let siguiente = 1
  const codigo = new Map<string, string>()
  for (const p of pacientes) {
    if (p.codigo) {
      codigo.set(p.id, p.codigo)
      continue
    }
    let c = ''
    do c = `P${String(siguiente++).padStart(3, '0')}`
    while (usados.has(c))
    usados.add(c)
    codigo.set(p.id, c)
  }
  const nombre = new Map(pacientes.map((p) => [p.id, nombreCompleto(p)]))
  const idSesion = new Map(sesiones.map((s, i) => [s.id, `S${String(i + 1).padStart(4, '0')}`]))

  tabla(
    libro.addWorksheet('Pacientes'),
    [
      { titulo: 'ID paciente', ancho: 12 },
      { titulo: 'Nombre', ancho: 18 },
      { titulo: 'Apellido', ancho: 18 },
      { titulo: 'DNI', ancho: 12 },
      { titulo: 'CUIL / CUIT', ancho: 15 },
      { titulo: 'Condición IVA', ancho: 18 },
      { titulo: 'Teléfono', ancho: 16 },
      { titulo: 'Email', ancho: 24 },
      { titulo: 'Domicilio', ancho: 24 },
      { titulo: 'Modalidad', ancho: 12 },
      { titulo: 'Honorario', tipo: 'monto' },
      { titulo: 'Moneda', ancho: 9 },
      { titulo: 'Frecuencia', ancho: 12 },
      { titulo: 'Fecha de alta', ancho: 13, tipo: 'fecha' },
      { titulo: 'Activo', ancho: 8 },
      { titulo: 'Notas administrativas', ancho: 30 },
    ],
    pacientes.map((p) => [
      codigo.get(p.id)!,
      p.nombre,
      p.apellido,
      p.dni,
      p.cuil_cuit,
      p.condicion_iva,
      p.telefono,
      p.email,
      p.domicilio,
      'Por hora',
      tarifaVigente(p, tarifaEstandar),
      p.moneda,
      p.frecuencia,
      fechaExcel(p.fecha_alta),
      p.activo ? 'Sí' : 'No',
      p.notas_admin,
    ]),
  )

  tabla(
    libro.addWorksheet('Sesiones'),
    [
      { titulo: 'ID sesión', ancho: 11 },
      { titulo: 'Fecha', ancho: 12, tipo: 'fecha' },
      { titulo: 'ID paciente', ancho: 12 },
      { titulo: 'Paciente', ancho: 26 },
      { titulo: 'Mes', ancho: 16 },
      { titulo: 'Monto', tipo: 'monto' },
      { titulo: 'Moneda', ancho: 9 },
      { titulo: 'Horas', ancho: 8, tipo: 'numero' },
      { titulo: 'Observaciones', ancho: 30 },
    ],
    sesiones.map((s) => [
      idSesion.get(s.id)!,
      fechaExcel(s.fecha),
      codigo.get(s.patient_id) ?? null,
      nombre.get(s.patient_id) ?? null,
      capitalizar(formatPeriodo(periodoDe(s.fecha))),
      s.monto,
      s.moneda,
      s.horas,
      s.observaciones,
    ]),
  )

  tabla(
    libro.addWorksheet('Pagos'),
    [
      { titulo: 'ID pago', ancho: 10 },
      { titulo: 'Fecha de pago', ancho: 13, tipo: 'fecha' },
      { titulo: 'Mes imputado', ancho: 13, tipo: 'fecha' },
      { titulo: 'ID paciente', ancho: 12 },
      { titulo: 'Paciente', ancho: 26 },
      { titulo: 'Monto', tipo: 'monto' },
      { titulo: 'Moneda', ancho: 9 },
      { titulo: 'Medio de pago', ancho: 15 },
      { titulo: 'Comprobante', ancho: 16 },
      { titulo: 'Punto de venta', ancho: 14 },
      { titulo: 'Nº de factura', ancho: 18 },
      { titulo: 'ID sesión (opcional)', ancho: 18 },
      { titulo: 'Observaciones', ancho: 30 },
    ],
    pagos.map((p, i) => [
      `G${String(i + 1).padStart(4, '0')}`,
      fechaExcel(p.fecha),
      fechaExcel(p.periodo),
      codigo.get(p.patient_id) ?? null,
      nombre.get(p.patient_id) ?? null,
      p.monto,
      p.moneda,
      ETIQUETA_MEDIO[p.medio],
      COMPROBANTE[p.comprobante],
      p.punto_venta,
      p.nro_factura,
      p.session_id ? (idSesion.get(p.session_id) ?? null) : null,
      p.observaciones,
    ]),
  )

  return libro
}

export async function exportarBackup(perfil: Perfil | undefined, pacientes: Paciente[], sesiones: Sesion[], pagos: Pago[]) {
  await guardarLibro(await libroBackup(perfil, pacientes, sesiones, pagos), `honorapp-datos-${hoyAR()}.xlsx`)
}
