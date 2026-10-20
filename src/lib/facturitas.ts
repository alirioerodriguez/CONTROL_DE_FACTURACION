// Conexión con Facturitas (facturitas.app) por planilla, porque no tiene API pública. Ver docs/investigacion/facturitas.md.
// Ida: los pagos de «Para facturar» en una planilla para su facturación masiva.
// Vuelta: el resumen que da Facturitas al descargar lo emitido marca cada pago como facturado con su número.
import { nombreCompleto } from './datos'
import { documentoReceptor, finDeMes, type ParaFacturar } from './facturar'
import { formatPeriodo, normalizar, parseFechaAR, parseMontoAR } from './formato'
import type { Celda, Hoja } from './importar/leer'

type Valor = string | number | null

/**
 * Columnas de la planilla. PROVISORIAS: armadas con lo que Facturitas documenta (fecha, descripción, precio,
 * cantidad, condición de venta) más los datos del receptor. Cuando tengamos su modelo oficial, se ajusta solo esta lista.
 */
export const COLUMNAS_FACTURITAS: { titulo: string; tipo?: 'fecha' | 'monto'; valor: (it: ParaFacturar, unidad: string) => Valor }[] = [
  { titulo: 'Fecha', tipo: 'fecha', valor: ({ pago }) => pago.fecha },
  { titulo: 'Tipo de documento', valor: (it) => receptor(it).tipoDoc },
  { titulo: 'Número de documento', valor: (it) => receptor(it).numeroDoc },
  { titulo: 'Nombre o razón social', valor: (it) => receptor(it).nombre },
  { titulo: 'Condición frente al IVA', valor: (it) => receptor(it).condicionIva },
  { titulo: 'Descripción', valor: (it, unidad) => descripcion(it, unidad) },
  { titulo: 'Cantidad', valor: () => 1 },
  { titulo: 'Precio unitario', tipo: 'monto', valor: ({ pago }) => pago.monto },
  { titulo: 'Moneda', valor: ({ pago }) => pago.moneda },
  { titulo: 'Condición de venta', valor: () => 'Contado' },
  { titulo: 'Período desde', tipo: 'fecha', valor: ({ pago }) => pago.periodo },
  { titulo: 'Período hasta', tipo: 'fecha', valor: ({ pago }) => finDeMes(pago.periodo) },
]

/** A quién va la factura: al paciente, o a su obra social si pagó ella. */
function receptor({ pago, paciente }: ParaFacturar) {
  if (pago.pagador === 'obra_social') {
    // El CUIT de la obra social no lo guarda honorapp: se completa en Facturitas.
    return { tipoDoc: 'CUIT', numeroDoc: null, nombre: paciente.obra_social || 'Obra social', condicionIva: null }
  }
  const doc = documentoReceptor(paciente)
  return {
    tipoDoc: doc?.tipo ?? 'Consumidor final',
    numeroDoc: doc?.numero ?? null,
    nombre: nombreCompleto(paciente),
    condicionIva: paciente.condicion_iva || 'Consumidor final',
  }
}

function descripcion({ pago, paciente }: ParaFacturar, unidad: string): string {
  const base = `Honorarios profesionales: ${unidad} de ${formatPeriodo(pago.periodo)}`
  if (pago.pagador !== 'obra_social') return base
  const afiliado = [nombreCompleto(paciente), paciente.nro_afiliado && `afiliado N.º ${paciente.nro_afiliado}`].filter(Boolean).join(', ')
  return `${base} · ${afiliado}`
}

/** Las filas de la planilla (las fechas como 'AAAA-MM-DD'; el Excel las convierte). */
export function filasFacturitas(items: ParaFacturar[], unidad: string): Valor[][] {
  return items.map((it) => COLUMNAS_FACTURITAS.map((c) => c.valor(it, unidad)))
}

// ---------------------------------------------------------------------
// Vuelta: resumen de lo emitido
// ---------------------------------------------------------------------

export interface Coincidencia {
  item: ParaFacturar
  numero: string
}

