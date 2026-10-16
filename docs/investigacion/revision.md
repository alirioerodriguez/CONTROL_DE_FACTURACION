# honorapp — Revisión de las páginas públicas

Revisé el **16/10/2026** estas páginas de https://control-de-facturacion-eight.vercel.app, en computadora y con ancho de celular (390 px):

| Página | Dirección |
|---|---|
| Inicio de sesión | `/` |
| Registro | `/registro` |
| Política de privacidad | `/privacidad` |
| Condiciones del servicio | `/terminos` |

No entré a la app. En el inicio de sesión y el registro solo toqué "Ingresar" y "Crear cuenta" con los campos vacíos, para ver los mensajes de error.

---

## 0. Resumen: lo más importante, en orden

1. **En el celular no se explica qué es honorapp.** El panel "Tus cobros, en orden" desaparece en pantallas chicas. Quien llega desde un link de WhatsApp ve solo el logo y un formulario de "Ingresá".
2. **La dirección genera desconfianza:** `control-de-facturacion-eight.vercel.app` no dice honorapp, parece de prueba, y habla de "facturación" cuando la app no factura.
3. **El contacto es un Gmail personal y no se sabe quién está detrás.** Para pacientes de una psicóloga, eso pesa mucho. Además, la Ley 25.326 (art. 6) pide identificar al responsable y su domicilio.
4. **"Solo vos ves tus datos"** promete más de lo que la política de privacidad puede sostener.
5. **Faltan cosas obligatorias en la privacidad:** la leyenda de la AAIP, la transferencia a Brasil y cuánto tiempo se guardan los datos.
6. **El registro no avisa** que crear la cuenta implica aceptar las condiciones, aunque las condiciones digan que sí.

---

## 1. Textos que se entienden mal

| Dónde | Texto actual | Problema | Propuesta |
|---|---|---|---|
| Inicio de sesión | Campo Contraseña con `••••••••` de ejemplo | Parece que la contraseña ya está escrita o guardada. Hay gente que va a tocar "Ingresar" así. | Dejarlo vacío o poner *Tu contraseña*. Sumar un ojito para mostrarla u ocultarla. |
| Inicio y registro, panel izquierdo | "Pesos y dólares · Efectivo, transferencia y MercadoPago" | Es una lista sin verbo. Se puede leer como que la app **cobra** por Mercado Pago, y la marca se escribe **Mercado Pago**, separado. | *Anotás cobros en pesos y en dólares, en efectivo, por transferencia o por Mercado Pago.* |
| Inicio y registro | "Sin planillas." | Corto y ambiguo: la app igual exporta Excel. | *Sin planillas a mano.* |
| Registro | "Tu nombre" con ejemplo "Ej. Lic. Ana Martínez" | No se sabe para qué lo pide ni dónde aparece: ¿lo ven los pacientes en el WhatsApp? ¿la contadora en el reporte? | Texto de ayuda debajo: *Así aparece en los recordatorios y en el reporte.* (ajustar a lo que haga la app). |
| Registro | Contraseña: "Mínimo 8 caracteres" como texto de ejemplo | El requisito desaparece apenas empezás a escribir. | Dejarlo como texto fijo debajo del campo. |
| Registro | "Gratis. Solo vos ves tus datos." | Ver la sección 2.4: promete de más. | *Gratis. Tus datos son privados: ninguna otra cuenta puede verlos.* |
| Privacidad | "la base aplica reglas de acceso por usuario" | Jerga técnica. | *Cada cuenta está separada: ninguna profesional puede ver los datos de otra.* |
| Privacidad | "la aplicación se sirve desde Vercel" | "Se sirve" no lo entiende alguien no técnico. | *La página web está alojada en Vercel (Estados Unidos).* |
| Privacidad | "No vendemos ni compartimos datos con terceros" | Sí se comparten con Supabase, Vercel y Google, que guardan o procesan datos. Alguien atento lo va a notar como contradicción. | *No vendemos ni compartimos tus datos. Solo los guardan los proveedores que necesitamos para que la app funcione (Supabase y Vercel), con obligación de confidencialidad.* |
| Condiciones | "se ofrece tal como está" | Es una traducción literal del inglés *as is*. Suena frío y defensivo. | *honorapp es gratuita y la mejoramos de a poco. No garantizamos que funcione sin interrupciones…* (ver sección 3.4). |
| Condiciones | "exportar un backup de tus datos de vez en cuando desde Ajustes" | "Backup" en inglés. Además deja entender que, si algo falla, se pierde todo. | *Además de nuestras copias de seguridad diarias, podés descargar tus datos cuando quieras desde Ajustes.* Usar esta frase solo si hay copias diarias (ver costos.md). |
| Pie de página | "Condiciones" | La página se titula "Condiciones del servicio" y en presentacion.md se habla de "términos". | Usar un solo nombre en todos lados: *Términos y condiciones*. |

---

## 2. Qué le genera desconfianza a alguien nuevo

