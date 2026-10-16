import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../../components/Layout'

const CONTACTO = 'alirioerodriguez@gmail.com'
const ACTUALIZADO = '16 de octubre de 2026'

function Marco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-fondo px-5 py-10 text-ink">
      <article className="mx-auto flex max-w-[720px] flex-col gap-5 text-[17px] leading-relaxed [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc">
        <Link to="/" className="no-underline">
          <Logo />
        </Link>
        <h1 className="m-0 font-serif text-[44px] leading-none font-normal">{titulo}</h1>
        <p className="text-sm text-ink2">Última actualización: {ACTUALIZADO}</p>
        {children}
        <p className="mt-6 text-sm text-ink2">
          <Link to="/privacidad">Privacidad</Link> · <Link to="/terminos">Condiciones</Link> · <Link to="/">Volver a la app</Link>
        </p>
      </article>
    </main>
  )
}

export function PrivacidadPage() {
  return (
    <Marco titulo="Política de privacidad">
      <p>
        honorapp es una aplicación web para que profesionales que atienden pacientes (psicología, nutrición,
        kinesiología y otras disciplinas) lleven el control administrativo de sus cobros: pacientes, sesiones, pagos y reportes para su contador o contadora. No es un software clínico.
      </p>
      <h2>Qué datos guardamos</h2>
      <ul>
        <li>De tu cuenta: tu mail y tu nombre. Si ingresás con Google, recibimos solo tu nombre y tu mail.</li>
        <li>
          Lo que cargás vos: datos administrativos de tus pacientes (nombre, teléfono, tarifa, días de atención),
          sesiones, pagos, medios de pago y números de factura.
        </li>
        <li>No guardamos historia clínica ni notas de sesión, y te pedimos que no las cargues.</li>
      </ul>
      <h2>Para qué los usamos</h2>
      <p>
        Solo para que la aplicación funcione: mostrarte saldos, reportes y recordatorios. No vendemos ni compartimos
        datos con terceros, no mostramos publicidad y no usamos los datos para otros fines.
      </p>
      <h2>Dónde se guardan y quién los ve</h2>
      <p>
        Los datos se guardan en Supabase (servidores en San Pablo, Brasil) y la aplicación se sirve desde Vercel. Cada
        cuenta ve únicamente sus propios datos: la base aplica reglas de acceso por usuario. Las conexiones van cifradas.
      </p>
      <h2>Tus derechos</h2>
      <p>
        Podés ver, corregir y exportar tus datos desde la aplicación, y borrar pacientes con todo su historial. Para
        eliminar tu cuenta completa o hacer cualquier consulta, escribinos a <a href={`mailto:${CONTACTO}`}>{CONTACTO}</a>.
        En Argentina, la Agencia de Acceso a la Información Pública es el órgano de control de la Ley 25.326 de
        Protección de Datos Personales.
      </p>
      <h2>Responsabilidad sobre los datos de pacientes</h2>
      <p>
        Cada profesional es responsable de los datos de sus pacientes que decide cargar y de contar con su
        consentimiento cuando corresponda.
      </p>
    </Marco>
  )
}

export function TerminosPage() {
  return (
    <Marco titulo="Condiciones del servicio">
      <p>
        honorapp se ofrece tal como está, para uso administrativo de profesionales. Al crear una cuenta aceptás estas
        condiciones y la <Link to="/privacidad">política de privacidad</Link>.
      </p>
      <h2>Uso</h2>
      <ul>
        <li>Sos responsable de la información que cargás y de mantener segura tu contraseña.</li>
        <li>No cargues historia clínica ni datos clínicos: la aplicación no está pensada para eso.</li>
        <li>Los reportes son una ayuda: revisá los números con tu contador o contadora antes de presentarlos.</li>
      </ul>
      <h2>Disponibilidad</h2>
      <p>
        Hacemos lo posible para que el servicio funcione siempre, pero puede haber interrupciones. Te recomendamos
        exportar un backup de tus datos de vez en cuando desde Ajustes.
      </p>
      <h2>Contacto</h2>
      <p>
        Consultas: <a href={`mailto:${CONTACTO}`}>{CONTACTO}</a>.
      </p>
    </Marco>
  )
}
