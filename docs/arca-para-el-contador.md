# honorapp · Factura electrónica: resumen para revisar con un contador

Una página para llevarle a un contador antes de lanzar la factura electrónica. Preguntas al final.

## Qué hace honorapp
- Emite **Facturas C** (monotributistas) de **servicios** (concepto 2) a nombre de la profesional, con el web service
  **WSFEv1** de ARCA. Cada factura sale con su **CAE** y el PDF lleva el **código QR** (RG 4892).
- La profesional **delega** el servicio «Facturación Electrónica» al CUIT de honorapp en el Administrador de
  Relaciones de ARCA (tercerización del servicio). honorapp nunca ve ni guarda su clave fiscal; ella puede revocar
  el permiso cuando quiera.
- Usa un **punto de venta de web services** propio de la profesional (no el del facturador web de ARCA).

## Cómo arma cada factura
| Campo | Valor |
|---|---|
| Tipo | Factura C (código 11), concepto 2 (servicios) |
| Fecha | La del día en que se emite |
| Período de servicio | Del 1.º al último día del mes que se cobra (o de los meses, si junta varios pagos) |
| Vencimiento del pago | La fecha de la factura (el pago ya se recibió) |
| Receptor | El paciente: CUIT/CUIL si lo tiene, si no DNI, si no «sin identificar» (DocTipo 99) |
| Condición frente al IVA del receptor | La cargada en el paciente; por defecto Consumidor Final (5) |
| Importe | Lo cobrado; neto = total, IVA 0 (Factura C) |
| Moneda | Pesos, o dólares con la cotización que da ARCA ese día y «se cancela en la misma moneda» |
| Descripción (solo en el PDF) | «Honorarios profesionales: N sesiones de <mes>» |

Opcional: **facturar sola cada pago nuevo** apenas se registra.

## Lo que queda afuera por ahora
- Facturas a **obras sociales y prepagas** (siguen a mano).
- **Notas de crédito** para anular una factura mal hecha (se hacen en ARCA).
- Responsables inscriptos (Facturas A/B).

## Preguntas para el contador
1. ¿Hay alguna responsabilidad para honorapp (o la SAS) por emitir comprobantes en nombre de terceros con delegación?
   ¿Conviene un contrato o términos de uso específicos?
2. ¿Está bien facturar por **mes de servicio** con la fecha del día del cobro? ¿Algún caso (cobro adelantado, varios meses juntos) que convenga tratar distinto?
3. **Consumidor final sin documento:** ¿qué tope de monto aplica hoy para no identificar al receptor? (ARCA lo rechaza si se pasa; la app muestra el error).
4. **Dólares:** ¿es correcto usar la cotización que devuelve ARCA y marcar «cancela en misma moneda»?
5. ¿Qué tiene que decir sí o sí el PDF además de lo que ya tiene (emisor, CUIT, condición, receptor, período, CAE y vencimiento, QR, «ORIGINAL»)? ¿Hace falta el domicilio comercial o la fecha de inicio de actividades?
6. ¿Algo a tener en cuenta con **Ingresos Brutos** o el tope del Monotributo al automatizar la facturación?
