/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { usePalabras } from '../../components/usePalabras'
import { mensajeError, supabase } from '../../lib/supabase'
import { guardarPreferencia, letraActual } from '../../lib/tema'
import type { Encuesta, EstadoEjercicio, FilaPrueba, ResultadoEjercicio } from './analisis'
import { armarEjercicios, nombrePantalla, type Ejercicio } from './ejercicios'
import { BarraPrueba } from './BarraPrueba'

/** En qué está la persona dentro de un ejercicio. */
export type Fase = 'listo' | 'corriendo' | 'calificando'

interface Activo {
  id: string
  fase: Fase
  /** Cómo le fue, elegido al terminar (antes de calificar). */
  estado?: 'logrado' | 'no_pude'
}

/** Cronómetro de un ejercicio: tiempo activo y tiempo por pantalla. Se guarda en el navegador por si se recarga. */
interface Cronometro {
  acumulado: number
  activoDesde: number | null
  pantalla: string
  pantallaDesde: number | null
  pantallas: Record<string, number>
}

interface ContextoPrueba {
  fila: FilaPrueba | null
  cargando: boolean
  ejercicios: Ejercicio[]
  activo: Activo | null
  /** Ejercicio en curso o por empezar. */
  ejercicio: Ejercicio | null
  numero: number
  msActual: () => number
  crear: (nombre: string) => Promise<void>
  empezar: (id: string) => void
  terminar: (estado: 'logrado' | 'no_pude') => void
  calificar: (dificultad: number, comentario: string) => Promise<void>
  saltear: () => Promise<void>
  continuar: () => void
  salir: () => void
  guardarEncuesta: (encuesta: Encuesta) => Promise<void>
}

const Ctx = createContext<ContextoPrueba | null>(null)
const CLAVE = ['prueba'] as const

export function usePrueba() {
  const c = useContext(Ctx)
  if (!c) throw new Error('usePrueba fuera de PruebaProvider')
  return c
}

function leerJSON<T>(clave: string): T | null {
  try {
    const v = localStorage.getItem(clave)
    return v ? (JSON.parse(v) as T) : null
  } catch {
    return null
  }
}

