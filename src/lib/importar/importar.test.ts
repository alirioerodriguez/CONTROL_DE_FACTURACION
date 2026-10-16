import { readFileSync } from 'node:fs'
import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import type { Paciente, Pago, Sesion } from '../datos'
import { armarHoja, leerCsv, leerXlsx, normalizarCelda } from './leer'
import {
  camposFaltantes, esPlantilla, mapeoAutomatico, parseMedio, parseMoneda, parseSiNo, prepararGenerico,
  prepararPlantilla, type Contexto,
} from './preparar'

const ctxVacio: Contexto = { pacientes: [], sesiones: [], pagos: [], monedaDefecto: 'ARS', tarifaEstandar: 50000 }

const lucia = { id: 'pac-lucia', nombre: 'Lucía Fernández', apellido: null, codigo: 'P001' } as Paciente

async function bufferDe(armar: (wb: ExcelJS.Workbook) => void): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook()
  armar(wb)
  const buf = await wb.xlsx.writeBuffer()
  return buf as ArrayBuffer
}

describe('lectura', () => {
  it('normaliza celdas de exceljs', () => {
    expect(normalizarCelda({ formula: 'A1*2', result: 10 })).toBe(10)
    expect(normalizarCelda({ formula: 'IF(B3="","",B3)' })).toBeNull() // fórmula sin resultado = vacía
    expect(normalizarCelda({ richText: [{ text: 'Hola ' }, { text: 'mundo' }] })).toBe('Hola mundo')
    expect(normalizarCelda('  ')).toBeNull()
  })

  it('toma la primera fila con contenido como encabezado y descarta filas vacías', () => {
    const h = armarHoja('X', [[], ['Paciente', 'Fecha'], ['Ana', '01/10/2026'], [null, null], ['Juan', '02/10/2026']])
    expect(h.encabezados).toEqual(['Paciente', 'Fecha'])
    expect(h.filas.map((f) => f.numero)).toEqual([3, 5])
  })

  it('lee CSV con punto y coma y montos argentinos', async () => {
    const [h] = await leerCsv('﻿Paciente;Fecha;Monto\nAna López;05/10/2026;"25.000,50"\n')
    expect(h.encabezados).toEqual(['Paciente', 'Fecha', 'Monto'])
    expect(h.filas[0].celdas).toEqual(['Ana López', '05/10/2026', '25.000,50'])
  })

  it('lee CSV con coma', async () => {
    const [h] = await leerCsv('Paciente,Fecha,Monto\nAna,05/10/2026,25000\n')
    expect(h.filas[0].celdas).toEqual(['Ana', '05/10/2026', '25000'])
  })

  it('lee xlsx con fechas reales y fórmulas', async () => {
    const buf = await bufferDe((wb) => {
      const ws = wb.addWorksheet('Hoja1')
      ws.addRow(['Paciente', 'Fecha', 'Monto'])
      ws.addRow(['Ana', new Date(Date.UTC(2026, 9, 5)), 25000])
      ws.addRow(['Juan', new Date(Date.UTC(2026, 9, 6)), { formula: '20000+5000', result: 25000 }])
    })
    const [h] = await leerXlsx(buf)
    expect(h.filas).toHaveLength(2)
    expect(h.filas[1].celdas[2]).toBe(25000)
  })
})

describe('valores', () => {
  it('moneda, sí/no y medio', () => {
    expect(parseMoneda('US$', 'ARS')).toBe('USD')
    expect(parseMoneda('pesos', 'USD')).toBe('ARS')
    expect(parseMoneda(null, 'USD')).toBe('USD')
    expect(parseMoneda('EUR', 'ARS')).toBe('invalida')
    expect(parseSiNo('Sí')).toBe(true)
    expect(parseSiNo('no')).toBe(false)
    expect(parseSiNo(null)).toBeNull()
    expect(parseMedio('MercadoPago')).toBe('mercadopago')
    expect(parseMedio('Efectivo')).toBe('efectivo')
    expect(parseMedio('Cheque')).toBe('otro')
  })
})

