import { Navigate, Route, Routes } from 'react-router-dom'
import { EnConstruccion } from './components/EnConstruccion'
import { Layout } from './components/Layout'
import { Cargando } from './components/ui'
import { useAuth } from './features/auth/AuthProvider'
import { LoginPage } from './features/auth/LoginPage'
import { NuevaClavePage } from './features/auth/NuevaClavePage'
import { RecuperarPage } from './features/auth/RecuperarPage'
import { RegistroPage } from './features/auth/RegistroPage'
import { AjustesPage } from './features/ajustes/AjustesPage'
import { supabaseConfigurado } from './lib/supabase'

export default function App() {
  const { session, cargando, recuperando } = useAuth()

  if (!supabaseConfigurado) return <FaltaConfiguracion />
  if (cargando) return <Cargando />
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
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<EnConstruccion titulo="Inicio" fase={3} />} />
        <Route path="pacientes" element={<EnConstruccion titulo="Pacientes" fase={2} />} />
        <Route path="reporte" element={<EnConstruccion titulo="Reporte para la contadora" fase={5} />} />
        <Route path="ajustes" element={<AjustesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function FaltaConfiguracion() {
  return (
    <main className="mx-auto max-w-lg p-8 text-stone-800">
      <h1 className="mb-3 text-xl font-semibold">Falta configurar Supabase</h1>
      <p>
        Copiá <code>.env.example</code> como <code>.env</code> y completá <code>VITE_SUPABASE_URL</code> y{' '}
        <code>VITE_SUPABASE_ANON_KEY</code>. En Vercel, cargalas en Settings → Environment Variables.
      </p>
    </main>
  )
}
