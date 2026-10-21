// Genera public/plantilla-cobros.xlsx: la planilla que se baja desde la app para cargar datos e importarlos.
// Una sola pestaña («Citas»): cada fila es una cita con lo que la profesional necesita del paciente, lo que pide
// la app y lo que pide ARCA para facturar. El paciente se crea la primera vez que aparece; en las filas
// siguientes alcanza con el nombre. Lo importa prepararCitas (src/lib/importar/preparar.ts).
// Uso: node scripts/generar-plantilla.mjs
import ExcelJS from 'exceljs'

const VERDE = 'FF557F69'
const AMARILLO = 'FFFFF8DC'
const libro = new ExcelJS.Workbook()
libro.creator = 'honorapp'

const COLUMNAS = [
  { titulo: 'Paciente', ancho: 40, nota: 'Nombre y apellido. Escribilo siempre igual: así se juntan las citas de la misma persona.' },
  { titulo: 'DNI', ancho: 12, nota: 'Solo números. Para la factura de ARCA.' },
  { titulo: 'CUIL / CUIT', ancho: 16, nota: 'Opcional. Si el paciente necesita la factura a su CUIT.' },
  {
    titulo: 'Condición frente al IVA',
    ancho: 24,
    lista: ['Consumidor final', 'Monotributista', 'Responsable inscripto', 'Exento'],
    nota: 'La pide ARCA. Si no sabés, dejá «Consumidor final».',
  },
  { titulo: 'Obra social', ancho: 18, nota: 'Opcional. Ej.: OSDE 310.' },
  { titulo: 'Teléfono', ancho: 16, nota: 'Opcional. Para mandarle recordatorios por WhatsApp desde la app.' },
  { titulo: 'Fecha de la cita', ancho: 15, tipo: 'fecha', nota: 'dd/mm/aaaa' },
  { titulo: 'Hora de la cita', ancho: 14, tipo: 'hora', nota: 'Opcional. Ej.: 18:30.' },
  { titulo: 'Monto', ancho: 14, tipo: 'monto', nota: 'Si lo dejás vacío, se usa tu tarifa estándar de Ajustes.' },
  { titulo: 'Moneda', ancho: 10, lista: ['ARS', 'USD'], nota: 'ARS o USD. Vacía: la de Ajustes.' },
  { titulo: 'Pagó', ancho: 8, lista: ['Sí', 'No'], nota: 'Sí, si ya te pagó esa cita.' },
  { titulo: 'Nº de factura', ancho: 18, nota: 'Opcional. Si ya hiciste la factura en ARCA. Ej.: C 00002-00000123.' },
]

const h = libro.addWorksheet('Citas')
h.columns = COLUMNAS.map((c) => ({ header: c.titulo, width: c.ancho }))
const enc = h.getRow(1)
enc.font = { bold: true, color: { argb: 'FFFFFFFF' } }
enc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE } }
enc.height = 30
enc.alignment = { vertical: 'middle', wrapText: true }
h.views = [{ state: 'frozen', ySplit: 1 }]
COLUMNAS.forEach((c, i) => {
  h.getCell(1, i + 1).note = c.nota
})

const fecha = (iso) => {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d))
}
// Filas de ejemplo: la app las saltea porque dicen «fila de ejemplo».
const EJEMPLO = 'María Ejemplo — fila de ejemplo, borrala'
for (const fila of [
  [EJEMPLO, '30123456', '27-30123456-4', 'Consumidor final', 'OSDE 310', '11 5555-1234', fecha('2026-10-06'), '18:30', 25000, 'ARS', 'Sí', 'C 00002-00000123'],
  [EJEMPLO, null, null, null, null, null, fecha('2026-10-13'), '18:30', 25000, 'ARS', 'No', null],
]) {
  const r = h.addRow(fila)
  r.font = { italic: true, color: { argb: 'FF8A8A8A' } }
}

COLUMNAS.forEach((c, i) => {
  const col = h.getColumn(i + 1)
  if (c.tipo === 'fecha') col.numFmt = 'dd/mm/yyyy'
  if (c.tipo === 'monto') col.numFmt = '#,##0.00'
  if (c.tipo === 'hora') col.numFmt = '@'
  for (let r = 4; r <= 500; r++) {
    const celda = h.getCell(r, i + 1)
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMARILLO } }
    if (c.lista) celda.dataValidation = { type: 'list', allowBlank: true, formulae: [`"${c.lista.join(',')}"`] }
  }
})

await libro.xlsx.writeFile(new URL('../public/plantilla-cobros.xlsx', import.meta.url))
console.log('Plantilla generada: public/plantilla-cobros.xlsx')
