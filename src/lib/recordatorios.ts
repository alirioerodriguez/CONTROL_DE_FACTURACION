// Pantalla Recordatorios (opcional): a quién hay que recordarle el pago y con qué mensaje.
import type { Paciente, Pago, Perfil, Sesion } from './datos'
import { completarPlantilla, formatMonto, hoyAR, nombreMes, numeroWhatsApp, type Moneda } from './formato'
import { deudaDe, saldosDe, textoDeuda, type Deuda } from './resumen'

export interface PorRecordar {
  paciente: Paciente
  deuda: Deuda
  /** Meses con algo impago, del más viejo al más nuevo (AAAA-MM-01). */
  meses: string[]
}

/** Pacientes que deben algo hoy, primero los que deben desde hace más tiempo. */
export function porRecordar(pacientes: Paciente[], sesiones: Sesion[], pagos: Pago[], hoy: string = hoyAR()): PorRecordar[] {
  const lista: PorRecordar[] = []
  for (const paciente of pacientes) {
    const saldos = saldosDe(paciente.id, sesiones, pagos, hoy)
    const deuda = deudaDe(saldos)
    if (deuda.ARS <= 0 && deuda.USD <= 0) continue
    const meses = [...new Set(saldos.flatMap((s) => s.meses.filter((m) => m.pendiente > 0).map((m) => m.periodo)))].sort()
    lista.push({ paciente, deuda, meses })
  }
  return lista.sort((a, b) => (a.meses[0] ?? '').localeCompare(b.meses[0] ?? '') || a.paciente.nombre.localeCompare(b.paciente.nombre))
}

/** ['2026-09-01', '2026-10-01'] → 'septiembre y octubre'. Con más de un año, agrega el año. */
export function textoMeses(meses: string[]): string {
  const variosAnios = new Set(meses.map((m) => m.slice(0, 4))).size > 1
  const nombres = meses.map((m) => (variosAnios ? `${nombreMes(m)} ${m.slice(0, 4)}` : nombreMes(m)))
  if (nombres.length <= 1) return nombres[0] ?? ''
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`
}

/** Mensaje del recordatorio con la plantilla de Ajustes. */
export function mensajeRecordatorio(r: PorRecordar, perfil: Perfil | undefined): string {
  const monedas = (['ARS', 'USD'] as Moneda[]).filter((m) => r.deuda[m] > 0)
  return completarPlantilla(perfil?.plantilla_whatsapp ?? '', {
    nombre: r.paciente.nombre.split(' ')[0],
    mes: textoMeses(r.meses),
    monto: monedas.length === 1 ? formatMonto(r.deuda[monedas[0]], monedas[0]) : textoDeuda(r.deuda),
    pago: perfil?.datos_pago,
  })
}

/** Link de WhatsApp, o null si el paciente no tiene teléfono. */
export function linkRecordatorio(r: PorRecordar, perfil: Perfil | undefined): string | null {
  const numero = numeroWhatsApp(r.paciente.telefono)
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(mensajeRecordatorio(r, perfil))}` : null
}
