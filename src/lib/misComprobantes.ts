// Marcar como facturado lo que ya se hizo en ARCA, con el archivo que exporta «Mis Comprobantes → Emitidos».
// Columnas tomadas de un CSV real de Mis Comprobantes (el de Recibidos, que tiene la misma estructura): separado
// por punto y coma, fechas AAAA-MM-DD, montos con coma decimal y el tipo de comprobante como código (11 = Factura C).
import { armarFacturas, documentoReceptor, type Factura, type ParaFacturar } from './facturar'
import { columna, numeroFactura } from './facturitas'
import { normalizar, parseFechaAR, parseMontoAR, type Moneda } from './formato'
import type { Celda, EsEncabezado, Hoja } from './importar/leer'

export interface ComprobanteEmitido {
  fecha: string
  numero: string
  /** Solo los números; vacío si la factura no identifica al receptor. */
  documento: string
  receptor: string
  moneda: Moneda
  total: number
  /** Total dividido por el tipo de cambio (los montos del archivo vienen en pesos). */
  totalEnMoneda: number
}

export interface CoincidenciaArca {
  factura: Factura
  comprobante: ComprobanteEmitido
}

export interface ResultadoMisComprobantes {
  coincidencias: CoincidenciaArca[]
  /** Facturas C del archivo que no coinciden con nada pendiente. */
  sinCruzar: number
  /** Notas de crédito, de débito y otros que no son Factura C. */
  otros: number
  error: string | null
}

const texto = (c: Celda | undefined) => (c == null ? '' : String(c).trim())
const DIA = 86400000

/** El Excel de ARCA puede traer un título arriba: el encabezado es la fila que empieza con «Fecha». Pasarla a leerArchivo. */
export const encabezadoMisComprobantes: EsEncabezado = (celdas) => celdas.some((c) => normalizar(texto(c)).startsWith('fecha'))

/** Lee las Facturas C del archivo. */
export function leerMisComprobantes(hoja: Hoja): { comprobantes: ComprobanteEmitido[]; otros: number; error: string | null } {
  const enc = hoja.encabezados
  const c = {
    fecha: columna(enc, ['fecha']),
    tipo: columna(enc, ['tipo de comprobante', 'tipo comprobante']),
    punto: columna(enc, ['punto de venta']),
    numero: columna(enc, ['numero desde', 'numero']),
    doc: columna(enc, ['nro. doc. receptor', 'nro doc receptor', 'documento receptor']),
    receptor: columna(enc, ['denominacion receptor']),
    cambio: columna(enc, ['tipo cambio', 'tipo de cambio']),
    moneda: columna(enc, ['moneda']),
    total: columna(enc, ['imp. total', 'importe total']),
  }
  if (c.receptor < 0 && columna(enc, ['denominacion emisor']) >= 0) {
    return { comprobantes: [], otros: 0, error: 'Ese archivo es de Comprobantes Recibidos. En Mis Comprobantes elegí «Emitidos» y exportá de nuevo.' }
  }
  const faltan = [c.fecha < 0 && 'fecha', c.tipo < 0 && 'tipo de comprobante', c.numero < 0 && 'número', c.total < 0 && 'importe total'].filter(Boolean)
  if (faltan.length) return { comprobantes: [], otros: 0, error: `El archivo no tiene: ${faltan.join(', ')}. ¿Es el que exporta Mis Comprobantes → Emitidos?` }

  const comprobantes: ComprobanteEmitido[] = []
  let otros = 0
  for (const { celdas } of hoja.filas) {
    const tipo = texto(celdas[c.tipo])
    if (!(/^0*11(\D|$)/.test(tipo) || normalizar(tipo).includes('factura c'))) {
      otros++
      continue
    }
    const fecha = parseFechaAR(celdas[c.fecha])
    const total = parseMontoAR(celdas[c.total])
    const nro = texto(celdas[c.numero])
    if (!fecha || total == null || !nro) {
      otros++
      continue
    }
    const moneda = texto(celdas[c.moneda]).replace(/\s/g, '').toUpperCase()
    const enPesos = moneda === '' || moneda === '$' || moneda === 'PES' || moneda === 'ARS'
    const cambio = c.cambio >= 0 ? Number(texto(celdas[c.cambio]).replace(/\./g, '').replace(',', '.')) || 1 : 1
    const documento = c.doc >= 0 ? texto(celdas[c.doc]).replace(/\D/g, '').replace(/^0+$/, '') : ''
    comprobantes.push({
      fecha,
      numero: numeroFactura(c.punto >= 0 ? texto(celdas[c.punto]) : '', nro),
      documento,
      receptor: c.receptor >= 0 ? texto(celdas[c.receptor]) : '',
      moneda: enPesos ? 'ARS' : 'USD',
      total,
      totalEnMoneda: enPesos ? total : Math.round((total / cambio) * 100) / 100,
    })
  }
  return { comprobantes, otros, error: null }
}