### 2.1 La dirección web
`control-de-facturacion-eight.vercel.app` tiene tres problemas:
- no dice "honorapp",
- el "eight" parece una dirección generada de prueba,
- "facturación" promete algo que la app no hace.

Antes de pasarle el link a colegas, conviene usar **honorapp.com.ar** (ver dominios.md). Sale $8.500 por año y se conecta a Vercel en minutos.

### 2.2 No se sabe quién está detrás
- El único contacto es **alirioerodriguez@gmail.com**: un Gmail personal que no tiene el nombre de la app.
- No hay un nombre de responsable, ni una ciudad, ni un "quiénes somos".
- Para una psicóloga que va a cargar a sus pacientes, "¿quién puede ver esto?" es la primera pregunta. Sin una persona identificable, la respuesta es "no sé".
- **Es también un requisito legal:** el art. 6 de la Ley 25.326 pide informar **quién es el responsable y su domicilio** (ver legal.md, sección 4.1).

**Propuesta:** un mail del dominio (por ejemplo *hola@honorapp.com.ar*) y una línea en la privacidad: *El responsable de honorapp es [nombre y apellido o razón social], CUIT [número], con domicilio en [ciudad y dirección].*

### 2.3 En el celular no aparece qué es la app
En pantallas chicas se ve **solo** esto: logo, "Ingresá", "Con Google o con tu mail." y el formulario. El título, la descripción y la línea de pesos y dólares **no se muestran**. La mayoría va a llegar desde el celular, por un link de WhatsApp. Ver la sección 4.1.

### 2.4 "Solo vos ves tus datos"
Es literalmente falso: quien administra honorapp puede acceder a la base, y Supabase la aloja. Si una usuaria lo descubre (o lo lee en la privacidad, donde dice otra cosa: "cada cuenta ve únicamente sus propios datos"), la promesa se vuelve en contra. Mejor una frase **cierta** y tranquilizadora, como la propuesta en la tabla de la sección 1.

### 2.5 La política de privacidad está incompleta
Comparado con lo que pide la ley (legal.md, sección 4):

| Falta | Por qué importa |
|---|---|
| **Leyenda de la AAIP** (Res. 14/2018), con el texto oficial | Es obligatoria. Hoy solo se menciona a la AAIP como órgano de control. |
| **Responsable y domicilio** | Art. 6. Ver 2.2. |
| **Transferencia internacional a Brasil** y su base legal | Brasil no está en la lista de países adecuados. Hay que decir cómo se cubre: contrato con cláusulas modelo o consentimiento (legal.md, sección 3). |
| **Cuánto tiempo se guardan los datos** y qué pasa al borrar la cuenta | Art. 4: destruirlos cuando ya no sirven. Además, es una pregunta típica de quien desconfía. |
| **Rol de honorapp con los datos de pacientes** (presta el servicio, no los usa para nada propio) | Art. 25. Tranquiliza a la profesional y la ordena legalmente. |
| **Que los datos de pacientes pueden ser sensibles** y qué medidas se toman | Art. 2 y art. 9 (ver legal.md, sección 5). |
| **Copias de seguridad** | Responde la duda "¿y si se rompe?". |
| **Cookies o almacenamiento en el navegador** | Si la app guarda la sesión en el navegador, conviene decirlo en una línea. |
| **Cómo pedir acceso, corrección o borrado** y en qué plazo | Hoy dice "escribinos", sin plazo. La ley da 10 días para acceso y 5 hábiles para corrección o supresión (arts. 14 y 16). |

### 2.6 Borrar la cuenta no se puede hacer desde la app
Hay que escribir a un Gmail. A alguien nuevo le da la sensación de que "entrar es fácil, salir no". Si es posible, sumar **"Eliminar mi cuenta"** en Ajustes. Mientras tanto, decir en la privacidad en cuántos días se borra.

### 2.7 Las condiciones son muy cortas para lo que está en juego
Faltan:
- Si **va a seguir siendo gratis**, o qué pasa si en el futuro hay un plan pago.
- Qué pasa **si el servicio cierra**: aviso previo y plazo para descargar los datos.
- Cómo se avisan los **cambios** de las condiciones.
- **Ley aplicable** (Argentina) y edad mínima.
- La cláusula de **prestación de servicios** del art. 25 (legal.md, pendientes).

### 2.8 El registro no pide aceptar nada
Las condiciones dicen "Al crear una cuenta aceptás estas condiciones y la política de privacidad", pero en `/registro` no aparece ese aviso. Hay que sumar, encima del botón "Crear cuenta" y del de Google:

> Al crear tu cuenta aceptás los [Términos y condiciones](/terminos) y la [Política de privacidad](/privacidad).

### 2.9 Fecha de actualización
"Última actualización: 16 de octubre de 2026" está bien. Cuando cambies algo importante, cambiala y avisá por mail.

---

## 3. Lo que funciona bien (no tocar)

