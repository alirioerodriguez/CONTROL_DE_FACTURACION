import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { EnConstruccion } from './components/EnConstruccion'
import { Layout } from './components/Layout'
import { Spinner } from './components/ui'
import { AjustesPage } from './features/ajustes/AjustesPage'
import { useAuth } from './features/auth/AuthProvider'
import { LoginPage } from './features/auth/LoginPage'
import { NuevaClavePage } from './features/auth/NuevaClavePage'
import { RecuperarPage } from './features/auth/RecuperarPage'
import { RegistroPage } from './features/auth/RegistroPage'
import { PrivacidadPage, TerminosPage } from './features/legal/LegalPage'
import { InicioPage } from './features/inicio/InicioPage'
import { FichaPage } from './features/pacientes/FichaPage'
import { PacientesPage } from './features/pacientes/PacientesPage'
import { RegistroProvider } from './features/registro/RegistroContext'
import { supabaseConfigurado } from './lib/supabase'

export default function App() {
  const { session, cargando, recuperando } = useAuth()
  const { pathname } = useLocation()

  // Páginas públicas: se ven con o sin sesión (Google las pide para publicar el ingreso).
  if (pathname === '/privacidad') return <PrivacidadPage />
  if (pathname === '/terminos') return <TerminosPage />

  if (!supabaseConfigurado) return <FaltaConfiguracion />
  if (cargando) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg text-acc">
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
        <Route path="*" element={<LoginPage />} />
      </Routes>
    )
  }

  return (
    <RegistroProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<InicioPage />} />
          <Route path="pacientes" element={<PacientesPage />} />
          <Route path="pacientes/:id" element={<FichaPage />} />
          <Route path="mes" element={<EnConstruccion titulo="Reporte del mes" fase={5} />} />
          <Route path="contadora" element={<EnConstruccion titulo="Reporte para contadora" fase={5} />} />
          <Route path="importar" element={<EnConstruccion titulo="Importar planilla" fase={4} />} />
          <Route path="ajustes" element={<AjustesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
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
