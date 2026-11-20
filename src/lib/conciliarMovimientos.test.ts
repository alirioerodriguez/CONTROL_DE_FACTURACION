import { describe, expect, it } from 'vitest'
import { adivinarColumnas, idDePago, movimientosDeHoja, movimientosDeTexto, ordinales, proponer, remitenteDeDetalle } from './conciliarMovimientos'
import type { Hoja } from './importar/leer'
import type { PacienteConciliar } from './conciliar'

// Extractos SINTÉTICOS con el estilo de los bancos y de Mercado Pago (nombres, CUIT y números inventados).
const HOY = '2026-11-20'
const hoja = (encabezados: string[], filas: (string | number | null)[][]): Hoja => ({
  nombre: 'Movimientos',
  encabezados,
  filas: filas.map((celdas, i) => ({ numero: i + 2, celdas })),
})

const PACIENTES: PacienteConciliar[] = [
  { id: 'p1', nombre: 'Juan Carlos', apellido: 'Pérez', dni: '28999888', cuil_cuit: null, moneda: 'ARS', activo: true },
  { id: 'p2', nombre: 'Ana María', apellido: 'Gómez', dni: null, cuil_cuit: null, moneda: 'ARS', activo: true },
  { id: 'p3', nombre: 'Tomás', apellido: 'Soria', dni: '40111222', cuil_cuit: null, moneda: 'ARS', activo: true },
  { id: 'p4', nombre: 'Julia', apellido: 'Ortega', dni: null, cuil_cuit: null, moneda: 'USD', activo: true },
]

describe('columnas', () => {
  it('banco con débito y crédito separados', () => {
    const h = hoja(['Fecha', 'Descripción', 'Débito', 'Crédito', 'Saldo'], [])
    expect(adivinarColumnas(h)).toEqual({ fecha: 0, detalle: 1, debito: 2, monto: 3, moneda: -1, referencia: -1 })
  })
  it('Mercado Pago con importe con signo y número de operación', () => {
    const h = hoja(['Fecha de liberación', 'Número de operación', 'Descripción', 'Importe neto'], [])
    const c = adivinarColumnas(h)
    expect([c.fecha, c.referencia, c.detalle, c.monto, c.debito]).toEqual([0, 1, 2, 3, -1])
  })
  it('importe sin la palabra neto también es el monto', () => {
    const c = adivinarColumnas(hoja(['Fecha', 'Concepto', 'Importe', 'Moneda'], []))
    expect([c.fecha, c.detalle, c.monto, c.moneda]).toEqual([0, 1, 2, 3])
  })
})

describe('quién pagó, desde el detalle del extracto', () => {
  it.each([
    ['TRANSF. RECIBIDA - PEREZ JUAN CARLOS - CUIL 20-28999888-1', 'PEREZ JUAN CARLOS'],
    ['TRF INMED. PROVEED. GOMEZ ANA MARIA', 'GOMEZ ANA MARIA'],
    ['Cred. transf. CVU 0000003100012345678901 Lopez Marta', 'Lopez Marta'],
    ['Dinero recibido de Carlos Ruiz', 'Carlos Ruiz'],
    ['Transferencia recibida', null],
    ['DEP. EFECTIVO', null],
  ])('%s → %s', (detalle, esperado) => {
    expect(remitenteDeDetalle(detalle)).toBe(esperado)
  })
})

