# Facturación electrónica ARCA desde honorapp (Factura C de monotributistas)

Investigación hecha el 16/10/2026 y revisada contra las fuentes el mismo día (ver "Registro de correcciones" al final). Cada afirmación lleva su fuente. Uso estas etiquetas:

- **[OFICIAL]**: la leí directamente en un documento de ARCA (manuales PDF y páginas del micrositio de Web Services).
- **[TERCERO]**: viene de un proveedor, un blog o una nota de prensa. Sirve de orientación, pero hay que confirmarlo.
- **[INFERENCIA]**: es una conclusión mía a partir de lo anterior. No está escrita así en ninguna fuente.

Al final hay una lista de lo que **no pude verificar**. Leela antes de decidir.

---

## 0. Resumen en 10 líneas

1. La integración es técnicamente viable. ARCA ofrece dos web services para esto: **WSAA** (autenticación) y **WSFEv1** (comprobantes). La página de producción de ARCA enlaza el manual de WSFEv1 v4.7 (revisión del 01/09/2026), pero ya está publicada la **v4.8** (revisión del 01/12/2026) en la sección de homologación externa. Conviene desarrollar contra la v4.8.
2. Cada profesional tiene que hacer **tres cosas en ARCA**: tener un **punto de venta** de tipo web service, **delegar el servicio de Facturación Electrónica** a honorapp y obtener clave fiscal **nivel 3**.
3. honorapp necesita **su propio CUIT, su propio certificado digital y ser Administrador de Relaciones**. Ese es el modelo de "tercerización del servicio" que ARCA documenta.
4. El pedido de CAE son cuatro pasos: pedir el ticket (TA) al WSAA, consultar el último número autorizado, enviar `FECAESolicitar` y guardar el CAE con su vencimiento.
5. La Factura C **no discrimina IVA**. En el web service es un comprobante sin detalle de ítems, así que el servicio que prestó el profesional no viaja a ARCA.
6. Al paciente casi siempre se le factura como **Consumidor Final sin identificar** (documento 99, número 0). Con montos menores a $10.000.000 no hace falta DNI, salvo que el paciente necesite la factura para deducir en Ganancias: en ese caso hay que identificarlo con CUIT, sin importar el monto (RG 5866/2026). Y hay que enviar **siempre** la condición frente al IVA del receptor: desde el **01/12/2026** ARCA rechaza las facturas que no la traen.
7. Un intermediario ahorra el trabajo más delicado (firma CMS, tickets, SOAP). **Afip SDK** es mucho más barato que **TusFacturasApp** para una app gratuita con muchos CUIT chicos.
8. El mayor riesgo no es técnico sino de **onboarding**. Cada profesional debe hacer a mano unos 8 pasos en la web de ARCA, y no conviene pedirles la clave fiscal.
9. Hay un riesgo legal a revisar: el paciente de un profesional de la salud genera **datos sensibles** (Ley 25.326).
10. **Recomendación:** integrar con Afip SDK detrás de una capa propia, con delegación a un CUIT de honorapp y sin guardar claves fiscales. Primero validar con 5 profesionales reales. El detalle está en la sección 7.

---

## 1. Qué tiene que hacer cada profesional

