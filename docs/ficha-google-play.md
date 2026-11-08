# Ficha de Google Play — honorapp

Borrador para la ficha de la app de Android (TWA). Palabras clave pensadas para cómo busca una profesional de más de 50 años: «cobros pacientes», «honorarios psicólogos», «control de sesiones», «monotributo».

## Título (máximo 30 caracteres)
honorapp: Cobros y Pacientes

## Descripción breve (máximo 80 caracteres)
Quién te debe en 2 toques, sin historia clínica y listo para tu contadora.

## Descripción completa

¿Atiendes pacientes por sesión o das clases particulares y a fin de mes pierdes horas pasando pagos a una planilla?

**honorapp** es el control de cobros y honorarios para psicólogas, nutricionistas, fonoaudiólogas, psicopedagogas, kinesiólogas, terapistas ocupacionales y docentes particulares en Argentina.

**Por qué honorapp y no una agenda clínica o una planilla:**
• **Cero datos clínicos:** nunca guarda historias clínicas, evoluciones ni motivos de consulta. Solo sesiones, pagos y saldos.
• **Pagos parciales sin cuentas a mano:** si un paciente paga una parte o de más, honorapp cancela primero el mes más viejo y te muestra qué mes cubrió y cuánto falta.
• **Pesos y dólares siempre separados:** ideal si atiendes pacientes en Argentina y en el exterior.
• **Comprobantes de transferencia:** pegas el texto del comprobante y la app sugiere el paciente, aunque haya pagado un familiar con otro apellido.
• **Modo Estudio Contable gratis:** tu contadora entra con acceso de solo lectura y descarga el cierre del mes en Excel o PDF, con el aviso del tope del Monotributo.
• **Se lee bien en cualquier celular:** puedes ocultar los montos frente al paciente, usar letra grande y modo oscuro.

honorapp es una herramienta de registro: no cobra, no presta ni mueve dinero.

## Categoría y datos de contacto
- **Categoría:** Productividad (alternativa: Empresa).
- **Correo de contacto:** honorapp.ar@gmail.com
- **Sitio web:** https://control-de-facturacion-eight.vercel.app
- **Política de privacidad:** https://control-de-facturacion-eight.vercel.app/privacidad

## Contenido de la app (Play Console)
- **Eliminación de cuenta:** en la app (Ajustes → «Eliminar mi cuenta») y por mail. Dirección para el formulario: https://control-de-facturacion-eight.vercel.app/privacidad (tiene la sección de borrado y el mail).
- **Seguridad de los datos:**
  - **Información personal:** nombre y correo de la profesional, para la cuenta.
  - **Información financiera:** sesiones, pagos y saldos que carga la profesional, para que la app funcione.
  - **Otros:** datos de contacto y de facturación de los pacientes (nombre, teléfono, DNI o CUIT, obra social) que carga la profesional.
  - Nada se comparte con terceros, todo viaja cifrado y se puede borrar.
- **Funciones financieras:** «Ninguna de las anteriores». Es un registro de cobros: no presta, no procesa pagos ni ofrece servicios bancarios.
- **Público objetivo:** mayores de 18. Sin anuncios.

## Antes de pegar
- **No poner «Gratis hasta 8 pacientes»** mientras el límite no esté activo (`cobroActivo` en `src/lib/planFreemium.ts` sigue en falso). Hoy la app es gratis entera.
- **Cobrar el Pro dentro de la app de Play:** Google exige su propio sistema de facturación para vender funciones digitales en apps de la tienda. Cobrarlo con Mercado Pago dentro de la app podría chocar con esa regla (sin verificar, revisar la política de pagos de Google Play antes de activar el cobro).
- Capturas con letra grande (5 a 8), en un celular real.
- Revisar que cada punto de la descripción esté en la versión publicada: la cola sin señal y el modo pasillo todavía no lo están, por eso no figuran.
