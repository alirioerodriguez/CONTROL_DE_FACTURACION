# honorapp y la Ley 25.326 de Protección de Datos Personales

Investigación hecha el 16/10/2026. **No soy abogado y esto no es asesoramiento legal.** Sirve para entender el tema y llegar preparada a la consulta con un abogado de protección de datos, que es el primer pendiente de la lista final.

Etiquetas que uso:
- **[OFICIAL]**: lo leí en una norma o en una página del Estado (argentina.gob.ar, AAIP).
- **[TERCERO]**: viene de un estudio jurídico, un medio o un proveedor.
- **[INFERENCIA]**: es mi interpretación. No está escrita así en ninguna fuente y es justo lo que hay que confirmar con el abogado.

---

## 0. Resumen en 8 líneas

1. La ley que rige es la **Ley 25.326** (año 2000), con su **Decreto reglamentario 1558/2001**. Hay proyectos para reemplazarla, pero al 16/10/2026 ninguno fue aprobado.
2. honorapp maneja dos tipos de datos: los de **sus usuarias** (las profesionales) y los de **los pacientes** que cada profesional carga. Para los primeros, honorapp es la **responsable**. Para los segundos, lo más probable es que la responsable sea cada profesional y honorapp sea **prestadora de servicios** (art. 25). [INFERENCIA]
3. Hay que **inscribir la base en el Registro Nacional de Bases de Datos** de la AAIP. Es gratis y se hace online por TAD.
4. **Guardar los datos en Brasil es una transferencia internacional.** Brasil **no** está en la lista de países con protección adecuada, así que hace falta una base legal: un contrato con las cláusulas modelo, el consentimiento expreso de los titulares, o mover los datos a una región adecuada (por ejemplo, la Unión Europea).
5. La política de privacidad tiene que incluir sí o sí lo del **art. 6** y la **leyenda de la AAIP** (Res. 14/2018).
6. Aunque no guarde historia clínica, una lista de pacientes de una psicóloga **puede revelar un dato de salud**, que es un **dato sensible**. Eso exige más cuidado.
7. Las medidas de seguridad de la AAIP (Res. 47/2018) son recomendaciones, pero la obligación de dar seguridad (art. 9) es obligatoria.
8. Las multas y la clasificación de infracciones están en la Res. AAIP 126/2024.

---

## 1. Qué te exige la Ley 25.326

### 1.1 Quién es quién en honorapp

| Datos | Quién decide para qué se usan | Rol de honorapp |
|---|---|---|
| Cuenta de la profesional (mail, nombre, datos de login) | honorapp | **Responsable** (art. 2) |
| Pacientes (nombre, teléfono, sesiones, montos) | Cada profesional | **Prestadora de servicios informatizados** (art. 25) [INFERENCIA] |
| Infraestructura (Supabase) | Contrata honorapp | Supabase es **subprestador** de honorapp [INFERENCIA] |

Por qué importa: el **art. 25** dice que quien presta servicios de tratamiento de datos para otro solo puede usarlos para lo contratado y tiene que destruirlos al terminar el contrato, salvo autorización. [OFICIAL] El **Decreto 1558/2001 (art. 25)** agrega que esos contratos deben incluir los niveles de seguridad exigidos, el deber de confidencialidad y que el prestador actúa **solo según las instrucciones del responsable**. [OFICIAL] En la práctica, eso va en los **Términos y Condiciones** que acepta cada profesional.

