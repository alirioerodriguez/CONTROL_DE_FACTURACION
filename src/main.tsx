import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { Check, CircleAlert } from 'lucide-react'
import { Toaster } from 'sonner'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './features/auth/AuthProvider'

// refetchOnWindowFocus: al volver a la app se recargan los datos, así lo
// que se cargó en el celular aparece en la PC y viceversa.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: true, staleTime: 30_000, retry: 1 },
  },
})

// Avisos con el estilo del diseño: pastilla oscura con ícono a la izquierda.
const icono = (ok: boolean) => (
  <span className={`grid size-[26px] place-items-center rounded-full ${ok ? 'bg-acc text-on-acc' : 'bg-bad text-surface'}`}>
    {ok ? <Check size={15} strokeWidth={2.4} /> : <CircleAlert size={15} strokeWidth={2.2} />}
  </span>
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <Toaster
            position="bottom-center"
            offset={32}
            mobileOffset={{ bottom: 176 }}
            icons={{ success: icono(true), error: icono(false) }}
            toastOptions={{
              unstyled: true,
              classNames: {
                toast:
                  'flex w-full items-center gap-2.5 rounded-full bg-ink py-3 pr-5 pl-3 text-[15px] font-medium text-bg shadow-[0_12px_32px_rgba(0,0,0,.22)]',
                icon: 'shrink-0',
                title: 'leading-snug',
              },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
