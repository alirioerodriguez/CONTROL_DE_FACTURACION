// Abono mensual fijo: el paciente paga lo mismo cada mes, haga las sesiones que haga.
// El abono se reparte entre las sesiones del mes (las canceladas no cuentan), así el saldo, Inicio, los reportes
// y los recordatorios lo usan sin cambios. Un mes sin sesiones (vacaciones) no genera deuda.
import type { Paciente, Sesion } from './datos'

export function tieneAbono(p: Pick<Paciente, 'abono_mensual'>): boolean {
  return (p.abono_mensual ?? 0) > 0
}

/** Devuelve las sesiones con el monto del abono repartido en cada mes (al centavo; la última se lleva el resto). */
export function aplicarAbono(sesiones: Sesion[], pacientes: Paciente[]): Sesion[] {
  const conAbono = new Map(pacientes.filter(tieneAbono).map((p) => [p.id, p]))
  if (conAbono.size === 0) return sesiones

  const grupos = new Map<string, Sesion[]>()
  for (const s of sesiones) {
    const p = conAbono.get(s.patient_id)
    if (!p || s.estado === 'cancelada' || s.moneda !== p.moneda) continue
    const clave = `${s.patient_id}|${s.fecha.slice(0, 7)}`
    const g = grupos.get(clave)
    if (g) g.push(s)
    else grupos.set(clave, [s])
  }

  const montos = new Map<string, number>()
  for (const [clave, g] of grupos) {
    const total = Math.round((conAbono.get(clave.split('|')[0])!.abono_mensual ?? 0) * 100)
    const orden = [...g].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id))
    const parte = Math.floor(total / orden.length)
    orden.forEach((s, i) => montos.set(s.id, (i === orden.length - 1 ? total - parte * (orden.length - 1) : parte) / 100))
  }

  return sesiones.map((s) => (montos.has(s.id) ? { ...s, monto: montos.get(s.id)! } : s))
}
