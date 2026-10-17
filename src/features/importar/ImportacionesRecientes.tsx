import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Boton, Confirmar, Tarjeta } from '../../components/ui'
import { usePalabras } from '../../components/usePalabras'
import { plural } from '../../lib/formato'
import { mensajeError, supabase } from '../../lib/supabase'

interface Importacion {
  id: string
  pacientes: number
  sesiones: number
  pagos: number
  created_at: string
}

const SIETE_DIAS = 7 * 24 * 60 * 60 * 1000

/** Importaciones de los últimos 7 días que todavía se pueden deshacer. */
export function ImportacionesRecientes() {
  const pal = usePalabras()
  const qc = useQueryClient()
  const [aDeshacer, setADeshacer] = useState<Importacion | null>(null)
  const [deshaciendo, setDeshaciendo] = useState(false)

  const { data = [] } = useQuery({
    queryKey: ['importaciones'],
    queryFn: async (): Promise<Importacion[]> => {
      const { data, error } = await supabase
        .from('importaciones')
        .select('id, pacientes, sesiones, pagos, created_at')
        .eq('deshecha', false)
        .gte('created_at', new Date(Date.now() - SIETE_DIAS).toISOString())
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Importacion[]
    },
  })

  if (!data.length) return null

  const detalle = (i: Importacion) =>
    [
      i.pacientes && plural(i.pacientes, 'paciente nuevo', 'pacientes nuevos'),
      i.sesiones && plural(i.sesiones, pal.sesion, pal.sesiones),
      i.pagos && plural(i.pagos, 'pago', 'pagos'),
    ]
      .filter(Boolean)
      .join(', ') || 'Sin datos'

  const cuando = (iso: string) =>
    new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(iso))

  async function deshacer() {
    if (!aDeshacer) return
    setDeshaciendo(true)
    const { error } = await supabase.rpc('deshacer_importacion', { p_importacion: aDeshacer.id })
    setDeshaciendo(false)
    if (error) {
      toast.error(`No se pudo deshacer: ${mensajeError(error)}`)
      return
    }
    setADeshacer(null)
    await qc.invalidateQueries()
    toast.success('Importación deshecha: se borró todo lo que había traído')
  }

  return (
    <Tarjeta className="flex flex-col gap-3 p-[1.375rem]">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-lg font-semibold">Importaciones recientes</h2>
        <p className="m-0 text-[0.9375rem] text-ink2">Si subiste un archivo equivocado, podés deshacerlo durante 7 días.</p>
      </div>
      {data.map((i) => (
        <div key={i.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
          <div className="min-w-0">
            <div className="text-base font-semibold">{cuando(i.created_at)}</div>
            <div className="text-sm text-ink2">{detalle(i)}</div>
          </div>
          <Boton variante="suave" alto="h-11" icono={Undo2} className="px-4" onClick={() => setADeshacer(i)}>
            Deshacer
          </Boton>
        </div>
      ))}

      {aDeshacer && (
        <Confirmar
          titulo="¿Deshacer esta importación?"
          textoConfirmar="Deshacer importación"
          cargando={deshaciendo}
          onCancelar={() => setADeshacer(null)}
          onConfirmar={() => void deshacer()}
        >
          Se borra todo lo que trajo ({detalle(aDeshacer)}). Los pacientes que creó se borran con todo lo que tengan,
          también lo que hayas cargado después a mano.
        </Confirmar>
      )}
    </Tarjeta>
  )
}
