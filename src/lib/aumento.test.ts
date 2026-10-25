import { describe, expect, it } from 'vitest'
import { afectados, aplicarAumento, planAumento, textoAviso, type Aumento } from './aumento'
import type { Paciente } from './datos'

const p = (x: Partial<Paciente>) =>
  ({ id: 'x', nombre: 'Lucía', apellido: 'Pérez', activo: true, tipo_tarifa: 'estandar', tarifa_personalizada: null, abono_mensual: null, moneda: 'ARS', ...x }) as Paciente
const perfil = { id: 'yo', tarifa_estandar: 30000, moneda_default: 'ARS' as const }
const quince: Aumento = { tipo: 'porcentaje', valor: 15, redondeo: 500 }
const todo = { estandar: true, personalizadas: true, abonos: true }

describe('aumento de honorarios en lote', () => {
  it('sube por porcentaje y redondea los pesos hacia arriba', () => {
    expect(aplicarAumento(30000, 'ARS', quince)).toBe(34500)
    expect(aplicarAumento(28000, 'ARS', quince)).toBe(32500) // 32.200 → 32.500
    expect(aplicarAumento(28000, 'ARS', { ...quince, redondeo: 0 })).toBe(32200)
  })
  it('los dólares suben por porcentaje pero no con un monto fijo en pesos', () => {
    expect(aplicarAumento(50, 'USD', quince)).toBe(58) // 57,5 → 58
    expect(aplicarAumento(50, 'USD', { tipo: 'monto', valor: 5000, redondeo: 0 })).toBe(50)
    expect(aplicarAumento(30000, 'ARS', { tipo: 'monto', valor: 5000, redondeo: 0 })).toBe(35000)
  })
  it('arma la lista: estándar, personalizadas y abonos de pacientes activos', () => {
    const pacientes = [
      p({ id: 'a', nombre: 'Ana', tipo_tarifa: 'personalizada', tarifa_personalizada: 25000 }),
      p({ id: 'b', nombre: 'Beto', abono_mensual: 100000 }),
      p({ id: 'c', nombre: 'Caro', tipo_tarifa: 'personalizada', tarifa_personalizada: 25000, activo: false }),
      p({ id: 'd', nombre: 'Dani' }),
    ]
    const cambios = planAumento(perfil, pacientes, quince, todo)
    expect(cambios.map((c) => [c.id, c.campo, c.antes, c.despues])).toEqual([
      ['perfil', 'tarifa_estandar', 30000, 34500],
      ['a', 'tarifa_personalizada', 25000, 29000],
      ['b', 'abono_mensual', 100000, 115000],
    ])
    // Dani sigue a la estándar: también hay que avisarle.
    expect(afectados(pacientes, cambios).map((x) => x.paciente.id)).toEqual(['a', 'b', 'd'])
  })
  it('respeta lo que se eligió subir', () => {
    const cambios = planAumento(perfil, [p({ id: 'b', abono_mensual: 100000 })], quince, { estandar: false, personalizadas: true, abonos: false })
    expect(cambios).toEqual([])
  })
  it('el aviso lleva el monto real y la palabra que usa la profesional', () => {
    const [c] = planAumento(perfil, [], quince, todo)
    expect(textoAviso('Lucía Pérez', c, 'diciembre', 'sesión')).toBe(
      'Hola Lucía! Te cuento que a partir de diciembre el valor de la sesión pasa a $ 34.500,00. Cualquier duda lo hablamos. ¡Gracias!',
    )
  })
})
