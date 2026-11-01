import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Download, Send, Share2, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { Boton, Confirmar, Tarjeta } from '../../components/ui'
import { usePalabras } from '../../components/usePalabras'
import type { Perfil } from '../../lib/datos'
import { descripcionFactura, type Factura } from '../../lib/facturar'
import { automatizable, compartirFacturas, descargarFacturas, emitirFacturas, mensajeFactura, useFacturasArca, type FacturaArca, type ResultadoEmision } from '../../lib/facturaArca'
import { formatFecha, formatMonto, plural, type Moneda } from '../../lib/formato'
import { numeroFactura } from '../../../supabase/functions/arca-factura/wsfe'
import { mensajeError } from '../../lib/supabase'

function useEmitir() {
  const pal = usePalabras()
  const qc = useQueryClient()
  const [emitiendo, setEmitiendo] = useState(false)
  async function emitir(facturas: Factura[]): Promise<ResultadoEmision[]> {
    setEmitiendo(true)
    try {
      const r = await emitirFacturas(facturas.map((f) => ({ pagos: f.pagos.map((p) => p.id), descripcion: descripcionFactura(f, pal) })))
      await qc.invalidateQueries()
      return r
    } finally {
      setEmitiendo(false)
    }
  }
  return { emitir, emitiendo }
}

/** Botón de una factura: la pide a ARCA y avisa el número. */
export function BotonFacturaArca({ factura }: { factura: Factura }) {
  const { emitir, emitiendo } = useEmitir()
  if (!automatizable(factura)) return null
  return (
    <Boton
      icono={Zap}
      cargando={emitiendo}
      onClick={async () => {
        try {
          const [r] = await emitir([factura])
          if (r.ok) toast.success(`Factura ${r.numero} hecha. CAE ${r.cae}`)
          else toast.error(`ARCA no la aceptó: ${r.error}`)
        } catch (e) {
          toast.error(`No se pudo hacer la factura: ${mensajeError(e)}`)
        }
      }}
    >
      Hacer Factura C
    </Boton>
  )
}

