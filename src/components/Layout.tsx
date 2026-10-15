import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ChartColumn, FileSpreadsheet, House, Plus, SlidersHorizontal, Upload, Users, type LucideIcon } from 'lucide-react'
import { useRegistro } from '../features/registro/RegistroContext'
import { iniciales } from '../lib/formato'
import { useAuth } from '../features/auth/AuthProvider'
import { usePerfil } from '../lib/datos'
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

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-[34px] place-items-center rounded-[11px] bg-acc">
        <div className="size-3 rounded-full bg-on-acc" />
      </div>
      <div className="font-serif text-[26px]">Consultorio</div>
    </div>
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
  const { session } = useAuth()
  const { data: perfil } = usePerfil()
  const email = session?.user.email ?? ''
  const nombre = perfil?.nombre?.trim() || email
  const conBotonFlotante = ['/', '/pacientes', '/mes'].includes(pathname) && !abierto

  return (
    <div className="min-h-dvh bg-bg text-ink md:flex">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-7 overflow-y-auto border-r border-line bg-surface px-4 pt-7 pb-5 md:flex">
        <div className="px-2">
          <Logo />
        </div>
        <button
          type="button"
          onClick={() => abrir({ modo: 'sesion' })}
          className="flex h-[52px] shrink-0 items-center justify-center gap-2 rounded-full bg-acc text-base font-semibold text-on-acc hover:bg-acc-strong"
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
                className={`flex h-12 items-center gap-3 rounded-[14px] px-3.5 text-base font-semibold ${
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
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-acc-soft text-[15px] font-bold text-acc-strong">
            {iniciales(nombre.split('@')[0])}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold">{perfil?.nombre?.trim() || 'Mi consultorio'}</div>
            <div className="truncate text-[13px] text-ink2">{email}</div>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 [container-type:inline-size]">
        <div className="mx-auto max-w-[1120px] px-5 pt-6 pb-[180px] md:px-12 md:pt-10 md:pb-16">
          <Outlet />
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-line bg-surface px-2 pt-2 pb-[max(22px,env(safe-area-inset-bottom))] md:hidden">
        {SECCIONES.filter((s) => s.enMovil).map((s) => {
          const on = activa(pathname, true) === s.to
          return (
            <NavLink
              key={s.to}
              to={s.to}
              className={`flex h-14 flex-col items-center justify-center gap-1 text-xs font-bold ${on ? 'text-acc-strong' : 'text-ink2'}`}
            >
              <span className={`grid h-[30px] w-[58px] place-items-center rounded-full text-[17px] ${on ? 'bg-acc-soft' : ''}`}>
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
          onClick={() => abrir({ modo: 'sesion' })}
          className="fixed right-[18px] bottom-[calc(102px+env(safe-area-inset-bottom))] z-[21] flex h-[58px] items-center gap-2 rounded-full bg-acc px-[22px] text-[17px] font-semibold text-on-acc shadow-[0_10px_28px_rgba(25,50,38,.28)] hover:bg-acc-strong md:hidden"
        >
          <Plus {...IC} />
          Registrar
        </button>
      )}
    </div>
  )
}
