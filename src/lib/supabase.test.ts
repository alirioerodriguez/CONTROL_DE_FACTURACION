import { describe, expect, it } from 'vitest'
import { mensajeError } from './supabase'

describe('mensajeError', () => {
  it('traduce las reglas de la base', () => {
    const e = (regla: string) => new Error(`new row for relation "sessions" violates check constraint "${regla}"`)
    expect(mensajeError(e('sessions_fecha_rango'))).toMatch(/entre el año 2000 y el 2100/)
    expect(mensajeError(e('sessions_horas_tope'))).toMatch(/hasta 24/)
    expect(mensajeError(e('patients_nombre_largo'))).toMatch(/demasiado largo/)
    expect(mensajeError(e('payments_monto_check'))).toMatch(/mayor a 0/)
    expect(mensajeError(e('otra_regla'))).toBe('Algún dato no es válido. Revisalo y probá de nuevo.')
  })
  it('corte de conexión', () => {
    expect(mensajeError(new TypeError('Failed to fetch'))).toMatch(/no se duplica nada/)
  })
})
