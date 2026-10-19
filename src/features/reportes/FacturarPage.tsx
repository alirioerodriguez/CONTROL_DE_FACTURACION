import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronDown, ChevronLeft, Copy, Download, ExternalLink, ReceiptText, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Boton, Campo, EstadoError, EstadoVacio, Esqueleto, IC, Pastilla, Tarjeta, Titulo } from '../../components/ui'
import { usePalabras } from '../../components/usePalabras'
import { nombreCompleto, useDatos, useGuardar } from '../../lib/datos'
import { datosFactura, pagosParaFacturar, textoFactura, type ParaFacturar } from '../../lib/facturar'
import { capitalizar, formatFecha, formatMonto, formatPeriodo, hoyAR, periodoDe, sumarMeses, type Moneda } from '../../lib/formato'
import type { ResultadoCruce } from '../../lib/facturitas'
import { mensajeError } from '../../lib/supabase'

const ARCA = 'https://auth.afip.gob.ar/contribuyente_/login.xhtml'

async function copiar(texto: string, que: string) {
  try {
    await navigator.clipboard.writeText(texto)
    toast.success(`${que} copiado`)
  } catch {
    toast.error('No se pudo copiar. Seleccioná el texto y copialo a mano.')
  }
}

/** Pagos sin factura con los datos listos para cargar la Factura C en ARCA, y marcarlos cuando ya se hizo. */
export function FacturarPage() {
  const navegar = useNavigate()
  const { pacientes, pagos, cargando, error, reintentar } = useDatos()
  const actual = periodoDe(hoyAR())
  const [meses, setMeses] = useState(3)
  const lista = useMemo(() => pagosParaFacturar(pagos, pacientes, sumarMeses(actual, -(meses - 1))), [pagos, pacientes, actual, meses])
  // El resumen de Facturitas se cruza con todo lo pendiente del último año, no solo con lo que se ve.
  const pendientesAnio = useMemo(() => pagosParaFacturar(pagos, pacientes, sumarMeses(actual, -11)).flatMap((m) => m.items), [pagos, pacientes, actual])

  if (cargando) return <Esqueleto que="los pagos para facturar" />
  if (error) return <EstadoError que="los pagos para facturar" reintentar={reintentar} />

  return (
    <section className="flex flex-col gap-6">
      <button
        type="button"
        onClick={() => navegar('/contadora')}
        className="flex h-10 items-center gap-1.5 self-start rounded-full pr-3.5 pl-2 text-base font-semibold text-ink2 hover:bg-surface2"
      >
        <ChevronLeft {...IC} />
        Contadora
      </button>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Titulo sub="Pagos que todavía no tienen Factura C, con los datos que te pide ARCA.">Para facturar</Titulo>
        <a
          href={ARCA}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-[3.25rem] items-center gap-2 rounded-full border border-line px-5 text-base font-semibold hover:bg-surface2"
        >
          <ExternalLink {...IC} />
          Abrir ARCA
        </a>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {[1, 3, 6, 12].map((n) => (
          <Pastilla key={n} activa={meses === n} onClick={() => setMeses(n)}>
            {n === 1 ? 'Este mes' : `Últimos ${n} meses`}
          </Pastilla>
        ))}
      </div>

      {(lista.length > 0 || pendientesAnio.length > 0) && (
        <ConFacturitas visibles={lista.flatMap((m) => m.items)} pendientes={pendientesAnio} />
      )}

      {lista.length === 0 ? (
        <EstadoVacio icono={Check} titulo="Todo facturado">
          No hay pagos sin Factura C en {meses === 1 ? 'este mes' : `los últimos ${meses} meses`}.
        </EstadoVacio>
      ) : (
        lista.map((m) => (
          <div key={m.periodo} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
              <h2 className="m-0 text-xl font-semibold">{capitalizar(formatPeriodo(m.periodo))}</h2>
              <div className="text-[0.9375rem] text-ink2 tabular">
                {(['ARS', 'USD'] as Moneda[])
                  .filter((x) => m.total[x] > 0)
                  .map((x) => formatMonto(m.total[x], x))
                  .join(' + ')}{' '}
                sin facturar
              </div>
            </div>
            <Tarjeta className="p-2">
              {m.items.map((it) => (
                <ItemFactura key={it.pago.id} item={it} />
              ))}
            </Tarjeta>
          </div>
        ))
      )}

      <p className="m-0 px-1 text-sm leading-normal text-ink2">
        En ARCA: Comprobantes en línea → Generar comprobantes → Factura C. honorapp no emite la factura: te deja los datos listos para
        copiar. Cuando la hagas, tocá «Ya la hice» y anotá el número.
      </p>
    </section>
  )
}

