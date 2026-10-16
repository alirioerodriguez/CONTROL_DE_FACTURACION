import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Logo } from '../../components/Layout'
import { Alerta, Boton, Segmentado } from '../../components/ui'
import type { Perfil } from '../../lib/datos'
import { mensajeError, supabase } from '../../lib/supabase'
import { palabras, PROFESIONES, type ModoCobro, type Termino } from '../../lib/terminos'

/** Elegir profesión, cómo se llama la unidad y cómo se cobra. Se usa en la bienvenida y en Ajustes. */
export function CamposProfesion({
  profesion,
  setProfesion,
  otra,
  setOtra,
  termino,
  setTermino,
  modo,
  setModo,
}: {
  profesion: string
  setProfesion: (v: string) => void
  otra: string
  setOtra: (v: string) => void
  termino: Termino
  setTermino: (v: Termino) => void
  modo: ModoCobro
  setModo: (v: ModoCobro) => void
}) {
  const p = palabras(termino, modo)
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PROFESIONES.map((x) => {
          const activa = profesion === x.v
          return (
            <button
              key={x.v}
              type="button"
              aria-pressed={activa}
              onClick={() => {
                setProfesion(x.v)
                setTermino(x.termino)
                setModo(x.modo)
              }}
              className={`min-h-12 rounded-2xl border px-3 py-2.5 text-left text-[15px] font-semibold ${
                activa ? 'border-acc bg-acc-soft text-acc-strong' : 'border-line bg-surface text-ink hover:bg-surface2'
              }`}
            >
              {x.l}
            </button>
          )
        })}
      </div>
      {profesion === 'otra' && (
        <label className="flex flex-col gap-2 text-[15px] font-semibold">
          ¿Cuál?
          <input
            value={otra}
            onChange={(e) => setOtra(e.target.value)}
            placeholder="Ej. Musicoterapia"
            maxLength={60}
            className="h-[52px] rounded-[14px] border border-line bg-fondo px-4 text-[17px] font-normal outline-none focus:border-acc"
          />
        </label>
      )}
      <div className="flex flex-col gap-2.5">
        <div className="text-[15px] font-semibold">¿Cómo le decís a cada encuentro?</div>
        <Segmentado
          opciones={[
            { v: 'sesion' as Termino, l: 'Sesión' },
            { v: 'consulta' as Termino, l: 'Consulta' },
          ]}
          valor={termino}
          onCambio={setTermino}
        />
      </div>
      <div className="flex flex-col gap-2.5">
        <div className="text-[15px] font-semibold">¿Cómo cobrás?</div>
        <Segmentado
          opciones={[
            { v: 'hora' as ModoCobro, l: 'Por hora' },
            { v: 'sesion' as ModoCobro, l: `Por ${p.sesion}` },
          ]}
          valor={modo}
          onCambio={setModo}
        />
        <div className="text-sm leading-snug text-ink2">
          {modo === 'hora'
            ? `Cargás tu valor por hora y la duración de cada ${p.sesion}; la app calcula el monto.`
            : `Cargás un valor fijo por ${p.sesion}, sin importar cuánto dure.`}
        </div>
      </div>
    </div>
  )
}

/** Pantalla de bienvenida: aparece una sola vez, antes del tutorial. */
export function Bienvenida({ perfil }: { perfil: Perfil }) {
  const qc = useQueryClient()
  const [profesion, setProfesion] = useState('')
  const [otra, setOtra] = useState('')
  const [termino, setTermino] = useState<Termino>('sesion')
  const [modo, setModo] = useState<ModoCobro>('hora')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function continuar() {
    if (!profesion) return setError('Elegí tu profesión (o «Otra»).')
    setGuardando(true)
    setError('')
    const valor = profesion === 'otra' ? otra.trim() || 'otra' : profesion
    const { error } = await supabase.from('profiles').update({ profesion: valor, termino, modo_cobro: modo }).eq('id', perfil.id)
    setGuardando(false)
    if (error) {
      setError(mensajeError(error))
      toast.error(`No se pudo guardar: ${mensajeError(error)}`)
      return
    }
    await qc.invalidateQueries({ queryKey: ['perfil'] })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[rgba(12,18,15,.6)] md:items-center md:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="¿A qué te dedicás?"
        className="flex max-h-[94dvh] w-full flex-col gap-5 overflow-auto rounded-t-[28px] bg-surface px-[22px] pt-6 pb-[max(24px,env(safe-area-inset-bottom))] shadow-[0_24px_60px_rgba(0,0,0,.3)] md:w-[560px] md:rounded-[28px] md:p-8"
      >
        <Logo tam={30} />
        <div>
          <h2 className="m-0 font-serif text-[34px] leading-tight font-normal">¿A qué te dedicás?</h2>
          <p className="mt-2 mb-0 text-base leading-relaxed text-ink2">
            Así adaptamos la app a tu forma de trabajar. Lo podés cambiar cuando quieras en Ajustes.
          </p>
        </div>
        <CamposProfesion
          profesion={profesion}
          setProfesion={(v) => {
            setProfesion(v)
            setError('')
          }}
          otra={otra}
          setOtra={setOtra}
          termino={termino}
          setTermino={setTermino}
          modo={modo}
          setModo={setModo}
        />
        {error && <Alerta>{error}</Alerta>}
        <Boton alto="h-14" className="shrink-0 text-[17px]" cargando={guardando} onClick={continuar}>
          Continuar
        </Boton>
      </div>
    </div>
  )
}
