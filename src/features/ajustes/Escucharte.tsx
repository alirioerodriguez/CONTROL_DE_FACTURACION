import { useState } from 'react'
import { MessageCircleHeart } from 'lucide-react'
import { toast } from 'sonner'
import { Boton, Campo, IC, Segmentado, Tarjeta } from '../../components/ui'
import { armarSugerencia, SUGERIR_URL, type TipoSugerencia } from '../../lib/sugerencia'

/**
 * «Queremos escucharte»: la profesional manda una idea o un problema y llega al panel de Alirio.
 * Solo viaja lo que escribe (y su mail si lo deja): nada de pacientes, sesiones ni pagos.
 */
export function Escucharte() {
  const [tipo, setTipo] = useState<TipoSugerencia>('idea')
  const [texto, setTexto] = useState('')
  const [mail, setMail] = useState('')
  const [trampa, setTrampa] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar() {
    const armado = armarSugerencia({ tipo, texto, mail, web: trampa })
    if ('error' in armado) return toast.error(armado.error)
    setEnviando(true)
    try {
      const r = await fetch(SUGERIR_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(armado.cuerpo) })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) throw new Error(j.error || 'No se pudo enviar')
      setTexto('')
      setMail('')
      toast.success('¡Gracias! Ya nos llegó. Lo vamos a leer con atención.')
    } catch (e) {
      toast.error(navigator.onLine === false ? 'Estás sin conexión: probá cuando vuelva.' : `No se pudo enviar: ${e instanceof Error ? e.message : 'probá de nuevo'}`)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Tarjeta className="flex flex-col gap-4 p-[1.375rem]">
      <h2 className="m-0 flex items-center gap-2 text-lg font-semibold">
        <MessageCircleHeart {...IC} /> Queremos escucharte
      </h2>
      <p className="m-0 text-[0.9375rem] leading-normal text-ink2">
        honorapp la hacemos con las colegas que la usan. Contanos qué te gustaría, qué no anda o qué cambiarías: lo leemos todo.
      </p>
      <Segmentado
        opciones={[
          { v: 'idea' as TipoSugerencia, l: 'Una idea' },
          { v: 'problema' as TipoSugerencia, l: 'Algo no anda' },
          { v: 'otra' as TipoSugerencia, l: 'Otra cosa' },
        ]}
        valor={tipo}
        onCambio={setTipo}
      />
      <label className="flex flex-col gap-2 text-[0.9375rem] font-semibold">
        Tu mensaje
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={2000}
          rows={5}
          placeholder="Por ejemplo: me gustaría ver cuántas sesiones tuve en el año"
          className="w-full resize-y rounded-[0.875rem] border border-line bg-fondo px-4 py-3 text-[1.0625rem] font-normal leading-normal outline-none transition focus:border-acc focus:shadow-[0_0_0_3px_var(--acc-soft)]"
        />
      </label>
      <Campo etiqueta="Tu mail, si querés que te respondamos" opcional type="email" inputMode="email" autoComplete="email" maxLength={120} value={mail} onChange={(e) => setMail(e.target.value)} placeholder="nombre@ejemplo.com" />
      {/* campo trampa: invisible para las personas, lo completan los robots */}
      <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={trampa} onChange={(e) => setTrampa(e.target.value)} className="absolute -left-[9999px] h-px w-px" />
      <Boton cargando={enviando} onClick={() => void enviar()} className="self-start">
        Enviar
      </Boton>
      <p className="m-0 text-sm text-ink2">No mandamos nada de tus pacientes, sesiones ni pagos: solo lo que escribas acá.</p>
    </Tarjeta>
  )
}
