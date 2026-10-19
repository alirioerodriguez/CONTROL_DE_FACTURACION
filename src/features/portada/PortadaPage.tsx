import { Link } from 'react-router-dom'
import { Banknote, CalendarDays, Check, FileSpreadsheet, MessageCircle, ShieldCheck, Users, type LucideIcon } from 'lucide-react'
import { Logo } from '../../components/Layout'
import { IC } from '../../components/ui'

// Textos: docs/investigacion/presentacion.md

const BENEFICIOS: { icono: LucideIcon; titulo: string; texto: string }[] = [
  { icono: Users, titulo: 'Sabés quién te debe, de un vistazo', texto: 'Se acabó revisar el cuaderno o los chats para acordarte.' },
  { icono: MessageCircle, titulo: 'Recordatorios por WhatsApp', texto: 'La app te deja el mensaje escrito; vos lo revisás y lo mandás desde tu teléfono.' },
  { icono: Banknote, titulo: 'Pesos y dólares, cada uno por su lado', texto: 'Tus cuentas claras, sin mezclar monedas.' },
  { icono: CalendarDays, titulo: 'Sesiones del mes en un toque', texto: 'Si atendés todos los lunes, se cargan solas; las que faltan o se cancelan, no se cobran.' },
  { icono: FileSpreadsheet, titulo: 'Reporte para tu contadora', texto: 'En Excel o PDF, listo para mandar. Y si ya usás un Excel, lo importás.' },
  { icono: ShieldCheck, titulo: 'Control del tope del monotributo', texto: 'Te avisa cuando te acercás al tope de tu categoría.' },
]

const PREGUNTAS: { p: string; r: string }[] = [
  { p: '¿Tiene costo?', r: 'No, es gratis. Entrás, la usás y listo.' },
  {
    p: '¿Es una historia clínica?',
    r: 'No. honorapp no guarda notas de las sesiones ni nada de lo que pasa en el consultorio. Solo lleva lo que tiene que ver con los cobros: nombre y teléfono de cada paciente, qué sesiones hubo y qué pagos recibiste.',
  },
  { p: '¿Puedo cobrar en pesos y en dólares?', r: 'Sí. Se llevan por separado, así que cada total es el de verdad.' },
  {
    p: 'Ya llevo todo en un Excel, ¿tengo que empezar de cero?',
    r: 'No. Pasás tus datos al modelo de Excel de la app, lo importás y seguís desde ahí. Y si algún día te querés llevar tus datos, los descargás en Excel.',
  },
  { p: '¿Cómo le paso todo a mi contadora?', r: 'Con un par de toques sacás el reporte del mes, en Excel o en PDF, y se lo mandás.' },
  { p: '¿Se puede leer con letra más grande?', r: 'Sí. En Ajustes elegís entre 5 tamaños de letra y toda la app se agranda.' },
  { p: '¿Cómo entro?', r: 'Con tu mail o con tu cuenta de Google.' },
]

