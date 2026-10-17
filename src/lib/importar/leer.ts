// Lectura de planillas .xlsx y .csv a una estructura simple de hojas y filas.
// exceljs y papaparse se cargan recién cuando se usan (no engordan la app).

export type Celda = string | number | boolean | Date | null

export interface Hoja {
  nombre: string
  encabezados: string[]
  /** Filas de datos (sin el encabezado), con su número de fila original. */
  filas: { numero: number; celdas: Celda[] }[]
}

export const TAMANO_MAXIMO = 5 * 1024 * 1024

/** Convierte lo que devuelve exceljs (fórmulas, texto enriquecido, links) en un valor simple. */
export function normalizarCelda(valor: unknown): Celda {
  if (valor == null) return null
  if (valor instanceof Date) return valor
  if (typeof valor === 'string') {
    const t = valor.trim()
    if (t === '') return null
    // Los Excel de la app protegen con un apóstrofo los textos que empiezan con = + - @ (para que no se
    // ejecuten como fórmula). Al volver a importarlos se saca.
    return /^'[=+\-@]/.test(t) ? t.slice(1) : t
  }
  if (typeof valor === 'number' || typeof valor === 'boolean') return valor
  if (typeof valor === 'object') {
    const o = valor as Record<string, unknown>
    // Fórmula: vale su último resultado calculado (si no tiene, la celda está vacía).
    if ('formula' in o || 'sharedFormula' in o) return 'result' in o ? normalizarCelda(o.result) : null
    if (Array.isArray(o.richText)) return normalizarCelda(o.richText.map((t: { text: string }) => t.text).join(''))
    if ('text' in o) return normalizarCelda(o.text)
    if ('error' in o) return null
  }
  return null
}

const vacia = (celdas: Celda[]) => celdas.every((c) => c === null || c === '')

/** Separa encabezado y datos: el encabezado es la primera fila con contenido. */
export function armarHoja(nombre: string, filasCrudas: unknown[][]): Hoja {
  const filas = filasCrudas.map((f, i) => ({ numero: i + 1, celdas: f.map(normalizarCelda) }))
  const iEnc = filas.findIndex((f) => !vacia(f.celdas))
  if (iEnc < 0) return { nombre, encabezados: [], filas: [] }
  const encabezados = filas[iEnc].celdas.map((c) => (c == null ? '' : String(c).trim()))
  const datos = filas
    .slice(iEnc + 1)
    .filter((f) => !vacia(f.celdas))
    .map((f) => ({ ...f, celdas: encabezados.map((_, i) => f.celdas[i] ?? null) }))
  return { nombre, encabezados, filas: datos }
}

export async function leerXlsx(datos: ArrayBuffer): Promise<Hoja[]> {
  const { default: ExcelJS } = await import('exceljs')
  const libro = new ExcelJS.Workbook()
  await libro.xlsx.load(datos)
  const hojas: Hoja[] = []
  libro.eachSheet((hoja) => {
    const filas: unknown[][] = []
    hoja.eachRow({ includeEmpty: true }, (fila, numero) => {
      // row.values empieza en el índice 1.
      filas[numero - 1] = (fila.values as unknown[]).slice(1)
    })
    for (let i = 0; i < filas.length; i++) filas[i] ??= []
    hojas.push(armarHoja(hoja.name, filas))
  })
  return hojas
}

export async function leerCsv(texto: string, nombre = 'CSV'): Promise<Hoja[]> {
  const { default: Papa } = await import('papaparse')
  const limpio = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto // saca el BOM de Excel
  const r = Papa.parse<string[]>(limpio, { skipEmptyLines: false, delimiter: '' }) // '' = detectar , o ;
  return [armarHoja(nombre, r.data)]
}

/** Lee un archivo elegido por la usuaria. Tira un Error con un mensaje para mostrar. */
export async function leerArchivo(archivo: File): Promise<Hoja[]> {
  const nombre = archivo.name
  if (!/\.(xlsx|csv)$/i.test(nombre)) {
    throw new Error(`“${nombre}” no es un formato que podamos leer. Subí un .xlsx o .csv.`)
  }
  if (archivo.size > TAMANO_MAXIMO) throw new Error(`“${nombre}” pesa más de 5 MB.`)
  try {
    if (/\.csv$/i.test(nombre)) return await leerCsv(await archivo.text(), nombre.replace(/\.csv$/i, ''))
    return await leerXlsx(await archivo.arrayBuffer())
  } catch {
    throw new Error(`No pudimos leer “${nombre}”. Revisá que no esté protegido con contraseña y probá de nuevo.`)
  }
}