function ItemFactura({ item }: { item: ParaFacturar }) {
  const pal = usePalabras()
  const guardar = useGuardar()
  const [abierto, setAbierto] = useState(false)
  const [marcando, setMarcando] = useState(false)
  const [numero, setNumero] = useState('')
  const { pago, paciente } = item
  const datos = datosFactura(item, pal.sesiones)

  async function marcar() {
    const nro = numero.trim()
    if (!nro) {
      toast.error('Escribí el número de la factura (por ejemplo C 0002-00000123).')
      return
    }
    try {
      await guardar.mutateAsync([{ tipo: 'actualizar', tabla: 'payments', id: pago.id, cambios: { comprobante: 'factura_c', nro_factura: nro } }])
      toast.success(`Pago de ${paciente.nombre} marcado como facturado`)
    } catch (e) {
      toast.error(`No se pudo guardar: ${mensajeError(e)}`)
    }
  }

  return (
    <div className="rounded-2xl px-3.5 py-3 [&+&]:border-t [&+&]:border-line">
      <button type="button" onClick={() => setAbierto(!abierto)} aria-expanded={abierto} className="flex w-full items-center gap-3 bg-transparent p-0 text-left">
        {/* En el celular el ícono se oculta y el monto va debajo del nombre, para que el texto entre en una línea. */}
        <span className="hidden size-11 shrink-0 place-items-center rounded-[0.875rem] bg-surface2 text-ink2 sm:grid">
          <ReceiptText {...IC} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[1.0625rem] font-semibold">{nombreCompleto(paciente)}</span>
          <span className="block text-base font-semibold tabular sm:hidden">{formatMonto(pago.monto, pago.moneda)}</span>
          <span className="block text-sm text-ink2">
            {pago.pagador === 'obra_social' ? `Pagó ${paciente.obra_social || 'la obra social'} el ${formatFecha(pago.fecha)}` : `Pagó el ${formatFecha(pago.fecha)}`} · {pago.comprobante === 'recibo' ? 'con recibo' : 'sin comprobante'}
          </span>
        </span>
        <span className="hidden text-[1.0625rem] font-semibold whitespace-nowrap tabular sm:inline">{formatMonto(pago.monto, pago.moneda)}</span>
        <ChevronDown {...IC} className={`shrink-0 text-ink2 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {abierto && (
        <div className="mt-3 flex flex-col gap-3 pl-0 md:pl-14">
          <dl className="m-0 grid grid-cols-1 gap-x-4 gap-y-2 rounded-2xl bg-surface2 p-4 sm:grid-cols-[auto_1fr]">
            {datos.map((d) => (
              <div key={d.etiqueta} className="contents">
                <dt className="text-sm font-semibold text-ink2 sm:pt-0.5">{d.etiqueta}</dt>
                <dd className="m-0 mb-1 flex items-start justify-between gap-2 break-words sm:mb-0">
                  <span className="min-w-0">{d.valor}</span>
                  <button
                    type="button"
                    onClick={() => copiar(d.valor, d.etiqueta)}
                    aria-label={`Copiar ${d.etiqueta}`}
                    className="grid size-8 shrink-0 place-items-center rounded-lg text-ink2 hover:bg-surface"
                  >
                    <Copy {...IC} className="size-4" />
                  </button>
                </dd>
              </div>
            ))}
          </dl>
          {marcando ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[13rem] flex-1">
                <Campo etiqueta="Número de factura" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="C 0002-00000123" autoFocus />
              </div>
              <Boton cargando={guardar.isPending} onClick={marcar}>
                Guardar
              </Boton>
              <Boton variante="texto" onClick={() => setMarcando(false)}>
                Cancelar
              </Boton>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Boton variante="borde" icono={Copy} onClick={() => copiar(textoFactura(item, pal.sesiones), 'Todo')}>
                Copiar todo
              </Boton>
              <Boton icono={Check} onClick={() => setMarcando(true)}>
                Ya la hice
              </Boton>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Facturar todo junto con Facturitas: se baja la planilla para su facturación masiva y, después, se sube el
 * resumen que da Facturitas para marcar los pagos como facturados. Ver docs/investigacion/facturitas.md.
 */
function ConFacturitas({ visibles, pendientes }: { visibles: ParaFacturar[]; pendientes: ParaFacturar[] }) {
  const pal = usePalabras()
  const guardar = useGuardar()
  const archivo = useRef<HTMLInputElement>(null)
  const [bajando, setBajando] = useState(false)
  const [leyendo, setLeyendo] = useState(false)
  const [cruce, setCruce] = useState<ResultadoCruce | null>(null)

  async function descargar() {
    setBajando(true)
    try {
      const { exportarParaFacturitas } = await import('../../lib/exportar')
      await exportarParaFacturitas(visibles, pal.sesiones)
      toast.success(`Planilla descargada con ${visibles.length} ${visibles.length === 1 ? 'pago' : 'pagos'}. Subila en Facturitas → Facturación Masiva.`)
    } catch (e) {
      toast.error(`No se pudo armar la planilla: ${mensajeError(e)}`)
    } finally {
      setBajando(false)
    }
  }

  async function leer(f: File) {
    setLeyendo(true)
    try {
      const [{ leerArchivo }, { cruzarResumen }] = await Promise.all([import('../../lib/importar/leer'), import('../../lib/facturitas')])
      const hojas = await leerArchivo(f)
      const hoja = hojas.find((h) => h.filas.length > 0) ?? hojas[0]
      const r = cruzarResumen(hoja, pendientes)
      if (r.columnasFaltantes.length) toast.error(`El archivo no tiene: ${r.columnasFaltantes.join(', ')}. ¿Es el resumen que da Facturitas?`)
      else if (!r.coincidencias.length) toast.error('Ninguna factura del archivo coincide con un pago pendiente (mismo importe y fecha cercana).')
      else setCruce(r)
    } catch (e) {
      toast.error(mensajeError(e))
    } finally {
      setLeyendo(false)
      if (archivo.current) archivo.current.value = ''
    }
  }

  async function confirmar() {
    if (!cruce) return
    try {
      await guardar.mutateAsync(
        cruce.coincidencias.map((c) => ({
          tipo: 'actualizar' as const,
          tabla: 'payments' as const,
          id: c.item.pago.id,
          cambios: { comprobante: 'factura_c', nro_factura: c.numero },
        })),
      )
      toast.success(`${cruce.coincidencias.length} ${cruce.coincidencias.length === 1 ? 'pago marcado' : 'pagos marcados'} como facturados`)
      setCruce(null)
    } catch (e) {
      toast.error(`No se pudo guardar: ${mensajeError(e)}`)
    }
  }

  return (
    <Tarjeta className="flex flex-col gap-3 p-[1.375rem]">
      <h2 className="m-0 text-lg font-semibold">Facturar todo junto con Facturitas</h2>
      <p className="m-0 text-[0.9375rem] leading-normal text-ink2">
        Si usás Facturitas (plan Profesional), bajá la planilla con estos pagos y subila en su Facturación Masiva. Después subí acá el
        resumen que te da Facturitas y los pagos quedan marcados como facturados, con su número.
      </p>
      {cruce ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface2 p-4">
          <div className="text-base font-semibold">
            {cruce.coincidencias.length} {cruce.coincidencias.length === 1 ? 'factura coincide' : 'facturas coinciden'} con pagos pendientes
          </div>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[0.9375rem]">
            {cruce.coincidencias.map((c) => (
              <li key={c.item.pago.id} className="flex flex-wrap justify-between gap-x-3">
                <span>
                  {nombreCompleto(c.item.paciente)} · {formatFecha(c.item.pago.fecha)}
                </span>
                <span className="text-ink2 tabular">
                  {formatMonto(c.item.pago.monto, c.item.pago.moneda)} → {c.numero}
                </span>
              </li>
            ))}
          </ul>
          {cruce.sinCruzar > 0 && (
            <div className="text-sm text-ink2">
              {cruce.sinCruzar === 1
                ? '1 fila del archivo no coincide con ningún pago pendiente y no se toca.'
                : `${cruce.sinCruzar} filas del archivo no coinciden con ningún pago pendiente y no se tocan.`}
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Boton icono={Check} cargando={guardar.isPending} onClick={confirmar}>
              Marcar como facturados
            </Boton>
            <Boton variante="texto" onClick={() => setCruce(null)}>
              Cancelar
            </Boton>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Boton variante="borde" icono={Download} disabled={!visibles.length} cargando={bajando} onClick={descargar}>
            Bajar planilla ({visibles.length})
          </Boton>
          <Boton variante="borde" icono={Upload} cargando={leyendo} onClick={() => archivo.current?.click()}>
            Subir resumen
          </Boton>
          <input
            ref={archivo}
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void leer(f)
            }}
          />
        </div>
      )}
    </Tarjeta>
  )
}
