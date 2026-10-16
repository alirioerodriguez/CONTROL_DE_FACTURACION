// Acceso a Supabase con TanStack Query. Cada usuaria trae todos sus
// pacientes, sesiones y pagos (son pocos datos) y la app calcula el resto.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Moneda } from './formato'
import type { ModoCobro, Termino } from './terminos'
import { supabase } from './supabase'

export type Medio = 'efectivo' | 'transferencia' | 'mercadopago' | 'otro'
export type Comprobante = 'factura_c' | 'recibo' | 'sin_comprobante'

export interface Perfil {
  id: string
  nombre: string | null
  email: string | null
  tarifa_estandar: number
  moneda_default: Moneda
  plantilla_whatsapp: string
  tutorial_visto: boolean
  profesion: string | null
  termino: Termino
  modo_cobro: ModoCobro
}

export interface Paciente {
  id: string
  codigo: string | null
  nombre: string
  apellido: string | null
  dni: string | null
  cuil_cuit: string | null
  condicion_iva: string | null
  telefono: string | null
  email: string | null
  domicilio: string | null
  frecuencia: string | null
  dias_semana: number[]
  horas_por_sesion: number
  tipo_tarifa: 'estandar' | 'personalizada'
  tarifa_personalizada: number | null
  moneda: Moneda
  fecha_alta: string
  activo: boolean
  notas_admin: string | null
}

export interface Sesion {
  id: string
  patient_id: string
  fecha: string
  horas: number
  tarifa_hora: number
  monto: number
  moneda: Moneda
  observaciones: string | null
}

export interface Pago {
  id: string
  patient_id: string
  fecha: string
  periodo: string
  monto: number
  moneda: Moneda
  medio: Medio
  comprobante: Comprobante
  punto_venta: string | null
  nro_factura: string | null
  session_id: string | null
  observaciones: string | null
}

export const ETIQUETA_MEDIO: Record<Medio, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  mercadopago: 'MercadoPago',
  otro: 'Otro',
}

/** Nombre completo para mostrar. */
export function nombreCompleto(p: Pick<Paciente, 'nombre' | 'apellido'>): string {
  return [p.nombre, p.apellido].filter(Boolean).join(' ').trim()
}

const CLAVES = {
  perfil: ['perfil'],
  pacientes: ['pacientes'],
  sesiones: ['sesiones'],
  pagos: ['pagos'],
} as const

// Postgres devuelve numeric como número en JSON; igual lo normalizamos.
const n = (v: unknown) => Number(v ?? 0)

async function traer<T>(tabla: string, orden: string): Promise<T[]> {
  const { data, error } = await supabase.from(tabla).select('*').order(orden)
  if (error) throw error
  return data as T[]
}

export function usePerfil() {
  return useQuery({
    queryKey: CLAVES.perfil,
    queryFn: async (): Promise<Perfil> => {
      const { data, error } = await supabase.from('profiles').select('*').single()
      if (error) throw error
      return { ...data, tarifa_estandar: n(data.tarifa_estandar) }
    },
  })
}

export function usePacientes() {
  return useQuery({
    queryKey: CLAVES.pacientes,
    queryFn: async () =>
      (await traer<Paciente>('patients', 'nombre')).map((p) => ({
        ...p,
        horas_por_sesion: n(p.horas_por_sesion),
        tarifa_personalizada: p.tarifa_personalizada == null ? null : n(p.tarifa_personalizada),
      })),
  })
}

export function useSesiones() {
  return useQuery({
    queryKey: CLAVES.sesiones,
    queryFn: async () =>
      (await traer<Sesion>('sessions', 'fecha')).map((s) => ({
        ...s,
        horas: n(s.horas),
        tarifa_hora: n(s.tarifa_hora),
        monto: n(s.monto),
      })),
  })
}

export function usePagos() {
  return useQuery({
    queryKey: CLAVES.pagos,
    queryFn: async () => (await traer<Pago>('payments', 'fecha')).map((p) => ({ ...p, monto: n(p.monto) })),
  })
}

/** Todo junto, con un solo estado de carga y error. */
export function useDatos() {
  const perfil = usePerfil()
  const pacientes = usePacientes()
  const sesiones = useSesiones()
  const pagos = usePagos()
  const consultas = [perfil, pacientes, sesiones, pagos]
  return {
    perfil: perfil.data,
    pacientes: pacientes.data ?? [],
    sesiones: sesiones.data ?? [],
    pagos: pagos.data ?? [],
    cargando: consultas.some((c) => c.isPending),
    error: consultas.find((c) => c.error)?.error ?? null,
    reintentar: () => consultas.forEach((c) => c.refetch()),
  }
}

// ---------------------------------------------------------------------
// Escrituras
// ---------------------------------------------------------------------

type Tabla = 'patients' | 'sessions' | 'payments' | 'profiles'

const INVALIDA: Record<Tabla, readonly (readonly string[])[]> = {
  patients: [CLAVES.pacientes, CLAVES.sesiones, CLAVES.pagos], // borrar un paciente borra lo suyo
  sessions: [CLAVES.sesiones, CLAVES.pagos],
  payments: [CLAVES.pagos],
  profiles: [CLAVES.perfil],
}

type Operacion =
  | { tipo: 'insertar'; tabla: Tabla; filas: Record<string, unknown>[] }
  | { tipo: 'actualizar'; tabla: Tabla; id: string; cambios: Record<string, unknown> }
  | { tipo: 'borrar'; tabla: Tabla; id: string }

async function ejecutar(op: Operacion) {
  if (!navigator.onLine) throw new Error('Sin conexión: no se puede guardar ahora.')
  if (op.tipo === 'insertar') {
    const { data, error } = await supabase.from(op.tabla).insert(op.filas).select()
    if (error) throw error
    return data
  }
  if (op.tipo === 'actualizar') {
    const { data, error } = await supabase.from(op.tabla).update(op.cambios).eq('id', op.id).select()
    if (error) throw error
    if (!data?.length) throw new Error('No se encontró el registro.')
    return data
  }
  const { error } = await supabase.from(op.tabla).delete().eq('id', op.id)
  if (error) throw error
  return []
}

/** Una mutación genérica que, al terminar, refresca lo que corresponde. */
export function useGuardar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ops: Operacion[]) => {
      const resultados = []
      for (const op of ops) resultados.push(await ejecutar(op))
      return resultados
    },
    onSettled: (_d, _e, ops) => {
      const claves = new Set(ops.flatMap((op) => INVALIDA[op.tabla].map((k) => k.join('/'))))
      claves.forEach((k) => qc.invalidateQueries({ queryKey: k.split('/') }))
    },
  })
}
