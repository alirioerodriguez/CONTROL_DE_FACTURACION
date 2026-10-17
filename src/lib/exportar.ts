// Exportación a Excel (.xlsx) y PDF. Las librerías se cargan recién al exportar.
import type { Worksheet } from 'exceljs'
import { ETIQUETA_MEDIO, nombreCompleto, type Paciente, type Pago, type Perfil, type Sesion } from './datos'
import { capitalizar, formatFecha, formatMonto, formatPeriodo, hoyAR, mesCorto, nombreMes, periodoDe, type Moneda } from './formato'
import { compartirPdf, type ResultadoCompartir } from './compartir'
import { C, caja, etiqueta, franja, montoGrande, nuevoPdf, pie, texto } from './pdfEstilo'
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

/**
 * Un texto que empieza con = + - @ (o tabulación) se abre como fórmula en Excel y otras planillas: se le
 * antepone un apóstrofo para que quede como texto. Los números y las fechas no se tocan.
 */
export function celdaSegura<T>(valor: T): T | string {
  if (typeof valor !== 'string' || !/^[=+\-@\t\r]/.test(valor)) return valor
  // Un teléfono (+54 9 11 …) o un número negativo escrito como texto no pueden ser una fórmula.
  if (/^[+-][\d\s().-]*$/.test(valor)) return valor
  return `'${valor}`
}

/** 'Lucía Fernández' → 'L. F.' (para exportar sin nombres completos). */
export function soloIniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => `${p[0].toUpperCase()}.`)
    .join(' ')
}

