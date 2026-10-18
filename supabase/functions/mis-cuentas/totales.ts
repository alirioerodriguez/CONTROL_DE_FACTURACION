// Totales cobrados por mes y moneda (por fecha de pago), para mandar a Mis Cuentas.
// Siempre van los últimos 12 meses en las dos monedas, también en cero: así, si se borra un pago, el ingreso
// de ese mes se corrige o desaparece en Mis Cuentas.

export interface PagoTotal {
  fecha: string // AAAA-MM-DD
  monto: number | string
  moneda: string
}

export interface TotalMes {
  periodo: string // AAAA-MM-01
  moneda: 'ARS' | 'USD'
  total: number
}

export function totalesPorMes(pagos: PagoTotal[], hoy: string, meses = 12): TotalMes[] {
  const periodos: string[] = []
  const [a, m] = hoy.split('-').map(Number)
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(a, m - 1 - i, 1))
    periodos.push(d.toISOString().slice(0, 10))
  }
  const suma = new Map<string, number>()
  for (const p of pagos) {
    const clave = `${p.fecha.slice(0, 7)}-01|${p.moneda}`
    suma.set(clave, Math.round(((suma.get(clave) ?? 0) + Number(p.monto)) * 100) / 100)
  }
  return periodos.flatMap((periodo) =>
    (['ARS', 'USD'] as const).map((moneda) => ({ periodo, moneda, total: suma.get(`${periodo}|${moneda}`) ?? 0 })),
  )
}
