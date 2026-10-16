// Modo claro / oscuro. index.html lo aplica antes de pintar; acá se cambia.
export type Tema = 'light' | 'dark'

export function temaActual(): Tema {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function cambiarTema(tema: Tema) {
  document.documentElement.dataset.theme = tema
  try {
    localStorage.setItem('tema', tema)
  } catch {
    // Sin almacenamiento (modo privado): el tema dura hasta recargar.
  }
}

/** Tamaño de letra: 1 (normal) a 5. Todo está en rem, así que la app entera escala. */
export const TAMANOS_LETRA = [
  { n: 1, nombre: 'Normal', escala: '100%' },
  { n: 2, nombre: 'Grande', escala: '112.5%' },
  { n: 3, nombre: 'Más grande', escala: '125%' },
  { n: 4, nombre: 'Muy grande', escala: '137.5%' },
  { n: 5, nombre: 'Enorme', escala: '150%' },
] as const

export function letraActual(): number {
  return Number(preferencia('letra', '1')) || 1
}

export function cambiarLetra(n: number) {
  const t = TAMANOS_LETRA.find((x) => x.n === n) ?? TAMANOS_LETRA[0]
  document.documentElement.style.fontSize = t.n === 1 ? '' : t.escala
  document.documentElement.dataset.letra = String(t.n)
  guardarPreferencia('letra', String(t.n))
}

/** Lee y guarda una preferencia chica del navegador (por ej. el último medio de pago). */
export function preferencia<T extends string>(clave: string, porDefecto: T): T {
  try {
    return (localStorage.getItem(clave) as T | null) ?? porDefecto
  } catch {
    return porDefecto
  }
}

export function guardarPreferencia(clave: string, valor: string) {
  try {
    localStorage.setItem(clave, valor)
  } catch {
    // Ignorar: es solo una comodidad.
  }
}
