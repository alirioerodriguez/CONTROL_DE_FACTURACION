import { useMemo, useState } from 'react'
import { Copy, MessageCircle, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { Boton, CampoMonto, Hoja, IC, Segmentado, Tarjeta } from '../../components/ui'
import { usePalabras } from '../../components/usePalabras'
import { afectados, planAumento, textoAviso, type Aumento, type Cambio, type QueSube, type TipoAumento } from '../../lib/aumento'
import { useGuardar, type Operacion, type Paciente, type Perfil } from '../../lib/datos'
import { capitalizar, formatMonto, hoyAR, nombreMes, numeroWhatsApp, parseMontoAR, periodoDe, plural, sumarMeses } from '../../lib/formato'
import { mensajeError } from '../../lib/supabase'

const REDONDEOS = [
  { v: 0, l: 'Sin redondear' },
  { v: 100, l: '$ 100' },
  { v: 500, l: '$ 500' },
  { v: 1000, l: '$ 1.000' },
]

function operacion(c: Cambio, perfilId: string): Operacion {
  return c.campo === 'tarifa_estandar'
    ? { tipo: 'actualizar', tabla: 'profiles', id: perfilId, cambios: { tarifa_estandar: c.despues } }
    : { tipo: 'actualizar', tabla: 'patients', id: c.id, cambios: { [c.campo]: c.despues } }
}

/** Tarjeta de Ajustes: subir los honorarios a todos de una vez y avisarles por WhatsApp. */
export function AumentoAjustes({ perfil, pacientes }: { perfil: Perfil; pacientes: Paciente[] }) {
  const guardar = useGuardar()
  const pal = usePalabras()
  const [abierta, setAbierta] = useState(false)
  const [tipo, setTipo] = useState<TipoAumento>('porcentaje')
  const [valorTxt, setValorTxt] = useState('')
  const [redondeo, setRedondeo] = useState(500)
  const [que, setQue] = useState<QueSube>({ estandar: true, personalizadas: true, abonos: true })
  const [aplicando, setAplicando] = useState(false)
  const [avisos, setAvisos] = useState<{ paciente: Paciente; cambio: Cambio }[] | null>(null)

  const valor = parseMontoAR(valorTxt || '0') ?? 0
  const aumento: Aumento = useMemo(() => ({ tipo, valor, redondeo }), [tipo, valor, redondeo])
  const cambios = useMemo(() => planAumento(perfil, pacientes, aumento, que), [perfil, pacientes, aumento, que])
  const mes = nombreMes(sumarMeses(periodoDe(hoyAR()), 1))
  const hayUSD = pacientes.some((p) => p.activo && p.moneda === 'USD') || perfil.moneda_default === 'USD'

  function cerrar() {
    setAbierta(false)
    setAvisos(null)
    setValorTxt('')
  }

  async function aplicar() {
    const aAvisar = afectados(pacientes, cambios)
    setAplicando(true)
    let hechos = 0
    try {
      // De a uno, para saber exactamente cuántos se guardaron si se corta la conexión.
      for (const c of cambios) {
        await guardar.mutateAsync([operacion(c, perfil.id)])
        hechos++
      }
      toast.success(`Aumento aplicado · ${plural(hechos, 'valor actualizado', 'valores actualizados')}`)
      setAvisos(aAvisar)
    } catch (e) {
      toast.error(`Se actualizaron ${hechos} de ${cambios.length}. Revisá antes de volver a aplicar: ${mensajeError(e)}`)
    } finally {
      setAplicando(false)
    }
  }

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto)
      toast.success('Mensaje copiado')
    } catch {
      toast.error('No se pudo copiar. Seleccioná el texto y copialo a mano.')
    }
  }

  const casilla = (clave: keyof QueSube, texto: string) => (
    <label className="flex cursor-pointer items-center gap-2.5 text-base">
      <input type="checkbox" checked={que[clave]} onChange={(e) => setQue({ ...que, [clave]: e.target.checked })} className="size-5 accent-[var(--acc)]" />
      {texto}
    </label>
  )

  return (
    <Tarjeta className="flex flex-col gap-3 p-[1.375rem]">
      <h2 className="m-0 flex items-center gap-2 text-lg font-semibold">
        <TrendingUp {...IC} /> Aumento de honorarios
      </h2>
      <p className="m-0 text-[0.9375rem] text-ink2">
        Subí la tarifa estándar, las personalizadas y los abonos de una vez, y mandale el aviso a cada paciente por WhatsApp.
      </p>
      <Boton variante="borde" onClick={() => setAbierta(true)} className="self-start">
        Preparar un aumento
      </Boton>

      {abierta && (
        <Hoja titulo={avisos ? 'Avisar a tus pacientes' : 'Aumento de honorarios'} onCerrar={cerrar}>
          {!avisos ? (
            <div className="flex flex-col gap-4">
              <Segmentado
                opciones={[
                  { v: 'porcentaje' as TipoAumento, l: 'Porcentaje' },
                  { v: 'monto' as TipoAumento, l: 'Monto fijo' },
                ]}
                valor={tipo}
                onCambio={setTipo}
              />
              <CampoMonto simbolo={tipo === 'porcentaje' ? '%' : '$'} etiqueta={tipo === 'porcentaje' ? 'Porcentaje de aumento' : 'Monto a sumar'} valor={valorTxt} onCambio={setValorTxt} autoFocus />
              {tipo === 'monto' && hayUSD && <p className="m-0 text-sm text-ink2">Un monto fijo en pesos no cambia lo que se cobra en dólares.</p>}
              <div className="flex flex-col gap-2 text-[0.9375rem] font-semibold">
                Redondear los pesos hacia arriba
                <Segmentado opciones={REDONDEOS} valor={redondeo} onCambio={setRedondeo} />
              </div>
              <div className="flex flex-col gap-2.5">
                {casilla('estandar', 'Tarifa estándar')}
                {casilla('personalizadas', 'Tarifas personalizadas')}
                {casilla('abonos', 'Abonos mensuales')}
              </div>
              {cambios.length > 0 ? (
                <div className="flex flex-col rounded-2xl border border-line">
                  {cambios.map((c) => (
                    <div key={c.id + c.campo} className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{c.nombre}</span>
                        <span className="text-sm text-ink2">{c.campo === 'abono_mensual' ? 'Abono mensual' : c.campo === 'tarifa_estandar' ? `La siguen los pacientes con tarifa estándar` : `Tarifa ${pal.porUnidad}`}</span>
                      </span>
                      <span className="text-right whitespace-nowrap tabular">
                        <span className="block text-sm text-ink2 line-through">{formatMonto(c.antes, c.moneda)}</span>
                        <span className="font-semibold">{formatMonto(c.despues, c.moneda)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="m-0 text-[0.9375rem] text-ink2">{aumento.valor > 0 ? 'No hay nada para subir con lo que elegiste.' : 'Escribí cuánto querés aumentar para ver cómo queda.'}</p>
              )}
              <p className="m-0 text-sm text-ink2">
                Las {pal.sesiones} ya cargadas conservan su precio; las nuevas se cobran con el valor nuevo.
              </p>
              <Boton disabled={!cambios.length} cargando={aplicando} onClick={aplicar}>
                {cambios.length ? `Aplicar a ${plural(cambios.length, 'valor', 'valores')}` : 'Aplicar'}
              </Boton>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="m-0 text-[0.9375rem] text-ink2">
                {avisos.length
                  ? `Mensaje listo para avisar que a partir de ${mes} cambia el valor. Tocá WhatsApp en cada paciente.`
                  : 'Listo. No hay pacientes activos a los que les cambie el valor.'}
              </p>
              {avisos.map(({ paciente, cambio }) => {
                const texto = textoAviso(paciente.nombre, cambio, mes, pal.unidad)
                const numero = numeroWhatsApp(paciente.telefono)
                return (
                  <div key={paciente.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{[paciente.nombre, paciente.apellido].filter(Boolean).join(' ')}</span>
                      <span className="text-sm text-ink2">{capitalizar(mes)}: {formatMonto(cambio.despues, cambio.moneda)}</span>
                    </span>
                    {numero ? (
                      <a
                        href={`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="presionable inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-acc px-4 font-semibold text-on-acc hover:bg-acc-strong"
                      >
                        <MessageCircle {...IC} /> WhatsApp
                      </a>
                    ) : (
                      <Boton variante="borde" icono={Copy} onClick={() => copiar(texto)}>
                        Copiar
                      </Boton>
                    )}
                  </div>
                )
              })}
              <Boton variante="suave" onClick={cerrar}>
                Listo
              </Boton>
            </div>
          )}
        </Hoja>
      )}
    </Tarjeta>
  )
}
