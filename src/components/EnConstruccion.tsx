import { Hammer } from 'lucide-react'
import { EstadoVacio, Titulo } from './ui'

/** Marcador para las pantallas de las próximas fases. */
export function EnConstruccion({ titulo, fase, sub }: { titulo: string; fase: number; sub?: string }) {
  return (
    <section className="flex flex-col gap-6">
      <Titulo sub={sub}>{titulo}</Titulo>
      <EstadoVacio icono={Hammer} titulo="Próximamente">
        Esta pantalla llega en la fase {fase}. Mientras tanto, podés cargar pacientes, sesiones y pagos.
      </EstadoVacio>
    </section>
  )
}