/** Página pública: lo primero que ve quien abre el link sin tener cuenta. */
export function PortadaPage() {
  const botonPrincipal =
    'inline-flex min-h-14 max-w-full items-center justify-center rounded-full py-2 text-center leading-tight bg-acc px-7 text-[1.0625rem] font-semibold text-on-acc no-underline hover:bg-acc-strong'
  const botonSecundario =
    'inline-flex min-h-14 max-w-full items-center justify-center rounded-full py-2 text-center leading-tight border border-line bg-surface px-7 text-[1.0625rem] font-semibold text-ink no-underline hover:bg-surface2'

  return (
    <div className="min-h-dvh bg-fondo text-ink">
      <header className="mx-auto flex max-w-[70rem] items-center justify-between gap-4 px-5 py-5 md:px-12">
        <Logo />
        <Link to="/ingresar" className="rounded-full px-4 py-2.5 text-base font-semibold text-ink no-underline hover:bg-surface2">
          Ingresar
        </Link>
      </header>

      <main className="mx-auto flex max-w-[70rem] flex-col gap-16 px-5 pt-4 pb-16 md:px-12 md:pt-10">

        <section className="grid items-center gap-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="flex flex-col gap-6">
            <h1 className="m-0 font-serif text-[clamp(2.75rem,7vw,4.75rem)] leading-[0.95] font-normal text-balance">
              Tus cobros, en orden.
            </h1>
            <p className="m-0 max-w-[36rem] text-[1.1875rem] leading-relaxed text-pretty text-ink2">
              honorapp es una app gratuita para profesionales que atienden pacientes en Argentina: anotás las sesiones y
              los pagos, ves quién te debe, mandás recordatorios por WhatsApp y le pasás el reporte del mes a tu
              contadora.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/registro" className={botonPrincipal}>
                Crear mi cuenta gratis
              </Link>
              <Link to="/ingresar" className={botonSecundario}>
                Ya tengo cuenta
              </Link>
            </div>
            <ul className="m-0 flex flex-col gap-2 p-0 text-[0.9375rem] text-ink2">
              {['Gratis, sin tarjeta', 'No es historia clínica: solo datos de cobro', 'Para psicología, nutrición, kinesiología y más'].map((t) => (
                <li key={t} className="flex list-none items-center gap-2">
                  <Check {...IC} className="shrink-0 text-acc-strong" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <Muestra />
        </section>

        <section className="flex flex-col gap-6">
          <h2 className="m-0 font-serif text-[clamp(2rem,4vw,2.75rem)] leading-tight font-normal">Qué hace por vos</h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,17rem),1fr))] gap-4">
            {BENEFICIOS.map((b) => (
              <div key={b.titulo} className="flex flex-col gap-2.5 rounded-[1.375rem] border border-line bg-surface p-5">
                <span className="grid size-11 place-items-center rounded-2xl bg-acc-soft text-[1.25rem] text-acc-strong">
                  <b.icono {...IC} />
                </span>
                <div className="text-[1.0625rem] font-semibold">{b.titulo}</div>
                <p className="m-0 text-[0.9375rem] leading-normal text-ink2">{b.texto}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="m-0 font-serif text-[clamp(2rem,4vw,2.75rem)] leading-tight font-normal">Preguntas frecuentes</h2>
          <div className="flex flex-col rounded-[1.375rem] border border-line bg-surface">
            {PREGUNTAS.map((q) => (
              <details key={q.p} className="group border-t border-line px-5 first:border-t-0">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[1.0625rem] font-semibold">
                  {q.p}
                  <span aria-hidden className="text-xl text-ink2 transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="m-0 max-w-[44rem] pb-4 text-[0.9375rem] leading-relaxed text-ink2">{q.r}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="flex flex-col items-start gap-5 rounded-[1.75rem] bg-acc-soft p-7 md:p-10">
          <p className="m-0 max-w-[40rem] font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] leading-tight">
            Probala y fijate cómo se siente cerrar el mes sin correr atrás de los números.
          </p>
          <Link to="/registro" className={botonPrincipal}>
            Crear mi cuenta gratis
          </Link>
        </section>
      </main>

      <footer className="mx-auto flex max-w-[70rem] flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-6 text-sm text-ink2 md:px-12">
        <Logo tam={24} />
        <span>
          <Link to="/privacidad" className="text-ink2">Privacidad</Link> ·{' '}
          <Link to="/terminos" className="text-ink2">Términos y condiciones</Link>
        </span>
      </footer>
    </div>
  )
}

/** Ejemplo de la app dibujado con datos inventados (no es una captura). */
function Muestra() {
  const filas = [
    { n: 'Lucía P.', d: 'Lun 12 oct', m: '$ 30.000', e: 'Pendiente', tono: 'bg-bad-soft text-bad' },
    { n: 'Martín G.', d: 'Mié 14 oct', m: '$ 15.000', e: 'Parcial', tono: 'bg-warn-soft text-warn' },
    { n: 'Sofía R.', d: 'Jue 15 oct', m: 'US$ 40', e: 'Pendiente', tono: 'bg-bad-soft text-bad' },
  ]
  return (
    <div aria-hidden className="flex flex-col gap-3 rounded-[1.75rem] border border-line bg-surface p-5 shadow-[0_24px_60px_rgba(0,0,0,.12)]">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-ink2">Pendiente de cobro · octubre</span>
        <span className="rounded-full bg-surface2 px-3 py-1 text-xs font-semibold text-ink2">Ejemplo</span>
      </div>
      <div className="num text-[2.5rem] leading-none">$ 45.000</div>
      <div className="text-sm text-ink2">+ US$ 40 · 3 sesiones sin abonar</div>
      <div className="mt-1 flex flex-col">
        {filas.map((f) => (
          <div key={f.n} className="flex items-center gap-3 border-t border-line py-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-acc-soft text-xs font-bold text-acc-strong">
              {f.n.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[0.9375rem] font-semibold">{f.n}</div>
              <div className="flex items-center gap-2 text-xs text-ink2">
                {f.d}
                <span className={`rounded-full px-2 py-0.5 font-semibold ${f.tono}`}>{f.e}</span>
              </div>
            </div>
            <span className="text-[0.9375rem] font-semibold whitespace-nowrap">{f.m}</span>
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-wa-soft text-wa">
              <MessageCircle {...IC} />
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
