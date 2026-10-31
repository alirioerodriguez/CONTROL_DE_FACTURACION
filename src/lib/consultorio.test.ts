// Un consultorio de ejemplo de punta a punta: sesiones de varios meses, pagos de menos, de más, adelantados y en dos
// monedas. Primero un caso armado a mano con los números esperados escritos; después 300 consultorios inventados al azar
// (con semilla fija, así el resultado es siempre el mismo) donde se comprueban las reglas que nunca se pueden romper:
// las cuentas cierran al centavo, el orden en que se cargan los pagos no cambia nada y el ticket de imputación explica
// exactamente el pago.
import { describe, expect, it } from 'vitest'
import { ticketDeImputacion } from './imputacion'
import { calcularSaldos, pagadoPorSesion, type PagoSaldo, type SesionSaldo } from './saldos'
import type { Moneda } from './formato'

const c = (n: number) => Math.round(n * 100)

describe('Consultorio de ejemplo: Laura, psicóloga', () => {
  // Martín: 4 sesiones por mes de $ 30.000. Paga de menos en agosto, se pone al día en septiembre con un pago grande.
  const sesiones: SesionSaldo[] = [
    ...['2026-08-04', '2026-08-11', '2026-08-18', '2026-08-25'].map((fecha) => ({ fecha, monto: 30000, moneda: 'ARS' as Moneda })),
    ...['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22'].map((fecha) => ({ fecha, monto: 30000, moneda: 'ARS' as Moneda })),
    // en octubre sube la tarifa a $ 36.000 y una sesión es online en dólares (paciente que vive afuera)
    ...['2026-10-06', '2026-10-13'].map((fecha) => ({ fecha, monto: 36000, moneda: 'ARS' as Moneda })),
    { fecha: '2026-10-20', monto: 40, moneda: 'USD' as Moneda },
  ]
  const pagos: PagoSaldo[] = [
    { periodo: '2026-08-01', monto: 90000, moneda: 'ARS' }, // le faltaron 30.000
    { periodo: '2026-09-01', monto: 160000, moneda: 'ARS' }, // septiembre (120.000) + agosto (30.000) + 10.000 de más
    { periodo: '2026-10-01', monto: 50, moneda: 'USD' }, // 10 dólares a favor
  ]

  it('el saldo en pesos: debe octubre menos lo que sobró de septiembre', () => {
    const ars = calcularSaldos(sesiones, pagos).find((s) => s.moneda === 'ARS')!
    expect(ars.meses.map((m) => [m.periodo, m.estado, m.pendiente])).toEqual([
      ['2026-08-01', 'pagado', 0],
      ['2026-09-01', 'pagado', 0],
      ['2026-10-01', 'parcial', 62000], // 72.000 de octubre − 10.000 que sobraron
    ])
    expect(ars.saldo).toBe(62000)
  })

  it('los dólares van aparte y quedan a favor', () => {
    const usd = calcularSaldos(sesiones, pagos).find((s) => s.moneda === 'USD')!
    expect(usd.saldo).toBe(-10)
  })

  it('el ticket del pago grande de septiembre cuenta lo que pasó, en orden', () => {
    const t = ticketDeImputacion(sesiones, [pagos[0]], pagos[1])
    expect(t.pasos.map((p) => [p.periodo, p.aplicado, p.esElegido])).toEqual([
      ['2026-09-01', 120000, true],
      ['2026-08-01', 30000, false],
      ['2026-10-01', 10000, false],
    ])
    expect(t.debiaAntes).toBe(222000) // agosto 30.000 + septiembre 120.000 + octubre 72.000
    expect(t.debeDespues).toBe(62000)
  })
})

// ---- Consultorios al azar ----------------------------------------------------

/** Generador con semilla (mulberry32): mismos números en cada corrida. */
function azar(semilla: number) {
  let a = semilla >>> 0
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const entero = (min: number, max: number) => min + Math.floor(r() * (max - min + 1))
  return { r, entero, elegir: <T,>(xs: T[]) => xs[entero(0, xs.length - 1)] }
}