function tabla(hoja: Worksheet, columnas: Columna[], filas: Fila[], filasTotal: Fila[] = []) {
  hoja.columns = columnas.map((c) => ({ header: c.titulo, width: c.ancho ?? 16 }))
  const enc = hoja.getRow(1)
  enc.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  enc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF557F69' } }
  hoja.views = [{ state: 'frozen', ySplit: 1 }]
  for (const f of filas) hoja.addRow(f.map(celdaSegura))
  for (const f of filasTotal) {
    const r = hoja.addRow(f.map(celdaSegura))
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
      f.sesiones.filter((s) => s.estado !== 'programada' && s.estado !== 'cancelada').length,
      f.sesiones
        .map((s) => formatFecha(s.fecha).slice(0, 5) + (s.ausente ? ' (ausente)' : s.estado === 'programada' ? ' (programada)' : s.estado === 'cancelada' ? ' (cancelada)' : ''))
        .join(' '),
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

export interface OpcionesExport {
  /** Iniciales en lugar del nombre completo de cada paciente. */
  iniciales?: boolean
}

export async function exportarContadoraXlsx(
  desde: string,
  hasta: string,
  perfil: Perfil | undefined,
  pacientes: Paciente[],
  pagos: Pago[],
  opciones: OpcionesExport = {},
) {
  const r = reporteContadora(desde, hasta, hoyAR(), pacientes, pagos)
  const nombrePaciente = (n: string) => (opciones.iniciales ? soloIniciales(n) : n)
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
        nombrePaciente(paciente),
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
  ].forEach((f) => datos.addRow(f.map(celdaSegura)))

  await guardarLibro(libro, `contadora-${mesArchivo(desde)}-a-${mesArchivo(hasta)}.xlsx`)
}

/** Arma el PDF para la contadora (separado de la descarga para poder probarlo). Diseño: docs/diseno/pdf/Reporte Contadora HonorApp.pdf */
export async function pdfContadora(
  desde: string,
  hasta: string,
  perfil: Perfil | undefined,
  pacientes: Paciente[],
  pagos: Pago[],
  opciones: OpcionesExport = {},
) {
  const r = reporteContadora(desde, hasta, hoyAR(), pacientes, pagos)
  const nombrePaciente = (n: string) => (opciones.iniciales ? soloIniciales(n) : n)
  const { default: autoTable } = await import('jspdf-autotable')
  const p = await nuevoPdf()
  const { doc, k } = p
  const hoy = hoyAR()

  // Encabezado (solo en la primera hoja)
  franja(p)
  etiqueta(p, 'Reporte para contadora', 62, 78)
  texto(p, 'Reporte de cobros', 62, 128, { t: 54, serif: true })
  const rangoTexto =
    desde === hasta
      ? capitalizar(formatPeriodo(desde))
      : desde.slice(0, 4) === hasta.slice(0, 4)
        ? `${capitalizar(nombreMes(desde))} a ${formatPeriodo(hasta)}`
        : `${capitalizar(formatPeriodo(desde))} a ${formatPeriodo(hasta)}`
  texto(p, [perfil?.nombre, rangoTexto].filter(Boolean).join(' · '), 62, 160, { t: 16, color: C.gris })
  const [ah, mh] = hasta.split('-').map(Number)
  const ultimoDia = new Date(Date.UTC(ah, mh, 0)).getUTCDate()
  texto(p, 'Período', 677, 82, { t: 14.5, color: C.gris, alinear: 'right' })
  texto(p, `${formatFecha(desde)} – ${String(ultimoDia).padStart(2, '0')}/${String(mh).padStart(2, '0')}/${ah}`, 863, 82, {
    t: 14.5,
    peso: 'semibold',
    alinear: 'right',
  })
  texto(p, 'Generado', 677, 105, { t: 14.5, color: C.gris, alinear: 'right' })
  texto(p, formatFecha(hoy), 863, 105, { t: 14.5, peso: 'semibold', alinear: 'right' })

  // Tarjetas de totales
  const tarjeta = (x: number, titulo: string, moneda: Moneda) => {
    const t = r.totales[moneda]
    caja(p, x, 194, 254, 134, C.fondoVerde)
    etiqueta(p, titulo, x + 22, 228, C.gris, 12)
    montoGrande(p, t.total, moneda, x + 22, 268, 33)
    texto(p, t.cantidad ? `${t.conFactura} de ${t.cantidad} ${t.cantidad === 1 ? 'pago facturado' : 'pagos facturados'}` : 'Sin pagos', x + 22, 292, {
      t: 13,
      color: C.gris,
    })
  }
  tarjeta(62, 'Total pesos', 'ARS')
  tarjeta(335, 'Total dólares', 'USD')
  caja(p, 608, 194, 255, 134, C.fondoNeutro)
  etiqueta(p, 'Últimos 12 meses', 630, 228, C.gris, 12)
  texto(p, formatMonto(r.ultimos12.ARS.total, 'ARS'), 630, 256, { t: 19, peso: 'semibold' })
  texto(p, formatMonto(r.ultimos12.USD.total, 'USD'), 630, 280, { t: 19, peso: 'semibold' })
  const mesAnio = (per: string) => `${capitalizar(mesCorto(per))} ${per.slice(0, 4)}`
  texto(p, `${mesAnio(r.rango12.desde)} – ${mesCorto(r.rango12.hasta)} ${r.rango12.hasta.slice(0, 4)}`, 630, 306, { t: 13, color: C.gris })

  // Estilo de las tablas
  const tamTabla = 14 * k
  const comunes = {
    theme: 'plain' as const,
    margin: { left: 62 * k, right: (923 - 863) * k, top: 60 * k, bottom: 130 * k },
    styles: { font: p.sans, fontStyle: 'normal' as const, fontSize: tamTabla, textColor: C.tinta, cellPadding: { top: 9 * k, bottom: 9 * k, left: 0, right: 4 * k } },
    headStyles: {
      fontStyle: (p.conFuentes ? 'semibold' : 'bold') as 'bold',
      fontSize: 11 * k,
      textColor: C.gris,
      lineWidth: { bottom: 1.6 * k },
      lineColor: C.verde,
    },
    bodyStyles: { lineWidth: { bottom: 0.9 * k }, lineColor: C.linea },
    footStyles: { fontStyle: 'bold' as const, fillColor: C.fondoVerde, textColor: C.tinta },
    didDrawPage: () => {
      if (doc.getNumberOfPages() > 1 && doc.getCurrentPageInfo().pageNumber > 1) franja(p)
    },
  }
  const guion = '—'
  const celdaMonto = (n: number, m: Moneda) => (n ? formatMonto(n, m) : guion)

  // Por mes y medio de pago
  texto(p, 'Por mes y medio de pago', 62, 380, { t: 18.5, peso: 'semibold' })
  const cuerpo: string[][] = []
  for (const m of r.meses) {
    for (const moneda of ['ARS', 'USD'] as Moneda[]) {
      const a = m.porMoneda[moneda]
      if (!a.cantidad) continue
      cuerpo.push([capitalizar(formatPeriodo(m.periodo)), moneda, ...MEDIOS.map((x) => celdaMonto(a.medios[x], moneda)), formatMonto(a.total, moneda), `${a.conFactura}/${a.cantidad}`])
    }
  }
  const pieTabla = (['ARS', 'USD'] as Moneda[])
    .filter((m) => r.totales[m].cantidad)
    .map((m) => ['Total', m, ...MEDIOS.map((x) => celdaMonto(r.totales[m].medios[x], m)), formatMonto(r.totales[m].total, m), `${r.totales[m].conFactura}/${r.totales[m].cantidad}`])
  const derecha = { halign: 'right' as const }
  autoTable(doc, {
    ...comunes,
    startY: 398 * k,
    head: [['MES', 'MONEDA', ...MEDIOS.map((x) => ETIQUETA_MEDIO[x].toUpperCase()), 'TOTAL', 'FACT.']],
    body: cuerpo,
    foot: pieTabla,
    showFoot: 'lastPage',
    columnStyles: {
      0: { cellWidth: 150 * k },
      1: { cellWidth: 70 * k, textColor: C.gris },
      2: derecha,
      3: derecha,
      4: derecha,
      5: derecha,
      6: { ...derecha, fontStyle: 'bold' },
      7: { ...derecha, cellWidth: 52 * k, textColor: C.gris },
    },
    didParseCell: (d) => {
      if ((d.section === 'head' || d.section === 'foot') && d.column.index >= 2) d.cell.styles.halign = 'right'
      if (d.section === 'foot' && d.column.index === 0) d.cell.styles.cellPadding = { top: 11 * k, bottom: 11 * k, left: 10 * k, right: 4 * k }
      if (d.section !== 'head' && d.cell.raw === guion) d.cell.styles.textColor = C.grisClaro
    },
  })

  // Detalle de pagos
  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY / k + 58
  if (y > 1060) {
    doc.addPage()
    franja(p)
    y = 90
  }
  texto(p, 'Detalle de pagos', 62, y, { t: 18.5, peso: 'semibold' })
  autoTable(doc, {
    ...comunes,
    startY: (y + 18) * k,
    head: [['FECHA', 'PACIENTE', 'MEDIO', 'COMPROBANTE', 'N.º DE FACTURA', 'MONTO']],
    body: r.meses.flatMap((m) =>
      m.pagos.map(({ pago: x, paciente }) => [
        formatFecha(x.fecha),
        nombrePaciente(paciente),
        ETIQUETA_MEDIO[x.medio],
        COMPROBANTE[x.comprobante],
        [x.punto_venta, x.nro_factura].filter(Boolean).join('-') || guion,
        formatMonto(x.monto, x.moneda),
      ]),
    ),
    columnStyles: {
      0: { cellWidth: 111 * k, textColor: C.gris },
      1: { cellWidth: 148 * k, fontStyle: (p.conFuentes ? 'semibold' : 'normal') as 'normal' },
      2: { cellWidth: 136 * k },
      3: { cellWidth: 136 * k },
      5: { halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (d) => {
      if (d.section === 'head' && d.column.index === 5) d.cell.styles.halign = 'right'
      if (d.section === 'body' && d.column.index === 3 && d.cell.raw === COMPROBANTE.sin_comprobante) d.cell.styles.textColor = C.aviso
      if (d.section === 'body' && d.cell.raw === guion) d.cell.styles.textColor = C.grisClaro
    },
  })

  // Pie en todas las hojas
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    pie(p, [
      total > 1 ? `Montos cobrados según registros de la profesional · Hoja ${i} de ${total}` : 'Montos cobrados según registros de la profesional.',
      `Generado con honorapp el ${formatFecha(hoy)}`,
    ], 62, 863)
  }
  return doc
}

/** Texto del mail o mensaje con que se manda el reporte a la contadora. */
export function mensajeContadora(desde: string, hasta: string, perfil: Perfil | undefined): { asunto: string; cuerpo: string } {
  const rango = desde === hasta ? formatPeriodo(desde) : `${formatPeriodo(desde)} a ${formatPeriodo(hasta)}`
  return {
    asunto: `Reporte de cobros · ${rango}`,
    cuerpo: `Hola, te paso el reporte de cobros de ${rango}.${perfil?.nombre ? `\n\n${perfil.nombre}` : ''}`,
  }
}

const nombreArchivoContadora = (desde: string, hasta: string) => `contadora-${mesArchivo(desde)}-a-${mesArchivo(hasta)}.pdf`

/** Comparte el PDF con el menú del celular. 'sin-soporte' en la mayoría de las computadoras. */
export async function compartirContadoraPdf(
  desde: string,
  hasta: string,
  perfil: Perfil | undefined,
  pacientes: Paciente[],
  pagos: Pago[],
  opciones: OpcionesExport = {},
): Promise<ResultadoCompartir> {
  if (typeof navigator === 'undefined' || !navigator.canShare) return 'sin-soporte'
  const doc = await pdfContadora(desde, hasta, perfil, pacientes, pagos, opciones)
  const m = mensajeContadora(desde, hasta, perfil)
  return compartirPdf(doc.output('blob'), nombreArchivoContadora(desde, hasta), m.asunto, m.cuerpo)
}

export async function exportarContadoraPdf(
  desde: string,
  hasta: string,
  perfil: Perfil | undefined,
  pacientes: Paciente[],
  pagos: Pago[],
  opciones: OpcionesExport = {},
) {
  const doc = await pdfContadora(desde, hasta, perfil, pacientes, pagos, opciones)
  doc.save(nombreArchivoContadora(desde, hasta))
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
      { titulo: 'Estado', ancho: 12 },
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
      s.estado === 'ausente' ? 'Ausente' : s.estado === 'cancelada' ? 'Cancelada' : null,
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
