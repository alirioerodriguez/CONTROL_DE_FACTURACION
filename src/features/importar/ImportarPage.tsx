import { useMemo, useRef, useState, type DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronLeft, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import { DescargarExcel } from '../../components/DescargarExcel'
import { Alerta, Boton, IC, Spinner, Tarjeta, Titulo } from '../../components/ui'
import { useDatos } from '../../lib/datos'
import { capitalizar, formatFecha, formatMonto, plural } from '../../lib/formato'
import { leerArchivo, type Celda, type Hoja } from '../../lib/importar/leer'
import {
  CAMPOS, camposFaltantes, esPlantilla, mapeoAutomatico, prepararGenerico, prepararPlantilla,
  type CampoGenerico, type Mapeo, type Preparado,
} from '../../lib/importar/preparar'
import { mensajeError, supabase } from '../../lib/supabase'

type Paso = 1 | 2 | 3
const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function textoCelda(c: Celda): string {
  if (c == null) return ''
  if (c instanceof Date) return formatFecha(c.toISOString())
  return String(c)
}

export function ImportarPage() {
  const navegar = useNavigate()
  const qc = useQueryClient()
  const { perfil, pacientes, sesiones, pagos } = useDatos()
  const entrada = useRef<HTMLInputElement>(null)

  const [paso, setPaso] = useState<Paso>(1)
  const [archivo, setArchivo] = useState('')
  const [hojas, setHojas] = useState<Hoja[]>([])
  const [plantilla, setPlantilla] = useState(false)
  const [indiceHoja, setIndiceHoja] = useState(0)
  const [mapeo, setMapeo] = useState<Mapeo | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [error, setError] = useState('')
  const [crearPacientes, setCrearPacientes] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const contexto = useMemo(
    () => ({
      pacientes,
      sesiones,
      pagos,
      monedaDefecto: perfil?.moneda_default ?? ('ARS' as const),
      tarifaEstandar: perfil?.tarifa_estandar ?? 0,
    }),
    [pacientes, sesiones, pagos, perfil],
  )

  const hoja = hojas[indiceHoja]
  const preparado: Preparado | null = useMemo(() => {
    if (paso !== 3) return null
    if (plantilla) return prepararPlantilla(hojas, contexto)
    return hoja && mapeo ? prepararGenerico(hoja, mapeo, contexto) : null
  }, [paso, plantilla, hojas, hoja, mapeo, contexto])

  function reiniciar() {
    setPaso(1)
    setArchivo('')
    setHojas([])
    setMapeo(null)
    setError('')
    setCrearPacientes(false)
  }

  async function procesar(f: File | undefined) {
    if (!f) return
    setLeyendo(true)
    setError('')
    try {
      const leidas = await leerArchivo(f)
      const conDatos = leidas.filter((h) => h.encabezados.length > 0)
      if (!conDatos.length) throw new Error(`“${f.name}” está vacío.`)
      setArchivo(f.name)
      setHojas(leidas)
      if (esPlantilla(leidas)) {
        setPlantilla(true)
        setPaso(3)
      } else {
        const i = leidas.findIndex((h) => h.filas.length > 0)
        const elegida = i >= 0 ? i : 0
        setPlantilla(false)
        setIndiceHoja(elegida)
        setMapeo(mapeoAutomatico(leidas[elegida].encabezados))
        setPaso(2)
      }
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setLeyendo(false)
    }
  }

  function soltar(e: DragEvent) {
    e.preventDefault()
    procesar(e.dataTransfer.files[0])
  }

  function elegirHoja(i: number) {
    setIndiceHoja(i)
    setMapeo(mapeoAutomatico(hojas[i].encabezados))
  }

  async function confirmar() {
    if (!preparado) return
    setGuardando(true)
    try {
      if (!navigator.onLine) throw new Error('Sin conexión: no se puede importar ahora.')
      const { data, error } = await supabase.rpc('importar_datos', {
        p_pacientes: preparado.pacientes,
        p_sesiones: preparado.sesiones,
        p_pagos: preparado.pagos,
      })
      if (error) throw error
      const r = data as { pacientes: number; sesiones: number; pagos: number }
      await qc.invalidateQueries()
      const partes = [
        r.sesiones && plural(r.sesiones, 'sesión', 'sesiones'),
        r.pagos && plural(r.pagos, 'pago', 'pagos'),
        r.pacientes && plural(r.pacientes, 'paciente nuevo', 'pacientes nuevos'),
      ].filter(Boolean)
      toast.success(`Importamos ${partes.join(', ')}`)
      navegar('/pacientes')
    } catch (e) {
      toast.error(`No se importó nada: ${mensajeError(e)}`)
    } finally {
      setGuardando(false)
    }
  }

  const pasos = ['Subir archivo', plantilla ? 'Revisar' : 'Mapear columnas', 'Confirmar']
  const faltan = mapeo ? camposFaltantes(mapeo) : []
  const usadas = new Map<number, string>()
  if (mapeo) for (const c of CAMPOS) if (mapeo[c.k] != null) usadas.set(mapeo[c.k]!, c.l)

  return (
    <section className="flex max-w-[900px] flex-col gap-6">
      <button
        type="button"
        onClick={() => navegar('/ajustes')}
        className="flex h-10 items-center gap-1.5 self-start rounded-full pr-3.5 pl-2 text-base font-semibold text-ink2 hover:bg-surface2 md:hidden"
      >
        <ChevronLeft {...IC} />
        Ajustes
      </button>
      <Titulo sub="Traé tus pacientes, sesiones y pagos desde Excel o CSV.">Importar planilla</Titulo>

      <div className="flex flex-wrap items-center gap-2.5">
        {pasos.map((l, i) => {
          const n = i + 1
          const hecho = n < paso
          const actual = n === paso
          return (
            <div key={l} className="flex items-center gap-2.5">
              <span
                className={`grid size-8 place-items-center rounded-full text-sm font-bold ${
                  hecho || actual ? 'bg-acc text-on-acc' : 'bg-surface2 text-ink2'
                }`}
              >
                {hecho ? <Check size={15} strokeWidth={2.4} /> : n}
              </span>
              <span className={`text-[15px] font-semibold ${actual ? 'text-ink' : 'text-ink2'}`}>{l}</span>
              {i < 2 && <span className="h-0.5 w-7 rounded bg-line" />}
            </div>
          )
        })}
      </div>

      {paso === 1 && (
        <div className="flex flex-col gap-3.5">
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={soltar}
            className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-line bg-surface px-6 py-14 text-center hover:border-acc hover:bg-acc-soft"
          >
            <input
              ref={entrada}
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
                <div className="text-lg font-semibold">Leyendo archivo…</div>
              </>
            ) : (
              <>
                <div className="grid size-16 place-items-center rounded-[20px] bg-acc-soft text-[28px] text-acc-strong">
                  <FileSpreadsheet {...IC} />
                </div>
                <div className="text-xl font-semibold">Arrastrá tu archivo o tocá para elegirlo</div>
                <div className="text-[15px] text-ink2">.xlsx o .csv · hasta 5 MB</div>
              </>
            )}
          </label>
          {error && <Alerta>{error}</Alerta>}
          <div className="text-[15px] text-ink2">Necesitamos al menos: paciente, fecha y monto.</div>
          <Tarjeta className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="min-w-0 flex-[1_1_260px]">
              <div className="text-base font-semibold">¿No tenés planilla?</div>
              <div className="mt-1 text-[15px] leading-snug text-ink2">
                Descargá el Excel, completalo con tus pacientes, sesiones y pagos, y subilo acá.
              </div>
            </div>
            <DescargarExcel vacia />
          </Tarjeta>
        </div>
      )}

      {paso === 2 && hoja && mapeo && (
        <div className="flex flex-col gap-4">
          <ArchivoElegido nombre={archivo} detalle={`${plural(hoja.filas.length, 'fila', 'filas')} · ${plural(hoja.encabezados.length, 'columna', 'columnas')}`} onCambiar={reiniciar} />

          {hojas.length > 1 && (
            <label className="flex flex-col gap-2 text-[15px] font-semibold">
              Hoja
              <select
                value={indiceHoja}
                onChange={(e) => elegirHoja(Number(e.target.value))}
                className="h-12 max-w-[320px] rounded-xl border border-line bg-surface px-3.5 font-normal"
              >
                {hojas.map((h, i) => (
                  <option key={h.nombre} value={i}>
                    {h.nombre} ({plural(h.filas.length, 'fila', 'filas')})
                  </option>
                ))}
              </select>
            </label>
          )}

          <Tarjeta className="overflow-hidden">
            <div className="px-5 pt-4 pb-3 text-base font-semibold">
              Vista previa <span className="font-normal text-ink2">· primeras 5 filas</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead className="bg-surface2 text-sm">
                  <tr>
                    {hoja.encabezados.map((e, i) => (
                      <th key={i} className="px-4 py-2.5 align-top font-normal">
                        <div className="flex flex-col items-start gap-1.5">
                          <span className="font-semibold whitespace-nowrap text-ink2">
                            {LETRAS[i] ?? i + 1} · {e || '(sin título)'}
                          </span>
                          {usadas.has(i) ? (
                            <span className="inline-flex h-[22px] items-center rounded-full bg-acc-soft px-2 text-xs font-bold text-acc-strong">
                              → {usadas.get(i)}
                            </span>
                          ) : (
                            <span className="inline-flex h-[22px] items-center rounded-full border border-dashed border-line px-2 text-xs text-ink2">
                              No se importa
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hoja.filas.slice(0, 5).map((f) => (
                    <tr key={f.numero} className="border-t border-line text-[15px]">
                      {f.celdas.map((c, i) => (
                        <td key={i} className={`max-w-[200px] truncate px-4 py-3 ${usadas.has(i) ? 'text-ink' : 'text-ink2'}`}>
                          {textoCelda(c) || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tarjeta>

          <Tarjeta className="px-[22px] pt-2 pb-3.5">
            <div className="pt-3.5 pb-2.5 text-lg font-semibold">Mapeá las columnas</div>
            {CAMPOS.map((c) => (
              <div key={c.k} className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-3">
                <div className="min-w-0">
                  <div className="text-base font-semibold">
                    {c.l}
                    {c.req && <span className="ml-1 text-bad">*</span>}
                  </div>
                  <div className="mt-0.5 text-sm text-ink2">{c.h}</div>
                </div>
                <select
                  aria-label={`Columna para ${c.l}`}
                  value={mapeo[c.k] ?? ''}
                  onChange={(e) =>
                    setMapeo({ ...mapeo, [c.k as CampoGenerico]: e.target.value === '' ? null : Number(e.target.value) })
                  }
                  className={`h-12 min-w-[200px] flex-[0_1_240px] rounded-xl border bg-surface px-3.5 ${
                    c.req && mapeo[c.k] == null ? 'border-bad' : 'border-line'
                  }`}
                >
                  <option value="">— No importar —</option>
                  {hoja.encabezados.map((e, i) => (
                    <option key={i} value={i}>
                      {LETRAS[i] ?? i + 1} · {e || '(sin título)'}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </Tarjeta>

          {faltan.length > 0 && <Alerta>Falta elegir la columna de {faltan.join(' y ').toLowerCase()}.</Alerta>}

          <div className="flex justify-between gap-2.5">
            <Boton variante="suave" onClick={reiniciar}>
              Volver
            </Boton>
            <Boton disabled={faltan.length > 0} onClick={() => setPaso(3)}>
              Continuar
            </Boton>
          </div>
        </div>
      )}

      {paso === 3 && preparado && (
        <Confirmacion
          archivo={archivo}
          plantilla={plantilla}
          preparado={preparado}
          crearPacientes={crearPacientes}
          setCrearPacientes={setCrearPacientes}
          guardando={guardando}
          onVolver={() => (plantilla ? reiniciar() : setPaso(2))}
          onConfirmar={confirmar}
          onCambiar={reiniciar}
        />
      )}
    </section>
  )
}

function ArchivoElegido({ nombre, detalle, onCambiar }: { nombre: string; detalle: string; onCambiar: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-[18px] border border-line bg-surface px-4 py-3.5">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-acc-soft text-base text-acc-strong">
        <FileSpreadsheet {...IC} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-base font-semibold">{nombre}</div>
        <div className="text-sm text-ink2">{detalle}</div>
      </div>
      <button type="button" onClick={onCambiar} className="text-[15px] font-semibold text-acc-strong">
        Cambiar
      </button>
    </div>
  )
}

function Confirmacion({
  archivo,
  plantilla,
  preparado: p,
  crearPacientes,
  setCrearPacientes,
  guardando,
  onVolver,
  onConfirmar,
  onCambiar,
}: {
  archivo: string
  plantilla: boolean
  preparado: Preparado
  crearPacientes: boolean
  setCrearPacientes: (v: boolean) => void
  guardando: boolean
  onVolver: () => void
  onConfirmar: () => void
  onCambiar: () => void
}) {
  const total = p.sesiones.length + p.pagos.length + p.pacientes.length
  const faltaConfirmarPacientes = p.pacientes.length > 0 && !crearPacientes
  const sumas = (lista: { moneda: 'ARS' | 'USD'; monto?: number; tarifa_hora?: number; horas?: number }[]) =>
    (['ARS', 'USD'] as const)
      .map((m) => [m, lista.filter((x) => x.moneda === m).reduce((t, x) => t + (x.monto ?? (x.tarifa_hora ?? 0) * (x.horas ?? 1)), 0)] as const)
      .filter(([, v]) => v > 0)
      .map(([m, v]) => formatMonto(v, m))
      .join(' + ')

  const tarjeta = 'rounded-[22px] border border-line bg-surface p-[22px]'
  const numero = 'num text-[52px] leading-[1.1] tracking-[-0.03em]'

  return (
    <div className="flex flex-col gap-4">
      <ArchivoElegido
        nombre={archivo}
        detalle={plantilla ? 'Reconocimos la plantilla de Consultorio' : 'Planilla de sesiones'}
        onCambiar={onCambiar}
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        <div className={tarjeta}>
          <div className="text-[15px] text-ink2">Para importar</div>
          <div className={`${numero} text-acc-strong`}>{p.sesiones.length + p.pagos.length}</div>
          <div className="text-sm text-ink2">
            {[
              plural(p.sesiones.length, 'sesión', 'sesiones'),
              plural(p.pagos.length, 'pago', 'pagos'),
            ].join(' · ')}
          </div>
        </div>
        <div className={tarjeta}>
          <div className="text-[15px] text-ink2">Con errores</div>
          <div className={`${numero} ${p.errores.length ? 'text-bad' : ''}`}>{p.errores.length}</div>
          <div className="text-sm text-ink2">se van a omitir</div>
        </div>
        <div className={tarjeta}>
          <div className="text-[15px] text-ink2">Ya estaban</div>
          <div className={numero}>{p.duplicadas}</div>
          <div className="text-sm text-ink2">no se repiten</div>
        </div>
      </div>

      {(p.sesiones.length > 0 || p.pagos.length > 0) && (
        <div className="text-[15px] text-ink2">
          {p.sesiones.length > 0 && <>Sesiones por {sumas(p.sesiones)}. </>}
          {p.pagos.length > 0 && <>Pagos por {sumas(p.pagos)}.</>}
        </div>
      )}

      {p.errores.length > 0 && (
        <Tarjeta className="px-[22px] pt-2 pb-3">
          <div className="pt-3.5 pb-2 text-lg font-semibold">Filas con errores</div>
          {p.errores.slice(0, 50).map((e, i) => (
            <div key={i} className="flex gap-3.5 border-t border-line py-3 text-base">
              <span className="min-w-[64px] text-ink2">
                {plantilla ? `${e.hoja} ` : ''}Fila {e.fila}
              </span>
              <span>{e.mensaje}</span>
            </div>
          ))}
          {p.errores.length > 50 && (
            <div className="border-t border-line py-3 text-[15px] text-ink2">Y {p.errores.length - 50} más.</div>
          )}
        </Tarjeta>
      )}

      {p.pacientes.length > 0 && (
        <label className="flex cursor-pointer items-start gap-3 rounded-[18px] bg-acc-soft px-[18px] py-4 text-base leading-normal text-acc-strong">
          <input
            type="checkbox"
            checked={crearPacientes}
            onChange={(e) => setCrearPacientes(e.target.checked)}
            className="mt-1 size-5 shrink-0 accent-[var(--acc)]"
          />
          <span>
            Crear {plural(p.pacientes.length, 'paciente nuevo', 'pacientes nuevos')}:{' '}
            <strong>
              {p.pacientes
                .slice(0, 12)
                .map((x) => capitalizar([x.nombre, x.apellido].filter(Boolean).join(' ')))
                .join(', ')}
              {p.pacientes.length > 12 ? ` y ${p.pacientes.length - 12} más` : ''}
            </strong>
            .{' '}
            {p.pacientesExistentes > 0 && `${plural(p.pacientesExistentes, 'ya existía', 'ya existían')} y se reutilizan. `}
            {!plantilla && 'Toman como tarifa el honorario de su primera sesión; después podés cambiarla.'}
          </span>
        </label>
      )}

      {total === 0 && (
        <Alerta>
          {p.duplicadas > 0
            ? 'Todo lo que tiene este archivo ya estaba cargado. No hay nada nuevo para importar.'
            : 'No encontramos filas para importar en este archivo.'}
        </Alerta>
      )}

      <div className="flex justify-between gap-2.5">
        <Boton variante="suave" onClick={onVolver}>
          Volver
        </Boton>
        <Boton disabled={total === 0 || faltaConfirmarPacientes} cargando={guardando} onClick={onConfirmar}>
          {guardando
            ? 'Importando…'
            : total === 0
              ? 'Importar'
              : p.sesiones.length + p.pagos.length > 0
              ? `Importar ${plural(p.sesiones.length + p.pagos.length, 'fila', 'filas')}`
              : `Importar ${plural(p.pacientes.length, 'paciente', 'pacientes')}`}
        </Boton>
      </div>
      {faltaConfirmarPacientes && total > 0 && (
        <div className="-mt-2 text-right text-sm text-ink2">Marcá la casilla para crear los pacientes nuevos.</div>
      )}
    </div>
  )
}
