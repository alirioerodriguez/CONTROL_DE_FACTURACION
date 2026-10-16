// Piezas de UI compartidas, con las medidas del diseño (docs/diseno).
import { useEffect, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { CircleAlert, RefreshCw, X, type LucideIcon } from 'lucide-react'
import { iniciales, partesMonto, type Moneda } from '../lib/formato'

/** Tamaño y trazo de íconos del diseño. */
export const IC = { size: '1.25em', strokeWidth: 1.8 } as const

export function Spinner({ className = 'size-[18px]' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
    />
  )
}

type Variante = 'primario' | 'suave' | 'borde' | 'texto' | 'peligro'

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-acc text-on-acc hover:bg-acc-strong',
  suave: 'bg-surface2 text-ink hover:bg-line',
  borde: 'border border-line bg-surface text-ink hover:bg-surface2',
  texto: 'bg-transparent text-acc-strong hover:bg-surface2',
  peligro: 'bg-bad-soft text-bad hover:brightness-95',
}

export function Boton({
  variante = 'primario',
  alto = 'h-[52px]',
  icono: Icono,
  cargando,
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante
  alto?: string
  icono?: LucideIcon
  cargando?: boolean
}) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || cargando}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 text-base font-semibold whitespace-nowrap transition-colors disabled:opacity-45 ${alto} ${VARIANTES[variante]} ${className}`}
    >
      {cargando ? <Spinner /> : Icono && <Icono {...IC} />}
      {children}
    </button>
  )
}

const claseInput =
  'h-[52px] w-full rounded-[14px] border border-line bg-fondo px-4 text-[17px] outline-none transition focus:border-acc focus:shadow-[0_0_0_3px_var(--acc-soft)]'

export function Campo({
  etiqueta,
  opcional,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; opcional?: boolean }) {
  return (
    <label className={`flex flex-col gap-2 text-[15px] font-semibold ${className}`}>
      <span>
        {etiqueta}
        {opcional && <span className="ml-2 text-sm font-normal text-ink2">Opcional</span>}
      </span>
      <input {...props} className={`${claseInput} font-normal`} />
    </label>
  )
}

/** Campo de monto grande, con el símbolo de la moneda adelante. */
export function CampoMonto({
  simbolo,
  valor,
  onCambio,
  grande,
  autoFocus,
  etiqueta = 'Monto',
}: {
  simbolo: string
  valor: string
  onCambio: (v: string) => void
  grande?: boolean
  autoFocus?: boolean
  etiqueta?: string
}) {
  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-line bg-fondo px-[18px] focus-within:border-acc ${grande ? 'h-[62px]' : 'h-14'}`}
    >
      <span className={`font-medium text-ink2 ${grande ? 'text-[22px]' : 'text-xl'}`}>{simbolo}</span>
      <input
        aria-label={etiqueta}
        inputMode="decimal"
        autoFocus={autoFocus}
        value={valor}
        placeholder="0"
        size={1}
        onChange={(e) => onCambio(e.target.value.replace(/[^\d.,]/g, ''))}
        className={`num w-full min-w-0 flex-1 border-none bg-transparent outline-none ${grande ? 'text-[30px]' : 'text-[22px]'}`}
      />
    </div>
  )
}

export interface Opcion<T> {
  v: T
  l: string
}

/** Control segmentado (pastilla con opciones), como en el diseño. */
export function Segmentado<T extends string | number | boolean>({
  opciones,
  valor,
  onCambio,
  className = '',
  alto = 'h-[42px]',
  redondeo = 'rounded-full',
}: {
  opciones: Opcion<T>[]
  valor: T
  onCambio: (v: T) => void
  className?: string
  alto?: string
  redondeo?: string
}) {
  return (
    <div role="radiogroup" className={`flex gap-1 bg-surface2 p-1 ${redondeo} ${className}`}>
      {opciones.map((o) => {
        const activo = o.v === valor
        return (
          <button
            key={String(o.v)}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => onCambio(o.v)}
            className={`flex-1 px-1.5 text-[15px] font-semibold whitespace-nowrap ${alto} ${redondeo} ${
              activo ? 'bg-surface text-ink shadow-[0_1px_3px_rgba(0,0,0,.14)]' : 'text-ink2'
            }`}
          >
            {o.l}
          </button>
        )
      })}
    </div>
  )
}

