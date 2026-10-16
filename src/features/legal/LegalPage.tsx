import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../../components/Layout'

const CONTACTO = 'honorapp.ar@gmail.com'
const ACTUALIZADO = '16 de octubre de 2026'

function Marco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-fondo px-5 py-10 text-ink">
      <article className="mx-auto flex max-w-[45rem] flex-col gap-5 text-[1.0625rem] leading-relaxed [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc">
        <Link to="/" className="no-underline">
          <Logo />
        </Link>
        <h1 className="m-0 font-serif text-[2.75rem] leading-none font-normal">{titulo}</h1>
        <p className="text-sm text-ink2">Última actualización: {ACTUALIZADO}</p>
        {children}
        <p className="mt-6 text-sm text-ink2">
          <Link to="/privacidad">Privacidad</Link> · <Link to="/terminos">Términos y condiciones</Link> ·{' '}
          <Link to="/">Volver a la app</Link>
        </p>
      </article>
    </main>
  )
}

const Mail = () => <a href={`mailto:${CONTACTO}`}>{CONTACTO}</a>

export function PrivacidadPage() {
  return (
    <Marco titulo="Política de privacidad">
      <div className="rounded-[1.125rem] bg-acc-soft px-5 py-4 text-base">
        <strong>En resumen:</strong> guardamos solo lo necesario para llevar tus cobros, no guardamos nada clínico, no
        vendemos ni usamos tus datos para otra cosa, y podés descargarlos o borrar tu cuenta cuando quieras.
      </div>
      <p>
        honorapp es una aplicación web para que profesionales que atienden pacientes (psicología, nutrición,
        kinesiología y otras disciplinas) lleven el control administrativo de sus cobros: pacientes, sesiones, pagos y
        reportes para su contador o contadora. No es un software clínico.
      </p>

      <h2>Qué datos guardamos</h2>
      <ul>
        <li>De tu cuenta: tu mail y tu nombre. Si ingresás con Google, recibimos solo tu nombre, tu mail y tu foto de perfil.</li>
        <li>
          Lo que cargás vos: datos administrativos de tus pacientes (nombre, teléfono, tarifa, días de atención),
          sesiones, pagos, medios de pago y números de factura.
        </li>
        <li>No guardamos historia clínica ni notas de sesión, y te pedimos que no las cargues.</li>
        <li>
          En tu navegador guardamos tu sesión iniciada y tus preferencias (por ejemplo, el modo oscuro). No usamos
          cookies de publicidad ni de seguimiento.
        </li>
      </ul>
      <p>
        Cargar estos datos es optativo, pero sin ellos la aplicación no puede calcular saldos ni armar reportes. Si
        cargás un dato mal, los saldos y reportes van a salir mal: podés corregirlo en cualquier momento.
      </p>

      <h2>Para qué los usamos</h2>
      <p>
        Solo para que la aplicación funcione: mostrarte saldos, reportes y recordatorios, y mandarte los mails de tu
        cuenta (confirmación, recuperar contraseña). No vendemos tus datos, no mostramos publicidad y no los usamos para
        ningún otro fin.
      </p>

      <h2>Datos de tus pacientes</h2>
      <p>
        Cada profesional decide qué datos de sus pacientes carga y es responsable de ellos frente a sus pacientes.
        honorapp solo los guarda y procesa por cuenta de la profesional para prestarle el servicio, con deber de
        confidencialidad, y no los usa para nada propio. Sabemos que la lista de pacientes de una profesional de la
        salud es información delicada: por eso cada cuenta está separada y nadie de honorapp mira esos datos, salvo que
        la profesional lo pida para resolver un problema.
      </p>

      <h2>Dónde se guardan y quién más interviene</h2>
      <p>
        No compartimos tus datos con nadie. Solo los guardan o procesan los proveedores que necesitamos para que la
        aplicación funcione, con obligación de confidencialidad:
      </p>
      <ul>
        <li>Supabase: base de datos y cuentas. Los datos se guardan en servidores de San Pablo, Brasil.</li>
        <li>Vercel: aloja la página web (Estados Unidos).</li>
        <li>Google: solo si elegís ingresar con tu cuenta de Google, y para enviar los mails de la cuenta.</li>
      </ul>
      <p>
        Guardar los datos en Brasil implica una transferencia internacional de datos. Supabase se compromete por
        contrato a protegerlos con cláusulas de protección de datos. Cada cuenta está separada: ninguna profesional
        puede ver los datos de otra. Las conexiones van cifradas.
      </p>

      <h2>Cuánto tiempo los guardamos</h2>
      <p>
        Mientras tengas tu cuenta. Si borrás un paciente, se borra con todo su historial. Si eliminás tu cuenta desde
        Ajustes, se borran en el momento tu cuenta, tus pacientes, sesiones y pagos.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Podés ver, corregir y descargar tus datos desde la aplicación, y eliminar tu cuenta desde Ajustes. Para
        cualquier pedido de acceso, corrección o borrado, escribinos a <Mail />. Respondemos los pedidos de acceso dentro
        de los 10 días corridos y los de corrección o borrado dentro de los 5 días hábiles, como indica la Ley 25.326
        de Protección de Datos Personales.
      </p>
      <p className="rounded-[0.875rem] border border-line bg-surface px-4 py-3 text-base">
        LA AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326, tiene
        la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos
        por incumplimiento de las normas vigentes en materia de protección de datos personales.
      </p>

      <h2>Contacto</h2>
      <p>
        <Mail />
      </p>
    </Marco>
  )
}

