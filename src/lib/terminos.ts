// Vocabulario según la profesión: "sesión", "consulta" o "clase", tarifa por hora o por sesión/consulta/clase.
// Las tres palabras son femeninas, así que los artículos ("la", "una") no cambian.

export type Termino = 'sesion' | 'consulta' | 'clase'
export type ModoCobro = 'hora' | 'sesion'

export interface Profesion {
  v: string
  l: string
  termino: Termino
  modo: ModoCobro
}

/** Profesiones sugeridas, con la palabra y la forma de cobro más habituales. */
export const PROFESIONES: Profesion[] = [
  { v: 'psicologia', l: 'Psicología', termino: 'sesion', modo: 'hora' },
  { v: 'psicopedagogia', l: 'Psicopedagogía', termino: 'sesion', modo: 'sesion' },
  { v: 'nutricion', l: 'Nutrición', termino: 'consulta', modo: 'sesion' },
  { v: 'kinesiologia', l: 'Kinesiología', termino: 'sesion', modo: 'sesion' },
  { v: 'fonoaudiologia', l: 'Fonoaudiología', termino: 'sesion', modo: 'sesion' },
  { v: 'terapia_ocupacional', l: 'Terapia ocupacional', termino: 'sesion', modo: 'sesion' },
  { v: 'medicina', l: 'Medicina', termino: 'consulta', modo: 'sesion' },
  { v: 'odontologia', l: 'Odontología', termino: 'consulta', modo: 'sesion' },
  { v: 'idiomas', l: 'Clases de idiomas', termino: 'clase', modo: 'hora' },
  { v: 'musica', l: 'Clases de música', termino: 'clase', modo: 'hora' },
  { v: 'otra', l: 'Otra', termino: 'sesion', modo: 'sesion' },
]

export function etiquetaProfesion(v: string | null | undefined): string {
  if (!v) return ''
  return PROFESIONES.find((p) => p.v === v)?.l ?? v
}

export interface Palabras {
  /** "sesión" / "consulta" */
  sesion: string
  /** "sesiones" / "consultas" */
  sesiones: string
  /** "Sesión" / "Consulta" */
  Sesion: string
  /** "Sesiones" / "Consultas" */
  Sesiones: string
  /** Unidad de cobro: "hora", "sesión" o "consulta". */
  unidad: string
  /** "por hora", "por sesión", "por consulta" */
  porUnidad: string
  /** Sufijo corto para montos: "/h", "/sesión", "/consulta" */
  sufijo: string
  /** true si la tarifa es por hora (entonces importa la duración). */
  porHora: boolean
}

const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

export function palabras(termino: Termino = 'sesion', modo: ModoCobro = 'hora'): Palabras {
  const sesion = termino === 'consulta' ? 'consulta' : termino === 'clase' ? 'clase' : 'sesión'
  const sesiones = termino === 'consulta' ? 'consultas' : termino === 'clase' ? 'clases' : 'sesiones'
  const unidad = modo === 'hora' ? 'hora' : sesion
  return {
    sesion,
    sesiones,
    Sesion: capital(sesion),
    Sesiones: capital(sesiones),
    unidad,
    porUnidad: `por ${unidad}`,
    sufijo: modo === 'hora' ? '/h' : `/${sesion}`,
    porHora: modo === 'hora',
  }
}
