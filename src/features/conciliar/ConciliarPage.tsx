import { useMemo, useState, type DragEvent } from 'react'
import { ArrowLeftRight, ClipboardPaste, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import { Alerta, Boton, EstadoError, Esqueleto, IC, Spinner, Tarjeta, Titulo } from '../../components/ui'
import { nombreCompleto, useDatos, useGuardar } from '../../lib/datos'
import { verMonto } from '../../lib/discreto'
import { formatFecha, hoyAR, normalizar, periodoDe, plural } from '../../lib/formato'
import { leerArchivo, type Celda, type Hoja } from '../../lib/importar/leer'
import {
  adivinarColumnas, idDePago, movimientosDeHoja, movimientosDeTexto, ordinales, proponer,
  type Columnas, type Movimiento, type Propuesta,
} from '../../lib/conciliarMovimientos'
import { deudasDe, leerConocidos, recordarPagadores } from '../../lib/pagadoresConocidos'
import { mensajeError } from '../../lib/supabase'

const NO_ES = '__no_es__'

/** En los extractos el encabezado no siempre está en la primera fila: es la que tiene «fecha» y un importe. */
const esEncabezadoBanco = (celdas: Celda[]) => {
  const t = celdas.map((c) => normalizar(String(c ?? '')))
  return t.some((x) => /^fecha/.test(x)) && t.some((x) => /(importe|monto|credito|ingreso|haber|neto|valor)/.test(x))
}

const CAMPOS: { campo: keyof Columnas; etiqueta: string; opcional?: boolean }[] = [
  { campo: 'fecha', etiqueta: 'Fecha' },
  { campo: 'detalle', etiqueta: 'Detalle (quién pagó)' },
  { campo: 'monto', etiqueta: 'Importe o créditos' },
  { campo: 'debito', etiqueta: 'Débitos', opcional: true },
]

/**
 * «Conciliar el mes»: la profesional sube los movimientos de su banco o de Mercado Pago (o pega varios comprobantes) y la
 * app propone de qué paciente es cada ingreso. Revisa, corrige y registra todos los pagos de una vez. El archivo se lee en
 * el dispositivo y no se guarda; volver a subir el mismo extracto no duplica pagos (cada movimiento tiene un id fijo).
 */
export function ConciliarPage() {
  const { perfil, pacientes, sesiones, pagos, cargando, error, reintentar } = useDatos()
  const guardar = useGuardar()
  const [hoja, setHoja] = useState<Hoja | null>(null)
  const [archivo, setArchivo] = useState('')
  const [columnas, setColumnas] = useState<Columnas | null>(null)
  const [pegado, setPegado] = useState('')
  const [modoTexto, setModoTexto] = useState(false)
  const [movs, setMovs] = useState<Movimiento[] | null>(null)
  const [ignorados, setIgnorados] = useState(0)
  const [leyendo, setLeyendo] = useState(false)
  const [problema, setProblema] = useState('')
  // Lo que la profesional cambió a mano: paciente elegido y si se registra, por índice de movimiento.
  const [elegidos, setElegidos] = useState<Record<number, string>>({})
  const [marcados, setMarcados] = useState<Record<number, boolean>>({})
  const [guardando, setGuardando] = useState(false)

  const ordenados = useMemo(() => [...pacientes].sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), 'es')), [pacientes])
  const propuestas = useMemo<Propuesta[]>(() => {
    if (!movs) return []
    return proponer(movs, pacientes, { conocidos: leerConocidos(), deudas: deudasDe(pacientes, sesiones, pagos), pagos })
  }, [movs, pacientes, sesiones, pagos])

  const elegidoDe = (i: number) => elegidos[i] ?? propuestas[i]?.elegido ?? ''
  const marcadoDe = (i: number) => {
    const id = elegidoDe(i)
    if (!id || id === NO_ES) return false
    return marcados[i] ?? !propuestas[i]?.yaCargado
  }
  const aRegistrar = propuestas.map((_, i) => i).filter((i) => marcadoDe(i))

  function reiniciar() {
    setHoja(null)
    setArchivo('')
    setColumnas(null)
    setMovs(null)
    setPegado('')
    setElegidos({})
    setMarcados({})
    setProblema('')
  }

  function aplicarColumnas(h: Hoja, c: Columnas) {
    setColumnas(c)
    setElegidos({})
    setMarcados({})
    if (c.fecha < 0 || c.monto < 0) {
      setMovs(null)
      return
    }
    const r = movimientosDeHoja(h, c, hoyAR(), perfil?.moneda_default ?? 'ARS')
    setMovs(r.movimientos)
    setIgnorados(r.ignorados)
  }

  async function procesar(f: File | undefined) {
    if (!f) return
    setLeyendo(true)
    setProblema('')
    try {
      const hojas = await leerArchivo(f, esEncabezadoBanco)
      // La hoja con más filas suele ser la de movimientos.
      const h = [...hojas].sort((a, b) => b.filas.length - a.filas.length)[0]
      if (!h || h.filas.length === 0) throw new Error('El archivo no tiene movimientos.')
      setArchivo(f.name)
      setHoja(h)
      aplicarColumnas(h, adivinarColumnas(h))
    } catch (e) {
      setProblema(mensajeError(e))
      toast.error('No pudimos leer el archivo')
    } finally {
      setLeyendo(false)
    }
  }

  function leerPegado() {
    const m = movimientosDeTexto(pegado, hoyAR())
    setHoja(null)
    setColumnas(null)
    setElegidos({})
    setMarcados({})
    setIgnorados(0)
    setMovs(m)
    if (m.length === 0) toast.error('No encontramos montos en lo que pegaste')
  }

  async function registrar() {
    if (!perfil?.id || aRegistrar.length === 0) return
    setGuardando(true)
    try {
      const ord = ordinales(movs ?? [])
      const filas = await Promise.all(
        aRegistrar.map(async (i) => {
          const { mov } = propuestas[i]
          const d = mov.datos
          const id = await idDePago(perfil.id, mov, ord[i])
          const medio = /mercado\s*pago/i.test(`${mov.detalle} ${archivo}`) ? 'mercadopago' : 'transferencia'
          return {
            id,
            idempotency_key: id,
            patient_id: elegidoDe(i),
            fecha: d.fecha ?? hoyAR(),
            periodo: periodoDe(d.fecha ?? hoyAR()),
            monto: d.monto,
            moneda: d.moneda ?? 'ARS',
            medio,
            pagador: 'paciente',
            comprobante: 'sin_comprobante',
            // Solo el número de operación (no el detalle, que puede traer datos de terceros).
            observaciones: d.referencia ? `Conciliado · op. ${d.referencia}` : 'Conciliado desde los movimientos',
          }
        }),
      )
      const [nuevos] = (await guardar.mutateAsync([{ tipo: 'insertar', tabla: 'payments', filas }])) as unknown[][]
      const cuantos = nuevos?.length ?? filas.length
      recordarPagadores(
        aRegistrar.flatMap((i) => {
          const p = pacientes.find((x) => x.id === elegidoDe(i))
          return p ? [{ datos: propuestas[i].mov.datos, paciente: p }] : []
        }),
      )
      const repetidos = filas.length - cuantos
      toast.success(
        `${plural(cuantos, 'pago registrado', 'pagos registrados')}${repetidos > 0 ? ` · ${plural(repetidos, 'ya estaba', 'ya estaban')} de antes` : ''}`,
      )
      reiniciar()
    } catch (e) {
      toast.error(`No se pudieron registrar los pagos: ${mensajeError(e)}`)
    } finally {
      setGuardando(false)
    }
  }

  function soltar(e: DragEvent) {
    e.preventDefault()
    procesar(e.dataTransfer.files?.[0])
  }

  if (cargando) return <Esqueleto que="tus pacientes" />
  if (error) return <EstadoError que="tus pacientes" reintentar={reintentar} />

  return (
    <div className="flex flex-col gap-5">
      <Titulo sub="Subí los movimientos de tu banco o de Mercado Pago y te decimos de qué paciente es cada transferencia. Revisás y registrás todos los pagos de una vez.">
        Conciliar el mes
      </Titulo>

      {!movs && (
        <div className="flex flex-col gap-3.5">
          {!modoTexto ? (
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={soltar}
              className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-line bg-surface px-6 py-12 text-center hover:border-acc hover:bg-acc-soft"
            >
              <input
                type="file"
                accept=".xlsx,.csv"
                className="hidden"
                onChange={(e) => {
                  procesar(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
              {leyendo ? (
                <>
                  <Spinner className="size-7 border-[3px] text-acc" />
                  <div className="text-lg font-semibold">Leyendo movimientos…</div>
                </>
              ) : (
                <>
                  <div className="grid size-16 place-items-center rounded-[1.25rem] bg-acc-soft text-[1.75rem] text-acc-strong">
                    <FileSpreadsheet {...IC} />
                  </div>
                  <div className="text-xl font-semibold">Subí el Excel o CSV de movimientos</div>
                  <div className="text-[0.9375rem] text-ink2">El que descargás del homebanking o de Mercado Pago · .xlsx o .csv</div>
                </>
              )}
            </label>
          ) : (
            <label className="flex flex-col gap-2 text-[0.9375rem] font-semibold">
              Pegá los comprobantes, separados por una línea en blanco
              <textarea
                value={pegado}
                onChange={(e) => setPegado(e.target.value)}
                rows={8}
                placeholder="Lo que te llegó por el banco, Mercado Pago o WhatsApp"
                className="rounded-[0.875rem] border border-line bg-surface p-3 text-base font-normal"
              />
            </label>
          )}
          {problema && <Alerta>{problema}</Alerta>}
          <div className="flex flex-wrap gap-2">
            {modoTexto && (
              <Boton alto="h-11" disabled={pegado.trim().length < 8} onClick={leerPegado}>
                Leer
              </Boton>
            )}
            <Boton variante="texto" alto="h-11" icono={modoTexto ? FileSpreadsheet : ClipboardPaste} onClick={() => setModoTexto(!modoTexto)}>
              {modoTexto ? 'Mejor subo el archivo del banco' : 'Prefiero pegar varios comprobantes'}
            </Boton>
          </div>
          <p className="text-[0.9375rem] text-ink2">
            El archivo se lee en tu dispositivo y no se guarda. Solo se registran los pagos que confirmes.
          </p>
        </div>
      )}

      {hoja && columnas && (
        <Tarjeta className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate font-semibold">{archivo}</div>
              <div className="text-sm text-ink2">{plural(hoja.filas.length, 'fila', 'filas')}</div>
            </div>
            <Boton variante="texto" alto="h-10" onClick={reiniciar}>Cambiar archivo</Boton>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {CAMPOS.map(({ campo, etiqueta, opcional }) => (
              <label key={campo} className="flex flex-col gap-1.5 text-[0.9375rem] font-semibold">
                {etiqueta}
                <select
                  value={columnas[campo]}
                  onChange={(e) => aplicarColumnas(hoja, { ...columnas, [campo]: Number(e.target.value) })}
                  className="h-12 rounded-xl border border-line bg-surface px-3.5 text-base font-normal"
                >
                  <option value={-1}>{opcional ? 'No hay' : 'Elegí la columna'}</option>
                  {hoja.encabezados.map((e, i) => (
                    <option key={i} value={i}>{e || `Columna ${i + 1}`}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {(columnas.fecha < 0 || columnas.monto < 0) && <Alerta>Elegí la columna de la fecha y la del importe.</Alerta>}
        </Tarjeta>
      )}

      {movs && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="m-0 text-lg font-semibold">
              {movs.length === 0 ? 'No encontramos ingresos' : plural(movs.length, 'ingreso', 'ingresos')}
              {ignorados > 0 && <span className="text-[0.9375rem] font-normal text-ink2"> · {plural(ignorados, 'fila dejada de lado', 'filas dejadas de lado')} (egresos, saldos o sin fecha)</span>}
            </h2>
            {!hoja && <Boton variante="texto" alto="h-10" onClick={reiniciar}>Empezar de nuevo</Boton>}
          </div>

          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {propuestas.map((p, i) => {
              const d = p.mov.datos
              const id = elegidoDe(i)
              const candidatos = new Set(p.sugerencia.candidatos.map((c) => c.patient_id))
              const motivos = id ? p.sugerencia.candidatos.find((c) => c.patient_id === id)?.motivos ?? [] : []
              return (
                <li key={i}>
                  <Tarjeta className="flex flex-col gap-2.5 p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="text-lg font-semibold">{verMonto(d.monto ?? 0, d.moneda ?? 'ARS')}</span>
                      <span className="text-[0.9375rem] text-ink2">{d.fecha ? formatFecha(d.fecha) : 'Sin fecha'}</span>
                    </div>
                    <div className="text-[0.9375rem] break-words text-ink2">{p.mov.detalle || 'Sin detalle'}</div>
                    <label className="flex flex-col gap-1.5 text-[0.9375rem] font-semibold">
                      Es de
                      <select
                        value={id}
                        onChange={(e) => setElegidos({ ...elegidos, [i]: e.target.value })}
                        className="h-12 rounded-xl border border-line bg-surface px-3.5 text-base font-normal"
                      >
                        <option value="">Elegí el paciente</option>
                        {p.sugerencia.candidatos.length > 0 && (
                          <optgroup label="Sugeridos">
                            {p.sugerencia.candidatos.map((c) => {
                              const pac = pacientes.find((x) => x.id === c.patient_id)
                              return pac ? <option key={c.patient_id} value={c.patient_id}>{nombreCompleto(pac)}</option> : null
                            })}
                          </optgroup>
                        )}
                        <optgroup label="Todos">
                          {ordenados.filter((x) => !candidatos.has(x.id)).map((x) => (
                            <option key={x.id} value={x.id}>{nombreCompleto(x)}</option>
                          ))}
                        </optgroup>
                        <option value={NO_ES}>No es de un paciente</option>
                      </select>
                    </label>
                    {motivos.length > 0 && <div className="text-sm text-ink2">{motivos.join(' · ')}</div>}
                    {p.yaCargado && id === p.elegido && <div className="text-sm font-semibold text-bad">Ya hay un pago así cargado: no lo marcamos para no duplicarlo.</div>}
                    {id && id !== NO_ES && (
                      <label className="flex cursor-pointer items-center justify-between gap-3 text-[0.9375rem] font-semibold">
                        Registrar este pago
                        <input
                          type="checkbox"
                          role="switch"
                          className="interruptor"
                          checked={marcadoDe(i)}
                          onChange={(e) => setMarcados({ ...marcados, [i]: e.target.checked })}
                        />
                      </label>
                    )}
                  </Tarjeta>
                </li>
              )
            })}
          </ul>

          {movs.length > 0 && (
            <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] border border-line bg-surface p-3 shadow-lg">
              <span className="text-[0.9375rem] text-ink2">
                {aRegistrar.length === 0 ? 'Elegí el paciente de cada ingreso' : `${plural(aRegistrar.length, 'pago listo', 'pagos listos')} para registrar`}
              </span>
              <Boton icono={ArrowLeftRight} disabled={aRegistrar.length === 0} cargando={guardando} onClick={registrar}>
                Registrar {aRegistrar.length > 0 ? plural(aRegistrar.length, 'pago', 'pagos') : 'pagos'}
              </Boton>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