export function PruebaProvider({ children }: { children: ReactNode }) {
  const pal = usePalabras()
  const ejercicios = useMemo(() => armarEjercicios(pal), [pal])
  const navegar = useNavigate()
  const { pathname } = useLocation()
  const qc = useQueryClient()

  const consulta = useQuery({
    queryKey: CLAVE,
    queryFn: async (): Promise<FilaPrueba | null> => {
      const { data, error } = await supabase.from('pruebas').select('*').maybeSingle()
      if (error) throw error
      return (data as FilaPrueba | null) ?? null
    },
  })
  const fila = consulta.data ?? null

  const [activo, setActivoEstado] = useState<Activo | null>(() => leerJSON<Activo>('prueba-activa'))
  const setActivo = useCallback((a: Activo | null) => {
    setActivoEstado(a)
    guardarPreferencia('prueba-activa', a ? JSON.stringify(a) : '')
  }, [])

  const crono = useRef<Cronometro | null>(leerJSON<Cronometro>('prueba-crono'))
  const guardarCrono = () => guardarPreferencia('prueba-crono', crono.current ? JSON.stringify(crono.current) : '')

  // Al recargar en medio de un ejercicio: se retoma desde lo acumulado.
  useEffect(() => {
    const c = crono.current
    if (activo?.fase === 'corriendo' && c) {
      const ahora = Date.now()
      c.activoDesde = document.hidden ? null : ahora
      c.pantallaDesde = document.hidden ? null : ahora
      c.pantalla = nombrePantalla(window.location.pathname)
    }
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Los pasos de menos de un segundo (por ejemplo, al arrancar) no cuentan como visita a una pantalla.
  function sumarPantalla(c: Cronometro, ahora: number) {
    if (c.pantallaDesde == null) return
    const ms = ahora - c.pantallaDesde
    if (ms >= 1000 || c.pantallas[c.pantalla]) c.pantallas[c.pantalla] = (c.pantallas[c.pantalla] ?? 0) + ms
  }

  function cerrarTramo(c: Cronometro, ahora: number) {
    if (c.activoDesde != null) c.acumulado += ahora - c.activoDesde
    sumarPantalla(c, ahora)
    c.activoDesde = null
    c.pantallaDesde = null
  }

  // Cambio de pantalla: se suma el tiempo a la anterior.
  useEffect(() => {
    const c = crono.current
    if (activo?.fase !== 'corriendo' || !c) return
    const ahora = Date.now()
    const nueva = nombrePantalla(pathname)
    if (nueva === c.pantalla) return
    sumarPantalla(c, ahora)
    c.pantalla = nueva
    c.pantallaDesde = document.hidden ? null : ahora
    guardarCrono()
  }, [pathname, activo?.fase])

  // App en segundo plano (por ejemplo, abrió WhatsApp): el reloj se pausa.
  useEffect(() => {
    const cambio = () => {
      const c = crono.current
      if (activo?.fase !== 'corriendo' || !c) return
      const ahora = Date.now()
      if (document.hidden) cerrarTramo(c, ahora)
      else {
        c.activoDesde = ahora
        c.pantallaDesde = ahora
      }
      guardarCrono()
    }
    document.addEventListener('visibilitychange', cambio)
    return () => document.removeEventListener('visibilitychange', cambio)
  }, [activo?.fase])

  const msActual = useCallback(() => {
    const c = crono.current
    if (!c) return 0
    return c.acumulado + (c.activoDesde != null ? Date.now() - c.activoDesde : 0)
  }, [])

  async function guardarEjercicio(id: string, resultado: ResultadoEjercicio) {
    if (!fila) return
    const ejerciciosNuevos = { ...fila.ejercicios, [id]: resultado }
    qc.setQueryData(CLAVE, { ...fila, ejercicios: ejerciciosNuevos })
    const { error } = await supabase.from('pruebas').update({ ejercicios: ejerciciosNuevos }).eq('id', fila.id)
    if (error) {
      toast.error(`No se pudo guardar el resultado: ${mensajeError(error)}`)
      throw error
    }
  }

  function siguiente(desdeId: string, hechos: Record<string, unknown>): Ejercicio | null {
    const i = ejercicios.findIndex((e) => e.id === desdeId)
    const resto = [...ejercicios.slice(i + 1), ...ejercicios.slice(0, i + 1)]
    return resto.find((e) => !hechos[e.id] || (hechos[e.id] as ResultadoEjercicio).estado === 'en_curso') ?? null
  }

  function avanzar(desdeId: string, hechos: Record<string, ResultadoEjercicio>) {
    const prox = siguiente(desdeId, hechos)
    crono.current = null
    guardarCrono()
    if (prox) setActivo({ id: prox.id, fase: 'listo' })
    else {
      setActivo(null)
      navegar('/pruebas')
      toast.success('¡Terminaste todos los ejercicios! Falta una encuesta cortita.')
    }
  }

  const valor: ContextoPrueba = {
    fila,
    cargando: consulta.isPending,
    ejercicios,
    activo,
    ejercicio: activo ? (ejercicios.find((e) => e.id === activo.id) ?? null) : null,
    numero: activo ? ejercicios.findIndex((e) => e.id === activo.id) + 1 : 0,
    msActual,

    async crear(nombre) {
      const { data, error } = await supabase
        .from('pruebas')
        .insert({
          nombre: nombre.trim() || null,
          dispositivo: window.innerWidth < 720 ? 'celular' : 'compu',
          ancho: window.innerWidth,
          letra: letraActual(),
        })
        .select('*')
        .single()
      if (error) {
        toast.error(`No se pudo empezar: ${mensajeError(error)}`)
        return
      }
      qc.setQueryData(CLAVE, data)
      setActivo({ id: ejercicios[0].id, fase: 'listo' })
    },

    empezar(id) {
      const ej = ejercicios.find((e) => e.id === id)
      if (!ej) return
      navegar(ej.inicio)
      const ahora = Date.now()
      crono.current = { acumulado: 0, activoDesde: ahora, pantalla: nombrePantalla(ej.inicio), pantallaDesde: ahora, pantallas: {} }
      guardarCrono()
      setActivo({ id, fase: 'corriendo' })
      if (fila) {
        void guardarEjercicio(id, { estado: 'en_curso', ms: 0, inicio: new Date().toISOString(), pantallas: {} }).catch(() => {})
      }
    },

    terminar(estado) {
      if (!activo || !crono.current) return
      cerrarTramo(crono.current, Date.now())
      guardarCrono()
      setActivo({ ...activo, fase: 'calificando', estado })
    },

    async calificar(dificultad, comentario) {
      if (!activo?.estado || !fila) return
      const c = crono.current
      const resultado: ResultadoEjercicio = {
        estado: activo.estado as EstadoEjercicio,
        ms: Math.round(c?.acumulado ?? 0),
        inicio: fila.ejercicios[activo.id]?.inicio ?? new Date().toISOString(),
        fin: new Date().toISOString(),
        dificultad,
        comentario: comentario.trim() || undefined,
        pantallas: Object.fromEntries(Object.entries(c?.pantallas ?? {}).map(([k, v]) => [k, Math.round(v)])),
      }
      try {
        await guardarEjercicio(activo.id, resultado)
      } catch {
        return
      }
      toast.success('Guardado')
      avanzar(activo.id, { ...fila.ejercicios, [activo.id]: resultado })
    },

    async saltear() {
      if (!activo || !fila) return
      const resultado: ResultadoEjercicio = {
        estado: 'salteado',
        ms: Math.round(msActual()),
        inicio: fila.ejercicios[activo.id]?.inicio ?? new Date().toISOString(),
        fin: new Date().toISOString(),
        pantallas: {},
      }
      try {
        await guardarEjercicio(activo.id, resultado)
      } catch {
        return
      }
      avanzar(activo.id, { ...fila.ejercicios, [activo.id]: resultado })
    },

    continuar() {
      if (!fila) return
      const prox = ejercicios.find((e) => !fila.ejercicios[e.id] || fila.ejercicios[e.id].estado === 'en_curso')
      if (prox) setActivo({ id: prox.id, fase: 'listo' })
    },

    salir() {
      crono.current = null
      guardarCrono()
      setActivo(null)
      navegar('/pruebas')
    },

    async guardarEncuesta(encuesta) {
      if (!fila) return
      const { error } = await supabase.from('pruebas').update({ encuesta, terminado: true }).eq('id', fila.id)
      if (error) {
        toast.error(`No se pudo guardar la encuesta: ${mensajeError(error)}`)
        return
      }
      qc.setQueryData(CLAVE, { ...fila, encuesta, terminado: true })
      toast.success('¡Gracias! Tus respuestas quedaron guardadas.')
    },
  }

  // Si la fila desapareció (por ejemplo, se borró la cuenta de pruebas), se apaga el modo prueba.
  useEffect(() => {
    if (!consulta.isPending && !fila && activo) setActivo(null)
  }, [consulta.isPending, fila, activo, setActivo])

  return (
    <Ctx.Provider value={valor}>
      {children}
      {activo && fila && <BarraPrueba />}
    </Ctx.Provider>
  )
}