### 1.1 Requisitos previos
- **Clave fiscal nivel 3.** Los manuales oficiales de certificados y de delegación dicen que se presupone "clave fiscal de nivel acorde a los servicios que se utilizan (3), tramitada en una dependencia de ARCA". [OFICIAL] [Cómo obtener el certificado de producción](https://www.arca.gob.ar/ws/WSAA/wsaa_obtener_certificado_produccion.pdf) · [Delegación de web services](https://www.arca.gob.ar/ws/WSAA/ADMINREL.DelegarWS.pdf)
- Estar inscripto como monotributista y tener habilitada la **facturación electrónica**. No investigué los requisitos de la inscripción en sí.

### 1.2 Hay dos caminos
La lista oficial "Acciones a realizar para consumir un web service de factura electrónica" ordena los pasos así. [OFICIAL] [Acciones para consumir un WS](https://www.arca.gob.ar/fe/documentos/AccionesarealizarparaconsumirunWebservicedeFacturaElectr.pdf)

1. Leer la arquitectura de los WS.
2. Identificar el web service de negocio. Para esto es **wsfev1**.
3. Generar el certificado digital, asociarlo al servicio y delegar.
4. Desarrollar el cliente de WSAA.
5. Desarrollar el cliente de WSFEv1.
6. Empadronarse, solo si la norma lo exige. Para los alcanzados por la RG 3749/2015, no.
7. Pedir el alta de un punto de venta.

Del paso 3 salen dos caminos posibles.

#### Camino A: el profesional delega a honorapp (recomendado para una plataforma)
ARCA documenta explícitamente la **"Situación 2: Tercerización del servicio"**: el contribuyente autoriza a una empresa de facturación a operar el web service en su nombre. [OFICIAL] [Delegación de web services](https://www.arca.gob.ar/ws/WSAA/ADMINREL.DelegarWS.pdf)

El profesional hace esto, y el manual oficial menciona la constancia que emite el sistema (F.3283/E):
1. Entra a ARCA con su clave fiscal y abre **Administrador de Relaciones de Clave Fiscal**.
2. Elige **Nueva Relación**.
3. Busca el servicio de **Facturación Electrónica** dentro de las agrupaciones de Web Services.
4. En "Representante" ingresa el **CUIT de honorapp**. Es el campo "CUIT/CUIL/CDI del usuario".
5. Confirma. El sistema emite la constancia.

Después, **honorapp tiene que completar su parte**:
1. Su Administrador de Relaciones entra a la opción de designaciones pendientes y **acepta** la delegación.
2. Con "Nueva Relación", elige al profesional como representado y asigna **uno de sus computadores fiscales** (su certificado) a ese servicio.
3. Recién ahí el servicio queda disponible. [OFICIAL]

Dos cosas importantes que salen del documento oficial:
- **Solo se puede elegir un computador fiscal propio en la subdelegación.** El manual dice que no se puede elegir a otra empresa para "continuar con una cadena de autorizaciones". [OFICIAL] [INFERENCIA] Entonces la cadena es **un solo salto**: profesional → quien opere el servicio. Si honorapp usara un intermediario como TusFacturasApp, el profesional tendría que delegar **directamente al CUIT del intermediario**, o honorapp tendría que delegarle un certificado propio. No se puede encadenar una segunda delegación.
- **Revocar es simple.** El profesional puede quitarle la delegación a honorapp cuando quiera desde "Consultar". Hay que diseñar qué pasa en la app cuando eso ocurra. [OFICIAL]

Un tutorial de Afip SDK describe el mismo flujo en 8 pasos: Nueva Relación → ARCA → Web Services → servicio → CUIT del destinatario → confirmar dos veces → el autorizado acepta. [TERCERO] [Delegar web service (Afip SDK)](https://docs.afipsdk.com/paso-a-paso/tutoriales-pagina-de-afip/delegar-web-service)

#### Camino B: certificado propio del profesional
Cada profesional genera su clave privada y su CSR (con OpenSSL), y entra a **Administración de Certificados Digitales** → **Agregar alias** → sube el CSR → descarga el `.crt`. Después, en el Administrador de Relaciones, **asocia el certificado al web service** de facturación. [OFICIAL] [Certificado de producción](https://www.arca.gob.ar/ws/WSAA/wsaa_obtener_certificado_produccion.pdf) · [Asociar certificado a un WSN](https://www.arca.gob.ar/ws/WSAA/wsaa_asociar_certificado_a_wsn_produccion.pdf)

Es más difícil para alguien que no es técnico y obliga a que honorapp custodie la clave privada de cada profesional. **No lo recomiendo** salvo que algún cliente lo pida.

### 1.3 Punto de venta
- El alta se hace en el servicio de ARCA **"Administración de puntos de venta y domicilios"** o en "Facturación y Registración · ABM Punto de Venta". [OFICIAL, paso 7 de la lista de acciones]
- **El tipo de punto de venta tiene que ser de web services.** Para monotributistas, tres fuentes de terceros (Afip SDK, TusFacturasApp, Odoo) coinciden en que la opción se llama **"Factura Electrónica – Monotributo – Web Services"**. La opción "RECE para aplicativo y web services" sería para responsables inscriptos. [TERCERO] [Crear punto de venta (Afip SDK)](https://docs.afipsdk.com/recursos/tutoriales-pagina-de-arca/crear-punto-de-venta) · [Nuevo punto de venta (TusFacturasApp)](https://intercom.help/tusfacturasapp/es/articles/10355011-nuevo-punto-de-venta)
- Los puntos de venta de web service **no aparecen en el facturador web de ARCA**, y a la inversa. [TERCERO] Hay que avisarle esto al profesional: si ya factura desde el sitio de ARCA, **necesita un punto de venta nuevo**, y la numeración de ese punto empieza de cero. [INFERENCIA]
- El número de punto de venta tiene hasta 5 dígitos desde 10/2018. [OFICIAL] [Manual WSFEv1 v4.7](https://www.afip.gob.ar/ws/documentacion/manuales/manual-desarrollador-ARCA-COMPG.pdf)
- Se puede comprobar que el punto de venta está bien con `FEParamGetPtosVenta`, que devuelve los puntos de venta asignados a facturación electrónica por web service. [OFICIAL, mismo manual]
- **Plazos nuevos (RG 5866/2026, vigente desde el 01/07/2026):** el alta de un punto de venta se informa con al menos **3 días hábiles de anticipación** a la fecha de inicio, la baja dentro de los **5 días hábiles** siguientes al cierre, y **un punto de venta dado de baja no puede volver a usarse**. [TERCERO: texto de la resolución reproducido por el Consejo Profesional de Salta; confirmalo en el Boletín Oficial] [RG 5866/2026](https://www.consejosalta.org.ar/wp-content/uploads/arca-5866.pdf) · [Boletín Oficial](https://www.boletinoficial.gob.ar/detalleAviso/primera/343656/20260629) Esto afecta el onboarding: el profesional no puede dar de alta el punto de venta y facturar el mismo día. [INFERENCIA]

### 1.4 Resumen de fricción para el profesional
| Paso | Dónde | Dificultad |
|---|---|---|
| Clave fiscal nivel 3 | Dependencia de ARCA o web | Media (si no la tiene) |
| Punto de venta tipo web service | ARCA, "Administración de puntos de venta" | Media |
| Delegar servicio a honorapp | ARCA, "Administrador de Relaciones" | Media-alta (menús confusos) |

Conviene armar un **asistente paso a paso con capturas** y un botón "Verificar conexión", que pruebe la delegación consultando los puntos de venta del CUIT.

---

## 2. Los web services: WSAA y WSFEv1

### 2.1 URLs
| Servicio | Homologación (pruebas) | Producción |
|---|---|---|
| WSAA | `https://wsaahomo.afip.gov.ar/ws/services/LoginCms` | `https://wsaa.afip.gov.ar/ws/services/LoginCms` |
| WSFEv1 | `https://wswhomo.afip.gov.ar/wsfev1/service.asmx` | `https://servicios1.afip.gov.ar/wsfev1/service.asmx` |

[OFICIAL] [WSAA](https://www.arca.gob.ar/ws/documentacion/wsaa.asp) · [Manual WSFEv1 v4.7](https://www.afip.gob.ar/ws/documentacion/manuales/manual-desarrollador-ARCA-COMPG.pdf). El WSDL de cada servicio se obtiene agregando `?WSDL`. Los dominios del manual siguen siendo `afip.gov.ar`, aunque el sitio institucional ya es `arca.gob.ar`. Verificá las URLs al implementar.

Los dos son **SOAP sobre HTTPS** y el cliente tiene que validar el certificado TLS del servidor. [OFICIAL] [Especificación técnica del WSAA 1.2.2](https://www.arca.gob.ar/ws/WSAA/Especificacion_Tecnica_WSAA_1.2.2.pdf)

### 2.2 WSAA: pedir el ticket de acceso (TA)
Flujo oficial en 5 pasos. [OFICIAL] [Especificación técnica del WSAA 1.2.2](https://www.arca.gob.ar/ws/WSAA/Especificacion_Tecnica_WSAA_1.2.2.pdf) · [Arquitectura general](https://www.arca.gob.ar/ws/documentacion/arquitectura-general.asp)

1. **Armar el TRA** (`LoginTicketRequest.xml`) con `uniqueId` (entero sin signo de 32 bits), `generationTime`, `expirationTime` y `service` (para facturación es `wsfe`).
   - ARCA acepta un `generationTime` de hasta 24 horas antes y un `expirationTime` de hasta 24 horas después.
2. **Firmarlo** como CMS `SignedData` (el documento dice SHA1 + RSA), incluyendo el certificado X.509.
3. **Codificar en Base64** el CMS.
4. Llamar a **`loginCms`** del WSAA y recibir el `LoginTicketResponse.xml`.
5. Extraer **`token` y `sign`** del TA. Esos dos valores se mandan en cada pedido a WSFEv1.

Reglas que importan al programar:
- **El TA dura 12 horas** y es válido para **un único servicio**. [OFICIAL]
- **No pidas un TA nuevo mientras tengas uno vigente.** Si lo hacés, ARCA responde `coe.alreadyAuthenticated`. Hay que **cachear el TA** y renovarlo cerca del vencimiento. [OFICIAL]
- Ante un error que no sea `wsaa.*` ni `wsn.unavailable`, **no reintentes** hasta resolver la causa. En el resto de los errores, esperá **60 segundos** antes de volver a pedir. [OFICIAL]
- **Reloj sincronizado** por NTP (el documento sugiere `time.afip.gov.ar`). Un reloj desfasado produce `xml.generationTime.invalid`. [OFICIAL]
- El certificado tiene que ser **X.509v3 emitido por la autoridad certificante de ARCA**. [OFICIAL] [WSAA](https://www.afip.gob.ar/ws/documentacion/wsaa.asp)
- **Un mismo certificado no puede usarse en varios equipos a la vez.** El FAQ oficial de delegación explica que, mientras el ticket de un computador fiscal está vigente, ese computador no puede pedir otro para el mismo web service. [OFICIAL] [Delegación de web services](https://www.afip.gob.ar/ws/WSAA/ADMINREL.DelegarWS.pdf) Si honorapp corre en más de un servidor o proceso, el cache del TA tiene que ser **compartido** (por ejemplo, en la base de datos), no local a cada instancia. [INFERENCIA]

**Certificado y delegaciones (a probar en homologación).** El manual de WSFEv1 incluye el error 601, "CUIT representada no incluida en token", y el parámetro `Auth.Cuit` se describe como "contribuyente (representado o emisora)". [OFICIAL] [INFERENCIA] Parece que el mismo certificado de honorapp sirve para facturar por varios CUIT, y que el token lista las representaciones vigentes. **No pude confirmar si, al sumarse un cliente nuevo, hay que pedir un TA nuevo antes de las 12 horas.** Tiene que quedar probado en homologación antes de diseñar el cache.

### 2.3 Homologación (ambiente de pruebas)
- En pruebas, el certificado se gestiona con **WSASS** (autogestión de certificados) y el servicio se asocia ahí. En producción se usan "Administración de Certificados Digitales" y "Administrador de Relaciones". [OFICIAL] [WSAA](https://www.arca.gob.ar/ws/documentacion/wsaa.asp)
- Consultas sobre homologación de WSFEv1: wsfev1@arca.gov.ar. Producción: sri@arca.gov.ar. [OFICIAL, manual v4.7]

### 2.4 WSFEv1: pedir el CAE
La página de producción enlaza la **v4.7** (revisión del 01/09/2026). [OFICIAL] [Manual WSFEv1 v4.7](https://www.afip.gob.ar/ws/documentacion/manuales/manual-desarrollador-ARCA-COMPG.pdf) Pero en homologación externa ya está la **v4.8** (revisión del 01/12/2026), que vuelve obligatorio `CondicionIVAReceptorId`. [OFICIAL] [Manual WSFEv1 v4.8](https://www.afip.gob.ar/fe/ayuda/documentos/wsfev1-RG-4291.pdf) · [Homologación externa](https://www.afip.gob.ar/ws/documentacion/homologacion-externa.asp) Desarrollá contra la v4.8.

Recomiendo este flujo de llamadas para cada factura:

```
1. FEDummy                   → ¿está vivo el servicio?  (opcional, para monitoreo)
2. FEParamGetPtosVenta       → ¿el punto de venta está activo?  (al conectar al profesional)
3. FECompUltimoAutorizado    → último número emitido para (CUIT, punto de venta, tipo)
4. FECAESolicitar            → enviar el comprobante con número = último + 1
5. Leer la respuesta         → Resultado A/R, CAE, CAEFchVto, Observaciones, Errores
6. FECompConsultar           → si hubo timeout o no sabés si se emitió: consultar antes de reintentar
```

Los métodos están todos en el manual oficial. [OFICIAL]

**Cómo responde `FECAESolicitar`.** Hay tres posibles resultados: aprobado, aprobado con observaciones (se asigna CAE igual) y rechazado. [OFICIAL] El campo `Resultado` vale `A` (aprobado) o `R` (rechazado). La respuesta trae `CAE` (14 caracteres), `CAEFchVto` (fecha de vencimiento del CAE), la fecha de proceso y las listas `Obs`, `Errors` y `Events`. [OFICIAL]

#### Campos para una Factura C (sin IVA discriminado)
Esto sale de la tabla de campos del manual. [OFICIAL] La Factura C es el **código 11**: la validación 10007 del manual lista 11, 12, 13, 15, 211, 212 y 213 como comprobantes clase C. [OFICIAL] Igual conviene consultar `FEParamGetTiposCbte` al implementar.

| Campo | Qué enviar |
|---|---|
| `Auth.Token`, `Auth.Sign`, `Auth.Cuit` | Los del WSAA y el CUIT del profesional representado |
| `FeCabReq.CantReg` | 1 |
| `FeCabReq.PtoVta` | Punto de venta del profesional |
| `FeCabReq.CbteTipo` | `11` (Factura C) |
| `Concepto` | `2` (Servicios). Es lo habitual en un consultorio. |
| `DocTipo` / `DocNro` | Ver sección 4 (casi siempre `99` y `0`) |
| `CbteDesde` = `CbteHasta` | Número siguiente al último autorizado. En tipo C deben ser iguales. |
| `CbteFch` | `yyyymmdd`. Con servicios, hasta 10 días antes o después de la fecha de generación. |
| `ImpTotal` | Importe total. En tipo C debe ser igual a `ImpNeto` + `ImpTrib`. |
| `ImpNeto` | En tipo C es el **subtotal**: el mismo importe del servicio. |
| `ImpTotConc`, `ImpOpEx`, `ImpIVA` | **0** (obligatorio en tipo C) |
| `ImpTrib` | 0 (si no hay tributos) |
| `Iva` (array) | **No se informa** en tipo C |
| `FchServDesde`, `FchServHasta`, `FchVtoPago` | **Obligatorios** con `Concepto` 2 o 3. `FchServHasta` no puede ser menor que `FchServDesde`. `FchVtoPago` debe ser igual o posterior a la fecha del comprobante. |
| `MonId` / `MonCotiz` | `PES` y `1` para pesos |
| `CondicionIVAReceptorId` | **Siempre enviarlo** (ver 4.3). Consumidor Final = `5`. |

Ejemplo ilustrativo armado con la estructura del manual (**no está probado contra ARCA**):

```xml
<ar:FECAESolicitar>
  <ar:Auth><ar:Token>…</ar:Token><ar:Sign>…</ar:Sign><ar:Cuit>20111111112</ar:Cuit></ar:Auth>
  <ar:FeCAEReq>
    <ar:FeCabReq><ar:CantReg>1</ar:CantReg><ar:PtoVta>3</ar:PtoVta><ar:CbteTipo>11</ar:CbteTipo></ar:FeCabReq>
    <ar:FeDetReq><ar:FECAEDetRequest>
      <ar:Concepto>2</ar:Concepto>
      <ar:DocTipo>99</ar:DocTipo><ar:DocNro>0</ar:DocNro>
      <ar:CbteDesde>45</ar:CbteDesde><ar:CbteHasta>45</ar:CbteHasta>
      <ar:CbteFch>20261016</ar:CbteFch>
      <ar:ImpTotal>40000.00</ar:ImpTotal><ar:ImpTotConc>0</ar:ImpTotConc>
      <ar:ImpNeto>40000.00</ar:ImpNeto><ar:ImpOpEx>0</ar:ImpOpEx>
      <ar:ImpTrib>0</ar:ImpTrib><ar:ImpIVA>0</ar:ImpIVA>
      <ar:FchServDesde>20261001</ar:FchServDesde><ar:FchServHasta>20261031</ar:FchServHasta>
      <ar:FchVtoPago>20261031</ar:FchVtoPago>
      <ar:MonId>PES</ar:MonId><ar:MonCotiz>1</ar:MonCotiz>
      <ar:CondicionIVAReceptorId>5</ar:CondicionIVAReceptorId>
    </ar:FECAEDetRequest></ar:FeDetReq>
  </ar:FeCAEReq>
</ar:FECAESolicitar>
```

#### Cosas a tener en cuenta al programar
- **Numeración:** si dos pedidos corren a la vez para el mismo punto de venta, se pisan los números. Serializá los pedidos por (CUIT, punto de venta). [INFERENCIA]
- **Timeouts:** si la llamada se corta sin respuesta, **consultá con `FECompConsultar` antes de reintentar**. Un reintento ciego puede dejar un número saltado o duplicar la factura. [INFERENCIA, el método existe en el manual]
- **Rechazos (`R`):** guardá el código y el mensaje que devuelve ARCA y mostrale al profesional una explicación en castellano. El manual tiene una tabla extensa de códigos de error y observación. [OFICIAL]
- **Sin detalle de ítems:** `wsfev1` sirve a comprobantes A, B, C y M "sin detalle de ítem". [OFICIAL] [WS de Factura Electrónica](https://www.arca.gob.ar/ws/documentacion/ws-factura-electronica.asp) Eso quiere decir que el concepto ("sesión de psicología") **solo aparece en el PDF que genera honorapp**, no en ARCA.
- **El PDF lo genera honorapp.** ARCA solo devuelve el CAE. El PDF debe llevar los datos fiscales, el CAE, su vencimiento y el código QR. El QR lo exige la **RG 4892/2020** (Boletín Oficial del 24/12/2020), y los datos que codifica están en el micrositio de ARCA (afip.gob.ar/fe/qr). [OFICIAL] [RG 4892/2020](https://biblioteca.afip.gob.ar/dcp/REAG01004892_2020_12_22)
- **Cuándo facturar (RG 5866/2026):** las prestaciones de servicios se facturan el día en que se concluye la prestación, o cuando se cobra si eso pasa antes. Los servicios continuos se facturan el último día de cada mes calendario, salvo cobro o conclusión anterior. [TERCERO: texto reproducido por el Consejo Profesional de Salta; confirmalo en el Boletín Oficial] [RG 5866/2026](https://www.consejosalta.org.ar/wp-content/uploads/arca-5866.pdf) En un consultorio, eso sugiere emitir la factura al registrar el pago o al terminar la sesión, no antes. Definilo con la contadora antes de diseñar el disparador de la factura. [INFERENCIA] El ejemplo XML de arriba (emitido el 16/10 por un período hasta el 31/10) es solo ilustrativo del formato.
- **Dólares:** el servicio admite moneda extranjera (`MonId`, `MonCotiz`, `CanMisMonExt`). Con `CanMisMonExt = S`, la cotización informada debe coincidir con la que ARCA tiene registrada para el día hábil anterior. [OFICIAL, manual v4.0 en adelante] Decidí con la contadora si honorapp factura en pesos o en dólares, porque el criterio tributario excede esta investigación.

---

## 3. ¿Conviene usar un servicio intermedio?

### 3.1 Qué haría un intermediario y qué no
Lo que **se evita** usando uno: armar la firma CMS del TRA, administrar los TA, hablar SOAP y mantener el cliente cuando ARCA cambia el manual. El manual de WSFEv1 tuvo cambios en 2025 y 2026 (por ejemplo, la condición IVA del receptor en la v4.0 y varias adecuaciones más en la v4.x).

Lo que **no se evita**: la delegación de cada profesional en ARCA, ni el alta del punto de venta. Eso siempre lo tiene que hacer cada uno, con cualquier opción.

### 3.2 Comparación (precios vigentes al 16/10/2026 según cada sitio)

#### Afip SDK [TERCERO, es un sitio comercial sin relación con ARCA]
Precios en **dólares por mes** [Precios de Afip SDK](https://afipsdk.com/pricing):

| Plan | USD/mes | CUIT incluidos | Requests incluidos | CUIT extra | Requests extra |
|---|---|---|---|---|---|
| Free | 0 | 1 | 1k | s/d | s/d |
| Pro | 25 | 10 | 10k | USD 10 por CUIT | USD 10 cada 1k |
| Growth | 80 | 100 | 100k | USD 5 por CUIT | USD 5 cada 1k |
| Startup | 250 | 1.000 | 1M | USD 1 por CUIT | USD 1 cada 1k |
| Enterprise | a medida | a medida | a medida | a medida | a medida |

Complementos: PDFs (100 gratis; 1k por USD 5/mes) y "automatizaciones" (10 gratis; 1k por USD 50/mes). La página tiene una posible errata en el precio del extra de automatizaciones (en el plan de 1k automatizaciones figura "USD 50 cada 100 extra") y las respuestas de su FAQ no se muestran. [TERCERO]

- **Ventaja de modelo:** su sitio describe el flujo multi-cliente que ARCA documenta: el CUIT del cliente delega el servicio al CUIT de quien integra, este lo acepta y lo vincula a su certificado. [TERCERO] [afipsdk.com](https://afipsdk.com/)
- Soporta Node.js, PHP, Python, .NET, Java, Go, API directa y n8n/Make/Zapier. [TERCERO]
- Ofrece **automatizaciones** que hacen por vos los pasos manuales en ARCA: crear certificados, autorizar y delegar web services, crear puntos de venta. [TERCERO] [Automatizaciones](https://afipsdk.com/docs/automations/introduction/) **Ojo:** la automatización "Crear certificado de producción" (`create-cert-prod`) pide como parámetros el CUIT, el usuario y la **contraseña de la clave fiscal** para entrar a la página de ARCA. [TERCERO] [Crear certificado de producción](https://afipsdk.com/docs/automations/create-cert-prod) La página no explica cómo se tratan esas credenciales.
- En su guía de producción, la configuración lleva `cert`, `key`, el `access_token` de su plataforma y `production: true`. El ejemplo es de un solo CUIT. [TERCERO] [Ir a producción](https://docs.afipsdk.com/siguientes-pasos/ir-a-produccion)

**Cuenta de cabecera** (suponiendo que cada profesional activo cuenta como un CUIT y que se usan pocos requests):

| Profesionales | Plan que corresponde | Costo aproximado |
|---|---|---|
| 8 | Pro | USD 25/mes |
| 80 | Growth | USD 80/mes |
| 500 | Startup | USD 250/mes |

Sale menos de **USD 1 por profesional por mes** a escala. Hay que confirmar con ellos cómo cuentan los CUIT y los requests. Una factura puede consumir más de un request (último número, solicitud, consulta).

#### TusFacturasApp [TERCERO]
Precios en **pesos con IVA incluido**, vigentes al 16/10/2026 [Tarifas](https://www.tusfacturas.app/tarifas):

| Plan | $/mes | Comprobantes o requests / 30 días | Puntos de venta |
|---|---|---|---|
| API DEV (prueba) | 0 | 1.500 | 2 |
| API26 1K4C | 34.980 | 1.000 | 4 |
| API26SaaS 1K12C | 68.900 | 1.500 | 12 |
| API26SaaS 4K24C | 116.600 | 4.000 | 24 |
| API26SaaS 7K48C | 243.800 | 7.000 | 48 |
| API26 10K20C | 201.400 | 10.000 | 20 |

Existen más planes API (hasta 100.000 comprobantes) y planes sin API para estudios. La grilla no limita la cantidad de CUIT, pero aclara que los **puntos de venta por espacio de trabajo pueden ser de un mismo CUIT o de diferentes**. Por eso el límite práctico para honorapp es la cantidad de puntos de venta. [TERCERO] En la misma grilla, el plan **API DEV** figura sin "Integración con ARCA" ni "QR y CAE desde ARCA", así que sirve para probar la API, no para emitir contra ARCA. [TERCERO]

Si cada profesional necesita un punto de venta propio, el costo ronda **$4.900 a $5.700 por profesional por mes** en los planes SaaS (por ejemplo, $243.800 ÷ 48 ≈ $5.080). [INFERENCIA] Para una app gratuita, eso es varios órdenes de magnitud más caro que Afip SDK.

- API REST con un JSON por comprobante. Autenticación con tres valores (`apitoken`, `apikey`, `usertoken`). Hay SDK descargable y soporte por mail y chat. [TERCERO] [Referencia API](https://developers.tusfacturas.app/api-factura-electronica-afip-facturacion-ventas/referencia-api-afip-arca)
- Sin permanencia mínima, se cancela cuando quieras, contratación por 30 días. [TERCERO]
- Su documentación no aclara cómo funciona la delegación para un integrador ni si hay entorno de pruebas aparte del plan API DEV. Habría que consultarles (api@tusfacturas.app).

#### Otras opciones que aparecieron
- **YoFacturo:** dice tener API REST "multi-tenant nativo, cada usuario con su propio CUIT y certificado". Su landing muestra un plan de punto de venta a AR$ 20.000/mes, sin precios de API. [TERCERO] [API de YoFacturo](https://yo-facturo.com/api-facturacion/) Es competidor directo de TusFacturas, así que sus comparaciones son marketing.
- **Sistemas360:** su documentación indica que el certificado es **por contribuyente** (no del proveedor) y que la delegación se hace desde el Administrador de Relaciones. No muestra precios. [TERCERO] [Producción](https://api.sistemas360.ar/en/api-documentation/production)
- **Invopop** (integración directa con WSFE) y **librerías open source** en PHP, Ruby, Python y Node. Las de PHP que encontré son de un solo CUIT por proceso. [TERCERO]
- No pude revisar Facturante, Contabilium ni Xubio. Aparecieron en mi búsqueda sin documentación de API ni precios.

### 3.3 Ventajas y riesgos de usar un intermediario

| | Ventajas | Riesgos |
|---|---|---|
| **Técnico** | Se evita implementar firma CMS, SOAP y tickets. Menos tiempo hasta el primer CAE. Se mantiene solo ante cambios del manual. | Dependés de su disponibilidad: si cae, nadie factura. Cada pedido tiene una latencia extra. |
| **Costo** | Afip SDK baja de USD 1 por profesional al mes a escala. | Cobran en dólares (Afip SDK) y los precios cambian. En TusFacturas, el costo por profesional es alto para una app gratuita. |
| **Seguridad** | No manejás la complejidad de los certificados. | Si el intermediario guarda tu certificado, tus claves o los datos de los pacientes, **sumás un tercero** a una cadena que ya incluye datos de salud. |
| **Operación** | Soporte y documentación hechos. | Migrar después a una integración directa cuesta: las facturas ya emitidas viven en su sistema y en ARCA, no en el tuyo. |
| **Automatizaciones (Afip SDK)** | Podrían quitar fricción del onboarding. | Requieren la **clave fiscal** del profesional (ver 6). |

### 3.4 Alternativa: integrar WSAA y WSFEv1 directamente
- Hay documentación completa y gratuita: manual, WSDL, clientes de ejemplo en Java, PHP, C# y PowerShell publicados por ARCA. [OFICIAL] [WSAA](https://www.arca.gob.ar/ws/documentacion/wsaa.asp)
- El costo es de ingeniería y de mantenimiento: firma, cache de TA, manejo de errores, ambiente de pruebas, cambios normativos.
- Es la opción con **costo marginal cero por profesional**, y la que conviene si honorapp crece mucho (más de unos pocos miles de profesionales activos). [INFERENCIA]

---

## 4. Qué datos del paciente hacen falta

### 4.1 Lo que exige el web service
El servicio no pide nombre ni domicilio del receptor. Pide **tipo y número de documento** (`DocTipo`, `DocNro`) y la **condición frente al IVA** (`CondicionIVAReceptorId`). [OFICIAL, manual v4.7]

Reglas de validación del manual (código 10015). **Ojo: el texto del manual las describe para comprobantes tipo B**; no encontré una regla equivalente escrita para tipo C. Tiene que confirmarse en homologación. [OFICIAL]
- Por **debajo** del monto que fija la norma, si `DocTipo = 99` entonces `DocNro` debe ser `0`. Si `DocTipo` es distinto de 99, `DocNro` debe ser mayor que 0.
- En el **monto de identificación obligatoria o por encima**, `DocTipo` no puede ser 99 y `DocNro` debe ser mayor que 0.
- Códigos de documento que el manual menciona: **80 = CUIT**, **86 = CUIL**, **87 = CDI**, **96 = DNI**, **99 = sin identificar**. La lista completa sale de `FEParamGetTiposDoc`.
- Si se informa CUIT, ARCA lo valida contra sus padrones: si está inactivo o es inválido, rechaza. [OFICIAL]

### 4.2 Cuál es el monto desde el cual hay que identificar al paciente
El manual sólo dice "monto en pesos resultante según RG 4444". La **RG 5700/2025** (Boletín Oficial del 27/05/2025, vigente desde el 29/05/2025) fijó ese umbral en **$10.000.000**: desde ese importe hay que identificar al consumidor final con CUIT, CUIL, CDI o DNI. [OFICIAL] [RG 5700/2025 en el Boletín Oficial](https://www.boletinoficial.gob.ar/pdf/aviso/primera/326006/20250530) La **RG 5866/2026** (Boletín Oficial del 29/06/2026, vigente desde el 01/07/2026) mantiene el mismo umbral. [TERCERO: texto reproducido por el Consejo Profesional de Salta] [RG 5866/2026](https://www.consejosalta.org.ar/wp-content/uploads/arca-5866.pdf) · [CPCE Córdoba](https://web.cpcecba.org.ar/arca-reorganiza-el-regimen-de-facturacion-electronica-con-la-rg-5866-a-partir-del-1-de-julio/)

Con ese umbral, ningún cobro de un consultorio llega a la identificación obligatoria. **El paciente puede facturarse como Consumidor Final sin DNI**, con una excepción importante:

- **Deducción en Ganancias:** la RG 5866/2026 dice que, si el receptor necesita el comprobante para computar una deducción en el Impuesto a las Ganancias, hay que identificarlo **con CUIT, sin importar el monto**. [TERCERO: texto reproducido por el Consejo Profesional de Salta; coincide con CPCE Córdoba] Muchos pacientes de psicólogos y otros profesionales de la salud deducen esos honorarios, así que honorapp debería preguntar "¿Vas a deducir esta factura en Ganancias?" y, si la respuesta es sí, pedir el CUIT. [INFERENCIA]

### 4.3 Condición frente al IVA del receptor: siempre enviarla
- Lo introdujo la **RG 5616/2024**, publicada el 18/12/2024. Es obligatorio informarlo en cada solicitud de CAE. [OFICIAL] [Texto de la RG 5616/2024](https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-5616-2024-407369/texto) · [Boletín Oficial](https://www.boletinoficial.gob.ar/detalleAviso/primera/318374/20241218)
- Códigos del manual: **5 = Consumidor Final**, 1 = IVA Responsable Inscripto, 4 = IVA Sujeto Exento, 6 = Responsable Monotributo, 13 = Monotributista Social, 7 = Sujeto No Categorizado, entre otros. En esta revisión no pude leer la tabla completa del anexo del manual, así que confirmá los códigos con el método `FEParamGetCondicionIvaReceptor`, que devuelve los **válidos para cada clase de comprobante**. Lo que sí está verificado: si enviás un valor que no corresponde a la clase de comprobante, ARCA rechaza (validación 10243). [OFICIAL, manual v4.8]
- **Desde cuándo rechaza: 01/12/2026.** El manual de WSFEv1 lo deja claro:
  - La **v4.0** (17/03/2025) agregó el campo y permitió enviarlo de forma **opcional desde el 06/04/2025**, hasta que entrara en vigencia la obligatoriedad de la RG 5616. [OFICIAL]
  - La **v4.8** (revisión del **01/12/2026**) lo vuelve **obligatorio** y deja en desuso los códigos 10245 (CAE) y 825 (CAEA), que hasta ahora solo observaban el comprobante. [OFICIAL] [Manual WSFEv1 v4.8](https://www.afip.gob.ar/fe/ayuda/documentos/wsfev1-RG-4291.pdf)
  - Coincide con la nota de iProfesional del 09/09/2026: ARCA notifica a los contribuyentes que el plazo de adecuación vence el 30/11/2026 y que desde el 01/12/2026 rechazará las solicitudes de CAE sin ese dato. [TERCERO] [iProfesional](https://www.iprofesional.com/impuestos/464104-nuevo-requisito-arca-puede-trabar-emision-facturas)
  - *Corrección:* la versión anterior de este documento citaba la fecha 09/06/2025 tomada del manual **WSBFEv1**, que es el web service de Bonos Fiscales, no el de facturación. Esa fecha no aplica a WSFEv1.

  **Conclusión práctica: enviá siempre el campo.** Con el paciente de un consultorio, el valor por defecto es `5`. Y tiene que viajar en el web service: tenerlo en la ficha del cliente o en el PDF no alcanza. [TERCERO]

### 4.4 Qué pedirle al paciente en honorapp

| Dato | ¿Hace falta? | Para qué |
|---|---|---|
| Nombre y apellido | Recomendado, no lo exige ARCA | Va en el PDF y en el registro del profesional |
| DNI (o CUIL/CUIT) | **Opcional** en el caso normal | Sólo si el paciente quiere factura a su nombre. **Si la necesita para deducir en Ganancias, hace falta el CUIT, sin importar el monto** (RG 5866/2026, ver 4.2). [TERCERO] |
| Condición frente al IVA | Sí, interna (por defecto Consumidor Final) | Va en `CondicionIVAReceptorId` |
| Email o WhatsApp | Opcional | Para enviarle el PDF |
| Domicilio | **No** | Ya no se pide para consumidores finales. [TERCERO] |

**Casos especiales a prever:**
- **Obra social, prepaga o empresa que paga:** hay que facturarles a ellas. Necesitás su **CUIT (`DocTipo` 80)** y su condición frente al IVA correcta, que no es Consumidor Final. Se valida contra los padrones. [INFERENCIA, a partir del manual]
- **Pacientes menores de edad:** la factura se emite a quien paga (padre, madre o tutor), con sus datos. [INFERENCIA, confirmalo con la contadora]
- **Pacientes extranjeros:** tienen códigos propios en `FEParamGetTiposDoc`. No los investigué.

---

## 5. Datos sensibles y privacidad

- **La información sobre la salud es un dato sensible** en la Ley 25.326 de Protección de Datos Personales: el art. 2 la define así y el art. 7 limita su tratamiento. [OFICIAL] [Texto de la Ley 25.326](https://www.argentina.gob.ar/normativa/nacional/64790/texto) · [Biblioteca ARCA](https://biblioteca.afip.gob.ar/dcp/LEY_C_025326_2000_10_04)
- El art. 7 también prohíbe formar archivos o registros que **directa o indirectamente** revelen datos sensibles. Y el art. 8 permite a los profesionales de la salud tratar datos de sus pacientes respetando el secreto profesional. [OFICIAL, mismo texto]
- Que **honorapp no guarde notas clínicas** reduce mucho el problema. Pero una lista de **nombres y DNI de pacientes asociados a un profesional de la salud mental** ya revela indirectamente que esa persona consulta a un psicólogo. [INFERENCIA] Cómo encaja honorapp entre los arts. 7 y 8 es una pregunta para un abogado, no una conclusión de este documento.
- El web service **no recibe el nombre del paciente** ni el servicio prestado: sólo documento (casi siempre 99/0), importes y fechas. [OFICIAL] Si honorapp pasa por un intermediario, **controlá qué datos le mandás**. Que el intermediario reciba el nombre sólo para armar el PDF sería evitable si honorapp genera su propio PDF. [INFERENCIA]
- Consultas que quedan pendientes: si honorapp debe registrar su base de datos, cómo tratar el consentimiento y qué cláusulas pedirle al intermediario. **No lo investigué.** Conviene consultar con un abogado de protección de datos antes de lanzar.

---

## 6. Riesgos específicos de pedir la clave fiscal
Algunas herramientas (por ejemplo, las automatizaciones de Afip SDK) hacen los pasos de ARCA por el profesional si les das su **clave fiscal**. Es lo que más reduce la fricción del onboarding, pero:

- Hace que honorapp custodie la credencial **más sensible** del profesional, con la que se accede a todos sus trámites con ARCA. [INFERENCIA]
- Mi recomendación es **no pedirla ni guardarla nunca**. Si se usa una automatización, que sea un uso puntual, sin almacenar. Los manuales de ARCA tratan la clave fiscal como credencial personal del contribuyente. **No verifiqué si los términos de uso de ARCA prohíben ceder la clave a un tercero**, así que confirmalo antes de ofrecer algo así.
- Es mejor un asistente que guíe al profesional paso a paso en su propia sesión de ARCA.

---

## 7. Recomendación

### 7.1 Decisión
**Integrar vía Afip SDK, con delegación a un CUIT de honorapp, detrás de una capa propia (un "proveedor de facturación") que permita cambiarlo.** Estas son las razones:

1. **Costo:** a escala, menos de USD 1 por profesional por mes. TusFacturasApp ronda $5.000 por profesional por mes, que no cierra para una app gratuita. [INFERENCIA, a partir de las tablas de la sección 3]
2. **Modelo correcto:** el flujo multi-cliente de Afip SDK coincide con la "tercerización del servicio" que describe ARCA: un certificado de honorapp, muchos CUIT que le delegan. [OFICIAL + TERCERO]
3. **Salida abierta:** si la capa propia aísla las llamadas, una migración futura a WSAA/WSFEv1 directo no obliga a que los profesionales repitan nada en ARCA, porque la delegación es a **honorapp**, no al intermediario. [INFERENCIA, y es una de las razones para no delegar al CUIT del intermediario]

### 7.2 Antes de escribir código
1. **Probar el recorrido de un profesional real.** Tomá 5 profesionales y hacé que completen: clave fiscal nivel 3 → punto de venta web service → delegación a un CUIT de prueba tuyo. Medí cuánto tardan, dónde se traban y cuántos abandonan. Tené en cuenta que el alta del punto de venta se informa con al menos 3 días hábiles de anticipación (RG 5866/2026, ver 1.3). Si el onboarding no funciona, el resto no importa.
2. **Resolver la parte legal y operativa de honorapp:**
   - Tener un CUIT, clave fiscal nivel 3 y el Administrador de Relaciones, para recibir las delegaciones. [OFICIAL]
   - Definir los términos de servicio: qué pasa si ARCA rechaza una factura, si el CAE falla o si el profesional revoca la delegación.
3. **Preguntarle a Afip SDK** (por escrito):
   - ¿Cómo cuentan los CUIT y los requests? ¿Cuántos requests consume una factura?
   - ¿Pueden operar con un certificado de honorapp para muchos CUIT delegados?
   - ¿Qué guardan de los datos de las facturas y dónde?
   - ¿Qué disponibilidad garantizan?
   - ¿Pueden facturar en pesos?
4. **Pruebas en homologación:** emitir Facturas C de prueba, forzar errores, simular cortes y confirmar el comportamiento del TA cuando se suma una delegación nueva (ver 2.2).

### 7.3 Cómo lanzarlo con poco riesgo
- **Fase 1:** honorapp registra sesiones y pagos, y ofrece un **resumen listo para facturar** (importe, fechas, datos del paciente) que el profesional carga en ARCA. Sirve para validar si de verdad lo piden.
- **Fase 2:** factura real para un grupo chico de profesionales, con la capa de proveedor y un botón "verificar conexión".
- **Fase 3:** apertura general. Se reevalúa con datos reales entre quedarse en Afip SDK o integrar directo.

### 7.4 Qué no hacer
- No pedir ni guardar claves fiscales.
- No delegar al CUIT de un intermediario, ni usar un certificado distinto por profesional si se puede evitar.
- No reintentar `FECAESolicitar` a ciegas ante un timeout.
- No olvidar `CondicionIVAReceptorId` (obligatorio desde el 01/12/2026).
- No compartir el certificado entre servidores con caches de TA separados.
- No enviar al intermediario más datos del paciente de los que necesite.

---

## 8. Lo que no pude verificar

1. **El texto de la RG 5866/2026 en el Boletín Oficial.** El sitio del Boletín no permite lectura automática; lo leí en la reproducción del Consejo Profesional de Salta y en el resumen del CPCE Córdoba. La RG 5700/2025 sí está verificada en el Boletín Oficial. No leí la RG 4444/2019.
2. **La regla DocTipo 99 / DocNro 0 para comprobantes tipo C.** El manual la describe para tipo B (validación 10015). Probalo en homologación.
3. **Los nombres exactos de las opciones de menú de ARCA** para el punto de venta y la delegación. Los PDFs oficiales muestran capturas; los nombres salen de ellos y de tutoriales de terceros.
4. **La tabla completa de códigos de condición frente al IVA del receptor** y cuáles valen para clase C. No la pude leer entera en el manual; consultala con `FEParamGetCondicionIvaReceptor`.
5. **El comportamiento del TA con múltiples CUIT delegados** (ver 2.2).
6. **Los precios de Afip SDK y TusFacturasApp pueden cambiar.** Los revisé en sus sitios el 16/10/2026. Afip SDK cobra en dólares y su FAQ no muestra respuestas.
7. **Facturante, Contabilium y Xubio:** no los pude evaluar.
8. **Requisitos de la inscripción de monotributo y del régimen de tope de facturación:** fuera del alcance de lo que investigué. El detalle técnico del QR está en el micrositio de ARCA (afip.gob.ar/fe/qr) y no lo revisé.
9. **Qué exige la Ley 25.326 en este caso concreto**, incluido el registro de bases de datos. Necesita revisión legal.
10. **Cómo trata Afip SDK las credenciales** de sus automatizaciones.
11. **Que el certificado de la autoridad certificante de ARCA sea gratuito.** Es lo habitual, pero no lo encontré escrito en las fuentes que revisé.

---

## 9. Fuentes

### Oficiales (ARCA y Estado)
- [Manual del desarrollador WSFEv1, RG 4291, v4.8 (rev. 01/12/2026), homologación externa](https://www.afip.gob.ar/fe/ayuda/documentos/wsfev1-RG-4291.pdf)
- [Manual del desarrollador WSFEv1, RG 4291, v4.7 (rev. 01/09/2026), enlazado en producción](https://www.afip.gob.ar/ws/documentacion/manuales/manual-desarrollador-ARCA-COMPG.pdf)
- [Homologación externa: manuales RG 5616/2024](https://www.afip.gob.ar/ws/documentacion/homologacion-externa.asp)
- [Web Services de Factura Electrónica (lista de servicios y manuales)](https://www.arca.gob.ar/ws/documentacion/ws-factura-electronica.asp)
- [Homologación externa y manuales de facturación](https://www.arca.gob.ar/fe/ayuda/webservice.asp)
- [Acciones a realizar para consumir un web service de factura electrónica](https://www.arca.gob.ar/fe/documentos/AccionesarealizarparaconsumirunWebservicedeFacturaElectr.pdf)
- [WSAA: página principal, endpoints y manuales](https://www.arca.gob.ar/ws/documentacion/wsaa.asp)
- [Arquitectura general de los web services](https://www.arca.gob.ar/ws/documentacion/arquitectura-general.asp)
- [Especificación técnica del WSAA 1.2.2](https://www.arca.gob.ar/ws/WSAA/Especificacion_Tecnica_WSAA_1.2.2.pdf)
- [Cómo obtener el certificado digital de producción](https://www.arca.gob.ar/ws/WSAA/wsaa_obtener_certificado_produccion.pdf)
- [Cómo asociar el certificado a un web service de negocio](https://www.arca.gob.ar/ws/WSAA/wsaa_asociar_certificado_a_wsn_produccion.pdf)
- [Delegación de web services con el Administrador de Relaciones](https://www.arca.gob.ar/ws/WSAA/ADMINREL.DelegarWS.pdf)
- [RG 5616/2024, texto oficial](https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-5616-2024-407369/texto) · [Boletín Oficial, 18/12/2024](https://www.boletinoficial.gob.ar/detalleAviso/primera/318374/20241218)
- [RG 5700/2025, Boletín Oficial](https://www.boletinoficial.gob.ar/pdf/aviso/primera/326006/20250530)
- [RG 5866/2026, Boletín Oficial (29/06/2026)](https://www.boletinoficial.gob.ar/detalleAviso/primera/343656/20260629)
- [RG 4892/2020 (código QR), Biblioteca ARCA](https://biblioteca.afip.gob.ar/dcp/REAG01004892_2020_12_22)
- [Ley 25.326 de Protección de Datos Personales](https://www.argentina.gob.ar/normativa/nacional/64790/texto) · [Biblioteca ARCA](https://biblioteca.afip.gob.ar/dcp/LEY_C_025326_2000_10_04)

### Terceros (orientativas, confirmar)
- [Afip SDK: sitio](https://afipsdk.com/) · [Precios](https://afipsdk.com/pricing) · [Automatizaciones](https://afipsdk.com/docs/automations/introduction/) · [Crear certificado de producción](https://afipsdk.com/docs/automations/create-cert-prod) · [Ir a producción](https://docs.afipsdk.com/siguientes-pasos/ir-a-produccion) · [Delegar web service](https://docs.afipsdk.com/paso-a-paso/tutoriales-pagina-de-afip/delegar-web-service) · [Crear punto de venta](https://docs.afipsdk.com/recursos/tutoriales-pagina-de-arca/crear-punto-de-venta)
- [RG 5866/2026, texto reproducido por el Consejo Profesional de Salta](https://www.consejosalta.org.ar/wp-content/uploads/arca-5866.pdf) · [Resumen del CPCE Córdoba](https://web.cpcecba.org.ar/arca-reorganiza-el-regimen-de-facturacion-electronica-con-la-rg-5866-a-partir-del-1-de-julio/)
- [TusFacturasApp: tarifas](https://www.tusfacturas.app/tarifas) · [Precios](https://www.tusfacturas.app/precios) · [Referencia de la API](https://developers.tusfacturas.app/api-factura-electronica-afip-facturacion-ventas/referencia-api-afip-arca) · [Nuevo punto de venta](https://intercom.help/tusfacturasapp/es/articles/10355011-nuevo-punto-de-venta)
- [YoFacturo: API](https://yo-facturo.com/api-facturacion/) · [Comparación con TusFacturas](https://yo-facturo.com/yofacturo-vs-tusfacturas/)
- [Sistemas360: producción](https://api.sistemas360.ar/en/api-documentation/production)
- [Blog del Contador sobre el umbral de $10 millones](https://blogdelcontador.com.ar/news-45898-arca-eleva-a-10-millones-el-limite-para-identificar-al-consumidor-final-en-comprobantes) · [Contadores en Red sobre identificación en 2026](https://contadoresenred.com/facturacion-a-partir-de-que-monto-se-debe-identificar-al-consumidor-final-en-2026/)
- [iProfesional sobre el rechazo por falta de condición IVA del receptor](https://www.iprofesional.com/impuestos/464104-nuevo-requisito-arca-puede-trabar-emision-facturas)

---

## 10. Registro de correcciones (16/10/2026)

Cambios respecto de la versión anterior, después de revisar cada fuente:

1. **Versión del manual:** se agregó la v4.8 (rev. 01/12/2026), publicada en homologación externa. Antes figuraba solo la v4.7.
2. **Fecha de rechazo sin `CondicionIVAReceptorId`:** se resolvió la contradicción. Es el 01/12/2026, según el manual v4.8. La fecha 09/06/2025 venía del manual WSBFEv1 (Bonos Fiscales) y no aplica a WSFEv1.
3. **Código de Factura C:** ahora está verificado en el manual (validación 10007).
4. **Regla DocTipo 99 / DocNro 0:** se aclaró que el manual la describe para comprobantes tipo B.
5. **RG 5700/2025:** ahora está verificada en el Boletín Oficial.
6. **RG 5866/2026:** se agregaron la identificación con CUIT para deducir en Ganancias, el momento de facturar servicios y los plazos de alta y baja de puntos de venta.
7. **QR:** se confirmó la RG 4892/2020.
8. **Afip SDK:** se reemplazó el link roto de "Otros métodos útiles" por la página de la automatización `create-cert-prod`, que pide la contraseña de la clave fiscal.
9. **TusFacturasApp:** se aclaró que los puntos de venta pueden ser de distintos CUIT y que el plan API DEV no integra con ARCA.
10. **WSAA:** se agregó que un mismo certificado no puede operar en varios equipos a la vez; el cache del TA tiene que ser compartido.
11. **Ley 25.326:** pasó de [TERCERO] a [OFICIAL] y se sumaron los arts. 7 (archivos que revelan datos sensibles de forma indirecta) y 8 (datos de salud y secreto profesional).
12. **Certificado "gratuito":** se quitó como dato [OFICIAL] porque no aparece en las fuentes revisadas; quedó en la lista de cosas sin verificar.
