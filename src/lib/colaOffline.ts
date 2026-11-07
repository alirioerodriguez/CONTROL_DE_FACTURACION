// Cola de borradores para cuando no hay señal (consultorios en planta baja). Pieza lista para el modo sin
// conexión que hoy no existe (la app avisa y no deja cargar): todavía no está conectada a ninguna pantalla.
//
// Cada borrador lleva un `clave` (UUID creado en el teléfono). Si la conexión va y viene o se toca «Sincronizar»
// dos veces, el servidor tiene que rechazar la segunda vez por clave repetida: así un pago nunca se duplica.
// Para eso falta en supabase/schema.sql una columna `idempotency_key uuid` con índice único por usuario en
// sessions y payments (y correr supabase/tests/aislamiento.sql después).
import type { Moneda } from './formato'

export type TipoBorrador = 'sesion' | 'pago'

export interface Borrador {
  clave: string
  userId: string
  tipo: TipoBorrador
  pacienteId: string
  fecha: string
  moneda: Moneda
  monto?: number
  creado: string
  intentos: number
  ultimoError?: string
}

export type ResultadoEnvio = 'creado' | 'repetido'

const CLAVE_COLA = 'honorapp_cola_v1'
type Almacen = Pick<Storage, 'getItem' | 'setItem'>

export function nuevaClave(): string {
  return crypto.randomUUID()
}

function leerTodo(st: Almacen): Borrador[] {
  try {
    const v = JSON.parse(st.getItem(CLAVE_COLA) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function guardarDeUsuario(st: Almacen, userId: string, cola: Borrador[]) {
  const otros = leerTodo(st).filter((b) => b.userId !== userId)
  st.setItem(CLAVE_COLA, JSON.stringify([...otros, ...cola]))
}

export function leerCola(userId: string, st: Almacen): Borrador[] {
  return leerTodo(st).filter((b) => b.userId === userId)
}

/** Agrega un borrador; si ya hay uno con la misma clave, devuelve ese y no duplica. */
export function encolar(b: Omit<Borrador, 'clave' | 'creado' | 'intentos'> & { clave?: string }, st: Almacen, ahora = new Date()): Borrador {
  const cola = leerCola(b.userId, st)
  const clave = b.clave ?? nuevaClave()
  const existente = cola.find((x) => x.clave === clave)
  if (existente) return existente
  const nuevo: Borrador = { ...b, clave, creado: ahora.toISOString(), intentos: 0 }
  guardarDeUsuario(st, b.userId, [...cola, nuevo])
  return nuevo
}

/**
 * Manda los borradores en orden. Lo que falla queda en la cola con un intento más; lo que el servidor ya tenía
 * («repetido») se saca sin contarlo dos veces.
 */
export async function sincronizar(userId: string, enviar: (b: Borrador) => Promise<ResultadoEnvio>, st: Almacen) {
  const quedan: Borrador[] = []
  let enviados = 0
  let repetidos = 0
  for (const b of leerCola(userId, st)) {
    try {
      if ((await enviar(b)) === 'repetido') repetidos++
      else enviados++
    } catch (e) {
      quedan.push({ ...b, intentos: b.intentos + 1, ultimoError: e instanceof Error ? e.message : 'Error de red' })
    }
  }
  guardarDeUsuario(st, userId, quedan)
  return { enviados, repetidos, pendientes: quedan.length }
}
