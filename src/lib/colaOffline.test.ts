import { describe, expect, it } from 'vitest'
import { borrarCacheDatos, encolar, etiquetaCache, formatHoraAR, guardarCacheDatos, leerCacheDatos, leerCola, sincronizar, suscribirCola } from './colaOffline'

function memoria() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  }
}

describe('cola sin señal y caché de consulta', () => {
  it('guarda borradores completos de pago y de sesión y avisa a los oyentes', () => {
    const st = memoria()
    let avisos = 0
    const desuscribir = suscribirCola(() => {
      avisos++
    })
    const bPago = encolar(
      {
        clave: 'p-1',
        userId: 'u1',
        tipo: 'pago',
        pacienteId: 'pac-1',
        fecha: '2026-11-09',
        periodo: '2026-11-01',
        moneda: 'ARS',
        monto: 30000,
        medio: 'transferencia',
        pagador: 'paciente',
      },
      st,
    )
    expect(bPago.medio).toBe('transferencia')
    expect(leerCola('u1', st)).toHaveLength(1)
    expect(avisos).toBe(1)
    desuscribir()
  })

  it('sincroniza sesiones y pagos sin duplicar los que ya estaban en el servidor', async () => {
    const st = memoria()
    encolar({ clave: 's-1', userId: 'u1', tipo: 'sesion', pacienteId: 'pac-1', fecha: '2026-11-09', moneda: 'ARS', monto: 30000, horas: 1, tarifa_hora: 30000 }, st)
    encolar({ clave: 'p-1', userId: 'u1', tipo: 'pago', pacienteId: 'pac-1', fecha: '2026-11-09', periodo: '2026-11-01', moneda: 'ARS', monto: 30000 }, st)
    const r = await sincronizar(
      'u1',
      async (b) => (b.tipo === 'sesion' ? 'repetido' : 'creado'),
      st,
    )
    expect(r).toEqual({ enviados: 1, repetidos: 1, pendientes: 0 })
    expect(leerCola('u1', st)).toEqual([])
  })

  it('guarda y lee la caché por usuaria con la hora en formato argentino («Datos de las 18:40»)', () => {
    const st = memoria()
    const fecha = new Date('2026-11-09T21:40:00.000Z') // 18:40 en Argentina (UTC-3)
    guardarCacheDatos('u1', { pacientes: ['Lucía'] }, st, fecha)
    const leido = leerCacheDatos<{ pacientes: string[] }>('u1', st)
    expect(leido?.datos).toEqual({ pacientes: ['Lucía'] })
    expect(formatHoraAR(leido!.guardadoEn)).toBe('18:40')
    expect(etiquetaCache(leido!.guardadoEn)).toBe('Datos de las 18:40')
    expect(leerCacheDatos('u2', st)).toBeNull()
  })

  it('al cerrar sesión borra la copia de datos del dispositivo', () => {
    const st = memoria()
    guardarCacheDatos('u1', { pacientes: ['Lucía'] }, st)
    borrarCacheDatos(st)
    expect(leerCacheDatos('u1', st)).toBeNull()
  })
})
