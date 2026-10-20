// «Para facturar»: pagos que todavía no tienen factura, con los datos que pide ARCA para hacer la Factura C.
import { nombreCompleto, type Paciente, type Pagador, type Pago, type Sesion } from './datos'
import { formatFecha, formatMonto, formatPeriodo, plural, type Moneda } from './formato'
import type { Palabras } from './terminos'

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
export function finDeMes(periodo: string): string {
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

// ---------------------------------------------------------------------
// Facturas a hacer: una por pago, o una por paciente por mes
// ---------------------------------------------------------------------

/** Una Factura C a cargar en ARCA. Junta uno o más pagos del mismo paciente, periodo, moneda y pagador. */
export interface Factura {
  clave: string
  paciente: Paciente
  pagos: Pago[]
  periodo: string
  monto: number
  moneda: Moneda
  pagador: Pagador
  /** Sesiones del periodo (sin las canceladas). Solo en la factura mensual. */
  sesiones?: number
}

/** La factura de un solo pago. */
export function facturaDePago({ pago, paciente }: ParaFacturar): Factura {
  return { clave: pago.id, paciente, pagos: [pago], periodo: pago.periodo, monto: pago.monto, moneda: pago.moneda, pagador: pago.pagador }
}

/**
 * Arma las facturas a hacer. Por pago: una por cada uno. Por mes: una por paciente y periodo, sumando sus pagos;
 * nunca junta monedas distintas ni lo que pagó el paciente con lo que pagó su obra social.
 */
export function armarFacturas(items: ParaFacturar[], porMes: boolean, sesiones: Sesion[] = []): Factura[] {
  if (!porMes) return items.map(facturaDePago)
  const grupos = new Map<string, Factura>()
  for (const it of items) {
    const { pago, paciente } = it
    const clave = [paciente.id, pago.periodo, pago.moneda, pago.pagador].join('|')
    const f = grupos.get(clave)
    if (f) {
      f.pagos.push(pago)
      f.monto = Math.round((f.monto + pago.monto) * 100) / 100
    } else grupos.set(clave, { ...facturaDePago(it), clave })
  }
  const lista = [...grupos.values()]
  for (const f of lista) {
    const mes = f.periodo.slice(0, 7)
    f.sesiones = sesiones.filter((s) => s.patient_id === f.paciente.id && s.moneda === f.moneda && s.estado !== 'cancelada' && s.fecha.startsWith(mes)).length
  }
  return lista
}

type Vocabulario = Pick<Palabras, 'sesion' | 'sesiones'>

/** "Honorarios profesionales: 4 sesiones de septiembre 2026" (y la paciente, si factura la obra social). */
export function descripcionFactura(f: Factura, pal: Vocabulario): string {
  const que = f.sesiones ? plural(f.sesiones, pal.sesion, pal.sesiones) : pal.sesiones
  const base = `Honorarios profesionales: ${que} de ${formatPeriodo(f.periodo)}`
  if (f.pagador !== 'obra_social') return base
  const afiliado = [nombreCompleto(f.paciente), f.paciente.nro_afiliado && `afiliado N.º ${f.paciente.nro_afiliado}`].filter(Boolean).join(', ')
  return `${base} · ${afiliado}`
}

/** Fecha del primer pago al último, para mostrar. */
export function fechasDePago(f: Factura): string {
  const fechas = f.pagos.map((p) => p.fecha).sort()
  const [desde, hasta] = [fechas[0], fechas[fechas.length - 1]]
  return desde === hasta ? formatFecha(desde) : `${formatFecha(desde)} al ${formatFecha(hasta)}`
}

/** Monto como se escribe en el campo de ARCA: sin signo ni separador de miles, con coma decimal. */
export function montoParaArca(monto: number): string {
  return Number.isInteger(monto) ? String(monto) : monto.toFixed(2).replace('.', ',')
}

/** Los datos en el orden en que los pide el formulario de ARCA (Comprobantes en línea). */
export function datosFactura(f: Factura, pal: Vocabulario): { etiqueta: string; valor: string }[] {
  const periodo = `${formatFecha(f.periodo)} al ${formatFecha(finDeMes(f.periodo))}`
  const datos: { etiqueta: string; valor: string }[] = [
    { etiqueta: 'Concepto', valor: 'Servicios' },
    { etiqueta: 'Período facturado', valor: periodo },
  ]
  // Si pagó la obra social, la factura va a su nombre y la paciente se nombra en la descripción.
  if (f.pagador === 'obra_social') {
    datos.push(
      { etiqueta: 'Condición frente al IVA', valor: 'La de la obra social (ARCA la muestra al cargar el CUIT)' },
      { etiqueta: 'Receptor', valor: f.paciente.obra_social || 'Obra social' },
      { etiqueta: 'CUIT', valor: 'El de la obra social (ARCA completa el nombre al cargarlo)' },
    )
  } else {
    const doc = documentoReceptor(f.paciente)
    datos.push(
      { etiqueta: 'Condición frente al IVA', valor: f.paciente.condicion_iva || 'Consumidor final' },
      { etiqueta: 'Receptor', valor: nombreCompleto(f.paciente) },
      { etiqueta: doc ? doc.tipo : 'Documento', valor: doc ? doc.numero : 'Sin cargar (con consumidor final se puede omitir si el monto es bajo)' },
      ...(f.paciente.domicilio ? [{ etiqueta: 'Domicilio', valor: f.paciente.domicilio }] : []),
    )
  }
  datos.push({ etiqueta: 'Descripción', valor: descripcionFactura(f, pal) }, { etiqueta: 'Importe', valor: formatMonto(f.monto, f.moneda) })
  if (f.moneda === 'USD') datos.push({ etiqueta: 'Moneda', valor: 'Dólares: en ARCA elegí moneda extranjera y la cotización del día' })
  return datos
}

/** Texto para copiar y pegar (un dato por renglón). */
export function textoFactura(f: Factura, pal: Vocabulario): string {
  return datosFactura(f, pal)
    .map((d) => `${d.etiqueta}: ${d.valor}`)
    .join('\n')
}

// ---------------------------------------------------------------------
// Modo ARCA: las mismas pantallas de Comprobantes en línea, en el mismo orden
// ---------------------------------------------------------------------

export interface CampoArca {
  etiqueta: string
  valor: string
  /** Lo que va al portapapeles (sin signo $ ni puntos de miles). Sin esto, el dato no se copia (se elige en una lista). */
  copiar?: string
  /** true si cambia de una factura a otra (se resalta); false si es siempre igual (va plegado). */
  cambia: boolean
}

export interface PantallaArca {
  /** Para la barra de pantallas. */
  corto: string
  titulo: string
  /** El botón de ARCA que lleva a la pantalla siguiente. */
  boton: string
  campos: CampoArca[]
}

/** Las pantallas de «Generar comprobantes» con lo que va en cada campo. `hoy` es 'AAAA-MM-DD'. */
export function pantallasArca(f: Factura, pal: Vocabulario, hoy: string): PantallaArca[] {
  const fijo = (etiqueta: string, valor: string, copiar?: string): CampoArca => ({ etiqueta, valor, copiar, cambia: false })
  // null: el dato se elige en una lista de ARCA, no se copia.
  const cambia = (etiqueta: string, valor: string, copiar: string | null = valor): CampoArca => ({ etiqueta, valor, copiar: copiar ?? undefined, cambia: true })
  const desde = formatFecha(f.periodo)
  const hasta = formatFecha(finDeMes(f.periodo))

  const emision = [
    fijo('Fecha del comprobante', `Hoy, ${formatFecha(hoy)} (la que propone ARCA)`),
    fijo('Concepto a incluir', 'Servicios'),
    cambia('Período facturado desde', desde),
    cambia('Período facturado hasta', hasta),
    fijo('Vto. para el pago', formatFecha(hoy), formatFecha(hoy)),
  ]
  if (f.moneda === 'USD') emision.push(cambia('Moneda extranjera', 'Dólar, con la cotización que propone ARCA', null))

  let receptor: CampoArca[]
  if (f.pagador === 'obra_social') {
    // honorapp no guarda el CUIT de la obra social: se busca en ARCA y completa el resto.
    receptor = [
      cambia('Condición frente al IVA', 'La de la obra social (ARCA la muestra al cargar el CUIT)', null),
      cambia('Tipo de documento', 'CUIT', null),
      cambia('Número', `El CUIT de ${f.paciente.obra_social || 'la obra social'}`, null),
      cambia('Razón social', f.paciente.obra_social || 'Obra social'),
    ]
  } else {
    const doc = documentoReceptor(f.paciente)
    const iva = f.paciente.condicion_iva || 'Consumidor final'
    receptor = [
      iva === 'Consumidor final' ? fijo('Condición frente al IVA', iva) : cambia('Condición frente al IVA', iva, null),
      cambia('Tipo de documento', doc ? doc.tipo : 'Sin documento (con consumidor final se puede omitir si el monto es bajo)', null),
      ...(doc ? [cambia('Número', doc.numero)] : []),
      cambia('Apellido y nombre', nombreCompleto(f.paciente)),
      ...(f.paciente.domicilio ? [cambia('Domicilio', f.paciente.domicilio)] : []),
    ]
  }
  receptor.push(fijo('Condición de venta', 'Contado'))

  return [
    {
      titulo: 'Punto de venta y tipo de comprobante',
      corto: 'Tipo',
      boton: 'Continuar',
      campos: [fijo('Punto de venta', 'El tuyo (el de siempre)'), fijo('Tipo de comprobante', 'Factura C')],
    },
    { titulo: 'Datos de emisión', corto: 'Emisión', boton: 'Continuar', campos: emision },
    { titulo: 'Datos del receptor', corto: 'Receptor', boton: 'Continuar', campos: receptor },
    {
      titulo: 'Datos de la operación',
      corto: 'Operación',
      boton: 'Continuar',
      campos: [
        cambia('Producto / Servicio', descripcionFactura(f, pal)),
        fijo('Cantidad', '1', '1'),
        fijo('U. medida', 'unidades'),
        cambia('Precio unitario', formatMonto(f.monto, f.moneda), montoParaArca(f.monto)),
      ],
    },
    {
      titulo: 'Resumen',
      corto: 'Resumen',
      boton: 'Confirmar datos → Generar comprobante',
      campos: [cambia('Importe total', formatMonto(f.monto, f.moneda), null)],
    },
  ]
}

/** El número que sigue: 'C 00002-00000123' → 'C 00002-00000124'. Sin formato reconocible, vacío. */
export function numeroSiguiente(numero: string): string {
  const m = /^(.*?)(\d+)\s*$/.exec(numero.trim())
  if (!m) return ''
  const siguiente = String(Number(m[2]) + 1).padStart(m[2].length, '0')
  return `${m[1]}${siguiente}`
}
