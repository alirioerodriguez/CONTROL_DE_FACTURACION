import { describe, expect, it } from 'vitest'
import type { Paciente, Pago, Perfil, Sesion } from './datos'
import { celdaSegura, libroBackup, pdfContadora, soloIniciales, textoParcial } from './exportar'
import { leerXlsx } from './importar/leer'
import { esPlantilla, prepararPlantilla } from './importar/preparar'

const perfil = { id: 'u', nombre: 'Ana', email: 'ana@x.com', tarifa_estandar: 50000, moneda_default: 'ARS', plantilla_whatsapp: '' } as Perfil

const base = {
  apellido: null, dni: null, cuil_cuit: null, condicion_iva: null, telefono: null, email: null, domicilio: null,
  frecuencia: 'Semanal', dias_semana: [1], horas_por_sesion: 1, fecha_alta: '2026-03-01', activo: true, notas_admin: null, abono_mensual: null, obra_social: null, nro_afiliado: null,
}
const pacientes: Paciente[] = [
  { ...base, id: 'a', codigo: null, nombre: 'Lucía Fernández', tipo_tarifa: 'estandar', tarifa_personalizada: null, moneda: 'ARS' },
  { ...base, id: 'b', codigo: 'P001', nombre: 'Sofía Ruiz', tipo_tarifa: 'personalizada', tarifa_personalizada: 50, moneda: 'USD' },
]
const sesiones: Sesion[] = [
  { id: 's1', patient_id: 'a', fecha: '2026-10-05', horas: 1, tarifa_hora: 50000, monto: 50000, moneda: 'ARS', observaciones: null, estado: 'normal', hora: null },
  { id: 's2', patient_id: 'a', fecha: '2026-10-12', horas: 1.5, tarifa_hora: 50000, monto: 75000, moneda: 'ARS', observaciones: null, estado: 'normal', hora: null },
  { id: 's3', patient_id: 'b', fecha: '2026-10-07', horas: 1, tarifa_hora: 50, monto: 50, moneda: 'USD', observaciones: null, estado: 'normal', hora: null },
]
const pagos: Pago[] = [
  {
    id: 'g1', patient_id: 'a', fecha: '2026-11-02', periodo: '2026-10-01', monto: 50000, moneda: 'ARS', medio: 'mercadopago',
    comprobante: 'factura_c', punto_venta: '00002', nro_factura: '00000123', session_id: 's1', observaciones: null, pagador: 'paciente',
  },
]

async function ida() {
  const libro = await libroBackup(perfil, pacientes, sesiones, pagos)
  const buf = (await libro.xlsx.writeBuffer()) as ArrayBuffer
  return leerXlsx(buf)
}

describe('Excel de backup', () => {
  it('tiene el formato de la plantilla', { timeout: 60000 }, async () => {
    expect(esPlantilla(await ida())).toBe(true)
  })

  it('subido a una cuenta vacía, recrea todo con los mismos montos, horas y meses', async () => {
    const r = prepararPlantilla(await ida(), { pacientes: [], sesiones: [], pagos: [], monedaDefecto: 'ARS', tarifaEstandar: 50000 })
    expect(r.errores).toEqual([])
    expect(r.pacientes.map((p) => [p.codigo, p.nombre, p.tipo_tarifa, p.moneda])).toEqual([
      ['P002', 'Lucía Fernández', 'estandar', 'ARS'], // P001 ya lo usaba Sofía
      ['P001', 'Sofía Ruiz', 'personalizada', 'USD'],
    ])
    expect(r.sesiones.map((s) => [s.fecha, s.horas, s.tarifa_hora, s.moneda])).toEqual([
      ['2026-10-05', 1, 50000, 'ARS'],
      ['2026-10-12', 1.5, 50000, 'ARS'],
      ['2026-10-07', 1, 50, 'USD'],
    ])
    expect(r.pagos[0]).toMatchObject({
      fecha: '2026-11-02',
      periodo: '2026-10-01',
      medio: 'mercadopago',
      comprobante: 'factura_c',
      punto_venta: '00002',
      nro_factura: '00000123',
      sesion_ref: 's:s0001',
    })
  })

  it('subido a la misma cuenta, no duplica nada', async () => {
    const r = prepararPlantilla(await ida(), { pacientes, sesiones, pagos, monedaDefecto: 'ARS', tarifaEstandar: 50000 })
    expect(r).toMatchObject({ pacientes: [], sesiones: [], pagos: [], errores: [], duplicadas: 4, pacientesExistentes: 2 })
  })
})

describe('PDF para contadora', () => {
  it('arma el documento con el resumen y el detalle', async () => {
    const doc = await pdfContadora('2026-10-01', '2026-11-01', perfil, pacientes, pagos)
    expect(doc.getNumberOfPages()).toBe(1)
    // Tipografías del diseño incrustadas (por eso el texto no se puede buscar en el PDF).
    expect(Object.keys(doc.getFontList())).toEqual(expect.arrayContaining(['Figtree', 'InstrumentSerif']))
  })

  it('reporte parcial: lo aclara solo si faltan pacientes', async () => {
    expect(textoParcial({ incluidos: 10, total: 12 })).toBe('Incluye 10 de 12 pacientes con cobros en el período.')
    expect(textoParcial({ incluidos: 12, total: 12 })).toBeNull()
    expect(textoParcial(undefined)).toBeNull()
    const doc = await pdfContadora('2026-10-01', '2026-11-01', perfil, pacientes, pagos, { parcial: { incluidos: 1, total: 2 } })
    expect(doc.getNumberOfPages()).toBe(1)
  })

  it('con muchos pagos sigue en varias hojas', async () => {
    const muchos = Array.from({ length: 80 }, (_, i) => ({ ...pagos[0], id: `m${i}` }))
    const doc = await pdfContadora('2026-10-01', '2026-11-01', perfil, pacientes, muchos)
    expect(doc.getNumberOfPages()).toBeGreaterThan(1)
  })
})

describe('exportes seguros', () => {
  it('protege los textos que se abrirían como fórmula', () => {
    expect(celdaSegura('=HYPERLINK("http://x","clic")')).toBe('\'=HYPERLINK("http://x","clic")')
    expect(celdaSegura('@SUMA(A1)')).toBe("'@SUMA(A1)")
    expect(celdaSegura('-2+3')).toBe("'-2+3")
  })
  it('no toca números, fechas, teléfonos ni textos comunes', () => {
    expect(celdaSegura(50000)).toBe(50000)
    expect(celdaSegura('+54 9 11 5555-1234')).toBe('+54 9 11 5555-1234')
    expect(celdaSegura('Lucía')).toBe('Lucía')
    expect(celdaSegura(null)).toBeNull()
  })
  it('iniciales', () => {
    expect(soloIniciales('Lucía Fernández')).toBe('L. F.')
    expect(soloIniciales('  maría  de los ángeles ')).toBe('M. D. L. Á.')
  })
  it('un texto protegido vuelve igual al importar el Excel de la app', async () => {
    const conFormula = [{ ...sesiones[0], observaciones: '=1+1' }, ...sesiones.slice(1)]
    const libro = await libroBackup(perfil, pacientes, conFormula, pagos)
    const hojas = await leerXlsx((await libro.xlsx.writeBuffer()) as ArrayBuffer)
    const r = prepararPlantilla(hojas, { pacientes: [], sesiones: [], pagos: [], monedaDefecto: 'ARS', tarifaEstandar: 50000 })
    expect(r.sesiones[0].observaciones).toBe('=1+1')
  })
})
