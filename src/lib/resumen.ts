// Cálculos por paciente a partir de los datos crudos (sin acceso a la base).
import { cobrables } from './estados'
import { formatMonto, hoyAR, type Moneda } from './formato'
import { calcularSaldos, type SaldoMoneda } from './saldos'
import type { Pago, Sesion } from './datos'

export type Deuda = Record<Moneda, number>

/** Saldo del paciente. Solo cuentan las sesiones realizadas y las ausentes (ver estados.ts). */
export function saldosDe(pacienteId: string, sesiones: Sesion[], pagos: Pago[], hoy: string = hoyAR()): SaldoMoneda[] {
  return calcularSaldos(
    cobrables(sesiones.filter((s) => s.patient_id === pacienteId), hoy),
    pagos.filter((p) => p.patient_id === pacienteId),
  )
}

/** Lo que debe en cada moneda (0 si está al día o tiene saldo a favor). */
export function deudaDe(saldos: SaldoMoneda[]): Deuda {
  const d: Deuda = { ARS: 0, USD: 0 }
  for (const s of saldos) d[s.moneda] = Math.max(0, s.saldo)
  return d
}

export function debeAlgo(d: Deuda): boolean {
  return d.ARS > 0 || d.USD > 0
}

/** "$ 50.000,00 + US$ 40,00" */
export function textoDeuda(d: Deuda): string {
  return (['ARS', 'USD'] as const)
    .filter((m) => d[m] > 0)
    .map((m) => formatMonto(d[m], m))
    .join(' + ')
}

/** Saldo a favor por moneda (pagos adelantados). */
export function aFavorDe(saldos: SaldoMoneda[]): Deuda {
  const d: Deuda = { ARS: 0, USD: 0 }
  for (const s of saldos) d[s.moneda] = Math.max(0, -s.saldo)
  return d
}
