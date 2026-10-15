import { EstadoVacio } from './ui'

/** Marcador para las pantallas de las próximas fases. */
export function EnConstruccion({ titulo, fase }: { titulo: string; fase: number }) {
  return (
    <section>
      <h1 className="mb-6 text-2xl font-semibold">{titulo}</h1>
      <EstadoVacio titulo="Próximamente">Esta pantalla llega en la fase {fase}.</EstadoVacio>
    </section>
  )
}
