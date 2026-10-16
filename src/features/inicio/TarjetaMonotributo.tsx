import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Boton, Chip, Tarjeta, type Tono } from '../../components/ui'
import { useGuardar, type Pago, type Perfil } from '../../lib/datos'
import { formatMonto, formatPeriodo, hoyAR } from '../../lib/formato'
import { controlTope, proximaRecategorizacion, type EstadoTope } from '../../lib/monotributo'
import { mensajeError } from '../../lib/supabase'

const ESTADO: Record<EstadoTope, { tono: Tono; texto: string }> = {
  bien: { tono: 'ok', texto: 'Vas bien' },
  cerca: { tono: 'parcial', texto: 'Cerca del tope' },
  pasado: { tono: 'mal', texto: 'Pasaste el tope' },
  fuera: { tono: 'mal', texto: 'Superás la K' },
}

/** Control del tope del monotributo en Inicio. No aparece si la persona marcó que no usa monotributo. */
export function TarjetaMonotributo({ perfil, pagos }: { perfil: Perfil; pagos: Pago[] }) {
  const navegar = useNavigate()
  const guardar = useGuardar()
  const hoy = hoyAR()
  const cat = perfil.monotributo_categoria
  if (cat === 'no') return null

  const c = controlTope(pagos, cat, perfil.tipo_cambio_usd, hoy)
  const recat = proximaRecategorizacion(hoy)
  const nota = (
    <p className="m-0 text-xs leading-snug text-ink2">
      Orientativo: se calcula con lo cobrado, y ARCA mira lo facturado y también el alquiler, la luz y los metros del
      consultorio. Confirmalo con tu contadora.
    </p>
  )

  // Todavía no eligió categoría: invitación corta, solo si ya hay cobros para comparar.
  if (!c.elegida) {
    if (c.total <= 0) return null
    return (
      <Tarjeta className="flex flex-col gap-3 p-[1.375rem]">
        <h2 className="m-0 text-xl font-semibold">Monotributo</h2>
        <p className="m-0 text-[0.9375rem] leading-normal">
          En los últimos 12 meses cobraste {formatMonto(c.total, 'ARS')}.{' '}
          {c.sugerida ? `Te correspondería la categoría ${c.sugerida.letra}.` : 'Superás el tope de la categoría K.'} Elegí
          tu categoría y te avisamos cuando te acerques al tope.
        </p>
        <div className="flex flex-wrap gap-2">
          <Boton alto="h-12" className="px-5" onClick={() => navegar('/ajustes#monotributo')}>
            Elegir mi categoría
          </Boton>
          <Boton
            variante="texto"
            alto="h-12"
            className="px-4"
            disabled={guardar.isPending}
            onClick={async () => {
              try {
                await guardar.mutateAsync([{ tipo: 'actualizar', tabla: 'profiles', id: perfil.id, cambios: { monotributo_categoria: 'no' } }])
                toast.success('Listo: no vuelve a aparecer. Lo podés activar en Ajustes.')
              } catch (e) {
                toast.error(`No se pudo guardar: ${mensajeError(e)}`)
              }
            }}
          >
            No uso monotributo
          </Boton>
        </div>
        {nota}
      </Tarjeta>
    )
  }

  const est = ESTADO[c.estado]
  const porcentaje = Math.round((c.uso ?? 0) * 100)
  const colorBarra = c.estado === 'bien' ? 'bg-acc' : c.estado === 'cerca' ? 'bg-warn' : 'bg-bad'

  return (
    <Tarjeta className="flex flex-col gap-3.5 p-[1.375rem]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-xl font-semibold">Monotributo · categoría {c.elegida.letra}</h2>
        <Chip tono={est.tono}>{est.texto}</Chip>
      </div>

      <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
        <div className="num text-[clamp(2rem,4cqi,2.75rem)] leading-none">{porcentaje} %</div>
        <div className="pb-1 text-[0.9375rem] text-ink2">del tope anual</div>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(porcentaje, 100)}
        aria-label="Parte del tope usada"
        className="h-3 overflow-hidden rounded-full bg-surface2"
      >
        <div className={`h-full rounded-full ${colorBarra}`} style={{ width: `${Math.min(porcentaje, 100)}%` }} />
      </div>

      <div className="flex flex-col gap-1 text-[0.9375rem] leading-normal">
        <div>
          Llevás <strong>{formatMonto(c.total, 'ARS')}</strong> de {formatMonto(c.elegida.tope, 'ARS')}, cobrados de{' '}
          {formatPeriodo(c.desde)} a {formatPeriodo(c.hasta)}.
        </div>
        {c.estado === 'bien' || c.estado === 'cerca' ? (
          <div>Te quedan {formatMonto(c.margen ?? 0, 'ARS')} antes del tope.</div>
        ) : null}
        {(c.estado === 'cerca' || c.estado === 'pasado') && c.sugerida && c.sugerida.letra !== c.elegida.letra && (
          <div>
            Con lo cobrado te correspondería la <strong>categoría {c.sugerida.letra}</strong> (hasta{' '}
            {formatMonto(c.sugerida.tope, 'ARS')}). Hablalo con tu contadora.
          </div>
        )}
        {c.estado === 'bien' && c.sugerida && c.sugerida.letra < c.elegida.letra && (
          <div className="text-ink2">
            Con lo cobrado alcanzaría la categoría {c.sugerida.letra}, que paga menos. Consultalo con tu contadora.
          </div>
        )}
        {c.estado === 'fuera' && (
          <div>Lo cobrado supera el tope de la categoría K, la más alta. Consultá con tu contadora cuanto antes.</div>
        )}
        {c.faltaTipoCambio && (
          <div className="text-ink2">
            Además cobraste {formatMonto(c.usd, 'USD')}, que no están sumados. Poné el dólar en Ajustes → Monotributo para
            incluirlos.
          </div>
        )}
        <div className="text-ink2">
          {recat.esteMes
            ? `Este mes toca recategorizarse, con lo cobrado hasta el ${recat.hastaCuando.split('-').reverse().join('/')}.`
            : `Próxima recategorización: ${formatPeriodo(recat.mes)}, con lo cobrado hasta el ${recat.hastaCuando.split('-').reverse().join('/')}.`}
        </div>
      </div>
      {nota}
    </Tarjeta>
  )
}
