import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  Calendar, ChartColumn, Check, FileSpreadsheet, House, MessageCircle, Plus, SlidersHorizontal, Smartphone, Sparkles,
  Upload, Users, type LucideIcon,
} from 'lucide-react'
import { Boton, IC } from '../../components/ui'
import { usePerfil } from '../../lib/datos'
import { supabase } from '../../lib/supabase'
import { guardarPreferencia, preferencia } from '../../lib/tema'

interface Paso {
  ruta: string
  /** Valor de data-tour del elemento a resaltar (si no hay, la tarjeta va sola). */
  objetivo?: string
  icono: LucideIcon
  titulo: string
  texto: string
}

const PASOS: Paso[] = [
  {
    ruta: '/',
    icono: Sparkles,
    titulo: '¡Te damos la bienvenida!',
    texto:
      'honorapp te ayuda a llevar los cobros de tus pacientes sin planillas. En un minuto te mostramos todo lo que podés hacer. Podés saltear el recorrido cuando quieras y volver a verlo desde Ajustes.',
  },
  {
    ruta: '/ajustes',
    objetivo: 'tarifa',
    icono: SlidersHorizontal,
    titulo: 'Primero, tu tarifa',
    texto:
      'Cargá cuánto cobrás la hora. Los pacientes con tarifa estándar la usan solos. Si la cambiás, las sesiones nuevas se cobran con el valor nuevo y las ya cargadas conservan su precio.',
  },
  {
    ruta: '/pacientes',
    objetivo: 'nuevo-paciente',
    icono: Users,
    titulo: 'Tus pacientes',
    texto:
      'Creá cada paciente con su teléfono, si usa tu tarifa estándar o una personalizada, cuánto dura la sesión y sus días fijos (por ejemplo, todos los lunes).',
  },
  {
    ruta: '/pacientes',
    objetivo: 'descargar-excel',
    icono: Upload,
    titulo: '¿Ya tenés una planilla?',
    texto:
      'Con «Descargar Excel» bajás nuestra planilla para completarla. Después la subís desde Importar (también acepta tu propio Excel o CSV). Lo que ya estaba cargado no se duplica.',
  },
  {
    ruta: '/',
    objetivo: 'registrar',
    icono: Plus,
    titulo: 'Registrar en segundos',
    texto:
      'Con «Registrar» cargás una sesión o un pago: elegís paciente, fecha y monto, y listo. Si ya te pagó la sesión, lo marcás en el mismo paso.',
  },
  {
    ruta: '/pacientes',
    icono: Calendar,
    titulo: 'La ficha de cada paciente',
    texto:
      'Tocando un paciente ves cuánto debe (pesos y dólares por separado), su historial mes a mes y un botón para cargar de un toque todas las sesiones del mes según sus días fijos. Ahí también editás o borrás sesiones y pagos.',
  },
  {
    ruta: '/',
    objetivo: 'resumen',
    icono: House,
    titulo: 'Tu mes de un vistazo',
    texto:
      'En Inicio ves lo cobrado y lo pendiente del mes, en pesos y en dólares, cuántos pacientes atendiste y un gráfico de los últimos 6 meses. Con las flechas cambiás de mes.',
  },
  {
    ruta: '/',
    objetivo: 'sin-abonar',
    icono: MessageCircle,
    titulo: 'Recordatorios por WhatsApp',
    texto:
      'Acá aparecen las sesiones sin abonar. Con el botón verde le mandás al paciente un recordatorio ya escrito con lo que debe. El mensaje lo podés cambiar en Ajustes.',
  },
  {
    ruta: '/mes',
    objetivo: 'reporte-mes',
    icono: ChartColumn,
    titulo: 'Reporte del mes',
    texto:
      'Cuánto facturaste, cuánto cobraste y quién debe, paciente por paciente, con cada sesión marcada como pagada, parcial o pendiente. Lo podés descargar en Excel.',
  },
  {
    ruta: '/contadora',
    objetivo: 'descargar-contadora',
    icono: FileSpreadsheet,
    titulo: 'Para tu contadora',
    texto:
      'Elegí el período y descargá el reporte en Excel o PDF: cobros por mes, moneda y medio de pago, con los números de factura y el total de los últimos 12 meses.',
  },
  {
    ruta: '/ajustes',
    icono: Smartphone,
    titulo: 'Llevala en el celular',
    texto:
      'Instalala como una app. En Android: menú ⋮ → «Instalar app». En iPhone: Compartir → «Agregar a inicio». Lo que cargás en el celular aparece en la compu y al revés.',
  },
  {
    ruta: '/',
    icono: Check,
    titulo: '¡Listo!',
    texto: 'Empezá por tu tarifa y tus pacientes. Si querés repasar algo, el tutorial está en Ajustes → «Ver tutorial».',
  },
]

interface TutorialApi {
  iniciar: () => void
}
const Ctx = createContext<TutorialApi | null>(null)

/** Elemento visible marcado con data-tour (en desktop y celular puede haber dos). */
function buscarObjetivo(nombre: string): HTMLElement | null {
  const candidatos = document.querySelectorAll<HTMLElement>(`[data-tour="${nombre}"]`)
  for (const el of candidatos) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return el
  }
  return null
}