Fuentes: [Ley 25.326](https://www.argentina.gob.ar/normativa/nacional/64790/texto) · [Decreto 1558/2001](https://www.argentina.gob.ar/normativa/nacional/70368/texto)

### 1.2 Las obligaciones, en castellano simple

| Artículo | Qué pide | Qué significa para honorapp |
|---|---|---|
| **Art. 4: calidad** | Datos ciertos, adecuados, pertinentes y **no excesivos**. Destruirlos cuando ya no sirven. [OFICIAL] | No pedir DNI, domicilio ni nada que no haga falta para cobrar. Definir cuánto tiempo se guardan los datos de una cuenta borrada. |
| **Art. 5: consentimiento** | Consentimiento libre, expreso e informado. Hay excepciones; una es cuando los datos surgen de una relación **contractual o profesional** y son necesarios para ella. [OFICIAL] | La profesional probablemente no necesita el consentimiento del paciente para anotar sus cobros. Pero ver la sección 5 sobre datos sensibles. [INFERENCIA] |
| **Art. 6: información** | Al juntar datos, informar de forma expresa y clara la finalidad, los destinatarios, quién es el responsable y los derechos. [OFICIAL] | Es el contenido mínimo de la política de privacidad (sección 4). |
| **Art. 9: seguridad** | Medidas técnicas y organizativas para la seguridad y confidencialidad. Prohíbe guardar datos en sistemas sin condiciones de seguridad. [OFICIAL] | Es obligatorio. La Res. 47/2018 dice cómo hacerlo (sección 1.3). |
| **Art. 10: confidencialidad** | Todos los que tratan datos tienen deber de secreto, incluso después de terminada la relación. [OFICIAL] | Aplica a vos y a cualquiera que acceda a la base. |
| **Art. 11: cesión** | Ceder datos a otro requiere consentimiento previo del titular, salvo excepciones. [OFICIAL] | No compartir datos de pacientes con nadie (ni para analítica, ni para marketing). |
| **Art. 12: transferencia internacional** | Prohíbe transferir a países sin protección adecuada, salvo excepciones. [OFICIAL] | Afecta el uso de Supabase en Brasil (sección 3). |
| **Art. 14: acceso** | El titular puede pedir sus datos. Hay que responder dentro de los **10 días corridos** desde que lo intima. [OFICIAL] | Tener un mail de contacto y una forma de exportar los datos. |
| **Art. 16: rectificación y supresión** | Corregir, actualizar o borrar dentro de los **5 días hábiles** del reclamo. [OFICIAL] | Que la profesional pueda editar y borrar pacientes, y que borrar sea real (también en los backups, en un plazo razonable). |
| **Art. 21: registro** | Las bases públicas y las privadas "destinadas a dar informes" se inscriben en el registro. [OFICIAL] | Sección 2. |
| **Art. 31: sanciones** | Apercibimiento, suspensión, multa o clausura. [OFICIAL] | La Res. AAIP 126/2024 clasifica las infracciones y gradúa las multas. [TERCERO] [Marval](https://www.marval.com/Publicacion/novedades-en-la-clasificacion-de-infracciones-y-en-el-regimen-de-graduacion-de-sanciones-16832) |

### 1.3 Seguridad: qué recomienda la AAIP
La **Res. AAIP 47/2018** aprueba medidas de seguridad **recomendadas**, de referencia, para cumplir el art. 9. [OFICIAL] Para sistemas informáticos las agrupa así:

- Recolección de datos.
- Control de acceso (autenticación, separación de roles).
- Control de cambios.
- Respaldo y recuperación.
- Gestión de vulnerabilidades.
- Destrucción de datos.
- Incidentes de seguridad (detectar, evaluar, contener y responder).
- Entornos de desarrollo.

Fuente: [Res. AAIP 47/2018](https://www.argentina.gob.ar/normativa/nacional/resolución-47-2018-312662/texto)

Aplicado a Supabase, eso es, como mínimo: **Row Level Security** activado en todas las tablas para que cada profesional vea solo sus pacientes, la clave `service_role` fuera del frontend, backups activos, logs de acceso, y no usar datos reales en desarrollo. [INFERENCIA]

> **Sobre filtraciones:** la Ley 25.326 no tiene un deber general de avisar a la AAIP o a los titulares si hay una filtración. La Res. 47/2018 sí recomienda tener un proceso de gestión de incidentes. [INFERENCIA a partir de los textos leídos; confirmalo con el abogado] Los proyectos de reforma sí lo incluyen.

### 1.4 ¿Va a cambiar la ley?
Hay varios proyectos para reemplazar la Ley 25.326 por una más parecida al reglamento europeo. Por ejemplo, el **1948-D-2025** incluye avisar a la autoridad dentro de las 72 horas de una filtración [OFICIAL], y el **1751-D-2026** (dip. Martín Yeza) dice expresamente que sustituye a la 25.326 [TERCERO, sitio del propio autor]. No encontré que ninguno haya sido aprobado, y en abril de 2026 la 25.326 seguía vigente. [TERCERO] [Diario Judicial, abril 2026](https://www.diariojudicial.com/news-103126-proteccion-de-datos-personales-sigue-siendo-suficiente-la-ley-25326-en-2026) · [Proyecto 1948-D-2025](https://www4.hcdn.gob.ar/dependencias/dsecretaria/Periodo2025/PDF2025/TP2025/1948-D-2025.pdf)

Argentina también aprobó el **Convenio 108+** del Consejo de Europa (Ley 27.699, 2022) y lo ratificó en 2023, pero el protocolo todavía no entró en vigor porque faltan ratificaciones de otros países. [TERCERO] [Palabras del Derecho](https://www.palabrasdelderecho.com.ar/articulo/4228/Argentina-ratifico-el-Convenio-108-sobre-proteccion-de-datos)

Conviene diseñar ya con criterios de la reforma (avisar filtraciones, registro de tratamientos, privacidad por diseño), porque cuesta poco hacerlo desde el principio. [INFERENCIA]

---

## 2. Inscribir la base ante la AAIP

### 2.1 ¿Tenés que inscribirla?
El **art. 21** obliga a inscribir las bases públicas y las privadas "destinadas a dar informes". [OFICIAL] La reglamentación del **Decreto 1558/2001** aclara que entran las bases que **exceden el uso exclusivamente personal** o que tienen como fin la cesión o transferencia de datos. [OFICIAL] La página de la AAIP dice que el registro es obligatorio para estas bases y que no hacerlo puede llevar a sanciones. [OFICIAL]

Una plataforma online con datos de muchas personas **excede el uso personal**, así que lo razonable es inscribirla. [INFERENCIA]

**Lo que no está claro y hay que preguntarle al abogado:** si honorapp inscribe una sola base (sus usuarias), o también la de pacientes declarándose prestadora, o si cada profesional tiene que inscribir su propia base de pacientes. La AAIP no lo resuelve en las páginas que leí. [INFERENCIA]

### 2.2 Cómo se hace
Es **gratis**, **online** y **no vence**. Si cambia lo declarado, hay que actualizarlo con el trámite de modificación. [OFICIAL] [Registrar bases de datos personales privadas](https://www.argentina.gob.ar/registrar-bases-de-datos-personales-privadas)

1. **Tener clave fiscal nivel 2 o más** (o un apoderamiento en TAD). [OFICIAL]
2. **Inscribir al responsable primero.** Es requisito previo para registrar cualquier base. [OFICIAL] Trámite: [Inscribir un responsable de bases de datos personales privadas](https://www.argentina.gob.ar/servicio/inscribir-un-responsable-de-bases-de-datos-personales-privadas) · [Instructivo PDF](https://www.argentina.gob.ar/sites/default/files/instructivo_tad_inscripcionymodificacionresponsable_basesprivadas_2.pdf)
3. **Entrar a TAD** (tramitesadistancia.gob.ar) y buscar **"Inscripción de bases de datos privadas"**. Completar el formulario y confirmar. [OFICIAL]
4. Revisar que el **mail** en "datos del solicitante" sea correcto: es el canal oficial de comunicación. [OFICIAL]
5. Cuando lo aprueban, llega por mail el **certificado con el número de inscripción**. Se puede descargar con código QR. [OFICIAL] [Trámites del Registro](https://www.argentina.gob.ar/aaip/datospersonales/tramites)

Consultas: **registrobasesdedatos@aaip.gob.ar**. [OFICIAL]

No pude abrir el instructivo del formulario de la base, así que no sé exactamente qué campos pide. Es esperable que pregunte por la finalidad, los tipos de datos, si hay datos sensibles, cesiones, transferencias internacionales y medidas de seguridad, porque eso es lo que regula la ley. [INFERENCIA] **Lo que declares tiene que coincidir con la política de privacidad**: el art. 21 prohíbe tener datos de un tipo distinto al declarado. [OFICIAL]

---

## 3. Guardar los datos fuera del país (Supabase en San Pablo)

### 3.1 Es una transferencia internacional
La propia AAIP pone como ejemplo de transferencia internacional a una empresa argentina que contrata almacenamiento en la nube en otro país. [OFICIAL] [Transferencias internacionales (AAIP)](https://www.argentina.gob.ar/transferencias-internacionales) Supabase con región **São Paulo (`sa-east-1`)** es exactamente eso. [TERCERO] [Regiones de Supabase](https://supabase.com/docs/guides/platform/regions)

### 3.2 Brasil no figura como país "adecuado"
El **art. 12** prohíbe transferir datos a países sin protección adecuada, salvo excepciones. [OFICIAL] La lista de la AAIP (Disposición 60-E/2016, actualizada por la Res. 34/2019) incluye: Unión Europea y Espacio Económico Europeo, Reino Unido, Suiza, Guernsey, Jersey, Isla de Man, Islas Feroe, Canadá (solo sector privado), Andorra, Nueva Zelanda, Uruguay e Israel (solo datos automatizados). **Brasil no está**, aunque tenga su propia ley (LGPD). [OFICIAL] [Disposición 60-E/2016](https://www.argentina.gob.ar/normativa/nacional/267922/texto) · [Transferencias internacionales](https://www.argentina.gob.ar/transferencias-internacionales)

La misma disposición aclara que no estar en la lista no significa que el país no sea adecuado. Pero sin declaración de la AAIP, no podés apoyarte en eso. [OFICIAL + INFERENCIA]

### 3.3 Qué opciones tenés

| Opción | Cómo funciona | Pros | Contras |
|---|---|---|---|
| **A. Contrato con cláusulas modelo** | Firmar con el importador el **contrato modelo de "prestación de servicios"** (Anexo II de la Disp. 60/2016) o las cláusulas de la Red Iberoamericana (Res. AAIP 198/2023). Si el contrato **se aparta** de los modelos, hay que presentarlo a la AAIP **dentro de los 30 días corridos** de firmado. [OFICIAL] | Mantenés Supabase en San Pablo. | Supabase usa su propio contrato (DPA), basado en las cláusulas **europeas**, no en las argentinas. [TERCERO] Probablemente haya que presentarlo a la AAIP como contrato que difiere de los modelos. [INFERENCIA] |
| **B. Consentimiento expreso** | El decreto dice que la prohibición no aplica si el titular **consintió expresamente** la transferencia. [OFICIAL] | Simple en papel. | Los titulares son los **pacientes**, que nunca usan honorapp. Conseguir su consentimiento depende de cada profesional. Es frágil. [INFERENCIA] |
| **C. Mover la base a un país adecuado** | Supabase permite elegir región; la **Unión Europea** está en la lista de adecuados. [OFICIAL + TERCERO] | Resuelve el problema del destino sin trámites ante la AAIP. [INFERENCIA] | Más latencia desde Argentina. Igual hace falta el contrato con Supabase (art. 25) y revisar a sus subprocesadores. |

Fuentes: [Res. AAIP 198/2023 (cláusulas RIPD)](https://www.argentina.gob.ar/noticias/la-aaip-aprobo-clausulas-contractuales-modelo-de-la-ripd-para-transferencias) · [Obligaciones de los responsables (AAIP)](https://www.argentina.gob.ar/aaip/datospersonales/responsables/obligaciones) · [DPA de Supabase](https://supabase.com/legal/dpa)

### 3.4 Qué dice el contrato de Supabase
- Su DPA incorpora las cláusulas contractuales tipo de la **Unión Europea** (más anexos para Reino Unido y Suiza). Aceptarlo equivale a firmar esas cláusulas. [TERCERO] [DPA de Supabase](https://supabase.com/legal/dpa)
- Si elegís una región, Supabase se compromete a **guardar y procesar principalmente** los datos ahí. "Principalmente" deja margen para que algo se procese en otro lado (soporte, logs, subprocesadores). [TERCERO]
- Publica una **lista de subprocesadores** y avisa los cambios con 30 días de anticipación. [TERCERO] [Subprocesadores](https://supabase.com/legal/customer-resources/subprocessor-list)
- La entidad que firma es **Supabase Pte. Ltd.** (Singapur). [TERCERO]

**Conclusión:** la opción más limpia probablemente sea **C (región en la UE) + DPA de Supabase aceptado y archivado**. Si preferís quedarte en San Pablo, la opción A con asesoramiento del abogado. **Decidilo con el abogado.** [INFERENCIA]

---

## 4. Qué tiene que decir sí o sí la política de privacidad

### 4.1 Lo obligatorio por el art. 6 de la Ley 25.326 [OFICIAL]
1. **Para qué** se usan los datos y **quiénes** pueden recibirlos.
2. **Que existe** la base, **quién es el responsable** y su **domicilio**.
3. Si responder las preguntas es **obligatorio u optativo**.
4. Qué pasa si das los datos, si te negás o si son inexactos.
5. Cómo ejercer los derechos de **acceso, rectificación y supresión**.

### 4.2 La leyenda de la AAIP [OFICIAL]
La **Res. AAIP 14/2018** obliga a mostrar esa información **en un lugar visible**, antes de recolectar los datos, y con mención especial de cómo ejercer los derechos. Además exige esta leyenda (texto oficial):

> "LA AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales."

Fuente: [Res. AAIP 14/2018](https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-14-2018-307621/texto)

### 4.3 Lo que conviene agregar para honorapp [INFERENCIA, a partir de los arts. 4, 9, 11, 12, 14, 16 y 25]
- **Los dos roles:** para los datos de las profesionales, honorapp es responsable; para los de pacientes, presta el servicio por cuenta de cada profesional.
- **Qué datos se guardan exactamente:** nombre y teléfono del paciente, sesiones, montos, pagos. **Y qué no se guarda:** ninguna nota clínica.
- **Dónde están los datos:** Supabase, región elegida, país, y la base legal de esa transferencia (sección 3).
- **Proveedores que acceden:** Supabase y, si los usás, el servicio de mails, Google (login), analítica, etc.
- **Que no se ceden ni venden** datos a terceros (art. 11).
- **Plazos:** cuánto se guardan los datos y qué pasa al borrar la cuenta (art. 4 y art. 25).
- **Seguridad:** resumen de las medidas (art. 9).
- **Plazos de respuesta:** 10 días corridos para acceso y 5 días hábiles para rectificar o borrar (arts. 14 y 16).
- **Mail de contacto** para ejercer derechos.
- **Número de inscripción** en el Registro Nacional de Bases de Datos, cuando lo tengas.

### 4.4 Además: términos para las profesionales
Como prestadora (art. 25 y Decreto art. 25), los **Términos y Condiciones** deberían decir que honorapp trata los datos de pacientes **solo según las instrucciones** de la profesional, con deber de **confidencialidad** y medidas de **seguridad**, y que al terminar se **devuelven o destruyen**. [OFICIAL para el contenido exigido; INFERENCIA para que vaya en los Términos]

También conviene un texto modelo para que cada profesional **le informe a sus pacientes** que usa honorapp para llevar los cobros, ya que ella es la responsable frente a ellos. [INFERENCIA]

---

## 5. ¿Cambia algo porque son datos de pacientes?

### 5.1 ¿Son datos sensibles?
- El **art. 2** define como dato sensible la información referente a la **salud**. [OFICIAL]
- honorapp no guarda diagnósticos. Pero saber que una persona es **paciente de una psicóloga** ya dice algo sobre su salud mental. Es razonable tratar esa lista como **dato sensible**. [INFERENCIA, es el punto central a confirmar con el abogado]

### 5.2 Qué cambia si lo son
- **Art. 7:** nadie puede ser obligado a dar datos sensibles, y la ley **prohíbe formar archivos que revelen datos sensibles de forma directa o indirecta**, salvo excepciones. [OFICIAL]
- **Art. 8:** los profesionales y establecimientos de salud **pueden** tratar datos de salud de sus pacientes, respetando el **secreto profesional**. [OFICIAL]
- **Art. 10:** el deber de secreto alcanza a todos los que intervienen en el tratamiento, también a honorapp. [OFICIAL]

La lectura que tiene sentido es: la profesional trata esos datos amparada en el art. 8, y honorapp lo hace **por cuenta de ella** como prestadora (art. 25), con deber de secreto (art. 10). Para que eso se sostenga, honorapp no tiene que usar esos datos para nada propio. [INFERENCIA]

### 5.3 Cuidados extra que recomiendo [INFERENCIA]
- **Minimizar:** solo nombre, teléfono y montos. Sin DNI salvo que haga falta para facturar. Sin campo libre de "notas" que invite a escribir cosas clínicas.
- **Recordatorios neutros:** el mensaje de WhatsApp no tiene que mencionar la especialidad ni el tipo de sesión (ya está en la lista de pruebas, 5.3).
- **Nada de analítica ni publicidad** con datos de pacientes, ni herramientas de terceros que los lean (por ejemplo, grabación de sesiones de usuario en las pantallas de pacientes).
- **Acceso restringido:** Row Level Security, y que nadie de honorapp mire datos de pacientes salvo para soporte pedido por la profesional, y dejando registro.
- **Cifrado** en tránsito y en reposo (Supabase lo da por defecto en su infraestructura; confirmalo en su documentación de seguridad).
- **Borrado real** al eliminar una cuenta, con un plazo definido para los backups.

---

## 6. Pendientes concretos

**Legales (con abogado)**
- [ ] **Consultar a un abogado de protección de datos** con este documento. Preguntas clave:
  - [ ] ¿La lista de pacientes de una profesional de la salud es dato sensible aunque no haya información clínica?
  - [ ] ¿honorapp es responsable o prestadora (art. 25) para los datos de pacientes?
  - [ ] ¿Qué bases tiene que inscribir honorapp? ¿Las profesionales tienen que inscribir algo?
  - [ ] ¿Qué base legal usar para la transferencia a Brasil, o conviene mover la base a la UE?
  - [ ] ¿Hace falta presentar el DPA de Supabase ante la AAIP dentro de los 30 días por apartarse de los modelos?
- [ ] Decidir **quién es el titular legal** de honorapp (persona física o sociedad), porque es quien se inscribe como responsable y quien firma con Supabase.

**Registro AAIP**
- [ ] Sacar o confirmar **clave fiscal nivel 2 o más** del titular.
- [ ] Hacer en TAD el trámite **"Inscripción de responsable de bases de datos privadas"**.
- [ ] Hacer en TAD el trámite **"Inscripción de bases de datos privadas"** (lo que el abogado indique).
- [ ] Guardar el **certificado** y poner el **número de inscripción** en la política de privacidad.
- [ ] Anotar que, si cambia algo declarado (región, proveedores, tipos de datos), hay que hacer el trámite de **modificación**.

**Supabase y transferencia**
- [ ] Decidir la **región** (seguir en San Pablo o migrar a la UE) según lo que diga el abogado.
- [ ] **Aceptar y archivar el DPA** de Supabase (con fecha y versión).
- [ ] Bajar y revisar la **lista de subprocesadores** de Supabase y suscribirse a los avisos de cambios.
- [ ] Si se queda en Brasil: preparar el contrato con las **cláusulas modelo** o presentar el contrato a la AAIP **dentro de los 30 días corridos** de firmado.

**Documentos públicos**
- [ ] Redactar la **política de privacidad** con todo lo de la sección 4 y la **leyenda de la Res. 14/2018**.
- [ ] Mostrarla **antes del registro** de la profesional y en el **pie de cada página**.
- [ ] Redactar los **Términos y Condiciones** con la cláusula de prestación de servicios (art. 25).
- [ ] Armar un **texto modelo** para que cada profesional informe a sus pacientes.
- [ ] Revisar que **presentacion.md** no prometa nada distinto de lo que dicen estos documentos.

**Técnicos**
- [ ] Verificar que **Row Level Security** esté activo en todas las tablas y probarlo con dos cuentas.
- [ ] Confirmar que la clave **`service_role`** no esté en el frontend ni en el repositorio.
- [ ] Confirmar **backups** y documentar cuánto tiempo se guardan.
- [ ] Implementar **exportar** los datos de una profesional y **borrar** su cuenta de verdad.
- [ ] Definir el **plazo de conservación** de datos de cuentas borradas.
- [ ] Revisar que **analítica, logs y herramientas de errores** no capturen nombres ni teléfonos de pacientes.
- [ ] Escribir un **procedimiento de incidentes** (qué hacer si hay una filtración), siguiendo la Res. 47/2018.
- [ ] Hacer el **mensaje de WhatsApp neutro**, sin especialidad ni tipo de sesión.

**Seguimiento**
- [ ] Seguir los **proyectos de reforma** de la ley (1948-D-2025, 1751-D-2026) y revisar este documento si se aprueba alguno.

---

## 7. Fuentes

### Oficiales
- [Ley 25.326 de Protección de Datos Personales](https://www.argentina.gob.ar/normativa/nacional/64790/texto)
- [Decreto 1558/2001, reglamentario](https://www.argentina.gob.ar/normativa/nacional/70368/texto)
- [Disposición DNPDP 60-E/2016 (países adecuados y contratos modelo)](https://www.argentina.gob.ar/normativa/nacional/267922/texto)
- [AAIP: transferencias internacionales](https://www.argentina.gob.ar/transferencias-internacionales)
- [AAIP: aprobación de las cláusulas RIPD (Res. 198/2023)](https://www.argentina.gob.ar/noticias/la-aaip-aprobo-clausulas-contractuales-modelo-de-la-ripd-para-transferencias)
- [AAIP: obligaciones de los responsables](https://www.argentina.gob.ar/aaip/datospersonales/responsables/obligaciones)
- [AAIP: registrar bases de datos personales privadas](https://www.argentina.gob.ar/registrar-bases-de-datos-personales-privadas)
- [AAIP: trámites del Registro Nacional de Bases de Datos](https://www.argentina.gob.ar/aaip/datospersonales/tramites)
- [Inscribir un responsable de bases privadas](https://www.argentina.gob.ar/servicio/inscribir-un-responsable-de-bases-de-datos-personales-privadas) · [Instructivo](https://www.argentina.gob.ar/sites/default/files/instructivo_tad_inscripcionymodificacionresponsable_basesprivadas_2.pdf)
- [Res. AAIP 14/2018 (información y leyenda)](https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-14-2018-307621/texto)
- [Res. AAIP 47/2018 (medidas de seguridad recomendadas)](https://www.argentina.gob.ar/normativa/nacional/resolución-47-2018-312662/texto)
- [Proyecto de ley 1948-D-2025](https://www4.hcdn.gob.ar/dependencias/dsecretaria/Periodo2025/PDF2025/TP2025/1948-D-2025.pdf)

### Terceros
- [Diario Judicial: ¿sigue siendo suficiente la Ley 25.326 en 2026?](https://www.diariojudicial.com/news-103126-proteccion-de-datos-personales-sigue-siendo-suficiente-la-ley-25326-en-2026)
- [Marval: Res. AAIP 126/2024, infracciones y sanciones](https://www.marval.com/Publicacion/novedades-en-la-clasificacion-de-infracciones-y-en-el-regimen-de-graduacion-de-sanciones-16832)
- [Palabras del Derecho: ratificación del Convenio 108+](https://www.palabrasdelderecho.com.ar/articulo/4228/Argentina-ratifico-el-Convenio-108-sobre-proteccion-de-datos)
- [Supabase: DPA](https://supabase.com/legal/dpa) · [Subprocesadores](https://supabase.com/legal/customer-resources/subprocessor-list) · [Regiones](https://supabase.com/docs/guides/platform/regions)

### Lo que no pude verificar
1. Los **campos exactos** del formulario de inscripción de una base privada (no pude abrir el instructivo de la base).
2. El **texto completo y los montos** de la Res. AAIP 126/2024 sobre sanciones.
3. Si la AAIP tiene un **criterio publicado** sobre si "ser paciente de un profesional de salud" es por sí solo un dato de salud.
4. La **lista vigente de subprocesadores** de Supabase (está en un PDF que no pude abrir).
5. El estado parlamentario actualizado de los **proyectos de reforma** (la última información que encontré es de abril de 2026). Revisalo en el sitio de la Cámara de Diputados antes de lanzar.
