// Resumen del mes para la pantalla Inicio (funciones puras).
import type { Paciente, Pago, Sesion } from './datos'
import { periodoDe, redondear2, sumarMeses, type Moneda } from './formato'
import { estadoSesion, pagadoPorSesion, type EstadoSesion } from './saldos'

type PorMoneda = Record<Moneda, number>
const cero = (): PorMoneda => ({ ARS: 0, USD: 0 })

export interface SesionImpaga {
  sesion: Sesion
  debe: number
  estado: Exclude<EstadoSesion, 'pagada'>
}

export interface ResumenMes {
  cobrado: PorMoneda
  cantPagos: PorMoneda
  pendiente: PorMoneda
  pacientesConSesiones: number
  pacientesActivos: number
  sesionesDelMes: number
  /** Todas las sesiones con saldo, de la más nueva a la más vieja. */
  impagas: SesionImpaga[]
  /** Cobrado de los 6 meses que terminan en el mes elegido. */
  barras: { periodo: string; cobrado: PorMoneda }[]
}

export function resumenMes(periodo: string, pacientes: Paciente[], sesiones: Sesion[], pagos: Pago[]): ResumenMes {
  // Lo cubierto de cada sesión se calcula por paciente (cada uno tiene su saldo).
  const cubierto = new Map<string, number>()
  for (const p of pacientes) {
    const delPaciente = pagadoPorSesion(
      sesiones.filter((s) => s.patient_id === p.id),
      pagos.filter((x) => x.patient_id === p.id),
    )
    delPaciente.forEach((v, k) => cubierto.set(k, v))
  }

  const cobrado = cero()
  const cantPagos = cero()
  for (const p of pagos) {
    if (periodoDe(p.fecha) !== periodo) continue
    cobrado[p.moneda] = redondear2(cobrado[p.moneda] + p.monto)
    cantPagos[p.moneda]++
  }

  const pendiente = cero()
  const delMes = sesiones.filter((s) => periodoDe(s.fecha) === periodo)
  for (const s of delMes) pendiente[s.moneda] = redondear2(pendiente[s.moneda] + s.monto - (cubierto.get(s.id) ?? 0))

  const impagas: SesionImpaga[] = []
  for (const s of sesiones) {
    const pagado = cubierto.get(s.id) ?? 0
    const estado = estadoSesion(s.monto, pagado)
    if (estado !== 'pagada') impagas.push({ sesion: s, debe: redondear2(s.monto - pagado), estado })
  }
  impagas.sort((a, b) => b.sesion.fecha.localeCompare(a.sesion.fecha))

  const barras = Array.from({ length: 6 }, (_, i) => {
    const per = sumarMeses(periodo, i - 5)
    const c = cero()
    for (const p of pagos) if (periodoDe(p.fecha) === per) c[p.moneda] = redondear2(c[p.moneda] + p.monto)
    return { periodo: per, cobrado: c }
  })

  return {
    cobrado,
    cantPagos,
    pendiente,
    pacientesConSesiones: new Set(delMes.map((s) => s.patient_id)).size,
    pacientesActivos: pacientes.filter((p) => p.activo).length,
    sesionesDelMes: delMes.length,
    impagas,
    barras,
  }
}
