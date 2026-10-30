// «Ticket de imputación»: cuenta paso a paso qué pasó con un pago. Cuando alguien paga de menos o de más, el sistema
// lo aplica solo (primero al mes elegido, después a los meses impagos más viejos) y el saldo cambia; para quien no
// sigue la cuenta eso se ve como magia. Esto arma el detalle: «se cubrió marzo, sobraron $ 10.000 que saldaron
// enero, y todavía debe febrero».
//
// Compara el saldo de antes con el de después de sumar el pago, usando el mismo cálculo de siempre (`calcularSaldos`),
// así que nunca puede contradecirse con lo que muestra el resto de la app. Funciones puras, sin acceso a la base.
import { formatMonto, formatPeriodo, type Moneda } from './formato'
import { calcularSaldos, type PagoSaldo, type SesionSaldo } from './saldos'

export interface PasoImputacion {
  periodo: string
  /** Lo que este pago sumó (o, si es negativo, liberó) en este mes. */
  aplicado: number
  /** Lo que debía el mes antes del pago y lo que debe después. */
  pendienteAntes: number
  pendienteDespues: number
  /** El mes que eligió la profesional para el pago (el resto se aplicó solo). */
  esElegido: boolean
}

export interface TicketImputacion {
  moneda: Moneda
  monto: number
  periodo: string
  /** Meses que cambiaron, en el orden en que se aplicó: primero el elegido, después los más viejos. */
  pasos: PasoImputacion[]
  /** Lo que sobró y queda a favor del paciente después del pago (saldo total, no solo de este pago). */
  aFavor: number
  /** Cuánto adeudaba en total antes y después (0 si está al día). */
  debiaAntes: number
  debeDespues: number
  /** El aumento (o la baja) del saldo a favor que causó este pago. */
  aFavorAntes: number
  /** El detalle en castellano, una frase por línea, listo para mostrar o mandar por WhatsApp. */
  frases: string[]
}

const centavos = (n: number) => Math.round(n * 100)
const pesos = (c: number) => c / 100

function resumenMeses(sesiones: SesionSaldo[], pagos: PagoSaldo[], moneda: Moneda) {
  const s = calcularSaldos(sesiones, pagos).find((x) => x.moneda === moneda)
  return { meses: new Map((s?.meses ?? []).map((m) => [m.periodo, m])), saldo: s?.saldo ?? 0 }
}

/**
 * Qué pasó con `pago` (de la moneda `pago.moneda`) al sumarlo a `pagosPrevios`.
 * `sesiones`: las que cuentan para el saldo (las cobrables); `pagosPrevios`: los pagos ya cargados, sin este.
 */
export function ticketDeImputacion(sesiones: SesionSaldo[], pagosPrevios: PagoSaldo[], pago: PagoSaldo): TicketImputacion {
  const { moneda, periodo } = pago
  const antes = resumenMeses(sesiones, pagosPrevios, moneda)
  const despues = resumenMeses(sesiones, [...pagosPrevios, pago], moneda)

  const periodos = [...new Set([...antes.meses.keys(), ...despues.meses.keys()])].sort()
  const pasos: PasoImputacion[] = []
  for (const p of periodos) {
    const a = antes.meses.get(p)
    const d = despues.meses.get(p)
    const aplicado = pesos(centavos(d?.pagado ?? 0) - centavos(a?.pagado ?? 0))
    if (aplicado === 0) continue
    pasos.push({ periodo: p, aplicado, pendienteAntes: a?.pendiente ?? 0, pendienteDespues: d?.pendiente ?? 0, esElegido: p === periodo })
  }
  // Orden de aplicación: el mes elegido primero y después del más viejo al más nuevo.
  pasos.sort((x, y) => Number(y.esElegido) - Number(x.esElegido) || x.periodo.localeCompare(y.periodo))

  const aFavor = Math.max(0, -despues.saldo)
  const aFavorAntes = Math.max(0, -antes.saldo)
  const debiaAntes = Math.max(0, antes.saldo)
  const debeDespues = Math.max(0, despues.saldo)

  const f = (n: number) => formatMonto(n, moneda)
  const frases: string[] = [`Pago de ${f(pago.monto)} para ${formatPeriodo(periodo)}.`]
  for (const p of pasos) {
    const mes = formatPeriodo(p.periodo)
    if (p.aplicado < 0) {
      frases.push(`${mes}: se reacomodaron ${f(-p.aplicado)} que estaban aplicados ahí; ahora debe ${f(p.pendienteDespues)}.`)
    } else if (p.pendienteDespues === 0) {
      frases.push(`${mes}: se cubrieron ${f(p.aplicado)} y quedó pagado.${p.esElegido ? '' : ' (Sobraba de este pago, por eso se aplicó a un mes más viejo.)'}`)
    } else {
      frases.push(`${mes}: se cubrieron ${f(p.aplicado)}; todavía debe ${f(p.pendienteDespues)}.`)
    }
  }
  const aplicadoTotal = pasos.reduce((t, p) => t + Math.max(0, centavos(p.aplicado)), 0)
  if (pasos.length === 0 && pago.monto > 0) frases.push('No había nada pendiente: todos los meses ya estaban pagos.')
  const sobro = aFavor - aFavorAntes
  if (sobro > 0.005 && aplicadoTotal >= 0) frases.push(`Sobraron ${f(sobro)}: quedan a favor${aFavorAntes > 0 ? ' (se suman a lo que ya tenía a favor)' : ''}.`)
  frases.push(debeDespues > 0 ? `${debiaAntes > 0 ? `Antes debía ${f(debiaAntes)}. ` : ''}Ahora debe ${f(debeDespues)}.` : aFavor > 0 ? `Está al día y tiene ${f(aFavor)} a favor.` : 'Está al día.')

  return { moneda, monto: pago.monto, periodo, pasos, aFavor, debiaAntes, debeDespues, aFavorAntes, frases }
}