describe('movimientos de una hoja', () => {
  const extracto = hoja(
    ['Fecha', 'Descripción', 'Débito', 'Crédito', 'Saldo'],
    [
      ['03/11/2026', 'TRANSF. RECIBIDA - PEREZ JUAN CARLOS - CUIL 20-28999888-1', null, '45.000,00', '545.000,00'],
      ['04/11/2026', 'PAGO TARJETA VISA', '120.000,00', null, '425.000,00'],
      ['05/11/2026', 'TRF INMED. PROVEED. GOMEZ ANA MARIA', '', '30.000,00', '455.000,00'],
      ['06/11/2026', 'COMISION MANTENIMIENTO', '1.500,00', '', '453.500,00'],
      ['', 'SALDO ANTERIOR', '', '', '500.000,00'],
    ],
  )
  it('toma solo los ingresos con fecha y deja de lado el resto', () => {
    const { movimientos, ignorados } = movimientosDeHoja(extracto, adivinarColumnas(extracto), HOY)
    expect(ignorados).toBe(3)
    expect(movimientos.map((m) => [m.datos.fecha, m.datos.monto, m.datos.remitente, m.datos.documento])).toEqual([
      ['2026-11-03', 45000, 'PEREZ JUAN CARLOS', '20289998881'],
      ['2026-11-05', 30000, 'GOMEZ ANA MARIA', null],
    ])
  })
  it('importe con signo: los negativos son egresos', () => {
    const mp = hoja(
      ['Fecha de liberación', 'Número de operación', 'Descripción', 'Importe neto'],
      [
        ['2026-11-02', '99887766554', 'Dinero recibido de Carlos Ruiz', 18500.5],
        ['2026-11-02', '99887766555', 'Pago a Supermercado', -8000],
      ],
    )
    const { movimientos } = movimientosDeHoja(mp, adivinarColumnas(mp), HOY)
    expect(movimientos).toHaveLength(1)
    expect(movimientos[0].datos).toMatchObject({ monto: 18500.5, remitente: 'Carlos Ruiz', referencia: '99887766554', moneda: 'ARS' })
  })
  it('lee la moneda si hay columna', () => {
    const h = hoja(['Fecha', 'Concepto', 'Importe', 'Moneda'], [['01/11/2026', 'Transferencia de Julia Ortega', '45,00', 'USD']])
    expect(movimientosDeHoja(h, adivinarColumnas(h), HOY).movimientos[0].datos.moneda).toBe('USD')
  })
})

describe('varios comprobantes pegados juntos', () => {
  it('separa por línea en blanco y descarta los que no tienen monto', () => {
    const t = 'Recibiste $ 30.000 de Ana María Gómez\n5 de noviembre de 2026\n\nhola, ya te pagué!\n\nTransferencia recibida\nImporte: $ 45.000,00\nOrdenante: PEREZ JUAN CARLOS\nFecha: 2026-11-03'
    const movs = movimientosDeTexto(t, HOY)
    expect(movs.map((m) => [m.datos.monto, m.datos.remitente])).toEqual([
      [30000, 'Ana María Gómez'],
      [45000, 'PEREZ JUAN CARLOS'],
    ])
  })
})

describe('propuesta', () => {
  it('propone por documento y por nombre; si no alcanza, deja sin elegir', () => {
    const h = hoja(
      ['Fecha', 'Descripción', 'Crédito'],
      [
        ['03/11/2026', 'TRANSF. RECIBIDA - FERNANDEZ LUCIA - CUIL 27-40111222-3', '25.000,00'], // DNI de Tomás: pagó la mamá
        ['05/11/2026', 'TRF INMED. PROVEED. GOMEZ ANA MARIA', '30.000,00'],
        ['06/11/2026', 'TRANSFERENCIA RECIBIDA', '10.000,00'],
      ],
    )
    const props = proponer(movimientosDeHoja(h, adivinarColumnas(h), HOY).movimientos, PACIENTES)
    expect(props.map((p) => p.elegido)).toEqual(['p3', 'p2', null])
  })
  it('avisa si el pago ya está cargado', () => {
    const h = hoja(['Fecha', 'Descripción', 'Crédito'], [['05/11/2026', 'TRF INMED. PROVEED. GOMEZ ANA MARIA', '30.000,00']])
    const pagos = [{ patient_id: 'p2', monto: 30000, moneda: 'ARS' as const, fecha: '2026-11-05', observaciones: null }]
    expect(proponer(movimientosDeHoja(h, adivinarColumnas(h), HOY).movimientos, PACIENTES, { pagos })[0].yaCargado).toBe(true)
  })
})

describe('id estable del pago', () => {
  const h = hoja(
    ['Fecha', 'Descripción', 'Crédito'],
    [
      ['05/11/2026', 'TRF GOMEZ ANA MARIA', '30.000,00'],
      ['05/11/2026', 'TRF GOMEZ ANA MARIA', '30.000,00'], // dos transferencias iguales el mismo día: son dos pagos
    ],
  )
  const movs = movimientosDeHoja(h, adivinarColumnas(h), HOY).movimientos
  it('es el mismo si se vuelve a subir el extracto, distinto entre movimientos idénticos y entre profesionales', async () => {
    const ord = ordinales(movs)
    expect(ord).toEqual([0, 1])
    const a1 = await idDePago('usuaria-1', movs[0], ord[0])
    expect(await idDePago('usuaria-1', movs[0], ord[0])).toBe(a1)
    expect(await idDePago('usuaria-1', movs[1], ord[1])).not.toBe(a1)
    expect(await idDePago('usuaria-2', movs[0], ord[0])).not.toBe(a1)
    expect(a1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})
