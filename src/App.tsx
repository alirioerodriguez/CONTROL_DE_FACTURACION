import { lazy, Suspense } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Spinner } from './components/ui'
import { AjustesPage } from './features/ajustes/AjustesPage'
import { RecordatoriosPage } from './features/recordatorios/RecordatoriosPage'
import { FacturarPage } from './features/reportes/FacturarPage'
import { useAuth } from './features/auth/AuthProvider'
import { LoginPage } from './features/auth/LoginPage'
import { NuevaClavePage } from './features/auth/NuevaClavePage'
import { SegundoPasoPage } from './features/auth/SegundoPasoPage'
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
import { AuthLayout } from './features/auth/AuthLayout'
import { EstudioPage } from './features/estudio/EstudioPage'
import { guardarInvitacion, invitacionPendiente } from './lib/estudio'

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
  const { session, cargando, recuperando, faltaSegundoPaso } = useAuth()
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
  if (session && faltaSegundoPaso) return <SegundoPasoPage />

  if (!session) {
    return (
      <Routes>
        <Route path="/estudio" element={<EstudioIngreso />} />
        <Route path="/registro" element={<RegistroPage />} />
        <Route path="/recuperar" element={<RecuperarPage />} />
        <Route path="/ingresar" element={<LoginPage />} />
        {/* Si volvió de Google con un error, se muestra el ingreso con el aviso. */}
        <Route path="/" element={errorDeRedireccion() ? <LoginPage /> : <PortadaPage />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    )
  }

  // Modo Estudio Contable: el panel de la contadora va aparte, sin el menú de la profesional.
  if (pathname === '/estudio') return <EstudioPage />
  if (invitacionPendiente()) return <Navigate to="/estudio" replace />

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
          <Route path="facturar" element={<FacturarPage />} />
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

/** La contadora abrió el link de invitación sin haber ingresado: se guarda y se le pide entrar o crear su cuenta. */
function EstudioIngreso() {
  const token = new URLSearchParams(window.location.search).get('invitacion')
  if (token) guardarInvitacion(token)
  return (
    <AuthLayout titulo="Te dieron acceso a sus cobros" sub="Una profesional que usa honorapp te comparte sus cobros para que bajes el reporte cuando lo necesites.">
      <p className="text-[1.0625rem] leading-normal text-ink2">
        Es gratis y solo para ver: no podés cambiar nada. Entrá con tu cuenta o creá una (alcanza con tu mail) y queda listo.
      </p>
      <div className="flex flex-col gap-2.5">
        <Link to="/ingresar" className="flex h-[3.25rem] items-center justify-center rounded-full bg-acc font-semibold text-on-acc">
          Ya tengo cuenta: ingresar
        </Link>
        <Link to="/registro" className="flex h-[3.25rem] items-center justify-center rounded-full border border-line font-semibold">
          Crear mi cuenta
        </Link>
      </div>
    </AuthLayout>
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
