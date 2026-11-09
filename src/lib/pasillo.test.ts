import { describe, expect, it } from 'vitest'
import { ACCIONES_PASILLO, armarSesionVinoHoy, textoResumenPasillo, yaVinoEnFecha } from './pasillo'

describe('Modo pasillo para mayores de 60', () => {
  it('define exactamente las 3 acciones por paciente: Vino hoy, Pagó y Resumen', () => {
    expect(ACCIONES_PASILLO).toEqual(['Vino hoy', 'Pagó', 'Resumen'])
  })

  it('detecta si ya vino hoy (ignorando canceladas) para no duplicar toques accidentales', () => {
    const sesiones = [
      { patient_id: 'p1', fecha: '2026-11-09', estado: 'cancelada' as const },
      { patient_id: 'p2', fecha: '2026-11-09', estado: 'normal' as const },
    ]
    expect(yaVinoEnFecha(sesiones, 'p1', '2026-11-09')).toBe(false)
    expect(yaVinoEnFecha(sesiones, 'p2', '2026-11-09')).toBe(true)
  })

  it('arma la sesión de hoy con idempotency_key y la tarifa correspondiente', () => {
    const fila = armarSesionVinoHoy(
      { id: 'p1', tipo_tarifa: 'estandar', tarifa_personalizada: null, horas_por_sesion: 1.5, moneda: 'ARS' },
      30000,
      true,
      '2026-11-09',
      'clave-fija',
    )
    expect(fila).toEqual({
      id: 'clave-fija',
      idempotency_key: 'clave-fija',
      patient_id: 'p1',
      fecha: '2026-11-09',
      hora: null,
      horas: 1.5,
      tarifa_hora: 30000,
      moneda: 'ARS',
      estado: 'normal',
    })
  })

  it('arma el texto de resumen con pesos y dólares separados', () => {
    expect(textoResumenPasillo('Lucía Pérez', { ARS: 0, USD: 0 })).toContain('estás al día')
    expect(textoResumenPasillo('Lucía Pérez', { ARS: 25000, USD: 40 })).toBe(
      'Hola Lucía, ¿cómo estás? Te paso el resumen de tu saldo pendiente: $ 25.000,00 y US$ 40,00. ¡Gracias!',
    )
  })
})