function consultorio(semilla: number) {
  const z = azar(semilla)
  const meses = z.entero(1, 8)
  const sesiones: (SesionSaldo & { id: string })[] = []
  const pagos: PagoSaldo[] = []
  for (let i = 0; i < meses; i++) {
    const mes = String(i + 1).padStart(2, '0')
    const periodo = `2026-${mes}-01`
    for (const moneda of ['ARS', 'USD'] as Moneda[]) {
      if (moneda === 'USD' && z.r() < 0.7) continue
      const tarifa = moneda === 'ARS' ? z.elegir([18000, 25000, 30000, 33333.33, 36000]) : z.elegir([30, 40, 45.5])
      const n = z.entero(0, 5)
      for (let k = 0; k < n; k++) sesiones.push({ id: `${semilla}-${mes}-${moneda}-${k}`, fecha: `2026-${mes}-${String(1 + k * 6).padStart(2, '0')}`, monto: tarifa, moneda })
      // pagos: nada, justo, de menos, de más, varios chicos, o adelantado a un mes sin sesiones
      const cargo = n * tarifa
      const tipo = z.entero(0, 5)
      const pagar = (monto: number, p = periodo) => monto > 0 && pagos.push({ periodo: p, monto: Math.round(monto * 100) / 100, moneda })
      if (tipo === 1) pagar(cargo)
      if (tipo === 2) pagar(cargo * z.r())
      if (tipo === 3) pagar(cargo + tarifa * z.entero(1, 3))
      if (tipo === 4) for (let k = 0; k < 3; k++) pagar(cargo / 3)
      if (tipo === 5) pagar(tarifa * 2, `2026-${String(meses + 1).padStart(2, '0')}-01`)
    }
  }
  return { sesiones, pagos, z }
}

describe('300 consultorios al azar', () => {
  const casos = Array.from({ length: 300 }, (_, i) => consultorio(i + 1))

  it('las cuentas cierran al centavo en cada moneda', () => {
    for (const { sesiones, pagos } of casos) {
      for (const s of calcularSaldos(sesiones, pagos)) {
        const cargos = sesiones.filter((x) => x.moneda === s.moneda).reduce((t, x) => t + c(x.monto), 0)
        const pagado = pagos.filter((x) => x.moneda === s.moneda).reduce((t, x) => t + c(x.monto), 0)
        expect(c(s.cargos)).toBe(cargos)
        expect(c(s.pagos)).toBe(pagado)
        expect(c(s.saldo)).toBe(cargos - pagado)
        // lo aplicado a los meses más lo que queda a favor es exactamente lo pagado
        const aplicado = s.meses.reduce((t, m) => t + c(m.pagado), 0)
        expect(aplicado + Math.max(0, -c(s.saldo))).toBe(pagado)
        for (const m of s.meses) {
          expect(c(m.pendiente)).toBe(c(m.cargo) - c(m.pagado))
          expect(m.pendiente).toBeGreaterThanOrEqual(0)
        }
        // si queda algo a favor, no puede quedar ningún mes debiendo
        if (s.saldo < 0) expect(s.meses.every((m) => m.pendiente === 0)).toBe(true)
      }
    }
  })

  it('el orden en que se cargan los pagos no cambia el resultado', () => {
    for (const { sesiones, pagos, z } of casos) {
      const mezclados = [...pagos].sort(() => z.r() - 0.5)
      expect(calcularSaldos(sesiones, mezclados)).toEqual(calcularSaldos(sesiones, pagos))
    }
  })

  it('lo pagado de cada sesión suma lo pagado del mes y nunca pasa el valor de la sesión', () => {
    for (const { sesiones, pagos } of casos) {
      const porSesion = pagadoPorSesion(sesiones, pagos)
      for (const s of calcularSaldos(sesiones, pagos)) {
        for (const m of s.meses) {
          const delMes = sesiones.filter((x) => x.moneda === s.moneda && `${x.fecha.slice(0, 7)}-01` === m.periodo)
          for (const x of delMes) expect(c(porSesion.get(x.id) ?? 0)).toBeLessThanOrEqual(c(x.monto))
          expect(delMes.reduce((t, x) => t + c(porSesion.get(x.id) ?? 0), 0)).toBe(c(m.pagado))
        }
      }
    }
  })

  it('el ticket de cada pago explica exactamente el monto pagado', () => {
    for (const { sesiones, pagos } of casos) {
      pagos.forEach((pago, i) => {
        const t = ticketDeImputacion(sesiones, pagos.slice(0, i), pago)
        const aplicado = t.pasos.reduce((s, p) => s + c(p.aplicado), 0)
        expect(aplicado + c(t.aFavor) - c(t.aFavorAntes)).toBe(c(pago.monto))
        const despues = calcularSaldos(sesiones, pagos.slice(0, i + 1)).find((s) => s.moneda === pago.moneda)
        expect(c(t.debeDespues)).toBe(Math.max(0, c(despues?.saldo ?? 0)))
        expect(t.frases.length).toBeGreaterThanOrEqual(2)
      })
    }
  })
})
