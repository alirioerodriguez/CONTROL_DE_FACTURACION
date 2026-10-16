// Lee la tabla de categorías del monotributo de la página oficial de ARCA
// (https://www.arca.gob.ar/monotributo/categorias.asp). Sin dependencias: corre en Deno (función) y en vitest.

export interface CategoriaArca {
  letra: string
  /** Tope anual de ingresos brutos, en pesos. */
  tope: number
  /** Total mensual para locaciones y prestaciones de servicios, en pesos. */
  cuota: number
}

export interface TablaArca {
  /** Fecha desde la que rigen los valores, 'AAAA-MM-DD'. */
  vigencia: string
  categorias: CategoriaArca[]
}

const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']

/** '$12.009.410,45 ' → 12009410.45. null si no es un monto. */
export function montoArca(texto: string): number | null {
  const limpio = texto.replace(/<[^>]*>/g, '').replace(/[$\s]/g, '').replace(/&nbsp;/g, '')
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$/.test(limpio)) return null
  return Number(limpio.replace(/\./g, '').replace(',', '.'))
}

/**
 * Devuelve la tabla o tira un Error explicando qué no encontró. Valida que estén las 11 categorías,
 * que los topes crezcan de la A a la K y que los montos sean razonables, para no guardar basura si
 * ARCA cambia el diseño de la página.
 */
export function leerTablaArca(html: string): TablaArca {
  const sinComentarios = html.replace(/<!--[\s\S]*?-->/g, '')

  const fecha = sinComentarios.match(/Valores de aplicaci(?:ó|&oacute;|o)n desde el (\d{1,2})\/(\d{1,2})\/(\d{4})/i)
  if (!fecha) throw new Error('No encontré la fecha de vigencia ("Valores de aplicación desde el ...").')
  const vigencia = `${fecha[3]}-${fecha[2].padStart(2, '0')}-${fecha[1].padStart(2, '0')}`

  const categorias: CategoriaArca[] = []
  for (const letra of LETRAS) {
    const fila = sinComentarios.match(new RegExp(`<th[^>]*id="th_${letra}_[^"]*"[^>]*>\\s*${letra}\\s*</th>([\\s\\S]*?)</tr>`))
    if (!fila) throw new Error(`No encontré la fila de la categoría ${letra}.`)
    const celda = (clave: string) => {
      const m = fila[1].match(new RegExp(`<td[^>]*headers="[^"]*${clave}[^"]*"[^>]*>([\\s\\S]*?)</td>`))
      return m ? montoArca(m[1]) : null
    }
    const tope = celda('th_ing_br')
    const cuota = celda('th_total_loc')
    if (tope == null) throw new Error(`No pude leer el tope de ingresos de la categoría ${letra}.`)
    if (cuota == null) throw new Error(`No pude leer la cuota de servicios de la categoría ${letra}.`)
    categorias.push({ letra, tope, cuota })
  }

  for (let i = 1; i < categorias.length; i++) {
    if (categorias[i].tope <= categorias[i - 1].tope) {
      throw new Error(`Los topes no crecen: ${categorias[i - 1].letra} ${categorias[i - 1].tope} y ${categorias[i].letra} ${categorias[i].tope}.`)
    }
  }
  for (const c of categorias) {
    if (c.tope < 1_000_000 || c.tope > 1e12) throw new Error(`Tope fuera de rango en la categoría ${c.letra}: ${c.tope}.`)
    if (c.cuota <= 0 || c.cuota >= c.tope / 12) throw new Error(`Cuota fuera de rango en la categoría ${c.letra}: ${c.cuota}.`)
  }

  return { vigencia, categorias }
}
