// Pruebas de estrés de fechas, abonos y tarifas: años bisiestos, meses con 5 ocurrencias de un día fijo, cambios de
// tarifa a mitad de mes y el cambio de día en Argentina (UTC-3). Sirven para que la generación automática de sesiones y
// el cálculo de deudas no se rompan sin que nadie lo note cuando se toque el código de fechas o de saldos.
//
// El resultado de `fechasDelMes` se compara contra un cálculo INDEPENDIENTE (algoritmo de Sakamoto para el día de la
// semana y la regla gregoriana de los bisiestos), no contra el mismo código.
import { describe, expect, it } from 'vitest'
import { aplicarAbono } from './abono'
import { aplicarAumento } from './aumento'
import type { Paciente, Sesion } from './datos'
import { hoyAR, periodoDe, sumarDias, sumarMeses } from './formato'
import { calcularSaldos, fechasDelMes, pagadoPorSesion } from './saldos'

// ---- Cálculo de referencia -------------------------------------------------

const esBisiesto = (a: number) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0
const diasEnMes = (a: number, m: number) => [31, esBisiesto(a) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
/** Sakamoto: 0 = domingo … 6 = sábado. */
function diaSemana(a: number, m: number, d: number): number {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4]
  const y = m < 3 ? a - 1 : a
  return (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + t[m - 1] + d) % 7
}
const periodo = (a: number, m: number) => `${a}-${String(m).padStart(2, '0')}-01`
const fecha = (a: number, m: number, d: number) => `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const esperadas = (a: number, m: number, dias: number[]) =>
  Array.from({ length: diasEnMes(a, m) }, (_, i) => i + 1).filter((d) => dias.includes(diaSemana(a, m, d))).map((d) => fecha(a, m, d))

describe('referencia independiente', () => {
  it('conoce los bisiestos y los días de la semana', () => {
    expect([1900, 2000, 2024, 2026, 2100].map(esBisiesto)).toEqual([false, true, true, false, false])
    expect(diaSemana(2026, 3, 2)).toBe(1) // lunes 2 de marzo de 2026
    expect(diaSemana(2024, 2, 29)).toBe(4) // jueves 29 de febrero de 2024
    expect(diaSemana(2000, 1, 1)).toBe(6) // sábado
    // Fechas conocidas en los 12 meses, para no depender de un solo dato:
    expect(diaSemana(2020, 8, 1)).toBe(6) // sábado
    expect(diaSemana(2026, 12, 25)).toBe(5) // viernes
    expect(diaSemana(2023, 10, 31)).toBe(2) // martes
    expect(diaSemana(2025, 7, 9)).toBe(3) // miércoles (Día de la Independencia)
    expect(diaSemana(2026, 5, 25)).toBe(1) // lunes
    expect(diaSemana(2022, 11, 20)).toBe(0) // domingo (final del Mundial)
    expect(diaSemana(1999, 9, 9)).toBe(4) // jueves
  })
})

// ---- Sesiones del mes -------------------------------------------------------

describe('fechasDelMes', () => {
  it('coincide con el cálculo de referencia en todos los meses de 2020 a 2035 y para cada día de la semana', () => {
    for (let a = 2020; a <= 2035; a++) {
      for (let m = 1; m <= 12; m++) {
        for (let dia = 0; dia <= 6; dia++) {
          expect(fechasDelMes(periodo(a, m), [dia]), `${a}-${m} día ${dia}`).toEqual(esperadas(a, m, [dia]))
        }
      }
    }
  })

  it('los 7 días de la semana juntos dan todos los días del mes, sin repetir y en orden', () => {
    for (let a = 2020; a <= 2035; a++) {
      for (let m = 1; m <= 12; m++) {
        const todas = fechasDelMes(periodo(a, m), [0, 1, 2, 3, 4, 5, 6])
        expect(todas).toHaveLength(diasEnMes(a, m))
        expect(new Set(todas).size).toBe(todas.length)
        expect([...todas].sort()).toEqual(todas)
        expect(todas.every((f) => f.startsWith(`${a}-${String(m).padStart(2, '0')}-`))).toBe(true)
      }
    }
  })

  it('febrero de los años bisiestos tiene 29 días, también en los casos raros de 1900, 2000 y 2100', () => {
    const febrero = (a: number) => fechasDelMes(periodo(a, 2), [0, 1, 2, 3, 4, 5, 6]).length
    expect([2023, 2024, 2025, 2028].map(febrero)).toEqual([28, 29, 28, 29])
    expect([1900, 2000, 2100, 2400].map(febrero)).toEqual([28, 29, 28, 29])
  })

  it('el 29 de febrero se genera solo si el año es bisiesto', () => {
    expect(fechasDelMes('2024-02-01', [4])).toEqual(['2024-02-01', '2024-02-08', '2024-02-15', '2024-02-22', '2024-02-29'])
    expect(fechasDelMes('2025-02-01', [4])).toEqual(['2025-02-06', '2025-02-13', '2025-02-20', '2025-02-27'])
  })

  it('meses con 5 ocurrencias: quién es el día que se repite', () => {
    // Un mes de 31 días repite 3 días de la semana (los que caen en el 1, el 2 y el 3). Marzo de 2026 empieza en domingo.
    const cuenta = (p: string, d: number) => fechasDelMes(p, [d]).length
    expect([0, 1, 2, 3, 4, 5, 6].map((d) => cuenta('2026-03-01', d))).toEqual([5, 5, 5, 4, 4, 4, 4])
    // Un mes de 30 días repite 2; uno de 28 días no repite ninguno.
    expect([0, 1, 2, 3, 4, 5, 6].map((d) => cuenta('2026-04-01', d)).filter((n) => n === 5)).toHaveLength(2)
    expect([0, 1, 2, 3, 4, 5, 6].map((d) => cuenta('2026-02-01', d))).toEqual([4, 4, 4, 4, 4, 4, 4])
    // Un febrero bisiesto repite uno solo.
    expect([0, 1, 2, 3, 4, 5, 6].map((d) => cuenta('2024-02-01', d)).filter((n) => n === 5)).toHaveLength(1)
  })

  it('varios días por semana, el 31 y el 1 de los bordes del año', () => {
    expect(fechasDelMes('2025-12-01', [3])).toContain('2025-12-31') // miércoles 31
    expect(fechasDelMes('2026-01-01', [4])[0]).toBe('2026-01-01') // jueves 1
    expect(fechasDelMes('2026-03-01', [1, 3, 5])).toEqual(esperadas(2026, 3, [1, 3, 5]))
  })

  it('sin días no hay sesiones, y los números fuera de 0 a 6 no generan nada', () => {
    expect(fechasDelMes('2026-03-01', [])).toEqual([])
    expect(fechasDelMes('2026-03-01', [7, -1, 99])).toEqual([])
  })
})

// ---- Fecha de hoy en Argentina (UTC-3) ---------------------------------------

describe('hoyAR y el cambio de día', () => {
  it('a las 03:00 UTC cambia el día en Argentina, no antes', () => {
    expect(hoyAR(new Date('2026-03-01T02:59:59Z'))).toBe('2026-02-28')
    expect(hoyAR(new Date('2026-03-01T03:00:00Z'))).toBe('2026-03-01')
  })

  it('el 29 de febrero de un año bisiesto y el cambio de año', () => {
    expect(hoyAR(new Date('2024-03-01T02:59:59Z'))).toBe('2024-02-29')
    expect(hoyAR(new Date('2024-03-01T03:00:00Z'))).toBe('2024-03-01')
    expect(hoyAR(new Date('2026-01-01T02:59:59Z'))).toBe('2025-12-31')
    expect(hoyAR(new Date('2026-01-01T03:00:00Z'))).toBe('2026-01-01')
  })

  it('una sesión de las 23:30 del último día del mes sigue en ese mes', () => {
    const hoy = hoyAR(new Date('2026-04-01T02:30:00Z')) // 23:30 del 31 de marzo en Argentina
    expect(hoy).toBe('2026-03-31')
    expect(periodoDe(hoy)).toBe('2026-03-01')
  })
})

describe('sumarDias y sumarMeses', () => {
  it('cruzan febrero bisiesto y fin de año', () => {
    expect(sumarDias('2024-02-28', 1)).toBe('2024-02-29')
    expect(sumarDias('2024-02-28', 2)).toBe('2024-03-01')
    expect(sumarDias('2023-02-28', 1)).toBe('2023-03-01')
    expect(sumarDias('2025-12-31', 1)).toBe('2026-01-01')
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28')
    expect(sumarDias('2024-03-01', -1)).toBe('2024-02-29')
    expect(sumarDias('2026-03-15', 366)).toBe('2027-03-16')
  })

  it('sumar o restar meses cruza años', () => {
    expect(sumarMeses('2025-11-01', 3)).toBe('2026-02-01')
    expect(sumarMeses('2026-01-01', -1)).toBe('2025-12-01')
    expect(sumarMeses('2026-03-01', 24)).toBe('2028-03-01')
    expect(sumarMeses('2026-03-01', -15)).toBe('2024-12-01')
    expect(sumarMeses('2026-03-01', 0)).toBe('2026-03-01')
  })
})

// ---- Cambio de tarifa a mitad de mes --------------------------------------------

const sesion = (id: string, f: string, monto: number, moneda: 'ARS' | 'USD' = 'ARS') => ({ id, fecha: f, monto, moneda })

describe('cambio de tarifa a mitad de mes', () => {
  // Los lunes de marzo de 2026 son 2, 9, 16, 23 y 30 (5 ocurrencias). La tarifa sube el día 15: las primeras 2 sesiones
  // conservan $ 25.000 y las otras 3 se cargan a $ 30.000 (CLAUDE.md: «las sesiones ya cargadas conservan su precio»).
  const lunes = fechasDelMes('2026-03-01', [1])
  const sesiones = lunes.map((f, i) => sesion(`s${i}`, f, f < '2026-03-15' ? 25000 : 30000))

  it('hay 5 lunes y el cargo del mes suma cada sesión a su precio', () => {
    expect(lunes).toHaveLength(5)
    const [saldo] = calcularSaldos(sesiones, [])
    expect(saldo.meses).toHaveLength(1)
    expect(saldo.meses[0]).toMatchObject({ periodo: '2026-03-01', cargo: 140000, pendiente: 140000, sesiones: 5, estado: 'pendiente' })
  })

  it('un pago parcial se reparte por fecha: las primeras sesiones quedan cubiertas, la cuarta parcial y la última sin pagar', () => {
    const pagos = [{ periodo: '2026-03-01', monto: 100000, moneda: 'ARS' as const }]
    const [saldo] = calcularSaldos(sesiones, pagos)
    expect(saldo.meses[0]).toMatchObject({ pagado: 100000, pendiente: 40000, estado: 'parcial' })
    const porSesion = pagadoPorSesion(sesiones, pagos)
    expect(sesiones.map((s) => porSesion.get(s.id))).toEqual([25000, 25000, 30000, 20000, 0])
  })

  it('el pago exacto de las 5 sesiones deja el mes pagado y sin saldo', () => {
    const [saldo] = calcularSaldos(sesiones, [{ periodo: '2026-03-01', monto: 140000, moneda: 'ARS' }])
    expect(saldo.meses[0].estado).toBe('pagado')
    expect(saldo.saldo).toBe(0)
  })

  it('el aumento del mes siguiente no cambia lo que se debe del anterior', () => {
    const abril = fechasDelMes('2026-04-01', [1]).map((f, i) => sesion(`a${i}`, f, 35000))
    const [saldo] = calcularSaldos([...sesiones, ...abril], [{ periodo: '2026-03-01', monto: 140000, moneda: 'ARS' }])
    expect(saldo.meses.map((m) => [m.periodo, m.cargo, m.estado])).toEqual([
      ['2026-03-01', 140000, 'pagado'],
      ['2026-04-01', 35000 * abril.length, 'pendiente'],
    ])
  })

  it('un pago de más pasa al mes impago más viejo y el resto queda a favor, al centavo', () => {
    const [saldo] = calcularSaldos(
      [sesion('a', '2026-01-05', 33333.33), sesion('b', '2026-02-05', 33333.33), sesion('c', '2026-03-05', 33333.33)],
      [{ periodo: '2026-03-01', monto: 100000, moneda: 'ARS' }],
    )
    expect(saldo.cargos).toBe(99999.99)
    expect(saldo.saldo).toBe(-0.01) // 1 centavo a favor, sin errores de coma flotante
    expect(saldo.meses.map((m) => m.estado)).toEqual(['pagado', 'pagado', 'pagado'])
  })

  it('ARS y USD de las mismas fechas no se mezclan', () => {
    const saldos = calcularSaldos([sesion('a', '2026-03-02', 25000), sesion('b', '2026-03-09', 40, 'USD')], [{ periodo: '2026-03-01', monto: 25000, moneda: 'ARS' }])
    expect(saldos.find((s) => s.moneda === 'ARS')!.saldo).toBe(0)
    expect(saldos.find((s) => s.moneda === 'USD')!.saldo).toBe(40)
  })

  it('montos con decimales binarios (0,1 + 0,2) suman exacto', () => {
    const [saldo] = calcularSaldos([sesion('a', '2026-03-02', 0.1), sesion('b', '2026-03-09', 0.2)], [])
    expect(saldo.cargos).toBe(0.3)
  })
})

// ---- Abono mensual ---------------------------------------------------------------

const paciente = (abono: number) => ({ id: 'p', moneda: 'ARS', abono_mensual: abono }) as Paciente
const sesionAbono = (i: number, f: string, estado: Sesion['estado'] = 'normal') =>
  ({ id: `s${i}`, patient_id: 'p', fecha: f, horas: 1, tarifa_hora: 30000, monto: 30000, moneda: 'ARS', estado }) as Sesion

describe('abono mensual con meses de 4 y de 5 sesiones', () => {
  const cargoDeMarzo = (sesiones: Sesion[], abono: number) => {
    const r = aplicarAbono(sesiones, [paciente(abono)])
    return Math.round(r.filter((s) => s.fecha.startsWith('2026-03')).reduce((t, s) => t + s.monto * 100, 0))
  }

  it('el total del mes es siempre el abono, tenga 4 o 5 lunes', () => {
    for (const abono of [100000, 99999.99, 33333.33, 0.01, 123456.78]) {
      for (const f of [['2026-02-02', '2026-02-09', '2026-02-16', '2026-02-23'], fechasDelMes('2026-03-01', [1])]) {
        const sesiones = f.map((x, i) => sesionAbono(i, x))
        const r = aplicarAbono(sesiones, [paciente(abono)])
        expect(Math.round(r.reduce((t, s) => t + s.monto * 100, 0)), `abono ${abono} con ${f.length} sesiones`).toBe(Math.round(abono * 100))
      }
    }
  })

  it('para cualquier cantidad de sesiones de 1 a 31, el reparto suma exacto y ninguna parte es negativa', () => {
    for (let n = 1; n <= 31; n++) {
      const sesiones = Array.from({ length: n }, (_, i) => sesionAbono(i, fecha(2026, 3, i + 1)))
      expect(cargoDeMarzo(sesiones, 100000), `${n} sesiones`).toBe(10_000_000)
      expect(aplicarAbono(sesiones, [paciente(100000)]).every((s) => s.monto >= 0)).toBe(true)
    }
  })

  it('las canceladas no cuentan para repartir y un mes sin sesiones no genera deuda', () => {
    const sesiones = [sesionAbono(1, '2026-03-02'), sesionAbono(2, '2026-03-09', 'cancelada'), sesionAbono(3, '2026-03-16')]
    const r = aplicarAbono(sesiones, [paciente(100000)])
    expect([r[0].monto, r[2].monto]).toEqual([50000, 50000])
    expect(r[1].monto).toBe(30000) // la cancelada no se toca
    expect(aplicarAbono([], [paciente(100000)])).toEqual([])
  })
})

// ---- Aumentos --------------------------------------------------------------------

describe('aplicarAumento: redondeos', () => {
  it('el porcentaje no se pasa de rosca por coma flotante: 20.000 + 15 % = 23.000 y no 23.500', () => {
    expect(aplicarAumento(20000, 'ARS', { tipo: 'porcentaje', valor: 15, redondeo: 500 })).toBe(23000)
    expect(aplicarAumento(25000, 'ARS', { tipo: 'porcentaje', valor: 10, redondeo: 500 })).toBe(27500)
    expect(aplicarAumento(25000, 'ARS', { tipo: 'porcentaje', valor: 10, redondeo: 1000 })).toBe(28000)
  })

  it('sin redondeo queda al centavo, y en dólares siempre sube al entero siguiente', () => {
    expect(aplicarAumento(33333.33, 'ARS', { tipo: 'porcentaje', valor: 7, redondeo: 0 })).toBe(35666.66)
    expect(aplicarAumento(50, 'USD', { tipo: 'porcentaje', valor: 5, redondeo: 0 })).toBe(53)
    expect(aplicarAumento(50, 'USD', { tipo: 'monto', valor: 5000, redondeo: 0 })).toBe(50) // un monto en pesos no se aplica a dólares
  })

  it('valores en cero o negativos no cambian nada', () => {
    expect(aplicarAumento(0, 'ARS', { tipo: 'porcentaje', valor: 10, redondeo: 0 })).toBe(0)
    expect(aplicarAumento(25000, 'ARS', { tipo: 'porcentaje', valor: 0, redondeo: 0 })).toBe(25000)
    expect(aplicarAumento(25000, 'ARS', { tipo: 'porcentaje', valor: -5, redondeo: 0 })).toBe(25000)
  })
})
