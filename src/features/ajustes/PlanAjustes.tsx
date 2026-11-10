import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Boton, Chip, IC, Segmentado, Tarjeta } from '../../components/ui'
import type { Paciente, Perfil } from '../../lib/datos'
import { formatFecha, formatMonto } from '../../lib/formato'
import {
  COBRO_ACTIVO,
  estadoPlan,
  LIMITE_GRATIS,
  PRECIO_PRO_ANUAL_ARS,
  PRECIO_PRO_MENSUAL_ARS,
} from '../../lib/planFreemium'
import { mensajeError, supabase } from '../../lib/supabase'

type Frecuencia = 'mensual' | 'anual'

/** Tarjeta de Ajustes: muestra el plan actual de la profesional y, cuando se active el cobro, el botón «Pasar a Pro». */
export function PlanAjustes({ perfil, pacientes }: { perfil: Perfil; pacientes: Paciente[] }) {
  const [frecuencia, setFrecuencia] = useState<Frecuencia>('mensual')
  const [abriendo, setAbriendo] = useState(false)

  const activos = pacientes.filter((p) => p.activo).length
  const est = estadoPlan({ plan: perfil.plan, proHasta: perfil.pro_hasta, activos })
  const venceIso = perfil.pro_hasta ? perfil.pro_hasta.slice(0, 10) : null

  async function pasarAPro() {
    setAbriendo(true)
    try {
      const { data, error } = await supabase.functions.invoke<{ ok: boolean; init_point?: string; mensaje?: string }>('mercadopago', {
        body: { accion: 'crear-suscripcion', frecuencia },
      })
      if (error || !data?.ok || !data.init_point) {
        throw new Error(data?.mensaje ?? 'No se pudo abrir Mercado Pago.')
      }
      window.location.assign(data.init_point)
    } catch (e) {
      toast.error(mensajeError(e))
      setAbriendo(false)
    }
  }

  return (
    <Tarjeta className="flex flex-col gap-3 p-[1.375rem]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 flex items-center gap-2 text-lg font-semibold">
          <Sparkles {...IC} /> Tu plan
        </h2>
        <Chip tono={est.esPro ? 'ok' : 'neutro'} grande>
          {est.esPro ? 'Plan Pro' : 'Plan Gratis'}
        </Chip>
      </div>

      <p className="m-0 text-[0.9375rem] leading-normal text-ink2">
        {est.esPro
          ? `Tenés pacientes activos ilimitados (${activos} ${activos === 1 ? 'activo' : 'activos'} hoy)${venceIso ? ` · vigente hasta el ${formatFecha(venceIso)}` : ''}.`
          : COBRO_ACTIVO
            ? `${est.mensaje} Con Pro tenés pacientes ilimitados por ${formatMonto(PRECIO_PRO_MENSUAL_ARS, 'ARS')} por mes o ${formatMonto(PRECIO_PRO_ANUAL_ARS, 'ARS')} por año.`
            : `Tenés ${activos} ${activos === 1 ? 'paciente activo' : 'pacientes activos'}. Hoy todas las funciones están liberadas sin costo (cuando se active el plan Pro, el plan Gratis incluirá hasta ${LIMITE_GRATIS} pacientes activos).`}
      </p>

      {COBRO_ACTIVO && !est.esPro && (
        <div className="flex flex-col gap-3 pt-1">
          <Segmentado
            opciones={[
              { v: 'mensual' as Frecuencia, l: `Mensual · ${formatMonto(PRECIO_PRO_MENSUAL_ARS, 'ARS')}` },
              { v: 'anual' as Frecuencia, l: `Anual · ${formatMonto(PRECIO_PRO_ANUAL_ARS, 'ARS')}` },
            ]}
            valor={frecuencia}
            onCambio={setFrecuencia}
          />
          <Boton cargando={abriendo} onClick={() => void pasarAPro()} className="self-start">
            Pasar a Pro
          </Boton>
        </div>
      )}
    </Tarjeta>
  )
}