describe('planilla genérica', () => {
  const hoja = armarHoja('Hoja1', [
    ['Paciente', 'Fecha', 'Honorario', 'Moneda', 'Pagó', 'Notas'],
    ['Lucía Fernández', '05/10/2026', '28.000', 'ARS', 'Sí', ''],
    ['Rocío Herrera', '06/10/2026', '30000', 'ARS', 'No', 'Primera entrevista'],
    ['Sofía Ruiz', '07/10/2026', '50', 'USD', 'Sí', ''],
    ['Diego Luna', '08/10/2026', '25000', '', 'Sí', ''],
    ['Martín Gómez', '31/02/2026', '25000', 'ARS', 'No', ''],
    ['Martín Gómez', '09/10/2026', '', 'ARS', 'No', ''],
    ['Martín Gómez', '10/10/2026', '25000', 'EUR', 'No', ''],
    ['Rocío Herrera', '06/10/2026', '30.000,00', 'ARS', 'No', 'repetida en el archivo'],
  ])

  it('reconoce las columnas por su nombre', () => {
    const m = mapeoAutomatico(hoja.encabezados)
    expect(m).toEqual({ paciente: 0, fecha: 1, monto: 2, moneda: 3, pago: 4, notas: 5 })
    expect(camposFaltantes(m)).toEqual([])
    expect(camposFaltantes({ ...m, fecha: null })).toEqual(['Fecha'])
  })

  it('valida, detecta duplicados y propone pacientes nuevos', () => {
    const sesionExistente = { patient_id: 'pac-lucia', fecha: '2026-10-05', monto: 28000, moneda: 'ARS' } as Sesion
    const r = prepararGenerico(hoja, mapeoAutomatico(hoja.encabezados), {
      ...ctxVacio,
      pacientes: [lucia],
      sesiones: [sesionExistente],
    })
    expect(r.errores.map((e) => [e.fila, e.mensaje])).toEqual([
      [6, 'Fecha inválida: “31/02/2026”'],
      [7, 'Monto vacío'],
      [8, 'Moneda “EUR” no soportada'],
    ])
    expect(r.duplicadas).toBe(2) // Lucía ya estaba cargada; Rocío repetida en el archivo
    expect(r.pacientes.map((p) => p.nombre)).toEqual(['Rocío Herrera', 'Sofía Ruiz', 'Diego Luna'])
    expect(r.pacientes[1]).toMatchObject({ tipo_tarifa: 'personalizada', tarifa_personalizada: 50, moneda: 'USD' })
    expect(r.sesiones).toHaveLength(3)
    expect(r.sesiones.find((s) => s.fecha === '2026-10-07')).toMatchObject({ moneda: 'USD', tarifa_hora: 50 })
    expect(r.sesiones.find((s) => s.fecha === '2026-10-08')?.moneda).toBe('ARS') // sin moneda: la de Ajustes
    expect(r.pagos).toHaveLength(2) // Sofía y Diego pagaron
    expect(r.pagos.every((p) => p.sesion_ref)).toBe(true)
  })
})

