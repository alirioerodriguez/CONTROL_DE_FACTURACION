import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ChartColumn, FileSpreadsheet, House, Plus, SlidersHorizontal, Upload, Users, type LucideIcon } from 'lucide-react'
import { useRegistro } from '../features/registro/RegistroContext'
import { FotoUsuario, useUsuario } from './FotoUsuario'
import { AvisoPrueba } from './AvisoPrueba'
import { IC } from './ui'

interface Seccion {
  to: string
  etiqueta: string
  corta?: string
  icono: LucideIcon
  enMovil: boolean
}

const SECCIONES: Seccion[] = [
  { to: '/', etiqueta: 'Inicio', icono: House, enMovil: true },
  { to: '/pacientes', etiqueta: 'Pacientes', icono: Users, enMovil: true },
  { to: '/mes', etiqueta: 'Mes y reportes', corta: 'Mes', icono: ChartColumn, enMovil: true },
  { to: '/contadora', etiqueta: 'Contadora', icono: FileSpreadsheet, enMovil: false },
  { to: '/importar', etiqueta: 'Importar', icono: Upload, enMovil: false },
  { to: '/ajustes', etiqueta: 'Ajustes', icono: SlidersHorizontal, enMovil: true },
]

/** Logo de honorapp: "h con tilde de cobro" (grilla 48×48, radio 12). Sigue los colores del tema. */
export function Logo({ tam = 34, conNombre = true }: { tam?: number; conNombre?: boolean }) {
  return (
    <span className="inline-flex items-center" style={{ gap: tam * 0.3 }}>
      <svg
        width={tam}
        height={tam}
        viewBox="0 0 48 48"
        className="shrink-0"
        role={conNombre ? undefined : 'img'}
        aria-hidden={conNombre || undefined}
        aria-label={conNombre ? undefined : 'honorapp'}
      >
        <rect width="48" height="48" rx="12" fill="var(--acc)" />
        <path
          d="M16 10v28M16 27c0-5 3.5-8 7.5-8s7.5 3 7.5 8v6l5-5"
          fill="none"
          stroke="var(--on-acc)"
          strokeWidth={tam < 24 ? 5.5 : 4.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {conNombre && (
        <span className="font-sans leading-none font-bold tracking-[-0.04em] text-ink" style={{ fontSize: tam * 0.7 }}>
          honorapp
        </span>
      )}
    </span>
  )
}

/** Sección activa: la ficha cuenta como Pacientes; en el celular, Importar va con Ajustes y Contadora con Mes. */
function activa(ruta: string, movil: boolean): string {
  if (ruta.startsWith('/pacientes')) return '/pacientes'
  if (movil && ruta.startsWith('/importar')) return '/ajustes'
  if (movil && ruta.startsWith('/contadora')) return '/mes'
  const s = SECCIONES.find((x) => x.to !== '/' && ruta.startsWith(x.to))
  return s ? s.to : '/'
}

export function Layout() {
  const { pathname } = useLocation()
  const { abrir, abierto } = useRegistro()
  const { nombre, email } = useUsuario()
  // Cada pantalla arranca desde arriba.
  // Con llaves: en Chrome nuevo scrollTo devuelve una promesa y React la tomaría como limpieza.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  const conBotonFlotante = ['/', '/pacientes', '/mes'].includes(pathname) && !abierto

  return (
    <div className="min-h-dvh bg-fondo text-ink md:flex">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-7 overflow-y-auto border-r border-line bg-surface px-4 pt-7 pb-5 md:flex">
        <div className="px-2">
          <Logo />
        </div>
        <button
          type="button"
          data-tour="registrar"
          onClick={() => abrir({ modo: 'sesion' })}
          className="flex h-[3.25rem] shrink-0 items-center justify-center gap-2 rounded-full bg-acc text-base font-semibold text-on-acc hover:bg-acc-strong"
        >
          <Plus {...IC} />
          Registrar
        </button>
        <nav className="flex flex-col gap-1">
          {SECCIONES.map((s) => {
            const on = activa(pathname, false) === s.to
            return (
              <NavLink
                key={s.to}
                to={s.to}
                className={`flex h-12 items-center gap-3 rounded-[0.875rem] px-3.5 text-base font-semibold ${
                  on ? 'bg-acc-soft text-acc-strong' : 'text-ink2 hover:bg-surface2'
                }`}
              >
                <s.icono {...IC} />
                {s.etiqueta}
              </NavLink>
            )
          })}
        </nav>
        <div className="flex-1" />
        <div className="flex shrink-0 items-center gap-3 rounded-2xl bg-surface2 p-3">
          <FotoUsuario />
          <div className="min-w-0">
            <div className="truncate text-[0.9375rem] font-semibold">{nombre ?? 'Mi cuenta'}</div>
            <div className="truncate text-[0.8125rem] text-ink2">{email}</div>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 [container-type:inline-size]">
        <div className="mx-auto max-w-[70rem] px-5 pt-6 pb-[11.25rem] md:px-12 md:pt-10 md:pb-16">
          <AvisoPrueba className="mb-6" />
          <Outlet />
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-line bg-surface px-2 pt-2 pb-[max(1.375rem,env(safe-area-inset-bottom))] md:hidden">
        {SECCIONES.filter((s) => s.enMovil).map((s) => {
          const on = activa(pathname, true) === s.to
          return (
            <NavLink
              key={s.to}
              to={s.to}
              className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 py-1 text-[min(0.75rem,1rem)] leading-tight font-bold ${on ? 'text-acc-strong' : 'text-ink2'}`}
            >
              <span className={`grid h-[1.875rem] w-full max-w-[3.625rem] place-items-center rounded-full text-[1.0625rem] ${on ? 'bg-acc-soft' : ''}`}>
                <s.icono {...IC} />
              </span>
              {s.corta ?? s.etiqueta}
            </NavLink>
          )
        })}
      </nav>

      {conBotonFlotante && (
        <button
          type="button"
          data-tour="registrar"
          onClick={() => abrir({ modo: 'sesion' })}
          className="fixed right-[1.125rem] bottom-[calc(6.375rem+env(safe-area-inset-bottom))] z-[21] flex h-[3.625rem] items-center gap-2 rounded-full bg-acc px-[1.375rem] text-[1.0625rem] font-semibold text-on-acc shadow-[0_10px_28px_rgba(25,50,38,.28)] hover:bg-acc-strong md:hidden"
        >
          <Plus {...IC} />
          Registrar
        </button>
      )}
    </div>
  )
}
