import { useMemo, useState } from 'react'
import { Ban, ChevronDown, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Boton, IC, Tarjeta } from '../../components/ui'
import { nombreCompleto, useDatos, useGuardar } from '../../lib/datos'
import { verMonto } from '../../lib/discreto'
import { pagosQueNoSeFacturan } from '../../lib/facturar'
import { formatFecha } from '../../lib/formato'
import { mensajeError } from '../../lib/supabase'

/**
 * Lo que la profesional decidió NO facturar: los cobros en dólares (con un interruptor), un paciente entero
 * (desde su ficha) o un pago suelto («No facturar»). Desde acá se ve y se puede deshacer.
 */
export function NoSeFacturan({ desde }: { desde: string }) {
  const { perfil, pacientes, pagos } = useDatos()
  const guardar = useGuardar()
  const [abierto, setAbierto] = useState(false)
  const sinUsd = !!perfil?.no_facturar_usd
  const lista = useMemo(() => pagosQueNoSeFacturan(pagos, pacientes, desde, sinUsd), [pagos, pacientes, desde, sinUsd])
  const hayUsd = useMemo(() => pagos.some((p) => p.moneda === 'USD' && p.comprobante !== 'factura_c'), [pagos])

  async function guardarYAvisar(ops: Parameters<typeof guardar.mutateAsync>[0], ok: string) {
    try {
      await guardar.mutateAsync(ops)
      toast.success(ok)
    } catch (e) {
      toast.error(`No se pudo guardar: ${mensajeError(e)}`)
    }
  }

  if (!perfil) return null
  return (
    <Tarjeta className="flex flex-col gap-3 p-[1.375rem]">
      {(hayUsd || sinUsd) && (
        <label className="flex cursor-pointer items-start gap-3 text-[0.9375rem] leading-snug">
          <input
            type="checkbox"
            className="mt-1 size-5"
            checked={sinUsd}
            disabled={guardar.isPending}
            onChange={(e) =>
              guardarYAvisar(
                [{ tipo: 'actualizar', tabla: 'profiles', id: perfil.id, cambios: { no_facturar_usd: e.target.checked } }],
                e.target.checked ? 'Listo: los cobros en dólares no se facturan' : 'Los cobros en dólares vuelven a «Para facturar»',
              )
            }
          />
          <span>
            <b>No facturar los cobros en dólares</b>
            <span className="block text-ink2">No aparecen para facturar ni se facturan solos. Se siguen registrando y salen en tus reportes.</span>
          </span>
        </label>
      )}

      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
        className="flex items-center justify-between gap-2 bg-transparent p-0 text-left text-[1.0625rem] font-semibold"
      >
        <span className="flex items-center gap-2">
          <Ban {...IC} className="text-ink2" />
          No se facturan {lista.length > 0 && <span className="font-normal text-ink2">({lista.length})</span>}
        </span>
        <ChevronDown {...IC} className={`text-ink2 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {abierto &&
        (lista.length === 0 ? (
          <p className="m-0 text-[0.9375rem] text-ink2">
            Nada. Para dejar un pago afuera tocá «No facturar» en él; para un paciente entero, marcá «No facturarle» en su ficha.
          </p>
        ) : (
          <div className="flex flex-col">
            {lista.map(({ pago, paciente }) => {
              const motivo = pago.no_facturar ? 'Elegiste no facturar este pago' : paciente.no_facturar ? 'No le facturás a este paciente (desde su ficha)' : 'Cobro en dólares'
              return (
                <div key={pago.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-2.5 first:border-t-0">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">
                      {nombreCompleto(paciente)} · {verMonto(pago.monto, pago.moneda)}
                    </div>
                    <div className="text-sm text-ink2">
                      {formatFecha(pago.fecha)} · {motivo}
                    </div>
                  </div>
                  {pago.no_facturar && (
                    <Boton
                      variante="texto"
                      alto="h-10"
                      icono={Undo2}
                      cargando={guardar.isPending}
                      onClick={() =>
                        guardarYAvisar([{ tipo: 'actualizar', tabla: 'payments', id: pago.id, cambios: { no_facturar: false } }], 'Vuelve a «Para facturar»')
                      }
                    >
                      Facturar
                    </Boton>
                  )}
                  {!pago.no_facturar && paciente.no_facturar && (
                    <Boton
                      variante="texto"
                      alto="h-10"
                      icono={Undo2}
                      cargando={guardar.isPending}
                      onClick={() =>
                        guardarYAvisar(
                          [{ tipo: 'actualizar', tabla: 'patients', id: paciente.id, cambios: { no_facturar: false } }],
                          `Volvés a facturarle a ${paciente.nombre}`,
                        )
                      }
                    >
                      Facturarle de nuevo
                    </Boton>
                  )}
                </div>
              )
            })}
          </div>
        ))}
    </Tarjeta>
  )
}
