import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BellRing, ChartColumn, ChevronRight, Ellipsis, FileSpreadsheet, House, Plus, ReceiptText, SlidersHorizontal, Upload, Users,
  type LucideIcon,
} from 'lucide-react'
import { useRegistro } from '../features/registro/RegistroContext'
import { FotoUsuario, useUsuario } from './FotoUsuario'
import { Hoja, IC } from './ui'
import { usePerfil } from '../lib/datos'

interface Seccion {
  to: string
  etiqueta: string
  corta?: string
  icono: LucideIcon
  enMovil: boolean
  /** Solo si la profesional prendió la función en Ajustes. */
  opcional?: 'ver_recordatorios'
}

const SECCIONES: Seccion[] = [
  { to: '/', etiqueta: 'Inicio', icono: House, enMovil: true },
  { to: '/pacientes', etiqueta: 'Pacientes', icono: Users, enMovil: true },
  { to: '/mes', etiqueta: 'Mes y reportes', corta: 'Mes', icono: ChartColumn, enMovil: true },
  { to: '/recordatorios', etiqueta: 'Recordatorios', icono: BellRing, enMovil: false, opcional: 'ver_recordatorios' },
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

/** En el celular, lo que no entra en la barra de abajo va en «Más». */
const EN_MAS: { to: string; etiqueta: string; ayuda: string; icono: LucideIcon; opcional?: 'ver_recordatorios' }[] = [
  { to: '/contadora', etiqueta: 'Contadora', ayuda: 'Reporte de cobros en Excel o PDF', icono: FileSpreadsheet },
  { to: '/facturar', etiqueta: 'Para facturar', ayuda: 'Pagos sin factura y datos para ARCA', icono: ReceiptText },
  { to: '/recordatorios', etiqueta: 'Recordatorios', ayuda: 'Quién te debe y a quién ya le escribiste', icono: BellRing, opcional: 'ver_recordatorios' },
  { to: '/importar', etiqueta: 'Importar', ayuda: 'Subir una planilla de Excel o CSV', icono: Upload },
]

/** Sección activa: la ficha cuenta como Pacientes; en el celular, lo que va en «Más» marca «Más». */
function activa(ruta: string, movil: boolean): string {
  if (ruta.startsWith('/pacientes')) return '/pacientes'
  if (movil && EN_MAS.some((x) => ruta.startsWith(x.to))) return 'mas'
  if (ruta.startsWith('/facturar')) return '/contadora'
  const s = SECCIONES.find((x) => x.to !== '/' && ruta.startsWith(x.to))
  return s ? s.to : '/'
}

export function Layout() {
  const { pathname } = useLocation()
  const { abrir, abierto } = useRegistro()
  const { nombre, email } = useUsuario()
  const { data: perfil } = usePerfil()
  const secciones = SECCIONES.filter((s) => !s.opcional || perfil?.[s.opcional])
  const navegar = useNavigate()
  const [mas, setMas] = useState(false)
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
          className="presionable flex h-[3.25rem] shrink-0 items-center justify-center gap-2 rounded-full bg-acc text-base font-semibold text-on-acc hover:bg-acc-strong"
        >
          <Plus {...IC} />
          Registrar
        </button>
        <nav className="flex flex-col gap-1">
          {secciones.map((s) => {
            const on = activa(pathname, false) === s.to
            return (
              <NavLink
                key={s.to}
                to={s.to}
                className={`presionable flex h-12 items-center gap-3 rounded-[0.875rem] px-3.5 text-base font-semibold ${
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
          {/* Con key: cada pantalla nueva entra con su animación. */}
          <div key={pathname} className="anim-pantalla">
            <Outlet />
          </div>
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-surface px-2 pt-2 pb-[max(1.375rem,env(safe-area-inset-bottom))] md:hidden">
        {SECCIONES.filter((s) => s.enMovil).map((s) => {
          const on = activa(pathname, true) === s.to
          return (
            <NavLink
              key={s.to}
              to={s.to}
              className={`presionable flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 py-1 text-[min(0.75rem,13px)] leading-tight font-bold ${on ? 'text-acc-strong' : 'text-ink2'}`}
            >
              <span className={`grid h-[1.875rem] w-full max-w-[3.625rem] place-items-center rounded-full text-[1.0625rem] transition-colors duration-200 ${on ? 'bg-acc-soft' : ''}`}>
                <s.icono {...IC} />
              </span>
              {s.corta ?? s.etiqueta}
            </NavLink>
          )
        })}
        <button
          type="button"
          onClick={() => setMas(true)}
          className={`presionable flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 py-1 text-[min(0.75rem,13px)] leading-tight font-bold ${activa(pathname, true) === 'mas' ? 'text-acc-strong' : 'text-ink2'}`}
        >
          <span
            className={`grid h-[1.875rem] w-full max-w-[3.625rem] place-items-center rounded-full text-[1.0625rem] ${activa(pathname, true) === 'mas' ? 'bg-acc-soft' : ''}`}
          >
            <Ellipsis {...IC} />
          </span>
          Más
        </button>
      </nav>

      {mas && (
        <Hoja titulo="Más" onCerrar={() => setMas(false)}>
          <div className="escalonado flex flex-col">
            {EN_MAS.filter((x) => !x.opcional || perfil?.[x.opcional]).map((x) => (
              <button
                key={x.to}
                type="button"
                onClick={() => {
                  setMas(false)
                  navegar(x.to)
                }}
                className="presionable flex min-h-16 items-center gap-3 border-b border-line bg-transparent px-1 py-3 text-left last:border-b-0"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-[0.875rem] bg-acc-soft text-acc-strong">
                  <x.icono {...IC} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold">{x.etiqueta}</span>
                  <span className="block text-sm text-ink2">{x.ayuda}</span>
                </span>
                <ChevronRight {...IC} className="shrink-0 text-ink2" />
              </button>
            ))}
          </div>
        </Hoja>
      )}

      {conBotonFlotante && (
        <button
          type="button"
          data-tour="registrar"
          onClick={() => abrir({ modo: 'sesion' })}
          className="presionable anim-saltito fixed right-[1.125rem] bottom-[calc(6.375rem+env(safe-area-inset-bottom))] z-[21] flex h-[3.625rem] items-center gap-2 rounded-full bg-acc px-[1.375rem] text-[1.0625rem] font-semibold text-on-acc shadow-[0_10px_28px_rgba(25,50,38,.28)] hover:bg-acc-strong md:hidden"
        >
          <Plus {...IC} />
          Registrar
        </button>
      )}
    </div>
  )
}
