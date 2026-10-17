// «Para facturar»: pagos que todavía no tienen factura, con los datos que pide ARCA para hacer la Factura C.
import { nombreCompleto, type Paciente, type Pago } from './datos'
import { formatFecha, formatMonto, formatPeriodo, type Moneda } from './formato'

export interface ParaFacturar {
  pago: Pago
  paciente: Paciente
}

export interface MesParaFacturar {
  periodo: string
  items: ParaFacturar[]
  total: Record<Moneda, number>
}

/** Pagos sin Factura C desde un mes (por fecha de pago), agrupados por mes de pago, el más nuevo primero. */
export function pagosParaFacturar(pagos: Pago[], pacientes: Paciente[], desde: string): MesParaFacturar[] {
  const porId = new Map(pacientes.map((p) => [p.id, p]))
  const meses = new Map<string, MesParaFacturar>()
  for (const pago of pagos) {
    if (pago.comprobante === 'factura_c' || pago.fecha < desde) continue
    const paciente = porId.get(pago.patient_id)
    if (!paciente) continue
    const periodo = `${pago.fecha.slice(0, 7)}-01`
    const mes = meses.get(periodo) ?? { periodo, items: [], total: { ARS: 0, USD: 0 } }
    mes.items.push({ pago, paciente })
    mes.total[pago.moneda] = Math.round((mes.total[pago.moneda] + pago.monto) * 100) / 100
    meses.set(periodo, mes)
  }
  const lista = [...meses.values()].sort((a, b) => b.periodo.localeCompare(a.periodo))
  for (const m of lista) m.items.sort((a, b) => a.pago.fecha.localeCompare(b.pago.fecha) || a.paciente.nombre.localeCompare(b.paciente.nombre))
  return lista
}

/** Último día del mes de un periodo 'AAAA-MM-01'. */
function finDeMes(periodo: string): string {
  const [a, m] = periodo.split('-').map(Number)
  return `${periodo.slice(0, 8)}${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, '0')}`
}

/** Documento del receptor: CUIT/CUIL si lo tiene, si no DNI. */
export function documentoReceptor(p: Paciente): { tipo: 'CUIT' | 'DNI'; numero: string } | null {
  const cuit = p.cuil_cuit?.replace(/\D/g, '')
  if (cuit) return { tipo: 'CUIT', numero: cuit }
  const dni = p.dni?.replace(/\D/g, '')
  return dni ? { tipo: 'DNI', numero: dni } : null
}

/** Los datos en el orden en que los pide el formulario de ARCA (Comprobantes en línea). */
export function datosFactura(item: ParaFacturar, unidad: string): { etiqueta: string; valor: string }[] {
  const { pago, paciente } = item
  const periodo = `${formatFecha(pago.periodo)} al ${formatFecha(finDeMes(pago.periodo))}`
  // Si pagó la obra social, la factura va a su nombre y la paciente se nombra en la descripción.
  if (pago.pagador === 'obra_social') {
    const afiliado = [nombreCompleto(paciente), paciente.nro_afiliado && `afiliado N.º ${paciente.nro_afiliado}`].filter(Boolean).join(', ')
    const datos = [
      { etiqueta: 'Concepto', valor: 'Servicios' },
      { etiqueta: 'Período facturado', valor: periodo },
      { etiqueta: 'Condición frente al IVA', valor: 'La de la obra social (ARCA la muestra al cargar el CUIT)' },
      { etiqueta: 'Receptor', valor: paciente.obra_social || 'Obra social' },
      { etiqueta: 'CUIT', valor: 'El de la obra social (ARCA completa el nombre al cargarlo)' },
      { etiqueta: 'Descripción', valor: `Honorarios profesionales: ${unidad} de ${formatPeriodo(pago.periodo)} · ${afiliado}` },
      { etiqueta: 'Importe', valor: formatMonto(pago.monto, pago.moneda) },
    ]
    if (pago.moneda === 'USD') datos.push({ etiqueta: 'Moneda', valor: 'Dólares: en ARCA elegí moneda extranjera y la cotización del día' })
    return datos
  }
  const doc = documentoReceptor(paciente)
  const datos = [
    { etiqueta: 'Concepto', valor: 'Servicios' },
    { etiqueta: 'Período facturado', valor: periodo },
    { etiqueta: 'Condición frente al IVA', valor: paciente.condicion_iva || 'Consumidor final' },
    { etiqueta: 'Receptor', valor: nombreCompleto(paciente) },
    { etiqueta: doc ? doc.tipo : 'Documento', valor: doc ? doc.numero : 'Sin cargar (con consumidor final se puede omitir si el monto es bajo)' },
    ...(paciente.domicilio ? [{ etiqueta: 'Domicilio', valor: paciente.domicilio }] : []),
    { etiqueta: 'Descripción', valor: `Honorarios profesionales: ${unidad} de ${formatPeriodo(pago.periodo)}` },
    { etiqueta: 'Importe', valor: formatMonto(pago.monto, pago.moneda) },
  ]
  if (pago.moneda === 'USD') datos.push({ etiqueta: 'Moneda', valor: 'Dólares: en ARCA elegí moneda extranjera y la cotización del día' })
  return datos
}

/** Texto para copiar y pegar (un dato por renglón). */
export function textoFactura(item: ParaFacturar, unidad: string): string {
  return datosFactura(item, unidad)
    .map((d) => `${d.etiqueta}: ${d.valor}`)
    .join('\n')
}