/** ¿El documento de la factura es el del paciente? El DNI también cuenta dentro del CUIL. null si no se puede saber. */
function mismoDocumento(f: Factura, documento: string): boolean | null {
  if (!documento || f.pagador === 'obra_social') return null
  const propio = documentoReceptor(f.paciente)?.numero
  const dni = f.paciente.dni?.replace(/\D/g, '')
  if (!propio && !dni) return null
  const soloDni = (n: string) => (n.length === 11 ? n.slice(2, 10) : n.padStart(8, '0'))
  return [propio, dni].some((x) => x && (x === documento || soloDni(x) === soloDni(documento)))
}

/**
 * Cruza las Facturas C emitidas con lo pendiente. Prueba cada factura contra un pago suelto o contra todos los pagos
 * del paciente en el mes juntos (así sirve hayas hecho una por pago o una por mes). Coincide si tiene el mismo
 * importe y moneda, el mismo documento (cuando los dos lo tienen) y la fecha va de 15 días antes del primer pago a
 * 45 días después del último. Ante varias, gana la del documento, después la del nombre y después la más cercana.
 * Cada pago se usa una sola vez.
 */
export function cruzarMisComprobantes(hoja: Hoja, items: ParaFacturar[]): ResultadoMisComprobantes {
  const { comprobantes, otros, error } = leerMisComprobantes(hoja)
  if (error) return { coincidencias: [], sinCruzar: 0, otros, error }

  const candidatas = [...armarFacturas(items, true).filter((f) => f.pagos.length > 1), ...armarFacturas(items, false)]
  const usados = new Set<string>()
  const coincidencias: CoincidenciaArca[] = []
  let sinCruzar = 0

  for (const comp of [...comprobantes].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
    const t = Date.parse(comp.fecha)
    const nombre = normalizar(comp.receptor)
    const opciones = candidatas
      .map((f) => {
        if (f.moneda !== comp.moneda || f.pagos.some((p) => usados.has(p.id))) return null
        if (Math.abs(f.monto - comp.total) >= 0.01 && Math.abs(f.monto - comp.totalEnMoneda) >= 0.01) return null
        const doc = mismoDocumento(f, comp.documento)
        if (doc === false) return null
        const fechas = f.pagos.map((p) => Date.parse(p.fecha))
        const [desde, hasta] = [Math.min(...fechas), Math.max(...fechas)]
        if (t < desde - 15 * DIA || t > hasta + 45 * DIA) return null
        const porNombre = nombre && nombre.includes(normalizar(f.paciente.nombre)) ? 1 : 2
        return { f, puntaje: doc ? 0 : porNombre, distancia: t < desde ? desde - t : Math.max(0, t - hasta) }
      })
      .filter((x) => x !== null)
      .sort((a, b) => a.puntaje - b.puntaje || a.distancia - b.distancia)
    const elegida = opciones[0]?.f
    if (!elegida) {
      sinCruzar++
      continue
    }
    for (const p of elegida.pagos) usados.add(p.id)
    coincidencias.push({ factura: elegida, comprobante: comp })
  }
  return { coincidencias, sinCruzar, otros, error: null }
}
