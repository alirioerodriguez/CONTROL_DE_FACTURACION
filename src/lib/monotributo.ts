// Control del tope del monotributo: cuánto se cobró en los últimos 12 meses contra el tope de la categoría.
// Es orientativo: ARCA mide lo facturado y también mira superficie, luz y alquiler del consultorio.
import type { Pago } from './datos'
import { periodoDe, sumarMeses } from './formato'

/**
 * Tabla oficial de ARCA (arca.gob.ar/monotributo/categorias.asp), valores desde el 1/08/2026.
 * Es el RESPALDO: la app usa la tabla monotributo_categorias, que la función actualizar-monotributo
 * mantiene al día leyendo ARCA todos los días. Esta copia se usa solo si la base no responde.
 * `cuota` es el total mensual para locaciones y prestaciones de servicios (impuesto + jubilación + obra social).
 */
export const VIGENCIA_MONOTRIBUTO = '2026-08-01'
export const FUENTE_MONOTRIBUTO = 'https://www.arca.gob.ar/monotributo/categorias.asp'

export const CATEGORIAS = [
  { letra: 'A', tope: 12_009_410.45, cuota: 49_527.18 },
  { letra: 'B', tope: 17_595_182.74, cuota: 56_379.08 },
  { letra: 'C', tope: 24_670_494.31, cuota: 66_020.12 },
  { letra: 'D', tope: 30_628_651.43, cuota: 84_612.93 },
  { letra: 'E', tope: 36_028_231.33, cuota: 119_811.45 },
  { letra: 'F', tope: 45_151_659.41, cuota: 150_784.21 },
  { letra: 'G', tope: 53_995_798.87, cuota: 230_312.94 },
  { letra: 'H', tope: 81_924_660.37, cuota: 522_706.68 },
  { letra: 'I', tope: 91_699_761.9, cuota: 963_747.86 },
  { letra: 'J', tope: 105_012_519.2, cuota: 1_167_299.76 },
  { letra: 'K', tope: 126_610_838.75, cuota: 1_614_446.04 },
] as const

export type Letra = (typeof CATEGORIAS)[number]['letra']
/** Una categoría con su tope anual y su cuota mensual de servicios. */
export interface CategoriaTope {
  letra: string
  tope: number
  cuota: number
}
/** Lo que se guarda en el perfil: una letra, 'no' (no usa monotributo) o null (todavía no eligió). */
export type CategoriaPerfil = Letra | 'no' | null

export function datosCategoria(letra: string | null | undefined, categorias: readonly CategoriaTope[] = CATEGORIAS) {
  return categorias.find((c) => c.letra === letra) ?? null
}

/** La categoría más baja cuyo tope alcanza para ese ingreso anual. null si supera la K. */
export function categoriaPara(ingresoAnual: number, categorias: readonly CategoriaTope[] = CATEGORIAS) {
  return categorias.find((c) => ingresoAnual <= c.tope) ?? null
}

/** Primer y último mes (día 1) de la ventana de 12 meses que termina en el mes de `hoy`. */
export function ventana12Meses(hoy: string): { desde: string; hasta: string } {
  const hasta = periodoDe(hoy)
  return { desde: sumarMeses(hasta, -11), hasta }
}

/** Próxima recategorización: en enero (con lo cobrado hasta diciembre) o en julio (hasta junio). */
export function proximaRecategorizacion(hoy: string): { mes: string; hastaCuando: string; esteMes: boolean } {
  const [a, m] = hoy.split('-').map(Number)
  if (m === 1 || m === 7) {
    return { mes: `${a}-${String(m).padStart(2, '0')}-01`, hastaCuando: m === 1 ? `${a - 1}-12-31` : `${a}-06-30`, esteMes: true }
  }
  if (m < 7) return { mes: `${a}-07-01`, hastaCuando: `${a}-06-30`, esteMes: false }
  return { mes: `${a + 1}-01-01`, hastaCuando: `${a}-12-31`, esteMes: false }
}

export type EstadoTope = 'bien' | 'cerca' | 'pasado' | 'fuera'

export interface ControlTope {
  desde: string
  hasta: string
  /** Pesos cobrados en la ventana. */
  ars: number
  /** Dólares cobrados en la ventana (sin convertir). */
  usd: number
  /** Lo que se compara con el tope: pesos + dólares convertidos si hay tipo de cambio. */
  total: number
  /** true si hay dólares y no hay tipo de cambio cargado: el total no los incluye. */
  faltaTipoCambio: boolean
  /** Categoría elegida por la persona, si eligió una. */
  elegida: CategoriaTope | null
  /** Categoría que le correspondería por lo cobrado. null = supera la K. */
  sugerida: CategoriaTope | null
  /** Parte del tope usada (0 a 1 o más). null sin categoría elegida. */
  uso: number | null
  /** Cuánto falta para el tope de la categoría elegida (0 si ya lo pasó). */
  margen: number | null
  estado: EstadoTope
}

/** A partir del 80 % del tope se avisa que está cerca. */
export const UMBRAL_CERCA = 0.8

export function controlTope(
  pagos: Pago[],
  categoria: CategoriaPerfil,
  tipoCambio: number | null,
  hoy: string,
  categorias: readonly CategoriaTope[] = CATEGORIAS,
): ControlTope {
  const { desde, hasta } = ventana12Meses(hoy)
  let arsCent = 0
  let usdCent = 0
  for (const p of pagos) {
    if (p.fecha < desde || p.fecha > hoy) continue
    if (p.moneda === 'USD') usdCent += Math.round(p.monto * 100)
    else arsCent += Math.round(p.monto * 100)
  }
  const ars = arsCent / 100
  const usd = usdCent / 100
  const conTc = tipoCambio != null && tipoCambio > 0
  const total = Math.round((ars + (conTc ? usd * tipoCambio : 0)) * 100) / 100
  const elegida = datosCategoria(categoria, categorias)
  const sugerida = categoriaPara(total, categorias)
  const uso = elegida ? total / elegida.tope : null

  let estado: EstadoTope = 'bien'
  if (!sugerida) estado = 'fuera'
  else if (uso != null && uso > 1) estado = 'pasado'
  else if (uso != null && uso >= UMBRAL_CERCA) estado = 'cerca'

  return {
    desde,
    hasta,
    ars,
    usd,
    total,
    faltaTipoCambio: usd > 0 && !conTc,
    elegida,
    sugerida,
    uso,
    margen: elegida ? Math.max(0, Math.round((elegida.tope - total) * 100) / 100) : null,
    estado,
  }
}
