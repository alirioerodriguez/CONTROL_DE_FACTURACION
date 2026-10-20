// Cálculos de los reportes (funciones puras).
import { nombreCompleto, type Medio, type Paciente, type Pago, type Sesion } from './datos'
import { cobrables, estadoVisible, seCobra } from './estados'
import { hoyAR, periodoDe, redondear2, sumarMeses, type Moneda } from './formato'
import { estadoSesion, pagadoPorSesion, type EstadoSesion } from './saldos'

const MONEDAS: Moneda[] = ['ARS', 'USD']
export const MEDIOS: Medio[] = ['efectivo', 'transferencia', 'mercadopago', 'otro']

// ---------------------------------------------------------------------
// Reporte del mes: sesiones del mes, lo facturado y lo cobrado de ellas
// ---------------------------------------------------------------------

export interface FilaMes {
  paciente: Paciente
  nombre: string
  moneda: Moneda
  /** Todas las sesiones del mes. Las programadas y canceladas no suman a lo facturado. */
  sesiones: { fecha: string; monto: number; estado: EstadoSesion | 'programada' | 'cancelada'; ausente: boolean }[]
  facturado: number
  cobrado: number
  pendiente: number
}

export interface TotalMes {
  moneda: Moneda
  sesiones: number
  facturado: number
  cobrado: number
  pendiente: number
}

export function reporteMes(periodo: string, pacientes: Paciente[], sesiones: Sesion[], pagos: Pago[], hoy: string = hoyAR()) {
  const filas: FilaMes[] = []
  for (const p of pacientes) {
    const ses = sesiones.filter((s) => s.patient_id === p.id)
    const delMes = ses.filter((s) => periodoDe(s.fecha) === periodo)
    if (!delMes.length) continue
    const cubierto = pagadoPorSesion(cobrables(ses, hoy), pagos.filter((x) => x.patient_id === p.id))
    for (const moneda of MONEDAS) {
      const lista = delMes.filter((s) => s.moneda === moneda).sort((a, b) => a.fecha.localeCompare(b.fecha))
      if (!lista.length) continue
      const aCobrar = lista.filter((s) => seCobra(s, hoy))
      const facturado = redondear2(aCobrar.reduce((t, s) => t + s.monto, 0))
      const cobrado = redondear2(aCobrar.reduce((t, s) => t + (cubierto.get(s.id) ?? 0), 0))
      filas.push({
        paciente: p,
        nombre: nombreCompleto(p),
        moneda,
        sesiones: lista.map((s) => {
          const visible = estadoVisible(s, hoy)
          return {
            fecha: s.fecha,
            monto: s.monto,
            estado: visible === 'programada' || visible === 'cancelada' ? visible : estadoSesion(s.monto, cubierto.get(s.id) ?? 0),
            ausente: visible === 'ausente',
          }
        }),
        facturado,
        cobrado,
        pendiente: redondear2(facturado - cobrado),
      })
    }
  }
  filas.sort((a, b) => a.nombre.localeCompare(b.nombre) || a.moneda.localeCompare(b.moneda))

  const totales: TotalMes[] = MONEDAS.map((moneda) => {
    const f = filas.filter((x) => x.moneda === moneda)
    const facturado = redondear2(f.reduce((t, x) => t + x.facturado, 0))
    const cobrado = redondear2(f.reduce((t, x) => t + x.cobrado, 0))
    const sesionesCobrables = f.reduce((t, x) => t + x.sesiones.filter((s) => s.estado !== 'programada' && s.estado !== 'cancelada').length, 0)
    return { moneda, sesiones: sesionesCobrables, facturado, cobrado, pendiente: redondear2(facturado - cobrado) }
  }).filter((t) => t.sesiones > 0)

  return { filas, totales }
}

// ---------------------------------------------------------------------
// Reporte para contadora: cobros según fecha de pago
// ---------------------------------------------------------------------

export interface Agregado {
  total: number
  cantidad: number
  conFactura: number
  medios: Record<Medio, number>
}

const agregadoVacio = (): Agregado => ({
  total: 0,
  cantidad: 0,
  conFactura: 0,
  medios: { efectivo: 0, transferencia: 0, mercadopago: 0, otro: 0 },
})

export function agregar(pagos: Pago[]): Record<Moneda, Agregado> {
  const r = { ARS: agregadoVacio(), USD: agregadoVacio() }
  for (const p of pagos) {
    const a = r[p.moneda]
    a.total = redondear2(a.total + p.monto)
    a.cantidad++
    if (p.nro_factura) a.conFactura++
    a.medios[p.medio] = redondear2(a.medios[p.medio] + p.monto)
  }
  return r
}

export interface PagoDetalle {
  pago: Pago
  paciente: string
  dni: string | null
  cuil_cuit: string | null
}

export interface MesContadora {
  periodo: string
  porMoneda: Record<Moneda, Agregado>
  pagos: PagoDetalle[]
}

/** Lista de periodos entre dos meses inclusive ('AAAA-MM-01'). */
export function mesesEntre(desde: string, hasta: string): string[] {
  const r: string[] = []
  for (let p = desde; p <= hasta; p = sumarMeses(p, 1)) r.push(p)
  return r
}

export function reporteContadora(desde: string, hasta: string, hoy: string, pacientes: Paciente[], pagos: Pago[]) {
  const porId = new Map(pacientes.map((p) => [p.id, p]))
  const enRango = pagos
    .filter((p) => periodoDe(p.fecha) >= desde && periodoDe(p.fecha) <= hasta)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
  const meses: MesContadora[] = mesesEntre(desde, hasta).map((periodo) => {
    const delMes = enRango.filter((p) => periodoDe(p.fecha) === periodo)
    return {
      periodo,
      porMoneda: agregar(delMes),
      pagos: delMes.map((pago) => {
        const p = porId.get(pago.patient_id)
        return { pago, paciente: p ? nombreCompleto(p) : '—', dni: p?.dni ?? null, cuil_cuit: p?.cuil_cuit ?? null }
      }),
    }
  })
  const actual = periodoDe(hoy)
  const desde12 = sumarMeses(actual, -11)
  const ultimos12 = agregar(pagos.filter((p) => periodoDe(p.fecha) >= desde12 && periodoDe(p.fecha) <= actual))
  return {
    meses,
    totales: agregar(enRango),
    cantidadPagos: enRango.length,
    ultimos12,
    rango12: { desde: desde12, hasta: actual },
  }
}
