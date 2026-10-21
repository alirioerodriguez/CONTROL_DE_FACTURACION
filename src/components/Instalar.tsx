import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { Check, Download, EllipsisVertical, MonitorDown, Share, SquarePlus, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  abiertaComoApp, avisoCerrado, cerrarAviso, estadoInstalacion, instalarAhora, LINK_PLAY, navegadorDe, plataformaDe,
  PUBLICADA_EN_PLAY, suscribirInstalacion, type Plataforma,
} from '../lib/instalar'
import { Boton, Hoja, IC, Segmentado, Tarjeta } from './ui'

// eslint-disable-next-line react-refresh/only-export-components
export function useInstalacion() {
  return useSyncExternalStore(suscribirInstalacion, estadoInstalacion, () => 'manual' as const)
}

async function instalar() {
  if (await instalarAhora()) toast.success('Listo: honorapp quedó instalada')
}

/**
 * Tarjeta discreta que invita a instalar honorapp. No aparece si ya se abre como app
 * (instalada o la de Google Play) ni durante DIAS_SIN_AVISO después de cerrarla.
 */
export function AvisoInstalar() {
  const estado = useInstalacion()
  const [oculto, setOculto] = useState(() => abiertaComoApp() || avisoCerrado())
  const [guia, setGuia] = useState(false)
  const cerrarGuia = () => setGuia(false)
  // Si se instala con la guía abierta, la tarjeta se va pero la guía queda hasta cerrarla.
  if (oculto || estado === 'instalada') return guia ? <GuiaInstalar onCerrar={cerrarGuia} /> : null

  const plataforma = plataformaDe(navigator.userAgent, navigator.maxTouchPoints)
  const donde = plataforma === 'escritorio' ? 'en tu compu' : 'en tu celular'

  return (
    <>
      <Tarjeta className="anim-pantalla relative mb-5 flex items-start gap-3.5 p-4 pr-12 md:items-center md:p-5 md:pr-14">
        <span className="grid size-11 shrink-0 place-items-center rounded-[0.875rem] bg-acc-soft text-acc-strong">
          {plataforma === 'escritorio' ? <MonitorDown {...IC} /> : <Download {...IC} />}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="text-base font-semibold">Instalá honorapp {donde}</div>
            <div className="text-[0.9375rem] leading-snug text-ink2">
              La abrís desde su ícono, como cualquier app, sin buscarla en el navegador.
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {estado === 'lista' && (
              <Boton alto="h-11" className="px-4" icono={Download} onClick={instalar}>
                Instalar
              </Boton>
            )}
            <Boton variante={estado === 'lista' ? 'texto' : 'suave'} alto="h-11" className="px-4" onClick={() => setGuia(true)}>
              Cómo instalar
            </Boton>
          </div>
        </div>
        <button
          type="button"
          aria-label="No mostrar más"
          title="No mostrar más"
          onClick={() => {
            cerrarAviso()
            setOculto(true)
          }}
          className="presionable absolute top-2.5 right-2.5 grid size-9 place-items-center rounded-full text-ink2 hover:bg-surface2"
        >
          <X size="1.125em" strokeWidth={1.8} />
        </button>
      </Tarjeta>
      {guia && <GuiaInstalar onCerrar={cerrarGuia} />}
    </>
  )
}

function Paso({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-acc-soft text-sm font-bold text-acc-strong">{n}</span>
      <span className="pt-0.5 text-base leading-snug">{children}</span>
    </li>
  )
}

/** Nombre de un botón o menú tal como se ve en la pantalla. */
function B({ children }: { children: ReactNode }) {
  return <strong className="font-semibold">{children}</strong>
}

/** Ícono chiquito dentro del texto de un paso. */
function Ic({ icono: Icono }: { icono: typeof Share }) {
  return <Icono size="1.05em" strokeWidth={2} className="mx-0.5 inline-block -translate-y-px align-middle text-acc-strong" />
}

