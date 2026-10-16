# honorapp — Recordatorios de pago automáticos por WhatsApp (Cloud API de Meta)

Investigación hecha el 16/10/2026.

Etiquetas:
- **[OFICIAL]**: lo leí en la documentación o en los términos de Meta/WhatsApp, o en la página de precios del proveedor.
- **[TERCERO]**: viene de un proveedor, un blog o un comparador.
- **[INFERENCIA]**: es mi conclusión.

> **Aviso importante:** el **1 de octubre de 2026** (hace dos semanas) Meta cambió los precios. Muchos artículos que circulan todavía dicen que los mensajes dentro de la ventana de 24 horas son gratis. **Ya no lo son.** Ver sección 2.

---

## 0. Resumen

1. **Darse de alta** requiere una cuenta de Meta Business (portfolio), una app en Meta for Developers, una cuenta de WhatsApp Business (WABA), un número que **no esté en uso** en WhatsApp, y **verificar el negocio** para pasar de 250 a 2.000 destinatarios por día.
2. **Costo en Argentina:** cerca de **USD 0,026 por recordatorio** (categoría "utilidad"). Equivale a unos **$39** por mensaje. Con 30 pacientes y 2 recordatorios al mes, son **USD 1,56 (≈ $2.360) por profesional por mes**.
3. **Plantillas:** cada mensaje que inicia la conversación tiene que ser una plantilla aprobada. La revisión es automática y tarda **hasta 24 horas**. Un recordatorio de pago, sin nada promocional, entra como **utilidad**, que es más barata que marketing.
4. **¿Número propio o compartido?** Técnicamente se puede usar **un número de honorapp** para todas, siempre que la plantilla diga en nombre de quién se escribe y el paciente haya aceptado recibirlos. Que cada profesional use **su propio número** es posible, pero obliga a que honorapp sea **"Tech Provider"** de Meta y que cada profesional pague su uso a Meta con su tarjeta.
5. **Intermediarios:** Twilio suma **USD 0,005 por mensaje**, Gupshup **USD 0,001**, 360dialog cobra **€49 por número por mes**, Botmaker arranca en **USD 149 por mes**. Para un solo número compartido, **conectarse directo a Meta es lo más barato**.
6. **Recomendación:** mantener gratis el botón actual (abre WhatsApp con el mensaje escrito, costo cero) y, como función **Pro**, sumar recordatorios automáticos desde **un número de honorapp**, conectado **directo a la Cloud API**, con plantilla de utilidad y un **cupo mensual por profesional**. Detalle en la sección 6.

---

## 1. Requisitos y pasos para darse de alta

### 1.1 Lo que hace falta [OFICIAL]
- **Cuenta de Facebook o Meta** y registro como desarrollador en Meta for Developers.
- **Portfolio comercial** (lo que antes se llamaba Business Manager).
- **App** en el panel de Meta con el caso de uso de WhatsApp.
- **Cuenta de WhatsApp Business (WABA)** conectada a la app.
- **Número de teléfono** del negocio, con estos requisitos:
  - Tiene que ser **tuyo**, con código de país y de área (no sirven números cortos).
  - Tiene que poder **recibir SMS o llamadas** para verificarlo.
  - **No puede estar en uso en WhatsApp.** Si lo está, primero hay que borrar esa cuenta. (La excepción es la "coexistencia", ver 4.3.)
  - Un fijo podría servir si recibe llamadas; no lo dice explícitamente. [INFERENCIA]
- **Nombre visible** (display name) aprobado por Meta. Sin nombre aprobado no se puede registrar el número.
- **PIN de verificación en dos pasos**, obligatorio al registrar el número.
- **Método de pago** cargado en la cuenta de WhatsApp Business para pagar los mensajes.
- **Token permanente**: se crea un "usuario del sistema" en la configuración del negocio y se le dan permisos de WhatsApp.

Fuentes: [Empezar con la Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started) · [Números de teléfono](https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers)

### 1.2 Pasos, en orden
1. Crear el portfolio comercial y la app en Meta for Developers. [OFICIAL]
2. Conectar o crear la cuenta de WhatsApp Business. Meta te da un **número de prueba** para empezar. [OFICIAL]
3. Mandar mensajes de prueba a tu propio celular y configurar el **webhook** para recibir los estados (enviado, entregado, leído, fallido). [OFICIAL]
4. Conseguir una **línea nueva** que no tenga WhatsApp (puede ser un chip prepago dedicado). [INFERENCIA]
5. Agregar el número real, cargar el **nombre visible** y esperar la aprobación. [OFICIAL]
6. Crear el **usuario del sistema** y el **token permanente**. [OFICIAL]
7. Cargar la **tarjeta** para pagar los mensajes. [OFICIAL]
8. Crear y mandar a revisión la **plantilla** del recordatorio (sección 3). [OFICIAL]
9. **Verificar el negocio** (sección 1.3). [OFICIAL]

