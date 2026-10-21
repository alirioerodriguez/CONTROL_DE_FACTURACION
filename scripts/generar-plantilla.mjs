// Genera public/plantilla-cobros.xlsx: la planilla simple que se baja desde la app para cargar datos e importarlos.
// Solo lo elemental para que funcione y para facturar en ARCA (nada de domicilio, mail ni notas).
// Uso: node scripts/generar-plantilla.mjs
import ExcelJS from 'exceljs'

const VERDE = 'FF557F69'
const AMARILLO = 'FFFFF8DC'
const libro = new ExcelJS.Workbook()
libro.creator = 'honorapp'

// Instrucciones
const ayuda = libro.addWorksheet('Cómo completar')
ayuda.columns = [{ width: 100 }]
const lineas = [
  ['Planilla de cobros de honorapp', { bold: true, size: 16 }],
  [''],
  ['1. En «Pacientes» va una fila por paciente: nombre y apellido, DNI o CUIT y su condición frente al IVA (lo que pide ARCA para la factura).'],
  ['2. En «Sesiones» va una fila por sesión: paciente (escrito igual que en Pacientes), fecha y monto.'],
  ['3. En «Pagos» va una fila por pago: paciente, fecha, monto y, si querés, de qué mes es y el número de factura.'],
  ['4. Borrá las filas de ejemplo, guardá y subila en honorapp → Importar. Lo que ya estaba cargado no se duplica.'],
  [''],
  ['Fechas: dd/mm/aaaa · Montos: 25000 o 25.000,50 · Moneda: ARS o USD (si la dejás vacía, se usa la de Ajustes).'],
  ['El teléfono es opcional: sirve para mandar recordatorios por WhatsApp desde la app.'],
]
for (const [texto, fuente] of lineas) {
  const fila = ayuda.addRow([texto])
  if (fuente) fila.font = fuente
  fila.alignment = { wrapText: true }
}

/** Hoja con encabezado verde, celdas para completar en amarillo y una fila de ejemplo. */
function hoja(nombre, columnas, ejemplo) {
  const h = libro.addWorksheet(nombre)
  h.columns = columnas.map((c) => ({ header: c.titulo, width: c.ancho ?? 18 }))
  const enc = h.getRow(1)
  enc.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  enc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE } }
  h.views = [{ state: 'frozen', ySplit: 1 }]
  // Fila de ejemplo: la app la saltea porque dice «fila de ejemplo».
  const fila = h.addRow(ejemplo)
  fila.font = { italic: true, color: { argb: 'FF8A8A8A' } }
  columnas.forEach((c, i) => {
    const col = h.getColumn(i + 1)
    if (c.tipo === 'fecha') col.numFmt = 'dd/mm/yyyy'
    if (c.tipo === 'monto') col.numFmt = '#,##0.00'
    for (let r = 3; r <= 300; r++) {
      const celda = h.getCell(r, i + 1)
      celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMARILLO } }
      if (c.lista) celda.dataValidation = { type: 'list', allowBlank: true, formulae: [`"${c.lista.join(',')}"`] }
    }
  })
  return h
}

const EJEMPLO = 'María Ejemplo — fila de ejemplo, borrala'

const fecha = (iso) => {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d))
}

hoja(
  'Pacientes',
  [
    { titulo: 'Paciente', ancho: 40 },
    { titulo: 'DNI o CUIT', ancho: 16 },
    { titulo: 'Condición frente al IVA', ancho: 24, lista: ['Consumidor final', 'Monotributista', 'Responsable inscripto', 'Exento'] },
    { titulo: 'Teléfono', ancho: 16 },
  ],
  [EJEMPLO, '30123456', 'Consumidor final', '11 5555-1234'],
)
hoja(
  'Sesiones',
  [
    { titulo: 'Paciente', ancho: 40 },
    { titulo: 'Fecha', ancho: 13, tipo: 'fecha' },
    { titulo: 'Monto', ancho: 14, tipo: 'monto' },
    { titulo: 'Moneda', ancho: 10, lista: ['ARS', 'USD'] },
  ],
  [EJEMPLO, fecha('2026-10-06'), 25000, 'ARS'],
)
hoja(
  'Pagos',
  [
    { titulo: 'Paciente', ancho: 40 },
    { titulo: 'Fecha de pago', ancho: 14, tipo: 'fecha' },
    { titulo: 'Monto', ancho: 14, tipo: 'monto' },
    { titulo: 'Moneda', ancho: 10, lista: ['ARS', 'USD'] },
    { titulo: 'Mes que paga', ancho: 14, tipo: 'fecha' },
    { titulo: 'Nº de factura', ancho: 18 },
  ],
  [EJEMPLO, fecha('2026-10-10'), 25000, 'ARS', fecha('2026-10-01'), 'C 00002-00000123'],
)

await libro.xlsx.writeFile(new URL('../public/plantilla-cobros.xlsx', import.meta.url))
console.log('Plantilla generada: public/plantilla-cobros.xlsx')
