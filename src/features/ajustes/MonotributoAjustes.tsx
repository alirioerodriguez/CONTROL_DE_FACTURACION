import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Boton, CampoMonto, Tarjeta } from '../../components/ui'
import { useGuardar, usePagos, type Perfil } from '../../lib/datos'
import { formatCompacto, formatFecha, formatMonto, hoyAR, montoParaInput, parseMontoAR } from '../../lib/formato'
import { CATEGORIAS, controlTope, datosCategoria, VIGENCIA_MONOTRIBUTO, type CategoriaPerfil } from '../../lib/monotributo'
import { mensajeError } from '../../lib/supabase'

/** Tarjeta de Ajustes: elegir la categoría del monotributo y el dólar para sumar los cobros en USD. */
export function MonotributoAjustes({ perfil }: { perfil: Perfil }) {
  const guardar = useGuardar()
  const { data: pagos = [] } = usePagos()
  const [tcTxt, setTcTxt] = useState('')

  useEffect(() => {
    setTcTxt(perfil.tipo_cambio_usd ? montoParaInput(perfil.tipo_cambio_usd) : '')
  }, [perfil.tipo_cambio_usd])

  // Desde Inicio se llega con #monotributo: se baja hasta esta tarjeta (después del scroll al principio del Layout).
  useEffect(() => {
    if (window.location.hash !== '#monotributo') return
    const t = setTimeout(() => document.getElementById('monotributo')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
    return () => clearTimeout(t)
  }, [])

  const elegida = perfil.monotributo_categoria
  const datos = datosCategoria(elegida)
  const control = controlTope(pagos, elegida, perfil.tipo_cambio_usd, hoyAR())

  async function elegir(cat: CategoriaPerfil) {
    try {
      await guardar.mutateAsync([{ tipo: 'actualizar', tabla: 'profiles', id: perfil.id, cambios: { monotributo_categoria: cat } }])
      toast.success(cat === 'no' ? 'Listo: no se muestra el control del monotributo' : `Categoría ${cat} guardada`)
    } catch (e) {
      toast.error(`No se pudo guardar: ${mensajeError(e)}`)
    }
  }

  async function guardarTc() {
    const tc = tcTxt.trim() ? parseMontoAR(tcTxt) : null
    if (tcTxt.trim() && (tc == null || tc <= 0)) {
      toast.error('Revisá el dólar: tiene que ser un número, por ejemplo 1.450')
      return
    }
    try {
      await guardar.mutateAsync([{ tipo: 'actualizar', tabla: 'profiles', id: perfil.id, cambios: { tipo_cambio_usd: tc } }])
      toast.success(tc ? `Dólar guardado: ${formatMonto(tc, 'ARS')}` : 'Dólar borrado: los cobros en USD quedan aparte')
    } catch (e) {
      toast.error(`No se pudo guardar: ${mensajeError(e)}`)
    }
  }

  const botonCat = (activa: boolean) =>
    `flex min-h-[3.75rem] flex-col items-center justify-center gap-0.5 rounded-2xl border px-1 py-1.5 ${
      activa ? 'border-ink bg-ink text-fondo' : 'border-line bg-surface hover:bg-surface2'
    }`

  return (
    <Tarjeta id="monotributo" className="flex scroll-mt-6 flex-col gap-[1.125rem] p-[1.375rem]">
      <div className="flex flex-col gap-1.5">
        <h2 className="m-0 text-lg font-semibold">Monotributo</h2>
        <p className="m-0 text-[0.9375rem] leading-normal text-ink2">
          Elegí tu categoría (figura en tu credencial de monotributo o te la dice tu contadora). En Inicio vas a ver cuánto
          llevás cobrado en los últimos 12 meses y cuánto te falta para el tope.
        </p>
      </div>

      <div role="radiogroup" aria-label="Categoría del monotributo" className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2">
        {CATEGORIAS.map((c) => (
          <button
            key={c.letra}
            type="button"
            role="radio"
            aria-checked={elegida === c.letra}
            aria-label={`Categoría ${c.letra}, hasta ${formatMonto(c.tope, 'ARS')} por año`}
            disabled={guardar.isPending}
            onClick={() => void elegir(c.letra)}
            className={botonCat(elegida === c.letra)}
          >
            <span className="text-xl leading-none font-semibold">{c.letra}</span>
            <span className={`text-xs ${elegida === c.letra ? 'opacity-80' : 'text-ink2'}`}>{formatCompacto(c.tope, 'ARS')}</span>
          </button>
        ))}
      </div>

      {datos ? (
        <div className="text-[0.9375rem] leading-normal">
          <strong>Categoría {datos.letra}:</strong> hasta {formatMonto(datos.tope, 'ARS')} por año · cuota mensual para
          servicios: {formatMonto(datos.cuota, 'ARS')}.
        </div>
      ) : elegida === 'no' ? (
        <div className="text-[0.9375rem] text-ink2">Marcaste que no usás monotributo: el control no aparece en Inicio.</div>
      ) : null}

      {control.total > 0 && (
        <div className="text-[0.9375rem] leading-normal text-ink2">
          Según lo que cobraste en los últimos 12 meses ({formatMonto(control.total, 'ARS')})
          {control.sugerida ? ` te correspondería la categoría ${control.sugerida.letra}.` : ' superás el tope de la categoría K.'}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="text-[0.9375rem] font-semibold">Dólar para el monotributo (opcional)</div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-[12rem] flex-1">
            <CampoMonto simbolo="$" valor={tcTxt} onCambio={setTcTxt} etiqueta="Pesos por dólar" />
          </div>
          <Boton variante="suave" alto="h-14" className="px-5" cargando={guardar.isPending} onClick={() => void guardarTc()}>
            Guardar
          </Boton>
        </div>
        <span className="text-sm text-ink2">
          Si cobrás en dólares, poné a cuánto los toma tu contadora. Así se suman a lo cobrado para el control del tope.
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3.5">
        <span className="text-sm text-ink2">Valores de ARCA vigentes desde el {formatFecha(VIGENCIA_MONOTRIBUTO)}.</span>
        {elegida !== 'no' && (
          <Boton variante="texto" alto="h-10" className="px-3 text-sm" onClick={() => void elegir('no')}>
            No uso monotributo
          </Boton>
        )}
      </div>
    </Tarjeta>
  )
}
