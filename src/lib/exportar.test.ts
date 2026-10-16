import { describe, expect, it } from 'vitest'
import type { Paciente, Pago, Perfil, Sesion } from './datos'
import { libroBackup, pdfContadora } from './exportar'
import { leerXlsx } from './importar/leer'
import { esPlantilla, prepararPlantilla } from './importar/preparar'

const perfil = { id: 'u', nombre: 'Ana', email: 'ana@x.com', tarifa_estandar: 50000, moneda_default: 'ARS', plantilla_whatsapp: '' } as Perfil

const base = {
  apellido: null, dni: null, cuil_cuit: null, condicion_iva: null, telefono: null, email: null, domicilio: null,
  frecuencia: 'Semanal', dias_semana: [1], horas_por_sesion: 1, fecha_alta: '2026-03-01', activo: true, notas_admin: null,
}
const pacientes: Paciente[] = [
  { ...base, id: 'a', codigo: null, nombre: 'Lucía Fernández', tipo_tarifa: 'estandar', tarifa_personalizada: null, moneda: 'ARS' },
  { ...base, id: 'b', codigo: 'P001', nombre: 'Sofía Ruiz', tipo_tarifa: 'personalizada', tarifa_personalizada: 50, moneda: 'USD' },
]
const sesiones: Sesion[] = [
  { id: 's1', patient_id: 'a', fecha: '2026-10-05', horas: 1, tarifa_hora: 50000, monto: 50000, moneda: 'ARS', observaciones: null },
  { id: 's2', patient_id: 'a', fecha: '2026-10-12', horas: 1.5, tarifa_hora: 50000, monto: 75000, moneda: 'ARS', observaciones: null },
  { id: 's3', patient_id: 'b', fecha: '2026-10-07', horas: 1, tarifa_hora: 50, monto: 50, moneda: 'USD', observaciones: null },
]
const pagos: Pago[] = [
  {
    id: 'g1', patient_id: 'a', fecha: '2026-11-02', periodo: '2026-10-01', monto: 50000, moneda: 'ARS', medio: 'mercadopago',
    comprobante: 'factura_c', punto_venta: '00002', nro_factura: '00000123', session_id: 's1', observaciones: null,
  },
]

async function ida() {
  const libro = await libroBackup(perfil, pacientes, sesiones, pagos)
  const buf = (await libro.xlsx.writeBuffer()) as ArrayBuffer
  return leerXlsx(buf)
}

describe('Excel de backup', () => {
  it('tiene el formato de la plantilla', async () => {
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
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
    const texto = doc.output()
    expect(texto).toContain('Reporte de cobros')
    expect(texto).toContain('Detalle de pagos')
    expect(texto).toContain('Noviembre 2026')
  })
})
