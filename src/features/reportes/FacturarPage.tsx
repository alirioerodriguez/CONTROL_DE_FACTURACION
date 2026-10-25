import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Download, ExternalLink, ListChecks, ReceiptText, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { Boton, Campo, EstadoError, EstadoVacio, Esqueleto, IC, Pastilla, Tarjeta, Titulo } from '../../components/ui'
import { usePalabras } from '../../components/usePalabras'
import { nombreCompleto, useDatos, useGuardar, type Pago } from '../../lib/datos'
import {
  armarFacturas,
  datosFactura,
  fechasDePago,
  numeroSiguiente,
  pagosParaFacturar,
  pantallasArca,
  textoFactura,
  type CampoArca,
  type Factura,
  type ParaFacturar,
} from '../../lib/facturar'
import { capitalizar, formatFecha, formatPeriodo, hoyAR, periodoDe, plural, sumarMeses, type Moneda } from '../../lib/formato'
import { verMonto } from '../../lib/discreto'
import type { ResultadoCruce } from '../../lib/facturitas'
import type { ResultadoMisComprobantes } from '../../lib/misComprobantes'
import { mensajeError } from '../../lib/supabase'
import { guardarPreferencia, preferencia } from '../../lib/tema'

const ARCA = 'https://auth.afip.gob.ar/contribuyente_/login.xhtml'

async function copiar(texto: string, que: string) {
  try {
    await navigator.clipboard.writeText(texto)
    toast.success(`${que} copiado`)
  } catch {
    toast.error('No se pudo copiar. Seleccioná el texto y copialo a mano.')
  }
}

/** Los cambios para marcar los pagos de una factura como facturados con su número. */
const marcarPagos = (pagos: Pago[], numero: string) =>
  pagos.map((p) => ({ tipo: 'actualizar' as const, tabla: 'payments' as const, id: p.id, cambios: { comprobante: 'factura_c', nro_factura: numero } }))

