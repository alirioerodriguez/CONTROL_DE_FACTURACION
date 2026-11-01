import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Copy, ExternalLink, Plug, ReceiptText } from 'lucide-react'
import { toast } from 'sonner'
import { Boton, IC, Tarjeta } from '../../components/ui'
import { useGuardar, type Perfil } from '../../lib/datos'
import { CUIT_HONORAPP, probarArca } from '../../lib/facturaArca'
import { formatCuil } from '../../lib/documentos'
import { formatFecha } from '../../lib/formato'
import { mensajeError } from '../../lib/supabase'

const LOGIN_ARCA = 'https://auth.afip.gob.ar/contribuyente_/login.xhtml'

/** Ajustes: conectar honorapp con ARCA para que haga las Facturas C (delegación del web service, sin clave fiscal). */
export function ArcaAjustes({ perfil }: { perfil: Perfil }) {
  const guardar = useGuardar()
  const qc = useQueryClient()
  const [pv, setPv] = useState(perfil.arca_punto_venta ? String(perfil.arca_punto_venta) : '')
  const [probando, setProbando] = useState(false)
  const conectado = !!perfil.arca_conectado_at && !!perfil.arca_punto_venta

  async function copiarCuit() {
    try {
      await navigator.clipboard.writeText(CUIT_HONORAPP.replace(/\D/g, ''))
      toast.success('CUIT de honorapp copiado')
    } catch {
      toast.error('No se pudo copiar: escribilo a mano')
    }
  }

  async function guardarYProbar() {
    const n = Number(pv)
    if (!Number.isInteger(n) || n < 1 || n > 99998) return toast.error('El punto de venta es un número de hasta 5 cifras')
    if (!perfil.cuit) return toast.error('Primero cargá tu CUIT más arriba, en tus datos')
    setProbando(true)
    try {
      await guardar.mutateAsync([{ tipo: 'actualizar', tabla: 'profiles', id: perfil.id, cambios: { arca_punto_venta: n } }])
      const r = await probarArca()
      toast.success(`¡Conectado! Tu última factura en ese punto de venta es la ${r.ultimo}`)
      await qc.invalidateQueries() // refresca el perfil (queda «Conectado»)
    } catch (e) {
      toast.error(mensajeError(e))
    } finally {
      setProbando(false)
    }
  }

  return (
    <Tarjeta className="flex flex-col gap-4 p-[1.375rem]">
      <div className="flex items-start gap-3">
        <ReceiptText {...IC} className="mt-1 shrink-0 text-acc-strong" />
        <div>
          <h2 className="m-0 text-lg font-semibold">Facturar con ARCA desde honorapp</h2>
          <p className="mt-1 text-[0.9375rem] leading-snug text-ink2">
            Conectalo una vez y después hacés la Factura C de cada pago (o de todo el mes) con un toque, sin entrar a ARCA. honorapp
            nunca te pide la clave fiscal: le das permiso solo para facturar, y se lo podés quitar cuando quieras desde ARCA.
          </p>
        </div>
      </div>

      {conectado ? (
        <div className="flex items-center gap-2 rounded-[1rem] bg-acc-soft px-4 py-3 font-semibold text-acc-strong">
          <Check {...IC} />
          Conectado · punto de venta {perfil.arca_punto_venta} · desde el {formatFecha(perfil.arca_conectado_at!.slice(0, 10))}
        </div>
      ) : null}

      {conectado ? (
        <label className="flex cursor-pointer items-start gap-3 text-[0.9375rem] leading-snug">
          <input
            type="checkbox"
            className="mt-1 size-5"
            checked={!!perfil.arca_auto}
            disabled={guardar.isPending}
            onChange={async (e) => {
              const valor = e.target.checked
              try {
                await guardar.mutateAsync([{ tipo: 'actualizar', tabla: 'profiles', id: perfil.id, cambios: { arca_auto: valor } }])
                toast.success(valor ? 'Listo: cada pago nuevo se factura solo' : 'Facturación automática apagada')
              } catch (err) {
                toast.error(`No se pudo guardar: ${mensajeError(err)}`)
              }
            }}
          />
          <span>
            <b>Facturar sola cada pago nuevo</b>
            <span className="block text-ink2">Apenas registrás un pago, honorapp hace la Factura C en ARCA y te avisa el número. Las de obras sociales quedan para hacer a mano.</span>
          </span>
        </label>
      ) : !CUIT_HONORAPP ? (
        <p className="m-0 rounded-[1rem] bg-surface2 px-4 py-3 text-[0.9375rem] text-ink2">
          Muy pronto: estamos terminando el alta de honorapp en ARCA. Mientras tanto, seguí usando «Para facturar» con los datos listos para copiar.
        </p>
      ) : null}

      {CUIT_HONORAPP && (
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          <Paso n={1} titulo="Entrá a ARCA con tu CUIT y clave fiscal (nivel 3)">
            <a href={LOGIN_ARCA} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-acc-strong">
              Abrir ARCA <ExternalLink size={15} />
            </a>
          </Paso>
          <Paso n={2} titulo="Dale permiso a honorapp para facturar">
            En <b>Administrador de Relaciones de Clave Fiscal</b> → <b>Nueva Relación</b> → buscá <b>ARCA → Web Services → Facturación Electrónica</b>. En
            «Representante» poné el CUIT de honorapp y confirmá.
            <button type="button" onClick={copiarCuit} className="mt-1.5 flex items-center gap-1.5 font-semibold text-acc-strong">
              <Copy size={15} /> {formatCuil(CUIT_HONORAPP)} (copiar)
            </button>
          </Paso>
          <Paso n={3} titulo="Creá un punto de venta para honorapp">
            En <b>Administración de puntos de venta y domicilios</b> → <b>Agregar</b>, elegí el sistema <b>«Factura Electrónica – Monotributo – Web Services»</b>.
            Es uno nuevo: el que usás en la web de ARCA no sirve, y su numeración empieza en 1.
          </Paso>
          <Paso n={4} titulo="Escribí acá el número de ese punto de venta y probá">
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <input
                inputMode="numeric"
                value={pv}
                onChange={(e) => setPv(e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="Ej.: 3"
                aria-label="Punto de venta de web services"
                className="h-12 w-28 rounded-[0.875rem] border border-line bg-fondo px-4 text-[1.0625rem]"
              />
              <Boton icono={Plug} cargando={probando} onClick={guardarYProbar}>
                {conectado ? 'Probar de nuevo' : 'Conectar'}
              </Boton>
            </div>
          </Paso>
        </ol>
      )}
    </Tarjeta>
  )
}

function Paso({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-acc-soft text-sm font-bold text-acc-strong">{n}</span>
      <div className="text-[0.9375rem] leading-snug">
        <div className="font-semibold">{titulo}</div>
        <div className="mt-0.5 text-ink2">{children}</div>
      </div>
    </li>
  )
}
