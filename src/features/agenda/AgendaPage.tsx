import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck, Check, MessageCircle, Plus, Trash2, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, Boton, Campo, Chip, EstadoError, Esqueleto, IC, Segmentado, Tarjeta, Titulo } from '../../components/ui'
import { usePalabras } from '../../components/usePalabras'
import { useAuth } from '../auth/AuthProvider'
import { nombreCompleto, useDatos } from '../../lib/datos'
import { capitalizar, diaSemana, fechaLarga, hoyAR, numeroWhatsApp, sumarDias } from '../../lib/formato'
import {
  candidatosParaHueco, faltasEnElAnio, guardarEspera, huecosLiberados, leerConfirmadas, leerEspera, marcarConfirmada, mensajeReconfirmacion,
  paraReconfirmar, type EnEspera, type Franja,
} from '../../lib/agendaHoy'

const DIAS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const linkWa = (telefono: string | null | undefined, texto: string) => {
  const n = numeroWhatsApp(telefono)
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(texto)}` : null
}

function BotonWa({ href, etiqueta, onClick }: { href: string; etiqueta: string; onClick?: () => void }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      aria-label={etiqueta}
      className="flex h-11 shrink-0 items-center gap-2 rounded-[0.875rem] bg-wa-soft px-3.5 font-semibold text-wa hover:brightness-95"
    >
      <MessageCircle {...IC} />
      <span className="max-sm:hidden">WhatsApp</span>
    </a>
  )
}

/**
 * Agenda de hoy: reconfirmar las sesiones de mañana, ofrecer los huecos de una cancelación a la lista de
 * espera y ver las faltas del año. Todo se manda a mano por WhatsApp (sin seña ni cobro anticipado).
 */
export function AgendaPage() {
  const { pacientes, sesiones, cargando, error, reintentar } = useDatos()
  const { session } = useAuth()
  const userId = session?.user.id ?? ''
  const p = usePalabras()
  const hoy = hoyAR()
  const manana = sumarDias(hoy, 1)
  const [confirmadas, setConfirmadas] = useState(() => leerConfirmadas(userId, hoy, localStorage))
  const [espera, setEspera] = useState<EnEspera[]>(() => leerEspera(userId, localStorage))
  const [nuevo, setNuevo] = useState({ nombre: '', telefono: '', dias: [] as number[], franja: 'cualquiera' as Franja })

  const porId = useMemo(() => new Map(pacientes.map((x) => [x.id, x])), [pacientes])
  const reconfirmar = useMemo(() => paraReconfirmar(sesiones, manana), [sesiones, manana])
  const huecos = useMemo(() => huecosLiberados(sesiones, hoy, sumarDias(hoy, 7)), [sesiones, hoy])
  const faltas = useMemo(() => {
    const m = faltasEnElAnio(sesiones, Number(hoy.slice(0, 4)))
    return [...m.entries()].map(([id, n]) => ({ paciente: porId.get(id), n })).filter((f) => f.paciente).sort((a, b) => b.n - a.n)
  }, [sesiones, hoy, porId])

  if (cargando) return <Esqueleto que="la agenda" />
  if (error) return <EstadoError que="la agenda" reintentar={reintentar} />

  function confirmar(id: string, fecha: string, si: boolean) {
    try {
      marcarConfirmada(userId, id, fecha, si, hoy, localStorage)
      setConfirmadas(leerConfirmadas(userId, hoy, localStorage))
    } catch {
      toast.error('No se pudo guardar en este dispositivo')
    }
  }

  function guardarLista(lista: EnEspera[], aviso: string) {
    try {
      guardarEspera(userId, lista, localStorage)
      setEspera(lista)
      toast.success(aviso)
    } catch {
      toast.error('No se pudo guardar en este dispositivo')
    }
  }

  function agregar() {
    if (!nuevo.nombre.trim()) return toast.error('Falta el nombre')
    if (!numeroWhatsApp(nuevo.telefono)) return toast.error('El teléfono no parece válido')
    const item: EnEspera = { id: crypto.randomUUID(), nombre: nuevo.nombre.trim(), telefono: nuevo.telefono.trim(), dias: nuevo.dias, franja: nuevo.franja, activo: true }
    guardarLista([...espera, item], `${item.nombre} quedó en la lista de espera`)
    setNuevo({ nombre: '', telefono: '', dias: [], franja: 'cualquiera' })
  }

  const cuandoManana = `mañana ${fechaLarga(manana).split(' ')[0].toLowerCase()}`

  return (
    <section className="flex flex-col gap-8">
      <Titulo sub={`Para reconfirmar, llenar huecos y ver faltas. Los mensajes se mandan desde tu WhatsApp; nada se cobra por adelantado.`}>
        Agenda de hoy
      </Titulo>

      {/* Reconfirmar mañana */}
      <div className="flex flex-col gap-3">
        <h2 className="m-0 font-serif text-[1.75rem] font-normal">Reconfirmar {cuandoManana}</h2>
        {reconfirmar.length === 0 ? (
          <Tarjeta className="px-6 py-8 text-center text-[1.0625rem] text-ink2">No hay {p.sesiones} cargadas para mañana.</Tarjeta>
        ) : (
          <Tarjeta className="p-2">
            {reconfirmar.map((s) => {
              const pac = porId.get(s.patient_id)
              if (!pac) return null
              const ok = confirmadas.has(s.id)
              const wa = s.hora ? linkWa(pac.telefono, mensajeReconfirmacion(pac.nombre, cuandoManana, s.hora, perfilTermino(p.sesion))) : null
              return (
                <div key={s.id} className="flex items-center gap-3 rounded-2xl px-3.5 py-3 [&+&]:border-t [&+&]:border-line">
                  <Avatar nombre={nombreCompleto(pac)} className="size-11 text-[0.9375rem]" />
                  <div className="min-w-0 flex-1">
                    <Link to={`/pacientes/${pac.id}`} className="block truncate text-[1.0625rem] font-semibold">{nombreCompleto(pac)}</Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink2">
                      {s.hora ? `${s.hora} hs` : 'Sin hora cargada'}
                      {ok && <Chip tono="ok">Confirmó</Chip>}
                      {!numeroWhatsApp(pac.telefono) && <span>· Sin teléfono cargado</span>}
                    </div>
                  </div>
                  {wa && !ok && <BotonWa href={wa} etiqueta={`Pedir confirmación a ${pac.nombre} por WhatsApp`} />}
                  {ok ? (
                    <Boton variante="texto" alto="h-11" icono={Undo2} onClick={() => confirmar(s.id, s.fecha, false)} aria-label="Desmarcar confirmación">
                      <span className="max-sm:hidden">Desmarcar</span>
                    </Boton>
                  ) : (
                    <Boton variante="borde" alto="h-11" icono={Check} onClick={() => confirmar(s.id, s.fecha, true)} aria-label={`Marcar que ${pac.nombre} confirmó`}>
                      <span className="max-sm:hidden">Confirmó</span>
                    </Boton>
                  )}
                </div>
              )
            })}
          </Tarjeta>
        )}
      </div>

      {/* Huecos liberados */}
      <div className="flex flex-col gap-3">
        <h2 className="m-0 font-serif text-[1.75rem] font-normal">Horarios que se liberaron</h2>
        {huecos.length === 0 ? (
          <Tarjeta className="px-6 py-8 text-center text-[1.0625rem] text-ink2">
            Cuando marques una {p.sesion} como cancelada (con hora) en los próximos 7 días, aparece acá para ofrecérsela a la lista de espera.
          </Tarjeta>
        ) : (
          huecos.map((h) => {
            const cuando = h.fecha === hoy ? 'hoy' : h.fecha === manana ? 'mañana' : `el ${fechaLarga(h.fecha).toLowerCase()}`
            const candidatos = candidatosParaHueco(espera, diaSemana(h.fecha), h.hora ?? '', cuando, perfilTermino(p.sesion))
            return (
              <Tarjeta key={h.id} className="flex flex-col gap-2 p-4">
                <div className="text-[1.0625rem] font-semibold">
                  {capitalizar(fechaLarga(h.fecha))} · {h.hora} hs
                  <span className="ml-2 text-sm font-normal text-ink2">(canceló {porId.get(h.patient_id)?.nombre ?? 'un paciente'})</span>
                </div>
                {candidatos.length === 0 ? (
                  <div className="text-ink2">Nadie de la lista de espera coincide con ese día u horario.</div>
                ) : (
                  candidatos.map((c) => {
                    const wa = linkWa(c.telefono, c.mensaje)
                    return (
                      <div key={c.id} className="flex items-center gap-3 border-t border-line pt-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold">{c.nombre}</div>
                          <div className="text-sm text-ink2">{c.puntaje === 3 ? 'Coincide en día y horario' : c.puntaje === 2 ? 'Coincide en el día' : 'Coincide en el horario'}</div>
                        </div>
                        {wa && <BotonWa href={wa} etiqueta={`Ofrecer el horario a ${c.nombre} por WhatsApp`} />}
                      </div>
                    )
                  })
                )}
              </Tarjeta>
            )
          })
        )}
      </div>

      {/* Lista de espera */}
      <div className="flex flex-col gap-3">
        <h2 className="m-0 font-serif text-[1.75rem] font-normal">Lista de espera</h2>
        <p className="m-0 text-[0.9375rem] text-ink2">Se guarda solo en este dispositivo.</p>
        {espera.length > 0 && (
          <Tarjeta className="p-2">
            {espera.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-2xl px-3.5 py-3 [&+&]:border-t [&+&]:border-line">
                <div className="min-w-0 flex-1">
                  <div className={`truncate text-[1.0625rem] font-semibold ${c.activo ? '' : 'text-ink2 line-through'}`}>{c.nombre}</div>
                  <div className="text-sm text-ink2">
                    {c.dias.length ? c.dias.map((d) => DIAS[d]).join(', ') : 'Cualquier día'} · {c.franja === 'manana' ? 'mañana' : c.franja === 'tarde' ? 'tarde' : 'cualquier horario'} · {c.telefono}
                  </div>
                </div>
                <Boton variante="texto" alto="h-11" onClick={() => guardarLista(espera.map((x) => (x.id === c.id ? { ...x, activo: !x.activo } : x)), c.activo ? `${c.nombre} en pausa` : `${c.nombre} vuelve a la lista`)}>
                  {c.activo ? 'Pausar' : 'Activar'}
                </Boton>
                <Boton variante="peligro" alto="h-11" icono={Trash2} aria-label={`Sacar a ${c.nombre} de la lista`} onClick={() => guardarLista(espera.filter((x) => x.id !== c.id), `${c.nombre} salió de la lista`)} />
              </div>
            ))}
          </Tarjeta>
        )}
        <Tarjeta className="flex flex-col gap-4 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Nombre" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
            <Campo etiqueta="Teléfono" inputMode="tel" value={nuevo.telefono} onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })} />
          </div>
          <div className="flex flex-col gap-2 text-[0.9375rem] font-semibold">
            Días que puede <span className="text-sm font-normal text-ink2">(ninguno = cualquier día)</span>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6].map((d) => {
                const on = nuevo.dias.includes(d)
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setNuevo({ ...nuevo, dias: on ? nuevo.dias.filter((x) => x !== d) : [...nuevo.dias, d].sort() })}
                    className={`h-11 min-w-14 rounded-full border px-3 font-semibold ${on ? 'border-transparent bg-acc text-on-acc' : 'border-line bg-surface'}`}
                  >
                    {DIAS[d]}
                  </button>
                )
              })}
            </div>
          </div>
          <Segmentado
            opciones={[{ v: 'cualquiera' as Franja, l: 'Cualquier hora' }, { v: 'manana' as Franja, l: 'Mañana' }, { v: 'tarde' as Franja, l: 'Tarde' }]}
            valor={nuevo.franja}
            onCambio={(f) => setNuevo({ ...nuevo, franja: f })}
            className="self-start"
          />
          <Boton icono={Plus} onClick={agregar} className="self-start">Agregar a la lista</Boton>
        </Tarjeta>
      </div>

      {/* Faltas */}
      <div className="flex flex-col gap-3">
        <h2 className="m-0 font-serif text-[1.75rem] font-normal">Faltas sin aviso en {hoy.slice(0, 4)}</h2>
        {faltas.length === 0 ? (
          <Tarjeta className="px-6 py-8 text-center text-[1.0625rem] text-ink2">
            <CalendarCheck {...IC} className="mr-2 inline" />Nadie faltó este año. Las faltas salen de las {p.sesiones} marcadas como ausentes.
          </Tarjeta>
        ) : (
          <Tarjeta className="p-2">
            {faltas.map((f) => (
              <Link key={f.paciente!.id} to={`/pacientes/${f.paciente!.id}`} className="flex items-center gap-3 rounded-2xl px-3.5 py-3 no-underline [&+&]:border-t [&+&]:border-line">
                <Avatar nombre={nombreCompleto(f.paciente!)} className="size-11 text-[0.9375rem]" />
                <span className="min-w-0 flex-1 truncate text-[1.0625rem] font-semibold">{nombreCompleto(f.paciente!)}</span>
                <Chip tono={f.n >= 3 ? 'mal' : 'parcial'} grande>{f.n} {f.n === 1 ? 'falta' : 'faltas'}</Chip>
              </Link>
            ))}
          </Tarjeta>
        )}
      </div>
    </section>
  )
}

/** De la palabra visible ('sesión', 'consulta', 'clase') al término que usan los mensajes. */
function perfilTermino(sesion: string) {
  return sesion === 'consulta' ? 'consulta' : sesion === 'clase' ? 'clase' : 'sesion'
}