describe('plantilla de la app', () => {
  async function plantilla() {
    const buf = await bufferDe((wb) => {
      const p = wb.addWorksheet('Pacientes')
      p.addRow(['ID paciente', 'Nombre', 'Apellido', 'DNI', 'CUIL / CUIT', 'Condición IVA', 'Teléfono', 'Email', 'Domicilio', 'Modalidad', 'Honorario', 'Moneda', 'Frecuencia', 'Fecha de alta', 'Activo', 'Notas administrativas', 'Nombre completo'])
      p.addRow(['P000', 'María', 'Ejemplo', '', '', '', '', '', '', '', 25000, 'ARS', '', '', 'Sí', 'FILA DE EJEMPLO – borrar'])
      p.addRow(['P001', 'Lucía', 'Fernández', '', '', '', '', '', '', '', 28000, 'ARS', 'Semanal', new Date(Date.UTC(2026, 2, 1)), 'Sí', ''])
      p.addRow(['P002', 'Sofía', 'Ruiz', '30111222', '', 'Consumidor final', '+34 612 44 81 90', '', '', '', 50, 'USD', 'Quincenal', '', 'Sí', ''])
      p.addRow(['P003', 'Ana', 'Estándar', '', '', '', '', '', '', '', 50000, 'ARS', '', '', 'No', ''])
      p.addRow([null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, { formula: 'TRIM(B6&" "&C6)' }])
      const s = wb.addWorksheet('Sesiones')
      s.addRow(['ID sesión', 'Fecha', 'ID paciente', 'Paciente', 'Mes', 'Monto', 'Moneda', 'Estado', 'Observaciones'])
      s.addRow(['S0001', new Date(Date.UTC(2026, 9, 5)), 'P001', 'Lucía Fernández', null, 28000, 'ARS', 'Pagada', ''])
      s.addRow(['S0002', new Date(Date.UTC(2026, 9, 7)), 'P002', 'Sofía Ruiz', null, 50, 'USD', 'Pendiente', ''])
      s.addRow(['S0003', new Date(Date.UTC(2026, 9, 8)), 'P009', '', null, 25000, 'ARS', '', ''])
      s.addRow([null, null, null, { formula: 'IF(C5="","",C5)' }, { formula: 'IF(B5="","",B5)' }])
      const g = wb.addWorksheet('Pagos')
      g.addRow(['ID pago', 'Fecha de pago', 'Mes imputado', 'ID paciente', 'Paciente', 'DNI', 'CUIL / CUIT', 'Monto', 'Moneda', 'Medio de pago', 'Comprobante', 'Punto de venta', 'Nº de factura', 'ID sesión (opcional)', 'Observaciones'])
      g.addRow(['G0001', new Date(Date.UTC(2026, 10, 2)), new Date(Date.UTC(2026, 9, 1)), 'P001', '', '', '', 28000, 'ARS', 'Transferencia', 'Factura C', '00002', '00000045', 'S0001', ''])
      g.addRow([null, null, { formula: 'IF(B3="","",DATE(YEAR(B3),MONTH(B3),1))' }, null, { formula: 'x' }])
    })
    return leerXlsx(buf)
  }

  it('reconoce la estructura de la plantilla', async () => {
    const hojas = await plantilla()
    expect(esPlantilla(hojas)).toBe(true)
    expect(esPlantilla([armarHoja('Hoja1', [['Paciente', 'Fecha', 'Monto']])])).toBe(false)
  })

  it('importa pacientes, sesiones y pagos enlazados, saltea la fila de ejemplo y las filas solo con fórmulas', async () => {
    const r = prepararPlantilla(await plantilla(), ctxVacio)
    expect(r.pacientes.map((p) => [p.codigo, p.nombre, p.apellido])).toEqual([
      ['P001', 'Lucía', 'Fernández'],
      ['P002', 'Sofía', 'Ruiz'],
      ['P003', 'Ana', 'Estándar'],
    ])
    expect(r.pacientes[0]).toMatchObject({ tipo_tarifa: 'personalizada', tarifa_personalizada: 28000, fecha_alta: '2026-03-01' })
    expect(r.pacientes[1]).toMatchObject({ moneda: 'USD', tarifa_personalizada: 50, telefono: '+34 612 44 81 90' })
    expect(r.pacientes[2]).toMatchObject({ tipo_tarifa: 'estandar', activo: false }) // mismo honorario que la estándar
    expect(r.sesiones).toHaveLength(2)
    expect(r.errores).toEqual([{ hoja: 'Sesiones', fila: 4, mensaje: 'El paciente “P009” no está en la hoja Pacientes' }])
    expect(r.pagos).toHaveLength(1)
    expect(r.pagos[0]).toMatchObject({
      paciente_ref: 'p:p001',
      sesion_ref: 's:s0001',
      fecha: '2026-11-02',
      periodo: '2026-10-01', // respeta el mes imputado
      medio: 'transferencia',
      comprobante: 'factura_c',
      punto_venta: '00002',
      nro_factura: '00000045',
    })
  })

  it('usa los pacientes que ya existen (por ID o por nombre) y no repite pagos', async () => {
    const pagoExistente = { patient_id: 'pac-lucia', fecha: '2026-11-02', monto: 28000, moneda: 'ARS' } as Pago
    const r = prepararPlantilla(await plantilla(), { ...ctxVacio, pacientes: [lucia], pagos: [pagoExistente] })
    expect(r.pacientesExistentes).toBe(1)
    expect(r.pacientes.map((p) => p.codigo)).toEqual(['P002', 'P003'])
    expect(r.sesiones[0]).toMatchObject({ patient_id: 'pac-lucia' })
    expect(r.pagos).toHaveLength(0)
    expect(r.duplicadas).toBe(1)
  })

  it('la plantilla vacía del proyecto no importa nada ni da errores', async () => {
    const archivo = readFileSync(new URL('../../../public/plantilla-cobros.xlsx', import.meta.url))
    const buf = archivo.buffer.slice(archivo.byteOffset, archivo.byteOffset + archivo.byteLength)
    const hojas = await leerXlsx(buf as ArrayBuffer)
    expect(esPlantilla(hojas)).toBe(true)
    const r = prepararPlantilla(hojas, ctxVacio)
    expect(r).toMatchObject({ pacientes: [], sesiones: [], pagos: [], errores: [], duplicadas: 0 })
  })
})