/** «Hacer las N facturas»: todas de una, con confirmación y resumen. */
export function FacturarTodas({ facturas }: { facturas: Factura[] }) {
  const { emitir, emitiendo } = useEmitir()
  const [confirmando, setConfirmando] = useState(false)
  const [resultado, setResultado] = useState<{ hechas: number; errores: string[] } | null>(null)
  const lista = facturas.filter(automatizable)
  const manuales = facturas.length - lista.length
  if (!lista.length) return null
  const total = (m: Moneda) => lista.filter((f) => f.moneda === m).reduce((s, f) => s + f.monto, 0)
  const totales = (['ARS', 'USD'] as Moneda[]).filter((m) => total(m) > 0).map((m) => formatMonto(total(m), m)).join(' + ')

  async function hacerTodas() {
    try {
      const r = await emitir(lista)
      const hechas = r.filter((x) => x.ok).length
      const errores = r.flatMap((x, i) => (x.ok ? [] : [`${lista[i].paciente.nombre}: ${x.error}`]))
      setResultado({ hechas, errores })
      if (hechas) toast.success(`${plural(hechas, 'factura hecha', 'facturas hechas')} en ARCA`)
      if (errores.length) toast.error(`${plural(errores.length, 'factura no salió', 'facturas no salieron')}: mirá el detalle`)
      setConfirmando(false)
    } catch (e) {
      toast.error(`No se pudieron hacer las facturas: ${mensajeError(e)}`)
    }
  }

  return (
    <Tarjeta className="flex flex-col gap-3 border-acc p-[1.375rem]">
      <h2 className="m-0 text-lg font-semibold">Hacelas con ARCA en un toque</h2>
      <p className="m-0 text-[0.9375rem] leading-normal text-ink2">
        {plural(lista.length, 'factura', 'facturas')} por {totales}. honorapp las hace en ARCA por vos, una por una, y marca cada pago con su número.
        {manuales > 0 && ` ${plural(manuales, 'factura a obra social queda', 'facturas a obras sociales quedan')} para hacer a mano.`}
      </p>
      <Boton icono={Zap} className="self-start" onClick={() => setConfirmando(true)}>
        Hacer {plural(lista.length, 'factura', 'facturas')}
      </Boton>
      {resultado && resultado.errores.length > 0 && (
        <ul className="m-0 flex flex-col gap-1 rounded-[0.875rem] bg-bad-soft p-3 pl-7 text-[0.9375rem] text-bad">
          {resultado.errores.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {confirmando && (
        <Confirmar
          titulo={`Hacer ${plural(lista.length, 'factura', 'facturas')} en ARCA`}
          textoConfirmar="Hacerlas"
          peligroso={false}
          cargando={emitiendo}
          onCancelar={() => setConfirmando(false)}
          onConfirmar={hacerTodas}
        >
          Son Facturas C reales por {totales}, con la fecha de hoy. Una vez hechas no se borran: si alguna está mal, se anula con una nota de crédito en ARCA.
        </Confirmar>
      )}
    </Tarjeta>
  )
}

/** Las facturas que hizo honorapp: PDF, mandarla al paciente, y todas juntas a la contadora. */
export function FacturasHechas({ perfil }: { perfil: Perfil | undefined }) {
  const facturas = useFacturasArca()
  const [haciendo, setHaciendo] = useState<string | null>(null)
  const lista = (facturas.data ?? []).slice(0, 30)
  if (!lista.length) return null
  const delMes = lista.filter((f) => f.fecha.slice(0, 7) === lista[0].fecha.slice(0, 7))

  async function accion(clave: string, fn: () => Promise<unknown>, ok: string) {
    setHaciendo(clave)
    try {
      await fn()
      toast.success(ok)
    } catch (e) {
      toast.error(`No se pudo: ${mensajeError(e)}`)
    } finally {
      setHaciendo(null)
    }
  }

  const aContadora = () =>
    compartirFacturas(delMes, perfil, `Hola! Te paso las ${delMes.length} facturas de este mes.${perfil?.nombre ? `\n${perfil.nombre}` : ''}`, perfil?.contadora_email)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2 px-1">
        <h2 className="m-0 text-xl font-semibold">Hechas con honorapp</h2>
        <div className="flex flex-wrap gap-2">
          <Boton variante="borde" alto="h-11" icono={Download} cargando={haciendo === 'todas'} onClick={() => accion('todas', () => descargarFacturas(delMes, perfil), 'PDF descargado')}>
            PDF del mes ({delMes.length})
          </Boton>
          <Boton variante="borde" alto="h-11" icono={Send} cargando={haciendo === 'contadora'} onClick={() => accion('contadora', aContadora, 'Listo')}>
            Mandar a mi contadora
          </Boton>
        </div>
      </div>
      <Tarjeta className="p-2">
        {lista.map((f) => (
          <FilaHecha key={f.id} f={f} haciendo={haciendo} accion={accion} perfil={perfil} />
        ))}
      </Tarjeta>
    </div>
  )
}

function FilaHecha({
  f,
  perfil,
  haciendo,
  accion,
}: {
  f: FacturaArca
  perfil: Perfil | undefined
  haciendo: string | null
  accion: (clave: string, fn: () => Promise<unknown>, ok: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-[1rem] px-3 py-2.5">
      <div className="min-w-0">
        <div className="truncate font-semibold">
          {f.receptor} · {formatMonto(f.total, f.moneda)}
          {f.entorno === 'homo' && <span className="ml-2 text-sm font-normal text-ink2">(prueba)</span>}
        </div>
        <div className="text-sm text-ink2 tabular">
          {numeroFactura(f.punto_venta, f.numero)} · {formatFecha(f.fecha)} · CAE {f.cae}
        </div>
      </div>
      <div className="flex gap-1.5">
        <Boton variante="texto" alto="h-10" icono={Download} cargando={haciendo === `pdf-${f.id}`} onClick={() => accion(`pdf-${f.id}`, () => descargarFacturas([f], perfil), 'PDF descargado')}>
          PDF
        </Boton>
        <Boton
          variante="texto"
          alto="h-10"
          icono={Share2}
          cargando={haciendo === `env-${f.id}`}
          onClick={() => accion(`env-${f.id}`, () => compartirFacturas([f], perfil, mensajeFactura(f, perfil)), 'Listo')}
        >
          Mandar
        </Boton>
      </div>
    </div>
  )
}
