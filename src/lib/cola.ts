// Cola de borradores sin conexión. Un pago cargado sin señal se guarda en el teléfono con un id único (uuid) y se manda
// cuando vuelve internet. Ese id es la clave primaria de `payments` en Supabase: si el reintento ya había llegado, la base
// lo ignora (upsert con ignoreDuplicates) y no se carga dos veces.
// Safari en iPhone no tiene Background Sync: la sincronización se dispara al volver la señal (evento `online`) y al abrir
// la app, nunca en segundo plano. Solo se guardan los datos del pago (no hay historia clínica ni notas de sesión).

export interface Borrador {
  /** uuid generado en el teléfono; es el id del pago en la base. */
  id: string
  user_id: string
  fila: Record<string, unknown>
  creado: string
  /** Cuántas veces falló el envío. */
  intentos: number
}

export type Almacen = Pick<Storage, 'getItem' | 'setItem'>

export const CLAVE_COLA = 'cola_borradores_pagos'

export function leerCola(almacen: Almacen, clave = CLAVE_COLA): Borrador[] {
  try {
    const v = JSON.parse(almacen.getItem(clave) ?? '[]')
    return Array.isArray(v)
      ? v.filter((b): b is Borrador => b && typeof b.id === 'string' && typeof b.user_id === 'string' && typeof b.fila === 'object' && b.fila !== null)
      : []
  } catch {
    return []
  }
}

function guardarCola(almacen: Almacen, cola: Borrador[], clave = CLAVE_COLA) {
  almacen.setItem(clave, JSON.stringify(cola))
}

/** Agrega un pago a la cola. Si ya hay uno con ese id (doble toque), no lo repite. Devuelve el borrador. */
export function encolar(almacen: Almacen, user_id: string, fila: Record<string, unknown>, ahora: Date = new Date(), id: string = crypto.randomUUID()): Borrador {
  const cola = leerCola(almacen)
  const idFinal = typeof fila.id === 'string' ? fila.id : id
  const ya = cola.find((b) => b.id === idFinal)
  if (ya) return ya
  const borrador: Borrador = { id: idFinal, user_id, fila: { ...fila, id: idFinal }, creado: ahora.toISOString(), intentos: 0 }
  guardarCola(almacen, [...cola, borrador])
  return borrador
}

export function pendientesDe(almacen: Almacen, user_id: string): Borrador[] {
  return leerCola(almacen).filter((b) => b.user_id === user_id)
}

export interface ResultadoSync {
  enviados: string[]
  fallidos: string[]
}

/**
 * Manda los borradores de esa cuenta de a uno, en orden. Los que salen bien se sacan de la cola; los que fallan se
 * quedan con un intento más para la próxima vez. `enviar` tiene que ser idempotente (upsert por id).
 */
export async function sincronizar(almacen: Almacen, user_id: string, enviar: (b: Borrador) => Promise<void>): Promise<ResultadoSync> {
  const enviados: string[] = []
  const fallidos: string[] = []
  for (const b of pendientesDe(almacen, user_id)) {
    try {
      await enviar(b)
      enviados.push(b.id)
    } catch {
      fallidos.push(b.id)
    }
  }
  // Se relee la cola: puede haber entrado un borrador nuevo mientras se enviaba.
  const resto = leerCola(almacen)
    .filter((b) => !enviados.includes(b.id))
    .map((b) => (fallidos.includes(b.id) ? { ...b, intentos: b.intentos + 1 } : b))
  guardarCola(almacen, resto)
  return { enviados, fallidos }
}