### 1.3 Verificación del negocio y límites
- Un portfolio nuevo arranca con un **límite de 250**: se puede escribirle a 250 personas distintas por día fuera de la ventana de 24 horas. [OFICIAL]
- **Verificar el negocio** sube el límite a **2.000**. Después sube solo (10.000, 100.000, ilimitado) si los mensajes son de buena calidad y se usa al menos la mitad del límite. [OFICIAL]
- Los límites son **por portfolio**: los comparten todos los números del mismo negocio. [OFICIAL]
- Un portfolio nuevo puede registrar **2 números**; al verificarse pasa a **20**. [OFICIAL]
- Para la verificación, Meta pide documentos que prueben el **nombre legal, la dirección o el teléfono** del negocio, y puede tardar **varios días**. [TERCERO] No encontré la lista de documentos que acepta Meta para Argentina; lo esperable es la constancia de inscripción en ARCA y algún comprobante de domicilio a nombre del titular. [INFERENCIA]

Fuentes: [Límites de mensajería](https://developers.facebook.com/docs/whatsapp/messaging-limits) · [Números de teléfono](https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers) · [Wati: documentos de verificación](https://support.wati.io/es/articles/11463208-verificacion-de-negocios-de-meta-documentos-requeridos-por-pais)

> **Dependencia con legal.md:** para verificar el negocio hay que definir antes **quién es el titular legal de honorapp** (persona o sociedad). Es el mismo pendiente que aparece en legal.md.

---

## 2. Cuánto cuesta en Argentina

### 2.1 Cómo cobra Meta hoy [OFICIAL]
- Desde el **1 de julio de 2025**, Meta cobra **por mensaje entregado**, no por conversación. El modelo por conversación ya no existe.
- El precio depende de la **categoría** de la plantilla (marketing, utilidad o autenticación) y del **país del destinatario** (Argentina tiene su propia tarifa).
- **Desde el 1 de octubre de 2026** también se cobran:
  - los mensajes de **utilidad enviados dentro de la ventana de 24 horas** (antes eran gratis);
  - los mensajes **libres** de respuesta ("de servicio"), a la misma tarifa que utilidad.
- Hay **1.000 mensajes de servicio gratis por mes por número**. No aplica a plantillas de utilidad. [TERCERO, coinciden respond.io y YCloud]
- Desde abril de 2026 se puede facturar en **pesos argentinos (ARS)**. [OFICIAL]

Fuentes: [Precios de la plataforma](https://developers.facebook.com/docs/whatsapp/pricing) · [Cambios para mensajes sin plantilla](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages) · [respond.io](https://respond.io/blog/whatsapp-pricing-change-2026) · [YCloud](https://www.ycloud.com/blog/whatsapp-api-message-pricing-update-effective-october-1-2026)

### 2.2 Tarifas de Argentina (USD por mensaje entregado)

| Categoría | Tarifa | Para qué sirve |
|---|---|---|
| **Utilidad** | **USD 0,026** | Recordatorios de pago, avisos de cuenta. **Es la de honorapp.** |
| Autenticación | USD 0,026 | Códigos de verificación |
| Servicio (respuestas libres) | USD 0,026 | Desde el 01/10/2026; 1.000 gratis por mes por número |
| Marketing | USD 0,0618 | Promociones |

Las cifras vienen de **dos comparadores** que leyeron la tabla de Meta vigente desde el 01/10/2026 y coinciden entre sí. [TERCERO] [FlowCall](https://www.flowcall.co/blog/whatsapp-business-api-pricing) · [Kanal](https://getkanal.com/blog/whatsapp-vs-sms-pricing-by-country) La documentación oficial confirma que Argentina **bajó** sus tarifas de utilidad y autenticación en octubre de 2025, lo que es consistente (antes la utilidad estaba en USD 0,0289). [OFICIAL + TERCERO, [Sent](https://docs.sent.dm/docs/guides/whatsapp-pricing)] **No pude abrir la tabla oficial**: confirmala en la [calculadora de Meta](https://whatsappbusiness.com/products/platform-pricing/) eligiendo Argentina y dólares.

**Descuentos por volumen** (solo utilidad y autenticación): se aplican a partir de los **10.000 mensajes pagos por mes**, sumando todas las cuentas del mismo portfolio. Según un comparador, el descuento empieza en 5%. [OFICIAL para la regla; TERCERO para el porcentaje]

### 2.3 Cuánto le costaría a honorapp
Supuesto: cada profesional tiene **30 pacientes** y se manda **2 recordatorios por paciente por mes**. Tipo de cambio de referencia: USD 1 = $1.513 (el que publicaba TusFacturasApp el 16/10/2026). [INFERENCIA]

| Profesionales | Mensajes por mes | Costo mensual (USD) | Por profesional |
|---|---|---|---|
| 50 | 3.000 | 78 | USD 1,56 (≈ $2.360) |
| 500 | 30.000 | 780 | USD 1,56 (≈ $2.360) (menos con descuento por volumen) |
| 2.000 | 120.000 | 3.120 | USD 1,56 (≈ $2.360) (menos con descuento por volumen) |

- **Un mensaje sale unos $39.** Psicobit le cobra a sus usuarios **$59 por mensaje** y AgendaPro **$7.900 por 50** (≈ $158 cada uno) (ver competencia.md). [INFERENCIA]
- **Solo se paga lo entregado**: un número que no tiene WhatsApp no cuesta (algunos intermediarios cobran algo por los fallidos, ver sección 5). [OFICIAL]
- Las **respuestas de los pacientes** (por ejemplo, "ya te transferí") no tienen costo de entrada, pero si honorapp contesta con un mensaje automático, ese mensaje sí se cobra después de los primeros 1.000 por mes. [INFERENCIA a partir de 2.1]

---

## 3. Cómo se aprueban las plantillas

### 3.1 Qué es una plantilla
Para escribirle a alguien que **no te escribió en las últimas 24 horas**, solo se pueden mandar **plantillas** aprobadas por Meta. Un recordatorio de pago siempre va a ser una plantilla, porque es honorapp la que inicia el contacto. [OFICIAL]

### 3.2 La revisión [OFICIAL]
- Se crea la plantilla (en WhatsApp Manager o por API) con un **ejemplo** para cada variable.
- La revisión es **automática** y puede tardar **hasta 24 horas**.
- Estados: **aprobada** (se puede usar), **rechazada**, **en pausa** o **desactivada** (si muchos destinatarios la bloquean o la ignoran), y **apelación pedida**.
- Cada plantilla tiene una **calificación de calidad** (alta, media, baja) según bloqueos, reportes y lecturas. Con calidad baja, Meta la puede pausar.
- Las variables van entre llaves dobles: `{{1}}`, `{{2}}` o con nombre, como `{{nombre_paciente}}`.

Fuente: [Pautas de plantillas](https://developers.facebook.com/docs/whatsapp/message-templates/guidelines)

### 3.3 Que quede como "utilidad" y no como "marketing" [OFICIAL]
- Es **utilidad** si está ligada a la cuenta o a una transacción del usuario y **no tiene ninguna intención promocional**. Meta da como ejemplo de utilidad un aviso del tipo "tu pago mensual de {{servicio}} se cobra el {{fecha}}".
- Pasa a ser **marketing** si mezcla el aviso con una oferta (por ejemplo, "pagá ahora y obtené un 10%"), o si el cuerpo es vago o solo una variable.
- Si Meta considera que una plantilla de utilidad es marketing, **la recategoriza** (con un día de aviso, por mail y webhook). Se puede apelar dentro de 60 días. Si se repite, puede pasar **todas** las plantillas a marketing por 7 o 30 días.

Fuente: [Pautas de categorías](https://developers.facebook.com/docs/whatsapp/updates-to-pricing/new-template-guidelines)

### 3.4 Plantilla sugerida [INFERENCIA]

> Hola {{1}}, te escribimos de parte de {{2}}. Tenés un saldo pendiente de {{3}}. Si ya lo abonaste, ignorá este mensaje. Este número solo envía avisos de pago; ante cualquier consulta escribile directamente a {{2}}. Para no recibir más avisos, respondé BAJA.

- `{{1}}` nombre del paciente, `{{2}}` nombre de la profesional ("Lic. Ana López"), `{{3}}` monto con moneda ("$25.000" o "USD 40").
- **No menciona la especialidad ni el tipo de sesión.** La política de WhatsApp pide no mandar información de salud donde la regulación lo prohíbe [OFICIAL], y legal.md recomienda mensajes neutros.
- Nada promocional, para que quede como utilidad.
- Incluye cómo darse de baja, que la política pide. [OFICIAL]
- Sería bueno tener dos versiones: una para deuda en una sola moneda y otra para pesos y dólares.

---

## 4. ¿Número propio de cada profesional o uno compartido?

### 4.1 Opción A: un solo número de honorapp para todas
**¿Está permitido?** No encontré ninguna regla de Meta que diga que un número solo puede representar a un negocio. Lo que sí piden las políticas: [OFICIAL]
- El destinatario tiene que haber dado su **consentimiento para recibir mensajes de ese negocio**, y el consentimiento tiene que **nombrar al negocio**. Puede ser en persona o en papel.
- No hablar **"con la voz de otro negocio sin permiso"** ni engañar sobre la relación con otro negocio.
- Tener un perfil con datos de contacto reales y una política de privacidad publicada.

Cómo cumplirlo: [INFERENCIA]
- El nombre visible es **honorapp** y la plantilla aclara **"de parte de [profesional]"**.
- La profesional autoriza a honorapp en los Términos y Condiciones (es la misma figura de "prestadora" de legal.md).
- La profesional confirma, al cargar el teléfono, que el paciente aceptó recibir avisos de pago de honorapp en su nombre. Conviene un checkbox obligatorio y un texto modelo para que se lo explique al paciente.

| A favor | En contra |
|---|---|
| La profesional no hace **ningún trámite** en Meta | Si algunos pacientes bloquean o reportan, baja la **calidad del número de todas** |
| Un solo alta, una sola verificación, una sola factura de Meta | Los pacientes ven "honorapp", no el nombre de su profesional (salvo dentro del mensaje) |
| Sumás volumen en un solo portfolio, así llegan antes los **descuentos por volumen** | Si un paciente responde, la respuesta llega a honorapp y no a la profesional |
| Conectarse **directo a Meta** sin intermediarios | honorapp pasa a ser quien "contacta" al paciente: revisar con el abogado (legal.md) |

Fuentes: [Consentimiento (opt-in)](https://developers.facebook.com/docs/whatsapp/overview/getting-opt-in) · [Política de mensajería](https://whatsappbusiness.com/policy/)

### 4.2 Opción B: cada profesional con su número, conectado desde honorapp
- honorapp tiene que registrarse como **Tech Provider** de Meta: verificar su negocio, pasar una **revisión de la app** con dos videos de demostración y pedir permisos avanzados. [OFICIAL]
- Cada profesional se conecta con **Embedded Signup** (un asistente de Meta dentro de honorapp). Se le crean **su propia cuenta de WhatsApp Business y sus activos**. [OFICIAL]
- **Quién paga:** con un Tech Provider, **Meta le cobra directamente a cada profesional** y ella tiene que cargar su tarjeta. Solo un **Solution Partner** (estatus que Meta dice que tarda en obtenerse) puede cubrirlos con su línea de crédito y refacturar. [OFICIAL]

| A favor | En contra |
|---|---|
| El paciente ve el número y el nombre **de su profesional** | Mucha fricción: cuenta de Meta, número, tarjeta, aprobación del nombre |
| La calidad de un número no afecta a los demás | Cada profesional arranca con límite de 250 y sin descuentos por volumen |
| Las respuestas le llegan a ella | Mucho más trabajo técnico y de soporte para honorapp |

Fuente: [Tech Providers](https://developers.facebook.com/docs/whatsapp/solution-providers/get-started-for-tech-providers) · [Solution Providers](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/overview)

### 4.3 Variante: "coexistencia" con su WhatsApp Business actual
- Desde mayo de 2025, Meta permite que un negocio use **la app de WhatsApp Business y la Cloud API con el mismo número**, conservando el historial. [TERCERO, YCloud]
- Requisitos: app de WhatsApp Business **2.24.17 o superior**, un país habilitado y que la conexión la haga un **Tech Provider o Solution Partner**. Argentina no figura en la lista de países excluidos, pero no está confirmado de forma explícita. [TERCERO]
- Limitaciones: **5 mensajes por segundo**, sin grupos, sin listas de difusión ni llamadas. Los mensajes que la profesional manda desde la app siguen siendo gratis. [TERCERO]
- Sería la mejor experiencia para una profesional que ya usa WhatsApp Business con sus pacientes, pero **requiere la Opción B** (honorapp como Tech Provider). [INFERENCIA]

Fuente: [YCloud: coexistencia](https://www.ycloud.com/blog/whatsapp-business-app-coexistence-meta-update)

---

## 5. Intermediarios (BSP) y cuánto cuestan

Todos cobran **la tarifa de Meta aparte** (o la trasladan), más su propio cargo.

| Proveedor | Cargo propio | Costo por recordatorio en Argentina | Ideal para | Fuente |
|---|---|---|---|---|
| **Cloud API directo** (Meta) | Ninguno | USD 0,026 (≈ $39) | Un número compartido | [OFICIAL] |
| **Gupshup** (autoservicio) | USD 0,001 por mensaje | USD 0,027 (≈ $41) | Volumen, sin fijo mensual | [Gupshup](https://www.gupshup.ai/isv-partners/whatsapp-api/pricing) |
| **Twilio** | USD 0,005 por mensaje enviado **o recibido**; USD 0,001 por fallido | USD 0,031 (≈ $47) | Si ya usás Twilio o querés también SMS | [Twilio](https://www.twilio.com/en-us/whatsapp/pricing) |
| **360dialog** | €49 por número por mes (Regular); sin recargo por mensaje. Para plataformas: desde **€250 por mes** + €49 por número | USD 0,026 + el fijo | Opción B: plataformas que conectan muchos números | [360dialog](https://www.360dialog.com/pricing) |
| **Botmaker** (Argentina) | Desde **USD 149 por mes** + **20% sobre la tarifa de Meta**; USD 99 de alta | ≈ USD 0,031 + el fijo | Chatbots y atención, no solo avisos | [Botmaker](https://botmaker.com/prices) |

Notas:
- Lo que aporta un intermediario: panel, soporte, ayuda con la verificación y con la revisión de la app, y en algunos casos la **línea de crédito** para que la profesional no cargue su tarjeta. [TERCERO + INFERENCIA]
- Para la **Opción A** (número compartido), honorapp ya programa la integración, así que el intermediario solo suma costo. [INFERENCIA]
- Para la **Opción B**, un intermediario que sea **Solution Partner** (como 360dialog con su plataforma para partners) resuelve la facturación y el alta de cada profesional, pero a 360dialog cada número le cuesta **€49 por mes**. Eso solo cierra si la profesional paga bastante más que el precio Pro sugerido en competencia.md. [INFERENCIA]

---

## 6. Recomendación

### 6.1 Ahora: no cambiar nada
El botón actual, que **abre WhatsApp con el mensaje escrito**, cuesta **cero**, no necesita trámites con Meta y sale desde el número de la profesional. Es justo lo que prometen los textos de presentación. **Que siga gratis.** [INFERENCIA]

### 6.2 Plan Pro: recordatorios automáticos con un número de honorapp (Opción A)
1. **Conexión directa a la Cloud API**, sin intermediario. Es lo más barato (≈ $39 por mensaje) y el volumen es chico. [INFERENCIA]
2. **Un número de honorapp**, con nombre visible "honorapp", **negocio verificado** y una plantilla de **utilidad** como la de 3.4.
3. **Cupo incluido en Pro**, por ejemplo **60 recordatorios por mes** (≈ USD 1,56 de costo). Sobre un precio de $6.900, deja margen. Si alguien necesita más, se vende un pack. [INFERENCIA]
4. **Consentimiento:** checkbox obligatorio al cargar el teléfono ("El paciente aceptó recibir avisos de pago de honorapp en mi nombre") y un texto modelo para la profesional.
5. **Respuestas:** contestar automáticamente "Este número solo envía avisos; escribile a tu profesional" y avisarle a ella en la app que el paciente respondió. Las respuestas de servicio entran en los 1.000 gratis por mes.
6. **Proteger la calidad del número:** no mandar más de un recordatorio por semana por paciente, cortar a quien responde BAJA, y no enviar a pacientes sin deuda.
7. **Facturar a Meta en pesos** (posible desde abril de 2026) para no depender del dólar tarjeta. [OFICIAL para la opción; INFERENCIA para la conveniencia]

### 6.3 Más adelante, si lo piden: número propio (Opción B)
Si muchas profesionales quieren que el aviso salga **desde su propio WhatsApp**, evaluar convertirse en **Tech Provider** y ofrecer **coexistencia**, como función de un plan más caro. Antes, medir cuántas lo piden. [INFERENCIA]

### 6.4 Antes de programar
- [ ] Definir el **titular legal** de honorapp (lo pide Meta para verificar y lo pide legal.md).
- [ ] Confirmar en la **calculadora oficial de Meta** la tarifa de utilidad para Argentina.
- [ ] Conseguir una **línea dedicada** que no tenga WhatsApp.
- [ ] Crear la app, la WABA y probar con el **número de prueba** de Meta.
- [ ] Mandar a revisión la **plantilla** y verificar que quede como **utilidad**.
- [ ] Iniciar la **verificación del negocio** (puede tardar días).
- [ ] Agregar a la **política de privacidad** y a los **Términos** que honorapp envía avisos por WhatsApp en nombre de la profesional, y que Meta es proveedor (revisarlo con el abogado de legal.md).
- [ ] Agregar el **checkbox de consentimiento** en la ficha del paciente.
- [ ] Agregar casos a **pruebas.md**: recordatorio automático, respuesta BAJA, paciente que responde, deuda en dos monedas.

---

## 7. Lo que no pude verificar
1. **La tabla oficial de Meta para Argentina.** La página oficial carga las tarifas solo de forma interactiva. Las cifras (USD 0,026 utilidad, 0,0618 marketing) vienen de dos comparadores que coinciden.
2. **Los porcentajes exactos de descuento por volumen** para Argentina.
3. **Los documentos que acepta Meta en Argentina** para verificar el negocio.
4. **Si la coexistencia está habilitada para números argentinos**: no figura entre los excluidos, pero no lo encontré confirmado.
5. **Las reglas exactas del nombre visible** (no pude abrir esa página de la documentación).
6. **Si Meta acepta explícitamente** que un número envíe avisos en nombre de muchas profesionales. No encontré una prohibición, pero tampoco una autorización expresa: probarlo con la primera plantilla y consultarlo con un intermediario si hay dudas.

---

## 8. Fuentes

### Oficiales (Meta / WhatsApp)
- [Empezar con la Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
- [Números de teléfono](https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers)
- [Límites de mensajería](https://developers.facebook.com/docs/whatsapp/messaging-limits)
- [Precios](https://developers.facebook.com/docs/whatsapp/pricing) · [Cambios desde el 01/10/2026](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages) · [Calculadora](https://whatsappbusiness.com/products/platform-pricing/)
- [Pautas de plantillas](https://developers.facebook.com/docs/whatsapp/message-templates/guidelines) · [Categorías de plantillas](https://developers.facebook.com/docs/whatsapp/updates-to-pricing/new-template-guidelines)
- [Consentimiento (opt-in)](https://developers.facebook.com/docs/whatsapp/overview/getting-opt-in)
- [Política de mensajería de WhatsApp Business](https://whatsappbusiness.com/policy/)
- [Términos de la solución de WhatsApp Business](https://www.whatsapp.com/legal/business-solution-terms)
- [Tech Providers](https://developers.facebook.com/docs/whatsapp/solution-providers/get-started-for-tech-providers) · [Solution Providers](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/overview)

### Proveedores
- [Twilio: precios de WhatsApp](https://www.twilio.com/en-us/whatsapp/pricing)
- [360dialog: precios](https://www.360dialog.com/pricing)
- [Gupshup: precios autoservicio](https://www.gupshup.ai/isv-partners/whatsapp-api/pricing)
- [Botmaker: precios](https://botmaker.com/prices)

### Terceros
- [FlowCall: tarifas por país (oct. 2026)](https://www.flowcall.co/blog/whatsapp-business-api-pricing)
- [Kanal: WhatsApp vs SMS por país](https://getkanal.com/blog/whatsapp-vs-sms-pricing-by-country)
- [Sent: guía de precios](https://docs.sent.dm/docs/guides/whatsapp-pricing)
- [respond.io: cambios de precios 2026](https://respond.io/blog/whatsapp-pricing-change-2026)
- [YCloud: cambios del 01/10/2026](https://www.ycloud.com/blog/whatsapp-api-message-pricing-update-effective-october-1-2026) · [YCloud: coexistencia](https://www.ycloud.com/blog/whatsapp-business-app-coexistence-meta-update)
- [Wati: verificación de negocios](https://support.wati.io/es/articles/11463208-verificacion-de-negocios-de-meta-documentos-requeridos-por-pais)
