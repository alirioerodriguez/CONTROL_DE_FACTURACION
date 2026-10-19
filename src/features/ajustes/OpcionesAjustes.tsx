import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { Tarjeta } from '../../components/ui'
import { useGuardar, type Perfil } from '../../lib/datos'
import { mensajeError } from '../../lib/supabase'

/** Funciones que no todas usan: arrancan apagadas y se prenden acá. */
type Opcion = 'ver_recordatorios' | 'aviso_mensual' | 'usa_obras_sociales'

const OPCIONES: { clave: Opcion; titulo: string; ayuda: ReactNode; prendida: string; apagada: string }[] = [
  {
    clave: 'ver_recordatorios',
    titulo: 'Recordatorios del mes',
    ayuda: 'Una pantalla con quién te debe, para mandarle el recordatorio por WhatsApp y llevar la cuenta de a quién ya le escribiste.',
    prendida: 'Listo: tenés la pantalla Recordatorios en el menú',
    apagada: 'Listo: se sacó Recordatorios del menú',
  },
  {
    clave: 'aviso_mensual',
    titulo: 'Resumen mensual por mail',
    ayuda: 'El día 1 de cada mes te llega un mail con cuánto te deben y cuánto cobraste el mes anterior.',
    prendida: 'Listo: el día 1 te llega el resumen por mail',
    apagada: 'Listo: ya no te llega el resumen por mail',
  },
  {
    clave: 'usa_obras_sociales',
    titulo: 'Obras sociales y prepagas',
    ayuda: 'Anotá la obra social y el n.º de afiliado de cada paciente, y al cargar un pago, si pagó el paciente o la obra social.',
    prendida: 'Listo: ya podés cargar la obra social de cada paciente',
    apagada: 'Listo: se ocultaron las obras sociales (los datos quedan guardados)',
  },
]

export function Interruptor({ prendido, onCambio, etiqueta }: { prendido: boolean; onCambio: () => void; etiqueta: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={prendido}
      aria-label={etiqueta}
      onClick={onCambio}
      className={`flex h-8 w-[3.25rem] shrink-0 rounded-full p-[0.1875rem] transition-colors ${
        prendido ? 'justify-end bg-acc' : 'justify-start bg-line'
      }`}
    >
      <span className="size-[1.625rem] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)]" />
    </button>
  )
}

export function OpcionesAjustes({ perfil }: { perfil: Perfil }) {
  const guardar = useGuardar()

  async function alternar(o: (typeof OPCIONES)[number]) {
    const valor = !perfil[o.clave]
    try {
      await guardar.mutateAsync([{ tipo: 'actualizar', tabla: 'profiles', id: perfil.id, cambios: { [o.clave]: valor } }])
      toast.success(valor ? o.prendida : o.apagada)
    } catch (e) {
      toast.error(`No se pudo guardar: ${mensajeError(e)}`)
    }
  }

  return (
    <Tarjeta data-tour="opciones" className="flex flex-col gap-1 p-[1.375rem]">
      <h2 className="m-0 text-lg font-semibold">Funciones opcionales</h2>
      <p className="m-0 mb-1 text-[0.9375rem] leading-normal text-ink2">Prendé solo lo que te sirva.</p>
      {OPCIONES.map((o, i) => (
        <div key={o.clave} className={`flex items-center justify-between gap-4 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
          <div className="min-w-0">
            <div className="text-base font-semibold">{o.titulo}</div>
            <div className="mt-0.5 text-[0.9375rem] leading-snug text-ink2">{o.ayuda}</div>
          </div>
          <Interruptor prendido={!!perfil[o.clave]} onCambio={() => alternar(o)} etiqueta={o.titulo} />
        </div>
      ))}
    </Tarjeta>
  )
}
