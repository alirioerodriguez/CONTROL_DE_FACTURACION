import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Paciente, Pago, Perfil } from './datos'
import { supabase } from './supabase'

// Modo Estudio Contable: la profesional le da a su contadora acceso de solo lectura a lo que va en el
// reporte para contadora. Ver «Modo Estudio Contable» en supabase/schema.sql.

export interface Vinculo {
  id: string
  token: string
  contadora_id: string | null
  contadora_email: string | null
  solo_iniciales: boolean
  created_at: string
  aceptado_at: string | null
}

export interface Clienta {
  profesional_id: string
  nombre: string | null
  email: string | null
  cuit: string | null
  monotributo_categoria: string | null
  solo_iniciales: boolean
  aceptado_at: string
}

export interface DatosClienta {
  solo_iniciales: boolean
  perfil: Perfil
  pacientes: Paciente[]
  pagos: Pago[]
}

const CLAVE_VINCULOS = ['estudio', 'vinculos'] as const
const CLAVE_CLIENTAS = ['estudio', 'clientas'] as const
const GUARDADA = 'honorapp_invitacion_estudio'

export const linkInvitacion = (token: string) => `${window.location.origin}/estudio?invitacion=${token}`

/** Link de invitación que se abrió sin sesión: se guarda hasta que la contadora entre con su cuenta. */
export function guardarInvitacion(token: string) {
  localStorage.setItem(GUARDADA, token)
}
export function invitacionPendiente(): string | null {
  const t = localStorage.getItem(GUARDADA)
  return t && /^[0-9a-f-]{36}$/i.test(t) ? t : null
}
export function olvidarInvitacion() {
  localStorage.removeItem(GUARDADA)
}

// ---------- Lado de la profesional ----------

export function useVinculos() {
  return useQuery({
    queryKey: CLAVE_VINCULOS,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('estudio_vinculos')
        .select('id, token, contadora_id, contadora_email, solo_iniciales, created_at, aceptado_at')
        .eq('user_id', u.user?.id ?? '')
        .order('created_at')
      if (error) throw error
      return data as Vinculo[]
    },
  })
}

export function useCambiarVinculos() {
  const qc = useQueryClient()
  const listo = () => qc.invalidateQueries({ queryKey: CLAVE_VINCULOS })
  return {
    crear: useMutation({
      mutationFn: async (soloIniciales: boolean) => {
        const { data, error } = await supabase.from('estudio_vinculos').insert({ solo_iniciales: soloIniciales }).select('token').single()
        if (error) throw error
        return data.token as string
      },
      onSuccess: listo,
    }),
    iniciales: useMutation({
      mutationFn: async ({ id, valor }: { id: string; valor: boolean }) => {
        const { error } = await supabase.from('estudio_vinculos').update({ solo_iniciales: valor }).eq('id', id)
        if (error) throw error
      },
      onSuccess: listo,
    }),
    quitar: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from('estudio_vinculos').delete().eq('id', id)
        if (error) throw error
      },
      onSuccess: listo,
    }),
  }
}

// ---------- Lado de la contadora ----------

export function useClientas() {
  return useQuery({
    queryKey: CLAVE_CLIENTAS,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('estudio_clientes')
      if (error) throw error
      return (data ?? []) as Clienta[]
    },
  })
}

export async function datosClienta(profesionalId: string): Promise<DatosClienta> {
  const { data, error } = await supabase.rpc('estudio_datos', { p_profesional: profesionalId })
  if (error) throw error
  return data as DatosClienta
}

/** Acepta una invitación. Devuelve el nombre de la profesional. */
export async function aceptarInvitacion(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('estudio_aceptar', { p_token: token })
  if (error) throw error
  return data as string
}

export function useDejarClienta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (profesionalId: string) => {
      const { data: u } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('estudio_vinculos')
        .delete()
        .eq('user_id', profesionalId)
        .eq('contadora_id', u.user?.id ?? '')
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVE_CLIENTAS }),
  })
}