function BotonArca({ className = '' }: { className?: string }) {
  return (
    <a
      href={ARCA}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex max-w-full min-h-[3.25rem] items-center justify-center gap-2 py-1.5 text-center leading-tight rounded-full border border-line px-5 text-base font-semibold hover:bg-surface2 ${className}`}
    >
      <ExternalLink {...IC} className="shrink-0" />
      Abrir ARCA
    </a>
  )
}

/** Pagos sin factura con los datos listos para cargar la Factura C en ARCA, y marcarlos cuando ya se hizo. */
export function FacturarPage() {
  const navegar = useNavigate()
  const { pacientes, pagos, sesiones, cargando, error, reintentar } = useDatos()
  const actual = periodoDe(hoyAR())
  const [meses, setMeses] = useState(3)
  const [porMes, setPorMes] = useState(() => preferencia<'mes' | 'pago'>('facturarPor', 'pago') === 'mes')
  const [guiado, setGuiado] = useState<{ facturas: Factura[]; inicio: number } | null>(null)
  const lista = useMemo(() => pagosParaFacturar(pagos, pacientes, sumarMeses(actual, -(meses - 1))), [pagos, pacientes, actual, meses])
  const facturasPorMes = useMemo(() => lista.map((m) => ({ ...m, facturas: armarFacturas(m.items, porMes, sesiones) })), [lista, porMes, sesiones])
  const facturas = useMemo(() => facturasPorMes.flatMap((m) => m.facturas), [facturasPorMes])
  // Los archivos de ARCA y de Facturitas se cruzan con todo lo pendiente del último año, no solo con lo que se ve.
  const pendientesAnio = useMemo(() => pagosParaFacturar(pagos, pacientes, sumarMeses(actual, -11)).flatMap((m) => m.items), [pagos, pacientes, actual])
  // El último número cargado, para proponer el siguiente.
  const ultimoNumero = useMemo(
    () =>
      pagos
        .filter((p) => p.comprobante === 'factura_c' && p.nro_factura)
        .sort((a, b) => b.fecha.localeCompare(a.fecha))[0]?.nro_factura ?? '',
    [pagos],
  )

  if (cargando) return <Esqueleto que="los pagos para facturar" />
  if (error) return <EstadoError que="los pagos para facturar" reintentar={reintentar} />

  if (guiado) return <ModoArca facturas={guiado.facturas} inicio={guiado.inicio} ultimoNumero={ultimoNumero} salir={() => setGuiado(null)} />

  function elegirModo(mes: boolean) {
    setPorMes(mes)
    guardarPreferencia('facturarPor', mes ? 'mes' : 'pago')
  }

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
        <BotonArca />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {[1, 3, 6, 12].map((n) => (
            <Pastilla key={n} activa={meses === n} onClick={() => setMeses(n)}>
              {n === 1 ? 'Este mes' : `Últimos ${n} meses`}
            </Pastilla>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-full bg-surface2 p-1" role="group" aria-label="Cómo facturar">
          {[
            [false, 'Una por pago'],
            [true, 'Una por paciente por mes'],
          ].map(([mes, texto]) => (
            <button
              key={String(mes)}
              type="button"
              aria-pressed={porMes === mes}
              onClick={() => elegirModo(mes as boolean)}
              className={`presionable min-h-10 rounded-full px-3 py-1 text-[0.9375rem] leading-tight font-semibold ${porMes === mes ? 'bg-surface text-ink shadow-sm' : 'text-ink2'}`}
            >
              {texto}
            </button>
          ))}
        </div>
      </div>

      {facturas.length > 0 && (
        <Tarjeta className="flex flex-col gap-3 p-[1.375rem]">
          <h2 className="m-0 text-lg font-semibold">
            {facturas.length === 1 ? '1 factura para hacer' : `${facturas.length} facturas para hacer`}
            {porMes && facturas.length < lista.reduce((n, m) => n + m.items.length, 0) && (
              <span className="font-normal text-ink2"> · {plural(lista.reduce((n, m) => n + m.items.length, 0), 'pago', 'pagos')}</span>
            )}
          </h2>
          <p className="m-0 text-[0.9375rem] leading-normal text-ink2">
            Abrí ARCA en otra pestaña y seguí las mismas pantallas de Comprobantes en línea: te mostramos solo lo que cambia en cada factura,
            con un botón para copiar cada dato.
          </p>
          <div className="flex flex-wrap gap-2">
            <Boton icono={ListChecks} onClick={() => setGuiado({ facturas, inicio: 0 })}>
              Hacerlas paso a paso
            </Boton>
          </div>
        </Tarjeta>
      )}

      {pendientesAnio.length > 0 && <DesdeMisComprobantes pendientes={pendientesAnio} />}

      {(lista.length > 0 || pendientesAnio.length > 0) && (
        <ConFacturitas visibles={lista.flatMap((m) => m.items)} pendientes={pendientesAnio} />
      )}

      {lista.length === 0 ? (
        <EstadoVacio icono={Check} titulo="Todo facturado">
          No hay pagos sin Factura C en {meses === 1 ? 'este mes' : `los últimos ${meses} meses`}.
        </EstadoVacio>
      ) : (
        facturasPorMes.map((m) => (
          <div key={m.periodo} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
              <h2 className="m-0 text-xl font-semibold">{capitalizar(formatPeriodo(m.periodo))}</h2>
              <div className="text-[0.9375rem] text-ink2 tabular">
                {(['ARS', 'USD'] as Moneda[])
                  .filter((x) => m.total[x] > 0)
                  .map((x) => verMonto(m.total[x], x))
                  .join(' + ')}{' '}
                sin facturar
              </div>
            </div>
            <Tarjeta className="p-2">
              {m.facturas.map((f) => (
                <ItemFactura key={f.clave} factura={f} pasoAPaso={() => setGuiado({ facturas, inicio: facturas.indexOf(f) })} />
              ))}
            </Tarjeta>
          </div>
        ))
      )}

      <p className="m-0 px-1 text-sm leading-normal text-ink2">
        En ARCA: Comprobantes en línea → Generar comprobantes → Factura C. honorapp no emite la factura: te deja los datos listos para
        copiar. Cuando la hagas, tocá «Ya la hice» y anotá el número, o subí después el archivo de Mis Comprobantes.
      </p>
    </section>
  )
}

/** Quién pagó y cuándo, para la fila de la lista. */
function detallePago(f: Factura): string {
  const quien = f.pagador === 'obra_social' ? `Pagó ${f.paciente.obra_social || 'la obra social'}` : 'Pagó'
  const cuantos = f.pagos.length > 1 ? ` · ${f.pagos.length} pagos` : ` · ${f.pagos[0].comprobante === 'recibo' ? 'con recibo' : 'sin comprobante'}`
  return `${quien} ${f.pagos.length > 1 ? 'del' : 'el'} ${fechasDePago(f)}${cuantos}`
}

function ItemFactura({ factura, pasoAPaso }: { factura: Factura; pasoAPaso: () => void }) {
  const pal = usePalabras()
  const guardar = useGuardar()
  const [abierto, setAbierto] = useState(false)
  const [marcando, setMarcando] = useState(false)
  const [numero, setNumero] = useState('')
  const { paciente } = factura
  const datos = datosFactura(factura, pal)

  async function marcar() {
    const nro = numero.trim()
    if (!nro) {
      toast.error('Escribí el número de la factura (por ejemplo C 0002-00000123).')
      return
    }
    try {
      await guardar.mutateAsync(marcarPagos(factura.pagos, nro))
      toast.success(factura.pagos.length > 1 ? `${factura.pagos.length} pagos de ${paciente.nombre} marcados como facturados` : `Pago de ${paciente.nombre} marcado como facturado`)
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
          <span className="block text-base font-semibold tabular sm:hidden">{verMonto(factura.monto, factura.moneda)}</span>
          <span className="block text-sm text-ink2">{detallePago(factura)}</span>
        </span>
        <span className="hidden text-[1.0625rem] font-semibold whitespace-nowrap tabular sm:inline">{verMonto(factura.monto, factura.moneda)}</span>
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
              <Boton variante="borde" icono={ListChecks} onClick={pasoAPaso}>
                Paso a paso
              </Boton>
              <Boton variante="borde" icono={Copy} onClick={() => copiar(textoFactura(factura, pal), 'Todo')}>
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

// ---------------------------------------------------------------------
// Modo ARCA: una factura tras otra, pantalla por pantalla
// ---------------------------------------------------------------------

/**
 * Guía la carga en Comprobantes en línea con las mismas pantallas y en el mismo orden. Resalta lo que cambia en cada
 * factura (con un botón para copiar cada dato) y pliega lo que es siempre igual. Al final se anota el número y sigue
 * la próxima. La lista queda fija al entrar, para que el contador no salte cuando se marcan pagos.
 */
function ModoArca({ facturas, inicio, ultimoNumero, salir }: { facturas: Factura[]; inicio: number; ultimoNumero: string; salir: () => void }) {
  const pal = usePalabras()
  const guardar = useGuardar()
  const [indice, setIndice] = useState(Math.max(0, inicio))
  const [pantalla, setPantalla] = useState(0)
  const [hechas, setHechas] = useState<Record<string, string>>({})
  const [ultimo, setUltimo] = useState(ultimoNumero)
  const [numero, setNumero] = useState(() => numeroSiguiente(ultimoNumero))
  const arriba = useRef<HTMLDivElement>(null)

  const terminado = indice >= facturas.length
  const factura = facturas[Math.min(indice, facturas.length - 1)]
  const pantallas = pantallasArca(factura, pal, hoyAR())
  const actual = pantallas[pantalla]
  const ultima = pantalla === pantallas.length - 1
  const cantHechas = Object.keys(hechas).length

  function ir(i: number, p = 0) {
    setIndice(i)
    setPantalla(p)
    arriba.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  async function guardarYSeguir() {
    const nro = numero.trim()
    if (!nro) {
      toast.error('Escribí el número que te dio ARCA (por ejemplo C 0002-00000123).')
      return
    }
    try {
      await guardar.mutateAsync(marcarPagos(factura.pagos, nro))
      toast.success(`Factura de ${factura.paciente.nombre} guardada`)
      setHechas((h) => ({ ...h, [factura.clave]: nro }))
      setUltimo(nro)
      setNumero(numeroSiguiente(nro))
      ir(indice + 1)
    } catch (e) {
      toast.error(`No se pudo guardar: ${mensajeError(e)}`)
    }
  }

  if (terminado) {
    return (
      <section className="flex flex-col gap-6">
        <EstadoVacio
          icono={Check}
          titulo={cantHechas ? '¡Listo!' : 'Llegaste al final'}
          acciones={
            <>
              <Boton onClick={salir}>Volver a Para facturar</Boton>
              {cantHechas < facturas.length && (
                <Boton variante="borde" onClick={() => ir(facturas.findIndex((f) => !hechas[f.clave]))}>
                  Ver las que salteaste
                </Boton>
              )}
            </>
          }
        >
          {cantHechas
            ? `Guardaste ${plural(cantHechas, 'factura', 'facturas')}${ultimo ? `; la última fue la ${ultimo}` : ''}.`
            : 'No marcaste ninguna como hecha.'}
          {cantHechas < facturas.length && ` Quedan ${plural(facturas.length - cantHechas, 'pendiente', 'pendientes')}.`}
        </EstadoVacio>
      </section>
    )
  }

  const cambian = actual.campos.filter((c) => c.cambia)
  const fijos = actual.campos.filter((c) => !c.cambia)

  return (
    <section ref={arriba} className="flex scroll-mt-4 flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={salir} className="flex h-10 items-center gap-1.5 rounded-full pr-3.5 pl-2 text-base font-semibold text-ink2 hover:bg-surface2">
          <X {...IC} />
          Salir
        </button>
        <BotonArca />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2 px-1">
          <div className="text-[0.9375rem] font-semibold text-ink2 tabular" aria-live="polite">
            Factura {indice + 1} de {facturas.length}
          </div>
          {cantHechas > 0 && <div className="text-sm text-ink2">{plural(cantHechas, 'hecha', 'hechas')}</div>}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface2" aria-hidden>
          <div className="h-full rounded-full bg-acc transition-[width]" style={{ width: `${((indice + (pantalla + 1) / pantallas.length) / facturas.length) * 100}%` }} />
        </div>
      </div>

      <Tarjeta className="flex flex-col gap-1 p-[1.375rem]">
        <div className="text-xl font-semibold">{nombreCompleto(factura.paciente)}</div>
        <div className="text-[0.9375rem] text-ink2">
          {verMonto(factura.monto, factura.moneda)} · {capitalizar(formatPeriodo(factura.periodo))}
          {factura.pagos.length > 1 && ` · ${factura.pagos.length} pagos juntos`}
          {hechas[factura.clave] && ` · ya guardada (${hechas[factura.clave]})`}
        </div>
      </Tarjeta>

      {/* Las pantallas de ARCA, para saltar a una. */}
      <ol className="m-0 flex list-none gap-1.5 overflow-x-auto p-0 pb-0.5" aria-label="Pantallas de ARCA">
        {pantallas.map((p, i) => (
          <li key={p.titulo}>
            <button
              type="button"
              onClick={() => setPantalla(i)}
              aria-current={i === pantalla ? 'step' : undefined}
              className={`h-9 rounded-full px-3 text-sm font-semibold whitespace-nowrap ${
                i === pantalla ? 'bg-ink text-fondo' : i < pantalla ? 'bg-acc-soft text-acc-strong' : 'bg-surface2 text-ink2'
              }`}
            >
              {i + 1}. {p.corto}
            </button>
          </li>
        ))}
      </ol>

      <Tarjeta className="flex flex-col gap-4 p-[1.375rem]">
        <div>
          <div className="text-sm font-semibold text-ink2">
            Pantalla {pantalla + 1} de {pantallas.length}
          </div>
          <h2 className="m-0 text-xl font-semibold">{actual.titulo}</h2>
        </div>

        {cambian.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {cambian.map((c) => (
              <CampoQueCambia key={c.etiqueta} campo={c} />
            ))}
          </ul>
        )}

        {fijos.length > 0 && (
          <details className="group rounded-2xl bg-surface2 px-4 py-3" open={cambian.length === 0}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[0.9375rem] font-semibold text-ink2">
              <span className="min-w-0">
                Siempre igual: <span className="font-normal">{fijos.map((c) => c.valor.split(' (')[0]).join(' · ')}</span>
              </span>
              <ChevronDown {...IC} className="shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <dl className="m-0 mt-3 flex flex-col gap-2">
              {fijos.map((c) => (
                <div key={c.etiqueta} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <dt className="text-sm text-ink2">{c.etiqueta}</dt>
                    <dd className="m-0">{c.valor}</dd>
                  </div>
                  {c.copiar && (
                    <button
                      type="button"
                      onClick={() => copiar(c.copiar!, c.etiqueta)}
                      aria-label={`Copiar ${c.etiqueta}`}
                      className="grid size-10 shrink-0 place-items-center rounded-xl text-ink2 hover:bg-surface"
                    >
                      <Copy {...IC} className="size-4" />
                    </button>
                  )}
                </div>
              ))}
            </dl>
          </details>
        )}

        {ultima ? (
          <div className="flex flex-col gap-3 border-t border-line pt-4">
            <p className="m-0 text-[0.9375rem] leading-normal text-ink2">
              En ARCA tocá <b className="text-ink">Confirmar datos</b> y después <b className="text-ink">Generar comprobante</b>. Anotá acá el número que te
              da.
            </p>
            <Campo etiqueta="Número de factura" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="C 0002-00000123" />
            <div className="flex flex-wrap gap-2">
              <Boton icono={Check} cargando={guardar.isPending} onClick={guardarYSeguir}>
                Guardar y siguiente factura
              </Boton>
              <Boton variante="texto" onClick={() => ir(indice + 1)}>
                Saltear
              </Boton>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-line pt-4">
            <span className="text-[0.9375rem] text-ink2">
              En ARCA tocá <b className="text-ink">{actual.boton}</b>
            </span>
            <Boton onClick={() => setPantalla(pantalla + 1)}>
              Siguiente pantalla
              <ChevronRight {...IC} className="shrink-0" />
            </Boton>
          </div>
        )}
      </Tarjeta>

      <div className="flex flex-wrap justify-between gap-2">
        <Boton variante="texto" icono={ChevronLeft} disabled={indice === 0} onClick={() => ir(indice - 1)}>
          Factura anterior
        </Boton>
        <Boton variante="borde" onClick={() => ir(indice + 1)}>
          Siguiente factura
          <ChevronRight {...IC} className="shrink-0" />
        </Boton>
      </div>
    </section>
  )
}

function CampoQueCambia({ campo }: { campo: CampoArca }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-2xl border border-acc bg-acc-soft px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-acc-strong">{campo.etiqueta}</div>
        <div className="text-[1.0625rem] font-semibold break-words">{campo.valor}</div>
      </div>
      {campo.copiar && (
        <button
          type="button"
          onClick={() => copiar(campo.copiar!, campo.etiqueta)}
          aria-label={`Copiar ${campo.etiqueta}`}
          className="presionable inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-acc px-4 text-[0.9375rem] font-semibold text-on-acc hover:bg-acc-strong"
        >
          <Copy {...IC} className="size-4" />
          Copiar
        </button>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------
// Marcar lo ya hecho en ARCA con el archivo de Mis Comprobantes
// ---------------------------------------------------------------------

function DesdeMisComprobantes({ pendientes }: { pendientes: ParaFacturar[] }) {
  const guardar = useGuardar()
  const archivo = useRef<HTMLInputElement>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [cruce, setCruce] = useState<ResultadoMisComprobantes | null>(null)
  const [quitadas, setQuitadas] = useState<Set<string>>(new Set())

  async function leer(f: File) {
    setLeyendo(true)
    try {
      const [{ leerArchivo }, { cruzarMisComprobantes, encabezadoMisComprobantes }] = await Promise.all([
        import('../../lib/importar/leer'),
        import('../../lib/misComprobantes'),
      ])
      const hojas = await leerArchivo(f, encabezadoMisComprobantes)
      const hoja = hojas.find((h) => h.filas.length > 0) ?? hojas[0]
      const r = cruzarMisComprobantes(hoja, pendientes)
      if (r.error) toast.error(r.error)
      else if (!r.coincidencias.length) toast.error('Ninguna Factura C del archivo coincide con un pago pendiente (mismo importe, documento y fecha cercana).')
      else {
        setQuitadas(new Set())
        setCruce(r)
      }
    } catch (e) {
      toast.error(mensajeError(e))
    } finally {
      setLeyendo(false)
      if (archivo.current) archivo.current.value = ''
    }
  }

  async function confirmar() {
    if (!cruce) return
    const elegidas = cruce.coincidencias.filter((c) => !quitadas.has(c.factura.clave))
    if (!elegidas.length) {
      toast.error('No elegiste ninguna factura.')
      return
    }
    try {
      await guardar.mutateAsync(elegidas.flatMap((c) => marcarPagos(c.factura.pagos, c.comprobante.numero)))
      const n = elegidas.reduce((s, c) => s + c.factura.pagos.length, 0)
      toast.success(`${n} ${n === 1 ? 'pago marcado' : 'pagos marcados'} como facturados`)
      setCruce(null)
    } catch (e) {
      toast.error(`No se pudo guardar: ${mensajeError(e)}`)
    }
  }

  function alternar(clave: string) {
    setQuitadas((q) => {
      const nuevo = new Set(q)
      if (nuevo.has(clave)) nuevo.delete(clave)
      else nuevo.add(clave)
      return nuevo
    })
  }

  return (
    <Tarjeta className="flex flex-col gap-3 p-[1.375rem]">
      <h2 className="m-0 text-lg font-semibold">¿Ya las hiciste en ARCA?</h2>
      <p className="m-0 text-[0.9375rem] leading-normal text-ink2">
        En ARCA entrá a <b className="text-ink">Mis Comprobantes → Emitidos</b>, elegí las fechas y exportá el CSV o el Excel. Subilo acá y
        marcamos los pagos como facturados con su número.
      </p>
      {cruce ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface2 p-4">
          <div className="text-base font-semibold">
            {cruce.coincidencias.length} {cruce.coincidencias.length === 1 ? 'factura coincide' : 'facturas coinciden'} con pagos pendientes
          </div>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[0.9375rem]">
            {cruce.coincidencias.map((c) => (
              <li key={c.factura.clave}>
                <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1">
                  <input
                    type="checkbox"
                    checked={!quitadas.has(c.factura.clave)}
                    onChange={() => alternar(c.factura.clave)}
                    className="mt-0.5 size-5 shrink-0 accent-[var(--acc)]"
                  />
                  <span className="flex min-w-0 flex-1 flex-wrap justify-between gap-x-3">
                    <span>
                      {nombreCompleto(c.factura.paciente)} · {fechasDePago(c.factura)}
                      {c.factura.pagos.length > 1 && ` (${c.factura.pagos.length} pagos)`}
                    </span>
                    <span className="text-ink2 tabular">
                      {verMonto(c.factura.monto, c.factura.moneda)} → <span className="whitespace-nowrap">{c.comprobante.numero}</span>
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {(cruce.sinCruzar > 0 || cruce.otros > 0) && (
            <div className="text-sm text-ink2">
              {[
                cruce.sinCruzar > 0 && `${plural(cruce.sinCruzar, 'Factura C', 'Facturas C')} del archivo no ${cruce.sinCruzar === 1 ? 'coincide' : 'coinciden'} con nada pendiente`,
                cruce.otros > 0 && `${plural(cruce.otros, 'comprobante', 'comprobantes')} que no ${cruce.otros === 1 ? 'es' : 'son'} Factura C`,
              ]
                .filter(Boolean)
                .join(' y ')}
              : no se tocan.
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
          <Boton variante="borde" icono={Upload} cargando={leyendo} onClick={() => archivo.current?.click()}>
            Subir Mis Comprobantes
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
      await guardar.mutateAsync(cruce.coincidencias.flatMap((c) => marcarPagos([c.item.pago], c.numero)))
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
                  {verMonto(c.item.pago.monto, c.item.pago.moneda)} → {c.numero}
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
