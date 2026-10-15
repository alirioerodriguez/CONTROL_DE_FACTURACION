// Piezas de UI compartidas. Los estilos finales se ajustan al diseño.
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

export function Boton({
  variante = 'primario',
  cargando,
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'primario' | 'secundario'; cargando?: boolean }) {
  const estilos =
    variante === 'primario'
      ? 'bg-teal-700 text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500'
      : 'border border-stone-300 text-stone-800 hover:bg-stone-100 dark:border-stone-600 dark:text-stone-100 dark:hover:bg-stone-800'
  return (
    <button
      {...props}
      disabled={props.disabled || cargando}
      className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 font-medium transition disabled:opacity-60 ${estilos} ${className}`}
    >
      {cargando ? 'Un momento…' : children}
    </button>
  )
}

export function Campo({
  etiqueta,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { etiqueta: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">{etiqueta}</span>
      <input
        {...props}
        className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base text-stone-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100"
      />
    </label>
  )
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center text-stone-500" role="status">
      <span className="mr-2 size-4 animate-spin rounded-full border-2 border-stone-300 border-t-teal-600" />
      {texto}
    </div>
  )
}

export function EstadoVacio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center dark:border-stone-700">
      <p className="font-medium text-stone-800 dark:text-stone-200">{titulo}</p>
      {children && <div className="mt-2 text-sm text-stone-500">{children}</div>}
    </div>
  )
}

export function EstadoError({ mensaje, reintentar }: { mensaje: string; reintentar?: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950">
      <p className="text-red-800 dark:text-red-200">{mensaje}</p>
      {reintentar && (
        <Boton variante="secundario" className="mt-3" onClick={reintentar}>
          Reintentar
        </Boton>
      )}
    </div>
  )
}