export function TutorialProvider({ children }: { children: ReactNode }) {
  const { data: perfil } = usePerfil()
  const qc = useQueryClient()
  const [indice, setIndice] = useState<number | null>(null)
  const yaArrancoSolo = useRef(false)

  // Arranca solo la primera vez (cuenta nueva). La marca local evita repetirlo si no se pudo guardar.
  useEffect(() => {
    if (!perfil || perfil.tutorial_visto || yaArrancoSolo.current) return
    if (preferencia<string>(`tutorial-${perfil.id}`, '') === 'visto') return
    yaArrancoSolo.current = true
    setIndice(0)
  }, [perfil])

  const terminar = useCallback(async () => {
    setIndice(null)
    if (!perfil) return
    guardarPreferencia(`tutorial-${perfil.id}`, 'visto')
    if (!perfil.tutorial_visto) {
      const { error } = await supabase.from('profiles').update({ tutorial_visto: true }).eq('id', perfil.id)
      if (!error) qc.invalidateQueries({ queryKey: ['perfil'] })
    }
  }, [perfil, qc])

  return (
    <Ctx.Provider value={{ iniciar: () => setIndice(0) }}>
      {children}
      {indice !== null && <Recorrido indice={indice} setIndice={setIndice} onTerminar={terminar} />}
    </Ctx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTutorial() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTutorial fuera de TutorialProvider')
  return ctx
}

function Recorrido({
  indice,
  setIndice,
  onTerminar,
}: {
  indice: number
  setIndice: (i: number) => void
  onTerminar: () => void
}) {
  const paso = PASOS[indice]
  const navegar = useNavigate()
  const { pathname } = useLocation()
  const [rect, setRect] = useState<DOMRect | null>(null)
  const ultimo = indice === PASOS.length - 1

  // Lleva a la pantalla del paso.
  useEffect(() => {
    if (pathname !== paso.ruta) navegar(paso.ruta)
  }, [paso.ruta, pathname, navegar])

  // Busca el elemento a resaltar (puede tardar en aparecer mientras cargan los datos).
  useLayoutEffect(() => {
    setRect(null)
    if (!paso.objetivo) return
    let cancelado = false
    let intentos = 0
    let el: HTMLElement | null = null
    const medir = () => el && setRect(el.getBoundingClientRect())
    const buscar = () => {
      if (cancelado) return
      el = buscarObjetivo(paso.objetivo!)
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
        requestAnimationFrame(medir)
      } else if (intentos++ < 40) {
        setTimeout(buscar, 75)
      }
    }
    buscar()
    window.addEventListener('resize', medir)
    window.addEventListener('scroll', medir, true)
    return () => {
      cancelado = true
      window.removeEventListener('resize', medir)
      window.removeEventListener('scroll', medir, true)
    }
  }, [paso.objetivo, pathname])

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onTerminar()
      if (e.key === 'ArrowRight') {
        if (ultimo) onTerminar()
        else setIndice(indice + 1)
      }
      if (e.key === 'ArrowLeft' && indice > 0) setIndice(indice - 1)
    }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [indice, ultimo, onTerminar, setIndice])

  const margen = 8
  // La tarjeta va del lado opuesto al elemento resaltado, para no taparlo.
  const arriba = rect ? rect.top + rect.height / 2 > window.innerHeight / 2 : false

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={paso.titulo}>
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-[18px] ring-2 ring-acc transition-all duration-200"
          style={{
            top: rect.top - margen,
            left: rect.left - margen,
            width: rect.width + margen * 2,
            height: rect.height + margen * 2,
            boxShadow: '0 0 0 9999px rgba(12,18,15,.6)',
          }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-[rgba(12,18,15,.6)]" />
      )}

      <div
        className={`fixed left-1/2 flex w-[min(440px,calc(100%-32px))] -translate-x-1/2 flex-col gap-4 rounded-[26px] bg-surface p-6 shadow-[0_24px_60px_rgba(0,0,0,.3)] ${
          rect ? (arriba ? 'top-[max(16px,env(safe-area-inset-top))]' : 'bottom-[max(16px,env(safe-area-inset-bottom))]') : 'top-1/2 -translate-y-1/2'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-acc-soft text-[22px] text-acc-strong">
            <paso.icono {...IC} />
          </div>
          <div className="text-sm font-semibold text-ink2">
            Paso {indice + 1} de {PASOS.length}
          </div>
          {!ultimo && (
            <button type="button" onClick={onTerminar} className="ml-auto p-2 text-[15px] font-semibold text-ink2 hover:text-ink">
              Saltar
            </button>
          )}
        </div>
        <div>
          <h2 className="m-0 font-serif text-[30px] leading-tight font-normal">{paso.titulo}</h2>
          <p className="mt-2 mb-0 text-base leading-relaxed text-ink2">{paso.texto}</p>
        </div>
        <div className="flex gap-1.5" aria-hidden>
          {PASOS.map((_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= indice ? 'bg-acc' : 'bg-surface2'}`} />
          ))}
        </div>
        <div className="flex gap-2.5">
          {indice > 0 && (
            <Boton variante="suave" alto="h-12" onClick={() => setIndice(indice - 1)}>
              Anterior
            </Boton>
          )}
          <Boton alto="h-12" className="flex-1" autoFocus onClick={() => {
              if (ultimo) onTerminar()
              else setIndice(indice + 1)
            }}>
            {indice === 0 ? 'Empezar el recorrido' : ultimo ? 'Empezar a usar la app' : 'Siguiente'}
          </Boton>
        </div>
      </div>
    </div>
  )
}
