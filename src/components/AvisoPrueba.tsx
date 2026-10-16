import { FlaskConical } from 'lucide-react'
import { IC } from './ui'

/**
 * Mientras el abogado no confirme dónde pueden guardarse los datos (ver docs/investigacion/legal.md),
 * la app es una versión de prueba: solo datos inventados. En el proyecto de producción se apaga con
 * VITE_DATOS_REALES=si.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const SOLO_DATOS_DE_PRUEBA = import.meta.env.VITE_DATOS_REALES !== 'si'

export function AvisoPrueba({ className = '' }: { className?: string }) {
  if (!SOLO_DATOS_DE_PRUEBA) return null
  return (
    <div
      role="note"
      className={`flex items-start gap-2.5 rounded-2xl bg-warn-soft px-4 py-3 text-[0.9375rem] leading-snug text-warn ${className}`}
    >
      <FlaskConical {...IC} className="mt-0.5 shrink-0" />
      <span>
        <strong>Versión de prueba.</strong> Cargá solo pacientes y datos inventados, nunca de pacientes reales.
      </span>
    </div>
  )
}