export interface ResultadoCruce {
  coincidencias: Coincidencia[]
  /** Filas del resumen que no coinciden con ningún pago pendiente. */
  sinCruzar: number
  /** El archivo no tiene las columnas mínimas (fecha, importe y número). */
  columnasFaltantes: string[]
}

/** Busca la columna cuyo encabezado contiene alguna de las palabras (sin tildes ni mayúsculas). */
export function columna(encabezados: string[], palabras: string[], excluir: string[] = []): number {
  const norm = encabezados.map((e) => normalizar(e))
  return norm.findIndex((e) => palabras.some((p) => e.includes(p)) && !excluir.some((x) => e.includes(x)))
}

const texto = (c: Celda | undefined) => (c == null ? '' : String(c).trim())

/** Arma el número de factura con el formato de la app: 'C 00002-00000123'. */
export function numeroFactura(puntoVenta: string, numero: string): string {
  const nro = numero.trim()
  if (/\d+\s*-\s*\d+/.test(nro)) return nro.toUpperCase().startsWith('C') ? nro : `C ${nro}`
  const solo = nro.replace(/\D/g, '')
  const pv = puntoVenta.replace(/\D/g, '')
  return pv ? `C ${pv.padStart(5, '0')}-${solo.padStart(8, '0')}` : `C ${solo.padStart(8, '0')}`
}

const diasEntre = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86400000

/**
 * Cruza el resumen de Facturitas con los pagos pendientes: mismo importe y fecha igual o cercana (hasta 15 días),
 * y si hay empate, el que tenga el nombre del receptor. Cada pago se usa una sola vez.
 */
export function cruzarResumen(hoja: Hoja, items: ParaFacturar[]): ResultadoCruce {
  const enc = hoja.encabezados
  const cFecha = columna(enc, ['fecha'], ['venc', 'desde', 'hasta'])
  const cImporte = columna(enc, ['importe total', 'total', 'importe', 'monto', 'precio'])
  const cNumero = columna(enc, ['numero de comprobante', 'nro de comprobante', 'comprobante', 'numero', 'nro'], ['documento', 'doc', 'cuit', 'dni', 'punto'])
  const cPunto = columna(enc, ['punto de venta', 'pto', 'punto'])
  const cNombre = columna(enc, ['razon social', 'receptor', 'cliente', 'nombre'])

  const columnasFaltantes = [cFecha < 0 && 'fecha', cImporte < 0 && 'importe', cNumero < 0 && 'número de comprobante'].filter(Boolean) as string[]
  if (columnasFaltantes.length) return { coincidencias: [], sinCruzar: hoja.filas.length, columnasFaltantes }

  const libres = new Set(items.map((it) => it.pago.id))
  const coincidencias: Coincidencia[] = []
  let sinCruzar = 0

  for (const fila of hoja.filas) {
    const fecha = parseFechaAR(fila.celdas[cFecha])
    const importe = parseMontoAR(fila.celdas[cImporte])
    const numero = texto(fila.celdas[cNumero])
    if (!fecha || importe == null || !numero) {
      sinCruzar++
      continue
    }
    const nombre = cNombre >= 0 ? normalizar(texto(fila.celdas[cNombre])) : ''
    const candidatos = items
      .filter((it) => libres.has(it.pago.id) && Math.abs(it.pago.monto - importe) < 0.01 && diasEntre(it.pago.fecha, fecha) <= 15)
      .sort((a, b) => {
        const porNombre = (it: ParaFacturar) => (nombre && nombre.includes(normalizar(it.paciente.nombre)) ? 0 : 1)
        return porNombre(a) - porNombre(b) || diasEntre(a.pago.fecha, fecha) - diasEntre(b.pago.fecha, fecha)
      })
    const elegido = candidatos[0]
    if (!elegido) {
      sinCruzar++
      continue
    }
    libres.delete(elegido.pago.id)
    coincidencias.push({ item: elegido, numero: numeroFactura(cPunto >= 0 ? texto(fila.celdas[cPunto]) : '', numero) })
  }
  return { coincidencias, sinCruzar, columnasFaltantes: [] }
}