/** Pastilla de filtro o de elección rápida (Hoy, Ayer, Deben…). */
export function Pastilla({
  activa,
  children,
  onClick,
  alto = 'h-10',
}: {
  activa: boolean
  children: ReactNode
  onClick: () => void
  alto?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={activa}
      onClick={onClick}
      className={`shrink-0 rounded-full border px-4 text-[15px] font-semibold whitespace-nowrap ${alto} ${
        activa ? 'border-ink bg-ink text-fondo' : 'border-line bg-surface text-ink'
      }`}
    >
      {children}
    </button>
  )
}

export function Avatar({ nombre, className = 'size-[46px] text-[15px]' }: { nombre: string; className?: string }) {
  return (
    <div className={`grid shrink-0 place-items-center rounded-full bg-acc-soft font-bold text-acc-strong ${className}`}>
      {iniciales(nombre)}
    </div>
  )
}

export type Tono = 'ok' | 'parcial' | 'mal' | 'neutro'

const TONOS: Record<Tono, string> = {
  ok: 'bg-acc-soft text-acc-strong',
  parcial: 'bg-warn-soft text-warn',
  mal: 'bg-bad-soft text-bad',
  neutro: 'bg-surface2 text-ink2',
}

export function Chip({ tono, children, grande }: { tono: Tono; children: ReactNode; grande?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full whitespace-nowrap tabular ${TONOS[tono]} ${
        grande ? 'h-[30px] px-3 text-sm font-semibold' : 'h-[22px] px-[9px] text-xs font-bold'
      }`}
    >
      {children}
    </span>
  )
}

export function Tarjeta({ children, className = '', ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div {...props} className={`rounded-[22px] border border-line bg-surface ${className}`}>
      {children}
    </div>
  )
}

export function Titulo({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div>
      <h1 className="m-0 font-serif text-[clamp(38px,5cqi,52px)] leading-none font-normal">{children}</h1>
      {sub && <div className="mt-2 text-[15px] text-ink2">{sub}</div>}
    </div>
  )
}

/** Monto grande con los centavos más chicos. */
export function MontoGrande({
  monto,
  moneda,
  className = 'text-[clamp(30px,3.4cqi,42px)]',
  colorDecimales = 'text-ink2',
}: {
  monto: number
  moneda: Moneda
  className?: string
  colorDecimales?: string
}) {
  const p = partesMonto(monto, moneda)
  return (
    <div className={`num ${className}`}>
      {p.entero}
      {p.decimales && <span className={`text-[.55em] tracking-normal ${colorDecimales}`}>{p.decimales}</span>}
    </div>
  )
}

export function Alerta({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-[14px] bg-bad-soft px-3.5 py-3 text-[15px] leading-snug text-bad">
      <CircleAlert {...IC} className="mt-px" />
      <span>{children}</span>
    </div>
  )
}

export function EstadoVacio({
  icono: Icono,
  titulo,
  children,
  acciones,
}: {
  icono: LucideIcon
  titulo: string
  children?: ReactNode
  acciones?: ReactNode
}) {
  return (
    <Tarjeta className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="grid size-16 place-items-center rounded-[20px] bg-acc-soft text-[28px] text-acc-strong">
        <Icono {...IC} />
      </div>
      <div className="font-serif text-[34px] leading-tight">{titulo}</div>
      {children && <div className="max-w-[380px] text-[17px] leading-normal text-ink2">{children}</div>}
      {acciones && <div className="mt-2 flex flex-wrap justify-center gap-2">{acciones}</div>}
    </Tarjeta>
  )
}

export function EstadoError({ que, reintentar }: { que: string; reintentar: () => void }) {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="flex max-w-[440px] flex-col items-center gap-3.5 px-2 py-10 text-center">
        <div className="grid size-16 place-items-center rounded-[20px] bg-bad-soft text-[28px] text-bad">
          <CircleAlert {...IC} />
        </div>
        <div className="font-serif text-[34px] leading-tight text-balance">No pudimos cargar {que}</div>
        <div className="text-[17px] leading-normal text-ink2">Revisá tu conexión a internet. Tus datos están a salvo.</div>
        <Boton icono={RefreshCw} onClick={reintentar} className="mt-2">
          Reintentar
        </Boton>
      </div>
    </div>
  )
}

/** Esqueleto de carga: título, tarjetas opcionales y una lista. */
export function Esqueleto({ que, tarjetas }: { que: string; tarjetas?: boolean }) {
  return (
    <div aria-busy="true" className="flex flex-col gap-5">
      <div className="esqueleto h-11 w-[220px] rounded-xl" />
      {tarjetas && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
          {[1, 2, 3, 4].map((k) => (
            <div key={k} className="flex h-[122px] flex-col gap-3.5 rounded-[22px] border border-line bg-surface p-[18px]">
              <div className="esqueleto h-3.5 w-3/5 rounded-lg" />
              <div className="esqueleto h-[30px] w-[85%] rounded-[10px]" />
            </div>
          ))}
        </div>
      )}
      <Tarjeta className="p-2">
        {[1, 2, 3, 4, 5].map((k) => (
          <div key={k} className="flex items-center gap-3.5 p-3.5">
            <div className="esqueleto size-11 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="esqueleto h-3.5 w-[45%] rounded-lg" />
              <div className="esqueleto h-3 w-[28%] rounded-lg" />
            </div>
            <div className="esqueleto h-7 w-[90px] rounded-full" />
          </div>
        ))}
      </Tarjeta>
      <div className="flex items-center gap-2.5 text-[15px] text-ink2">
        <Spinner className="size-4" />
        Cargando {que}…
      </div>
    </div>
  )
}

/**
 * Panel que sube desde abajo en el celular y aparece centrado en desktop.
 */
export function Hoja({
  titulo,
  onCerrar,
  children,
  ancho = 'md:w-[540px]',
}: {
  titulo: string
  onCerrar: () => void
  children: ReactNode
  ancho?: string
}) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    document.addEventListener('keydown', tecla)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', tecla)
      document.body.style.overflow = overflow
    }
  }, [onCerrar])

  return (
    <div
      onClick={onCerrar}
      className="fixed inset-0 z-30 flex items-end justify-center bg-[rgba(12,18,15,.42)] md:items-center md:p-6"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[92dvh] w-full flex-col gap-[18px] overflow-auto rounded-t-[28px] bg-surface px-[22px] pt-3 pb-[max(28px,env(safe-area-inset-bottom))] shadow-[0_24px_60px_rgba(0,0,0,.25)] md:rounded-[28px] md:px-8 md:pt-7 md:pb-8 ${ancho}`}
      >
        <div className="h-[5px] w-11 self-center rounded-full bg-line md:hidden" />
        <div className="flex items-center justify-between gap-3">
          <h2 className="m-0 font-serif text-[34px] leading-none font-normal">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-surface2 hover:bg-line"
          >
            <X {...IC} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Diálogo de confirmación para acciones que no se pueden deshacer. */
export function Confirmar({
  titulo,
  children,
  textoConfirmar,
  onConfirmar,
  onCancelar,
  cargando,
  peligroso = true,
}: {
  titulo: string
  children: ReactNode
  textoConfirmar: string
  onConfirmar: () => void
  onCancelar: () => void
  cargando?: boolean
  peligroso?: boolean
}) {
  return (
    <Hoja titulo={titulo} onCerrar={onCancelar} ancho="md:w-[440px]">
      <div className="text-[17px] leading-normal text-ink2">{children}</div>
      <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
        <Boton variante="suave" onClick={onCancelar}>
          Cancelar
        </Boton>
        <Boton variante={peligroso ? 'peligro' : 'primario'} cargando={cargando} onClick={onConfirmar}>
          {textoConfirmar}
        </Boton>
      </div>
    </Hoja>
  )
}
