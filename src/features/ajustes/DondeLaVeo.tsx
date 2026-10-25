import { ExternalLink } from 'lucide-react'
import { IC, Tarjeta } from '../../components/ui'

const DONDE_LA_VEO = 'https://donde-la-veo-app.vercel.app/?ref=honorapp'

/** Tarjeta de Ajustes: ¿Dónde la veo?, otra app gratis del mismo autor. Solo un link: no comparte ningún dato. */
export function DondeLaVeo() {
  return (
    <Tarjeta className="flex items-center gap-4 p-[1.375rem]">
      <img src="/donde-la-veo.png" alt="" width={56} height={56} className="size-14 shrink-0 rounded-[0.875rem]" />
      <div className="min-w-0 flex-1">
        <h2 className="m-0 text-lg font-semibold">¿Qué mirar esta noche?</h2>
        <p className="m-0 mt-1 text-[0.9375rem] text-ink2">
          Con <b className="text-ink">¿Dónde la veo?</b> buscás cualquier película o serie y te dice en qué plataforma está en tu país. Gratis y sin cuenta.
        </p>
      </div>
      <a
        href={DONDE_LA_VEO}
        target="_blank"
        rel="noopener noreferrer"
        className="presionable inline-flex h-12 shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-4 font-semibold text-ink hover:bg-surface2 max-sm:px-3"
        aria-label="Abrir ¿Dónde la veo? (se abre en otra pestaña)"
      >
        <span className="max-sm:hidden">Abrir</span> <ExternalLink {...IC} />
      </a>
    </Tarjeta>
  )
}
