// Cola de borradores y caché de última lectura para cuando no hay señal (consultorios en planta baja).
// Cada borrador lleva un `clave` (UUID creado en el teléfono) que viaja como `id` e `idempotency_key` a
// sessions y payments: si la conexión va y viene o se sincroniza dos veces, la base rechaza el duplicado.
import { ZONA_AR, type Moneda } from './formato'
import type { EstadoGuardado } from './estados'
import type { Comprobante, Medio, Pagador } from './datos'

export type TipoBorrador = 'sesion' | 'pago'

export interface Borrador {
  clave: string
  userId: string
  tipo: TipoBorrador
  pacienteId: string
  fecha: string
  moneda: Moneda
  monto?: number
  // Datos opcionales de sesión
  hora?: string | null
  horas?: number
  tarifa_hora?: number
  estado?: EstadoGuardado
  // Datos opcionales de pago
  periodo?: string
  medio?: Medio
  pagador?: Pagador
  nro_factura?: string | null
  comprobante?: Comprobante
  session_id?: string | null
  creado: string
  intentos: number
  ultimoError?: string
}

export type ResultadoEnvio = 'creado' | 'repetido'

const CLAVE_COLA = 'honorapp_cola_v1'
const CLAVE_CACHE = 'honorapp_cache_datos_v1'
type Almacen = Pick<Storage, 'getItem' | 'setItem'>

const oyentes = new Set<() => void>()
function notificar() {
  oyentes.forEach((fn) => fn())
}

export function suscribirCola(fn: () => void): () => void {
  oyentes.add(fn)
  return () => oyentes.delete(fn)
}

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
  try {
    st.setItem(CLAVE_COLA, JSON.stringify([...otros, ...cola]))
  } catch {
    // Sin espacio en el navegador.
  }
  notificar()
}

export function leerCola(userId: string, st: Almacen): Borrador[] {
  if (!userId) return []
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

// ---------------------------------------------------------------------
// Caché local de última lectura («Datos de las 18:40») para consultar sin señal
// ---------------------------------------------------------------------

export interface SnapshotDatos<T> {
  guardadoEn: string
  datos: T
}

export function guardarCacheDatos<T>(userId: string, datos: T, st: Almacen, ahora = new Date()): void {
  if (!userId) return
  try {
    const actual = JSON.parse(st.getItem(CLAVE_CACHE) ?? '{}') as Record<string, SnapshotDatos<T>>
    actual[userId] = { guardadoEn: ahora.toISOString(), datos }
    st.setItem(CLAVE_CACHE, JSON.stringify(actual))
  } catch {
    // Modo privado o almacenamiento lleno: se ignora.
  }
}

export function leerCacheDatos<T>(userId: string, st: Almacen): SnapshotDatos<T> | null {
  if (!userId) return null
  try {
    const actual = JSON.parse(st.getItem(CLAVE_CACHE) ?? '{}') as Record<string, SnapshotDatos<T>>
    const snap = actual[userId]
    return snap && typeof snap.guardadoEn === 'string' && snap.datos ? snap : null
  } catch {
    return null
  }
}

/** Al cerrar sesión: la copia de pacientes, sesiones y pagos no queda en el dispositivo (puede ser una compu compartida). */
export function borrarCacheDatos(st: Pick<Storage, 'removeItem'>): void {
  try {
    st.removeItem(CLAVE_CACHE)
  } catch {
    // Sin almacenamiento: no hay nada que borrar.
  }
}

/** Hora '18:40' en huso horario de Argentina. */
export function formatHoraAR(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: ZONA_AR,
  }).format(new Date(iso))
}

/** 'Datos de las 18:40' */
export function etiquetaCache(iso: string): string {
  return `Datos de las ${formatHoraAR(iso)}`
}
