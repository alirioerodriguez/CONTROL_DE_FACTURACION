import { useState } from 'react'
import { CalendarDays, Copy, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Boton, IC, Tarjeta } from '../../components/ui'
import { usePalabras } from '../../components/usePalabras'
import { useGuardar, type Perfil } from '../../lib/datos'
import { mensajeError } from '../../lib/supabase'

/** Link privado del calendario (función calendario de Supabase). */
function linkCalendario(token: string): string {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendario?t=${token}`
}

/** Tarjeta de Ajustes: ver las sesiones en Google Calendar (u otro calendario) con un link privado. */
export function CalendarioAjustes({ perfil }: { perfil: Perfil }) {
  const guardar = useGuardar()
  const pal = usePalabras()
  const [confirmarCambio, setConfirmarCambio] = useState(false)
  const token = perfil.calendario_token

  async function cambiarToken(nuevo: string | null, mensaje: string) {
    try {
      await guardar.mutateAsync([{ tipo: 'actualizar', tabla: 'profiles', id: perfil.id, cambios: { calendario_token: nuevo } }])
      toast.success(mensaje)
      setConfirmarCambio(false)
    } catch (e) {
      toast.error(`No se pudo guardar: ${mensajeError(e)}`)
    }
  }

  async function copiar(link: string) {
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Link copiado')
    } catch {
      toast.error('No se pudo copiar. Seleccioná el link y copialo a mano.')
    }
  }

  const link = token ? linkCalendario(token) : ''
  const google = token ? `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(link.replace(/^https:/, 'webcal:'))}` : ''

  return (
    <Tarjeta data-tour="calendario" className="flex flex-col gap-3 p-[1.375rem]">
      <h2 className="m-0 flex items-center gap-2.5 text-lg font-semibold">
        <CalendarDays {...IC} />
        Tus {pal.sesiones} en Google Calendar
      </h2>
      <p className="m-0 text-[0.9375rem] leading-normal text-ink2">
        Un calendario que se actualiza solo con tus {pal.sesiones}. Por privacidad, en el calendario solo aparecen las iniciales del
        paciente. Google lo actualiza cada algunas horas.
      </p>
      {!token ? (
        <Boton
          variante="borde"
          className="self-start"
          cargando={guardar.isPending}
          onClick={() => cambiarToken(crypto.randomUUID(), 'Listo: ya tenés tu link del calendario')}
        >
          Crear mi link
        </Boton>
      ) : (
        <>
          <div className="flex items-center gap-2 rounded-xl bg-surface2 px-3.5 py-2.5">
            <code className="min-w-0 flex-1 truncate text-sm">{link}</code>
            <button
              type="button"
              onClick={() => copiar(link)}
              aria-label="Copiar link"
              className="grid size-9 shrink-0 place-items-center rounded-lg text-ink2 hover:bg-surface"
            >
              <Copy {...IC} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={google}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full min-h-[3.25rem] items-center justify-center gap-2 py-1.5 text-center leading-tight rounded-full bg-acc px-5 text-base font-semibold text-on-acc hover:bg-acc-strong"
            >
              <ExternalLink {...IC} className="shrink-0" />
              Agregar a Google Calendar
            </a>
          </div>
          <p className="m-0 text-sm leading-normal text-ink2">
            Si no se abre: en Google Calendar, en la computadora, «Otros calendarios» → «+» → «Desde URL» y pegá el link. En el iPhone:
            Ajustes → Calendario → Cuentas → Agregar cuenta → Otra → Agregar calendario suscripto. No compartas este link: quien lo tenga
            ve tus {pal.sesiones} (solo con iniciales).
          </p>
          {confirmarCambio ? (
            <div className="flex flex-wrap items-center gap-2 text-[0.9375rem]">
              <span className="text-ink2">El link actual deja de funcionar.</span>
              <Boton variante="borde" alto="h-11" onClick={() => cambiarToken(crypto.randomUUID(), 'Link nuevo creado. Volvé a agregarlo en tu calendario.')}>
                Crear uno nuevo
              </Boton>
              <Boton variante="texto" alto="h-11" onClick={() => cambiarToken(null, 'Listo: el calendario se apagó')}>
                Apagar
              </Boton>
              <Boton variante="texto" alto="h-11" onClick={() => setConfirmarCambio(false)}>
                Cancelar
              </Boton>
            </div>
          ) : (
            <Boton variante="texto" alto="h-11" className="self-start px-0 text-ink2" onClick={() => setConfirmarCambio(true)}>
              Cambiar o apagar el link
            </Boton>
          )}
        </>
      )}
    </Tarjeta>
  )
}