export function TerminosPage() {
  return (
    <Marco titulo="Términos y condiciones">
      <p>
        honorapp es una herramienta gratuita para el control administrativo de los cobros de profesionales que atienden
        pacientes. Al crear una cuenta, con tu mail o con Google, aceptás estos términos y la{' '}
        <Link to="/privacidad">política de privacidad</Link>. Para usarla tenés que ser mayor de 18 años.
      </p>

      <h2>Uso</h2>
      <ul>
        <li>Sos responsable de la información que cargás y de mantener segura tu contraseña.</li>
        <li>No cargues historia clínica ni datos clínicos: la aplicación no está pensada para eso.</li>
        <li>
          Si mandás recordatorios por WhatsApp, los mandás vos desde tu teléfono: revisá el mensaje antes de enviarlo.
        </li>
        <li>Los reportes son una ayuda: revisá los números con tu contador o contadora antes de presentarlos.</li>
      </ul>

      <h2>Datos de tus pacientes</h2>
      <p>
        honorapp guarda y procesa los datos de tus pacientes solo para prestarte el servicio y según lo que vos hagas en
        la aplicación, con deber de confidencialidad y medidas de seguridad. No los usa para nada propio ni los cede.
        Cuando eliminás tu cuenta, se borran.
      </p>

      <h2>Precio</h2>
      <p>
        Las funciones que tiene hoy honorapp son gratuitas. Si en el futuro sumamos funciones pagas, van a ser
        opcionales y te vamos a avisar antes.
      </p>

      <h2>Disponibilidad</h2>
      <p>
        honorapp es gratuita y la mejoramos de a poco. Hacemos lo posible para que funcione siempre, pero puede haber
        interrupciones o errores. Te recomendamos descargar tus datos en Excel de vez en cuando desde Ajustes.
      </p>
      <p>
        Si algún día dejamos de ofrecer el servicio, te vamos a avisar por mail con al menos 30 días de anticipación
        para que puedas descargar tus datos.
      </p>

      <h2>Cambios</h2>
      <p>
        Si cambiamos algo importante de estos términos o de la política de privacidad, te vamos a avisar por mail o
        dentro de la aplicación antes de que empiece a regir.
      </p>

      <h2>Ley aplicable</h2>
      <p>Estos términos se rigen por las leyes de la República Argentina.</p>

      <h2>Contacto</h2>
      <p>
        <Mail />
      </p>
    </Marco>
  )
}
