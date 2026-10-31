import { useState } from 'react'
import { Check, Copy, KeyRound, Link2, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Boton, Confirmar, IC, Tarjeta } from '../../components/ui'
import { linkInvitacion, useCambiarVinculos, useVinculos, type Vinculo } from '../../lib/estudio'
import { formatFecha } from '../../lib/formato'
import { mensajeError } from '../../lib/supabase'

/** Sección del reporte para contadora: darle a la contadora acceso de solo lectura (Modo Estudio Contable). */
export function AccesoContadora({ mailContadora }: { mailContadora: string | null }) {
  const vinculos = useVinculos()
  const { crear, iniciales, quitar } = useCambiarVinculos()
  const [aQuitar, setAQuitar] = useState<Vinculo | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)

  const lista = vinculos.data ?? []
  const activos = lista.filter((v) => v.contadora_id)
  const pendiente = lista.find((v) => !v.contadora_id)

  async function copiar(v: Vinculo) {
    try {
      await navigator.clipboard.writeText(linkInvitacion(v.token))
      setCopiado(v.id)
      toast.success('Link copiado')
    } catch {
      toast.error('No se pudo copiar. Mantené apretado el link para copiarlo.')
    }
  }

  function mandar(v: Vinculo) {
    const texto = `Hola! Te comparto el acceso a mis cobros en honorapp para que bajes el reporte cuando lo necesites. Es solo para ver, no podés cambiar nada: ${linkInvitacion(v.token)}`
    const asunto = 'Acceso a mis cobros en honorapp'
    window.open(`mailto:${encodeURIComponent(mailContadora ?? '')}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(texto)}`, '_blank', 'noopener')
  }

  return (
    <Tarjeta className="flex flex-col gap-4 p-5 md:p-6">
      <div className="flex items-start gap-3">
        <KeyRound {...IC} className="mt-1 shrink-0 text-acc-strong" />
        <div>
          <h2 className="m-0 font-serif text-[1.625rem] leading-tight font-normal">Acceso para tu contadora</h2>
          <p className="mt-1.5 text-[0.9375rem] leading-snug text-ink2">
            Tu contadora entra gratis con su cuenta y baja este reporte cuando lo necesita, sin que se lo mandes. Solo puede
            ver tus cobros y los datos para facturar: no ve teléfonos, mails, notas ni sesiones, y no puede cambiar nada. Le
            podés quitar el acceso cuando quieras.
          </p>
        </div>
      </div>

      {vinculos.isError && <p className="text-bad">No se pudo cargar quién tiene acceso. Probá de nuevo más tarde.</p>}

      {activos.map((v) => (
        <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[1rem] bg-surface2 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate font-semibold">{v.contadora_email ?? 'Contadora'}</div>
            <div className="text-sm text-ink2">Tiene acceso desde el {formatFecha(v.aceptado_at!.slice(0, 10))}</div>
            <label className="mt-1.5 flex cursor-pointer items-center gap-2 text-[0.9375rem] text-ink2">
              <input
                type="checkbox"
                checked={v.solo_iniciales}
                disabled={iniciales.isPending}
                onChange={(e) =>
                  iniciales.mutate(
                    { id: v.id, valor: e.target.checked },
                    {
                      onSuccess: () => toast.success(e.target.checked ? 'Ahora ve solo las iniciales de tus pacientes' : 'Ahora ve el nombre de tus pacientes'),
                      onError: (err) => toast.error(`No se pudo cambiar: ${mensajeError(err)}`),
                    },
                  )
                }
              />
              Que vea solo las iniciales de mis pacientes (sin DNI ni CUIT)
            </label>
          </div>
          <Boton variante="borde" alto="h-11" icono={Trash2} onClick={() => setAQuitar(v)}>
            Quitar acceso
          </Boton>
        </div>
      ))}

      {pendiente ? (
        <div className="flex flex-col gap-2.5 rounded-[1rem] border border-dashed border-line px-4 py-3">
          <div className="text-[0.9375rem] text-ink2">Mandale este link a tu contadora. Sirve una sola vez.</div>
          <div className="truncate font-mono text-sm">{linkInvitacion(pendiente.token)}</div>
          <div className="flex flex-wrap gap-2">
            <Boton alto="h-11" icono={copiado === pendiente.id ? Check : Copy} onClick={() => copiar(pendiente)}>
              Copiar link
            </Boton>
            <Boton alto="h-11" variante="borde" icono={Send} onClick={() => mandar(pendiente)}>
              Mandar por mail
            </Boton>
            <Boton alto="h-11" variante="borde" icono={Trash2} onClick={() => setAQuitar(pendiente)}>
              Anular link
            </Boton>
          </div>
        </div>
      ) : (
        <Boton
          variante="borde"
          icono={Link2}
          className="self-start"
          cargando={crear.isPending}
          disabled={vinculos.isLoading}
          onClick={() =>
            crear.mutate(false, {
              onSuccess: () => toast.success('Link creado: mandáselo a tu contadora'),
              onError: (e) => toast.error(`No se pudo crear el link: ${mensajeError(e)}`),
            })
          }
        >
          {activos.length ? 'Dar acceso a otra persona' : 'Crear link para mi contadora'}
        </Boton>
      )}

      {aQuitar && (
        <Confirmar
          titulo={aQuitar.contadora_id ? 'Quitar el acceso' : 'Anular el link'}
          textoConfirmar={aQuitar.contadora_id ? 'Quitar acceso' : 'Anular'}
          cargando={quitar.isPending}
          onCancelar={() => setAQuitar(null)}
          onConfirmar={() =>
            quitar.mutate(aQuitar.id, {
              onSuccess: () => {
                toast.success(aQuitar.contadora_id ? 'Acceso quitado' : 'Link anulado')
                setAQuitar(null)
              },
              onError: (e) => toast.error(`No se pudo: ${mensajeError(e)}`),
            })
          }
        >
          {aQuitar.contadora_id
            ? `${aQuitar.contadora_email ?? 'Tu contadora'} deja de ver tus cobros. Si después querés volver a darle acceso, le mandás un link nuevo.`
            : 'El link deja de funcionar. Podés crear otro cuando quieras.'}
        </Confirmar>
      )}
    </Tarjeta>
  )
}
