// Cálculo de saldos. Funciones puras, sin acceso a la base.
//
// Regla de negocio: el paciente paga por mes. Lo que debe de un mes es la
// suma de las sesiones de ese mes. Cada pago se aplica primero al mes
// imputado (periodo); si sobra, cancela los meses impagos más viejos, y lo
// que quede es saldo a favor. ARS y USD se calculan por separado: nunca se
// convierten ni se suman entre sí.
//
// Internamente se trabaja en centavos enteros para evitar errores de
// redondeo con decimales.

import { periodoDe, type Moneda } from './formato'

export type EstadoMes = 'pagado' | 'parcial' | 'pendiente' | 'a_favor'

export interface SesionSaldo {
  fecha: string // 'AAAA-MM-DD'
  monto: number
  moneda: Moneda
}

export interface PagoSaldo {
  periodo: string // 'AAAA-MM-01'
  monto: number
  moneda: Moneda
}

export interface MesSaldo {
  periodo: string
  cargo: number
  pagado: number
  pendiente: number
  sesiones: number
  estado: EstadoMes
}

export interface SaldoMoneda {
  moneda: Moneda
  cargos: number
  pagos: number
  /** cargos − pagos. Negativo = saldo a favor del paciente. */
  saldo: number
  meses: MesSaldo[] // ordenados del más viejo al más nuevo
}

const MONEDAS: Moneda[] = ['ARS', 'USD']

const aCentavos = (n: number) => Math.round(n * 100)
const aPesos = (c: number) => c / 100

/** Saldo de un paciente, separado por moneda. Solo incluye monedas con movimientos. */
export function calcularSaldos(sesiones: SesionSaldo[], pagos: PagoSaldo[]): SaldoMoneda[] {
  return MONEDAS.map((moneda) =>
    saldoEnMoneda(
      moneda,
      sesiones.filter((s) => s.moneda === moneda),
      pagos.filter((p) => p.moneda === moneda),
    ),
  ).filter((s) => s.meses.length > 0)
}

function saldoEnMoneda(moneda: Moneda, sesiones: SesionSaldo[], pagos: PagoSaldo[]): SaldoMoneda {
  const meses = new Map<string, { cargo: number; pagado: number; sesiones: number }>()
  const mes = (periodo: string) => {
    let m = meses.get(periodo)
    if (!m) {
      m = { cargo: 0, pagado: 0, sesiones: 0 }
      meses.set(periodo, m)
    }
    return m
  }

  for (const s of sesiones) {
    const m = mes(periodoDe(s.fecha))
    m.cargo += aCentavos(s.monto)
    m.sesiones += 1
  }

  // 1) Cada pago cubre primero su mes imputado.
  let sobrante = 0
  for (const p of pagos) {
    const m = mes(p.periodo)
    const monto = aCentavos(p.monto)
    const aplicable = Math.min(monto, Math.max(0, m.cargo - m.pagado))
    m.pagado += aplicable
    sobrante += monto - aplicable
  }

  const ordenados = [...meses.entries()].sort(([a], [b]) => a.localeCompare(b))

  // 2) El sobrante cancela los meses impagos más viejos (FIFO).
  for (const [, m] of ordenados) {
    if (sobrante === 0) break
    const aplicable = Math.min(sobrante, m.cargo - m.pagado)
    m.pagado += aplicable
    sobrante -= aplicable
  }

  const cargos = ordenados.reduce((t, [, m]) => t + m.cargo, 0)
  const totalPagos = pagos.reduce((t, p) => t + aCentavos(p.monto), 0)

  return {
    moneda,
    cargos: aPesos(cargos),
    pagos: aPesos(totalPagos),
    saldo: aPesos(cargos - totalPagos),
    meses: ordenados.map(([periodo, m]) => ({
      periodo,
      cargo: aPesos(m.cargo),
      pagado: aPesos(m.pagado),
      pendiente: aPesos(m.cargo - m.pagado),
      sesiones: m.sesiones,
      estado: estadoMes(m.cargo, m.pagado),
    })),
  }
}

function estadoMes(cargo: number, pagado: number): EstadoMes {
  if (cargo === 0) return 'a_favor' // mes sin sesiones con pago adelantado
  if (pagado >= cargo) return 'pagado'
  if (pagado > 0) return 'parcial'
  return 'pendiente'
}

// ---------------------------------------------------------------------
// Tarifas
// ---------------------------------------------------------------------

export interface PacienteTarifa {
  tipo_tarifa: 'estandar' | 'personalizada'
  tarifa_personalizada: number | null
}

/** Tarifa por hora vigente hoy para un paciente. */
export function tarifaVigente(paciente: PacienteTarifa, tarifaEstandar: number): number {
  if (paciente.tipo_tarifa === 'personalizada' && paciente.tarifa_personalizada != null) {
    return paciente.tarifa_personalizada
  }
  return tarifaEstandar
}

// ---------------------------------------------------------------------
// Sesiones del mes según los días fijos del paciente
// ---------------------------------------------------------------------

/**
 * Fechas del mes que caen en los días de la semana indicados
 * (0 = domingo … 6 = sábado). Ej.: todos los lunes de marzo 2026.
 */
export function fechasDelMes(periodo: string, diasSemana: number[]): string[] {
  const [anio, mes] = periodo.split('-').map(Number)
  const diasEnMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate()
  const fechas: string[] = []
  for (let dia = 1; dia <= diasEnMes; dia++) {
    const diaSemana = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay()
    if (diasSemana.includes(diaSemana)) {
      fechas.push(`${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`)
    }
  }
  return fechas
}