/** Paso a paso para instalar, con la pestaña del equipo que se está usando ya elegida. */
export function GuiaInstalar({ onCerrar }: { onCerrar: () => void }) {
  const estado = useInstalacion()
  const ua = navigator.userAgent
  const [plataforma, setPlataforma] = useState<Plataforma>(() => plataformaDe(ua, navigator.maxTouchPoints))
  const navegador = navegadorDe(ua)
  const yaEsApp = abiertaComoApp() || estado === 'instalada'

  return (
    <Hoja titulo="Instalar la app" onCerrar={onCerrar}>
      {yaEsApp ? (
        <div className="flex items-start gap-3 rounded-2xl bg-acc-soft p-4 text-acc-strong">
          <Check {...IC} className="mt-0.5 shrink-0" />
          <span className="text-base leading-snug font-semibold">honorapp ya está instalada en este dispositivo. Abrila desde su ícono.</span>
        </div>
      ) : (
        <p className="m-0 text-[1.0625rem] leading-normal text-ink2">
          honorapp se puede instalar desde el navegador: queda con su ícono en el celular o la compu y se abre en su propia
          ventana. Es la misma cuenta y los mismos datos, y casi no ocupa lugar.
        </p>
      )}

      {estado === 'lista' && !yaEsApp && (
        <Boton icono={Download} className="self-start" onClick={instalar}>
          Instalar ahora
        </Boton>
      )}

      <Segmentado
        opciones={[
          { v: 'android' as Plataforma, l: 'Android' },
          { v: 'ios' as Plataforma, l: 'iPhone / iPad' },
          { v: 'escritorio' as Plataforma, l: 'Compu' },
        ]}
        valor={plataforma}
        onCambio={setPlataforma}
      />

      {plataforma === 'android' && (
        <div className="flex flex-col gap-3">
          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            <Paso n={1}>Abrí honorapp en <B>Chrome</B>.</Paso>
            <Paso n={2}>
              Tocá el menú <Ic icono={EllipsisVertical} /> de arriba a la derecha.
            </Paso>
            <Paso n={3}>
              Elegí <B>Instalar app</B> (en algunos celulares dice <B>Agregar a la pantalla principal</B>).
            </Paso>
            <Paso n={4}>
              Confirmá con <B>Instalar</B>. El ícono de honorapp aparece junto a tus otras apps.
            </Paso>
          </ol>
          <p className="m-0 text-sm leading-snug text-ink2">
            {navegador === 'samsung'
              ? 'En Samsung Internet: menú ≡ de abajo → «Agregar página a» → «Pantalla de inicio».'
              : '¿Otro navegador? Buscá en su menú «Instalar» o «Agregar a pantalla de inicio». Si no aparece, abrila en Chrome.'}
          </p>
        </div>
      )}

      {plataforma === 'ios' && (
        <div className="flex flex-col gap-3">
          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            <Paso n={1}>Abrí honorapp en <B>Safari</B>.</Paso>
            <Paso n={2}>
              Tocá <B>Compartir</B> <Ic icono={Share} /> (el cuadrado con la flecha para arriba): abajo en el iPhone, arriba en el
              iPad.
            </Paso>
            <Paso n={3}>
              Bajá y elegí <B>Agregar a pantalla de inicio</B> <Ic icono={SquarePlus} />.
            </Paso>
            <Paso n={4}>
              Tocá <B>Agregar</B>. honorapp queda en tu pantalla de inicio.
            </Paso>
          </ol>
          <p className="m-0 text-sm leading-snug text-ink2">
            Desde iOS 16.4 también funciona en Chrome para iPhone, con el mismo botón Compartir.
          </p>
        </div>
      )}

      {plataforma === 'escritorio' && (
        <div className="flex flex-col gap-3">
          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            <Paso n={1}>Abrí honorapp en <B>Chrome</B> o <B>Edge</B>.</Paso>
            <Paso n={2}>
              En la barra de direcciones, a la derecha, hacé clic en el ícono de instalar <Ic icono={MonitorDown} />.
            </Paso>
            <Paso n={3}>
              Clic en <B>Instalar</B>. Queda en el menú Inicio (o en Aplicaciones) y en la barra de tareas si la fijás.
            </Paso>
          </ol>
          <p className="m-0 text-sm leading-snug text-ink2">
            ¿No ves el ícono? En Chrome: menú ⋮ → «Transmitir, guardar y compartir» → «Instalar página como app». En Edge: menú … →
            «Aplicaciones» → «Instalar este sitio como una aplicación». En Safari para Mac: Archivo → «Agregar al Dock». Firefox no
            permite instalarla.
          </p>
        </div>
      )}

      {PUBLICADA_EN_PLAY && (
        <a
          href={LINK_PLAY}
          target="_blank"
          rel="noreferrer"
          className="presionable flex min-h-14 items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 text-base font-semibold text-ink hover:bg-surface2"
        >
          En Android también la podés bajar de Google Play
        </a>
      )}
    </Hoja>
  )
}
