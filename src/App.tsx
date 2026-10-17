import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Spinner } from './components/ui'
import { AjustesPage } from './features/ajustes/AjustesPage'
import { RecordatoriosPage } from './features/recordatorios/RecordatoriosPage'
import { useAuth } from './features/auth/AuthProvider'
import { LoginPage } from './features/auth/LoginPage'
import { NuevaClavePage } from './features/auth/NuevaClavePage'
import { RecuperarPage } from './features/auth/RecuperarPage'
import { RegistroPage } from './features/auth/RegistroPage'
import { InicioPage } from './features/inicio/InicioPage'
import { FichaPage } from './features/pacientes/FichaPage'
import { PacientesPage } from './features/pacientes/PacientesPage'
import { TutorialProvider } from './features/tutorial/Tutorial'
import { RegistroProvider } from './features/registro/RegistroContext'
import { PruebaProvider } from './features/pruebas/PruebaContext'
import { PruebasPage } from './features/pruebas/PruebasPage'
import { PortadaPage } from './features/portada/PortadaPage'
import { errorDeRedireccion } from './features/auth/AuthLayout'
import { supabaseConfigurado } from './lib/supabase'

const ImportarPage = lazy(() => import('./features/importar/ImportarPage').then((m) => ({ default: m.ImportarPage })))
const MesPage = lazy(() => import('./features/reportes/MesPage').then((m) => ({ default: m.MesPage })))
const ContadoraPage = lazy(() => import('./features/reportes/ContadoraPage').then((m) => ({ default: m.ContadoraPage })))
const ResultadosPage = lazy(() => import('./features/pruebas/ResultadosPage').then((m) => ({ default: m.ResultadosPage })))
const PrivacidadPage = lazy(() => import('./features/legal/LegalPage').then((m) => ({ default: m.PrivacidadPage })))
const TerminosPage = lazy(() => import('./features/legal/LegalPage').then((m) => ({ default: m.TerminosPage })))

const cargandoPantalla = (
  <div className="grid min-h-[50vh] place-items-center text-acc">
    <Spinner className="size-7 border-[3px]" />
  </div>
)

export default function App() {
  const { session, cargando, recuperando } = useAuth()
  const { pathname } = useLocation()

  // Páginas públicas: se ven con o sin sesión (Google las pide para publicar el ingreso).
  if (pathname === '/privacidad' || pathname === '/terminos') {
    return <Suspense fallback={cargandoPantalla}>{pathname === '/privacidad' ? <PrivacidadPage /> : <TerminosPage />}</Suspense>
  }

  if (!supabaseConfigurado) return <FaltaConfiguracion />
  if (cargando) {
    return (
      <div className="grid min-h-dvh place-items-center bg-fondo text-acc">
        <Spinner className="size-7 border-[3px]" />
      </div>
    )
  }
  if (recuperando) return <NuevaClavePage />

  if (!session) {
    return (
      <Routes>
        <Route path="/registro" element={<RegistroPage />} />
        <Route path="/recuperar" element={<RecuperarPage />} />
        <Route path="/ingresar" element={<LoginPage />} />
        {/* Si volvió de Google con un error, se muestra el ingreso con el aviso. */}
        <Route path="/" element={errorDeRedireccion() ? <LoginPage /> : <PortadaPage />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    )
  }

  return (
    <RegistroProvider>
      <TutorialProvider>
      <PruebaProvider>
      <Suspense fallback={cargandoPantalla}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<InicioPage />} />
          <Route path="pacientes" element={<PacientesPage />} />
          <Route path="pacientes/:id" element={<FichaPage />} />
          <Route path="mes" element={<MesPage />} />
          <Route path="contadora" element={<ContadoraPage />} />
          <Route path="importar" element={<ImportarPage />} />
          <Route path="recordatorios" element={<RecordatoriosPage />} />
          <Route path="ajustes" element={<AjustesPage />} />
          <Route path="pruebas" element={<PruebasPage />} />
          <Route path="pruebas/resultados" element={<ResultadosPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      </Suspense>
      </PruebaProvider>
      </TutorialProvider>
    </RegistroProvider>
  )
}

function FaltaConfiguracion() {
  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="mb-3 font-serif text-3xl font-normal">Falta configurar Supabase</h1>
      <p className="text-ink2">
        Copiá <code>.env.example</code> como <code>.env</code> y completá <code>VITE_SUPABASE_URL</code> y{' '}
        <code>VITE_SUPABASE_ANON_KEY</code>. En Vercel, cargalas en Settings → Environment Variables.
      </p>
    </main>
  )
}
