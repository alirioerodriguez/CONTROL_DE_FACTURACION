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