- **El diseño:** sobrio, colores tranquilos, buena tipografía. Transmite "profesional" y no "app de juguete".
- **"Tus cobros, en orden."** Es claro y en dos segundos dice para qué sirve.
- **El voseo y el tono** son coherentes en todas las páginas.
- **El ingreso con Google** está bien ubicado arriba, y en la privacidad aclara que solo recibe nombre y mail.
- **"No es un software clínico"** y **"No guardamos historia clínica"** están dichos de forma directa. Es lo que más tranquiliza a una psicóloga: hay que llevarlo también a la pantalla de registro (ver 4.2).
- **Los errores** se muestran en castellano y son claros ("Ingresá un mail válido.").
- La privacidad **es corta y se lee**. Hay que completarla sin convertirla en un texto legal ilegible: se puede sumar un resumen arriba y el detalle abajo.

---

## 4. Qué agregaría para que alguien se anime a crear la cuenta

### 4.1 Una mini presentación arriba del formulario en el celular
Arriba de "Creá tu cuenta" (o abajo, con un botón "¿Qué es honorapp?"):

> **Tus cobros, en orden.**
> - Anotás sesiones y pagos, en pesos y en dólares.
> - Ves de un vistazo quién te debe.
> - Mandás el recordatorio por WhatsApp.
> - Descargás el reporte del mes para tu contadora.

### 4.2 Tres frases de confianza junto al botón de registro
> ✓ Gratis, sin tarjeta.
> ✓ No es historia clínica: solo datos de cobro.
> ✓ Descargás o borrás tus datos cuando quieras.

### 4.3 Ver la app antes de registrarse
- Dos o tres **capturas** de la app (con datos inventados), o el **video de 2 minutos** de guion-video.md.
- Con eso, quien duda ve qué va a encontrar antes de dejar su mail.

### 4.4 Quién la hace
Una línea con tu nombre y por qué la hiciste, por ejemplo: *La hice para que [una psicóloga conocida / colegas] dejaran de llevar los cobros en un cuaderno.* Una cara y un nombre generan más confianza que cualquier sello.

### 4.5 Preguntas frecuentes
Un link a las preguntas frecuentes que ya están escritas en presentacion.md: ¿tiene costo?, ¿es historia clínica?, ¿puedo traer mi Excel?, ¿cómo le paso todo a la contadora?

### 4.6 Testimonios, cuando los tengas
Cuando la encuesta (encuesta.md) te dé respuestas, pedí permiso para publicar dos o tres frases cortas, con nombre y profesión, o solo profesión y ciudad. Que sean reales: no inventes testimonios.

### 4.7 Detalles del formulario
- Mostrar u ocultar la contraseña.
- Debajo del botón de Google: *Solo usamos tu nombre y tu mail.*
- Después de "Crear cuenta", si llega un mail de confirmación, un mensaje claro: *Te mandamos un mail a vos@mail.com. Abrilo para activar la cuenta (si no lo ves, fijate en Spam).* Recordá que el mail que trae Supabase no sirve para producción (costos.md, sección 5).

---

## 5. Pendientes

**Antes de pasar el link a colegas**
- [ ] Conectar **honorapp.com.ar** y dejar de usar la dirección de vercel.app.
- [ ] Mostrar la presentación (título, bullets) también en el **celular**.
- [ ] Cambiar "Solo vos ves tus datos" por una frase cierta.
- [ ] Sumar el aviso **"Al crear tu cuenta aceptás…"** en el registro.
- [ ] Sacar los puntitos `••••••••` del campo de contraseña en el inicio de sesión.
- [ ] Crear un **mail del dominio** y reemplazar el Gmail personal.

**Privacidad y condiciones (con el abogado; ver legal.md)**
- [ ] Sumar responsable, CUIT y domicilio.
- [ ] Sumar la **leyenda de la AAIP** de la Res. 14/2018, textual.
- [ ] Explicar la transferencia a Brasil y su base legal.
- [ ] Sumar plazos de conservación, borrado y respuesta a pedidos.
- [ ] Aclarar el rol de honorapp con los datos de pacientes (art. 25).
- [ ] Completar las condiciones: gratuidad, cierre del servicio, cambios, ley aplicable.

**Para convertir más**
- [ ] Tres frases de confianza junto al botón.
- [ ] Capturas o el video tutorial.
- [ ] "Quién la hace" y preguntas frecuentes.
- [ ] "Eliminar mi cuenta" en Ajustes.

---

## Fuentes
- Páginas revisadas: [inicio de sesión](https://control-de-facturacion-eight.vercel.app/), [registro](https://control-de-facturacion-eight.vercel.app/registro), [privacidad](https://control-de-facturacion-eight.vercel.app/privacidad) y [condiciones](https://control-de-facturacion-eight.vercel.app/terminos), 16/10/2026.
- [Ley 25.326 de Protección de Datos Personales](https://servicios.infoleg.gob.ar/infolegInternet/anexos/60000-64999/64790/texact.htm)
- [Res. AAIP 14/2018 (información y leyenda)](https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-14-2018-307621/texto)
- legal.md, costos.md, dominios.md, presentacion.md, guion-video.md y encuesta.md (archivos anteriores de este proyecto).
