import { NavLink, Outlet } from 'react-router-dom'

const SECCIONES = [
  { to: '/', etiqueta: 'Inicio', icono: '⌂' },
  { to: '/pacientes', etiqueta: 'Pacientes', icono: '☺' },
  { to: '/reporte', etiqueta: 'Reporte', icono: '▤' },
  { to: '/ajustes', etiqueta: 'Ajustes', icono: '⚙' },
]

const claseLink = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? 'text-teal-700 dark:text-teal-400 font-semibold'
    : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'

/** Barra lateral en desktop, barra inferior en el celular. */
export function Layout() {
  return (
    <div className="min-h-dvh bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100 md:flex">
      <aside className="hidden w-56 shrink-0 border-r border-stone-200 p-5 dark:border-stone-800 md:block">
        <p className="mb-8 text-lg font-semibold text-teal-700 dark:text-teal-400">Consultorio</p>
        <nav className="flex flex-col gap-1">
          {SECCIONES.map((s) => (
            <NavLink key={s.to} to={s.to} end={s.to === '/'} className={(e) => `rounded-lg px-3 py-2 ${claseLink(e)}`}>
              <span className="mr-2" aria-hidden>{s.icono}</span>
              {s.etiqueta}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6 md:px-8 md:pb-10">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-stone-800 dark:bg-stone-900/95 md:hidden">
        {SECCIONES.map((s) => (
          <NavLink key={s.to} to={s.to} end={s.to === '/'} className={(e) => `flex flex-col items-center py-2 text-xs ${claseLink(e)}`}>
            <span className="text-lg" aria-hidden>{s.icono}</span>
            {s.etiqueta}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
