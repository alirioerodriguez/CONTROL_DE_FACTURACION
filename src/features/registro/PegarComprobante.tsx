import { useMemo, useState } from 'react'
import { ClipboardPaste } from 'lucide-react'
import { Boton } from '../../components/ui'
import { nombreCompleto, type Paciente, type Pago, type Sesion } from '../../lib/datos'
import {
  aprenderPagador, leerComprobante, posibleDuplicado, sugerir, type DatosComprobante, type DeudaPaciente, type PagadorConocido,
} from '../../lib/conciliar'
import { verMonto } from '../../lib/discreto'
import { saldosDe } from '../../lib/resumen'
import { guardarPreferencia, preferencia } from '../../lib/tema'
import { etiquetaDia } from '../../lib/formato'

const CLAVE = 'pagadores_conocidos'

/** Los pagadores que la profesional ya confirmó («siempre paga la mamá»). Quedan solo en este navegador. */
function leerConocidos(): PagadorConocido[] {
  try {
    const v = JSON.parse(preferencia<string>(CLAVE, '[]'))
    return Array.isArray(v) ? v.filter((k) => k && typeof k.nombre === 'string' && typeof k.patient_id === 'string') : []
  } catch {
    return []
  }
}

/**
 * «Pegar comprobante»: la profesional pega el texto de una transferencia (homebanking, Mercado Pago, WhatsApp) y la app
 * sugiere a qué paciente corresponde y completa el monto y la fecha. Nada se guarda solo: elige el paciente y revisa el pago.
 * El texto pegado no se guarda en ningún lado; solo se recuerda el nombre de quien pagó, si ella lo confirma.
 */
export function PegarComprobante({
  pacientes, sesiones, pagos, onAplicar,
}: {
  pacientes: Paciente[]
  sesiones: Sesion[]
  pagos: Pago[]
  onAplicar: (paciente: Paciente, datos: DatosComprobante) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const [leido, setLeido] = useState<{ datos: DatosComprobante; texto: string } | null>(null)

  const resultado = useMemo(() => {
    if (!leido) return null
    const deudas: Record<string, DeudaPaciente> = {}
    for (const p of pacientes) {
      const s = saldosDe(p.id, sesiones, pagos).find((x) => x.moneda === p.moneda)
      if (s) deudas[p.id] = { moneda: p.moneda, total: Math.max(0, s.saldo), porMes: s.meses.filter((m) => m.pendiente > 0).map((m) => m.pendiente) }
    }
    return sugerir(leido.datos, pacientes, { conocidos: leerConocidos(), deudas })
  }, [leido, pacientes, sesiones, pagos])

  function leer() {
    setLeido({ datos: leerComprobante(texto), texto })
  }

  function elegir(p: Paciente) {
    if (!leido) return
    guardarPreferencia(CLAVE, JSON.stringify(aprenderPagador(leido.datos, p, leerConocidos())))
    onAplicar(p, leido.datos)
    setTexto('')
    setLeido(null)
    setAbierto(false)
  }

  if (!abierto) {
    return (
      <Boton variante="borde" icono={ClipboardPaste} alto="h-12" onClick={() => setAbierto(true)}>
        Pegar un comprobante
      </Boton>
    )
  }

  const d = leido?.datos
  return (
    <section aria-label="Pegar un comprobante" className="flex flex-col gap-3 rounded-[0.875rem] border border-line bg-fondo p-3.5">
      <label className="flex flex-col gap-2 text-[0.9375rem] font-semibold">
        Pegá el texto del comprobante
        <textarea
          value={texto}
          onChange={(e) => { setTexto(e.target.value); setLeido(null) }}
          rows={5}
          placeholder="Lo que te llegó por el banco, Mercado Pago o WhatsApp"
          className="rounded-[0.875rem] border border-line bg-surface p-3 text-base font-normal"
        />
        <span className="text-sm font-normal text-ink2">No se guarda el texto: solo se usa para sugerirte el paciente.</span>
      </label>
      <div className="flex gap-2">
        <Boton alto="h-11" disabled={texto.trim().length < 8} onClick={leer}>Leer</Boton>
        <Boton variante="texto" alto="h-11" onClick={() => { setAbierto(false); setTexto(''); setLeido(null) }}>Cancelar</Boton>
      </div>

      {d && resultado && (
        <div className="flex flex-col gap-2.5" aria-live="polite">
          <p className="text-[0.9375rem]">
            {d.monto !== null ? <>Leí <b>{verMonto(d.monto, d.moneda ?? 'ARS')}</b></> : 'No pude leer el monto'}
            {d.remitente ? <> de <b>{d.remitente}</b></> : null}
            {d.fecha ? <> · {etiquetaDia(d.fecha)}</> : null}.
          </p>
          {resultado.candidatos.length === 0 ? (
            <p className="text-sm text-ink2">No encontré a quién corresponde. Elegí el paciente a mano en el formulario.</p>
          ) : (
            <>
              <p className="text-sm text-ink2">
                {resultado.confianza === 'alta' ? 'Parece ser de:' : 'Puede ser de (revisá bien):'}
              </p>
              <ul className="flex flex-col gap-2">
                {resultado.candidatos.map((c) => {
                  const p = pacientes.find((x) => x.id === c.patient_id)
                  if (!p) return null
                  const repetido = posibleDuplicado(d, pagos, p.id)
                  return (
                    <li key={c.patient_id}>
                      <button
                        type="button"
                        onClick={() => elegir(p)}
                        className="flex w-full flex-col items-start gap-0.5 rounded-[0.875rem] border border-line bg-surface px-3.5 py-2.5 text-left presionable"
                      >
                        <span className="font-semibold">{nombreCompleto(p)}</span>
                        <span className="text-sm text-ink2">{c.motivos.join(' · ')}</span>
                        {repetido && <span className="text-sm font-semibold text-bad">Ojo: ya hay un pago así cargado.</span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  )
}
