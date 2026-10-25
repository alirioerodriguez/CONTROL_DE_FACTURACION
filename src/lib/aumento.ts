// Aumento de honorarios en lote: sube la tarifa estándar, las personalizadas y los abonos de una vez
// y arma el aviso para cada paciente. Las sesiones ya cargadas conservan su precio (ver CLAUDE.md).
import { formatMonto, redondear2, type Moneda } from './formato'
import type { Paciente, Perfil } from './datos'

export type TipoAumento = 'porcentaje' | 'monto'
export interface Aumento {
  tipo: TipoAumento
  /** Porcentaje (15 = 15 %) o monto fijo en pesos. */
  valor: number
  /** Redondear los pesos hacia arriba a este múltiplo (0 = sin redondeo). */
  redondeo: number
}
export interface QueSube {
  estandar: boolean
  personalizadas: boolean
  abonos: boolean
}

export type Campo = 'tarifa_estandar' | 'tarifa_personalizada' | 'abono_mensual'
export interface Cambio {
  /** 'perfil' para la tarifa estándar; si no, el id del paciente. */
  id: string
  nombre: string
  campo: Campo
  moneda: Moneda
  antes: number
  despues: number
}

/** Nuevo valor. Un monto fijo en pesos no se aplica a valores en dólares. */
export function aplicarAumento(actual: number, moneda: Moneda, a: Aumento): number {
  if (!(actual > 0) || !(a.valor > 0)) return actual
  if (a.tipo === 'monto' && moneda === 'USD') return actual
  const bruto = a.tipo === 'porcentaje' ? actual * (1 + a.valor / 100) : actual + a.valor
  if (moneda === 'USD') return Math.ceil(bruto)
  if (a.redondeo > 0) return Math.ceil(bruto / a.redondeo - 1e-9) * a.redondeo
  return redondear2(bruto)
}

const nombreDe = (p: Paciente) => [p.nombre, p.apellido].filter(Boolean).join(' ')

/** Lista de cambios (solo pacientes activos), sin tocar nada todavía. */
export function planAumento(perfil: Pick<Perfil, 'id' | 'tarifa_estandar' | 'moneda_default'>, pacientes: Paciente[], a: Aumento, que: QueSube): Cambio[] {
  const cambios: Cambio[] = []
  const sumar = (c: Omit<Cambio, 'despues'>) => {
    const despues = aplicarAumento(c.antes, c.moneda, a)
    if (despues !== c.antes) cambios.push({ ...c, despues })
  }
  if (que.estandar) sumar({ id: 'perfil', nombre: 'Tarifa estándar', campo: 'tarifa_estandar', moneda: perfil.moneda_default, antes: perfil.tarifa_estandar })
  for (const p of pacientes) {
    if (!p.activo) continue
    if (que.abonos && p.abono_mensual) sumar({ id: p.id, nombre: nombreDe(p), campo: 'abono_mensual', moneda: p.moneda, antes: p.abono_mensual })
    else if (que.personalizadas && !p.abono_mensual && p.tipo_tarifa === 'personalizada' && p.tarifa_personalizada)
      sumar({ id: p.id, nombre: nombreDe(p), campo: 'tarifa_personalizada', moneda: p.moneda, antes: p.tarifa_personalizada })
  }
  return cambios
}

/** Pacientes a los que les cambia lo que pagan, con su valor nuevo (los de tarifa estándar siguen a la estándar). */
export function afectados(pacientes: Paciente[], cambios: Cambio[]): { paciente: Paciente; cambio: Cambio }[] {
  const estandar = cambios.find((c) => c.campo === 'tarifa_estandar')
  return pacientes.flatMap((p) => {
    if (!p.activo) return []
    const propio = cambios.find((c) => c.id === p.id)
    if (propio) return [{ paciente: p, cambio: propio }]
    if (estandar && p.tipo_tarifa === 'estandar' && !p.abono_mensual && p.moneda === estandar.moneda) return [{ paciente: p, cambio: estandar }]
    return []
  })
}

/** Mensaje de aviso para WhatsApp. `unidad`: "hora", "sesión" o "consulta" (todas femeninas: "la"). */
export function textoAviso(nombre: string, cambio: Cambio, mes: string, unidad: string): string {
  const primer = nombre.trim().split(/\s+/)[0] ?? ''
  const que = cambio.campo === 'abono_mensual' ? 'el abono mensual pasa' : `el valor de la ${unidad} pasa`
  return `Hola ${primer}! Te cuento que a partir de ${mes} ${que} a ${formatMonto(cambio.despues, cambio.moneda)}. Cualquier duda lo hablamos. ¡Gracias!`
}
