# Facturitas + honorapp

Investigación del 18/10/2026. Fuentes: el sitio de Facturitas, su centro de ayuda y notas de prensa (al final). Lo que no pude ver sin una cuenta está marcado como **[sin verificar]**.

## Qué es Facturitas

Un facturador para ARCA: el monotributista emite la **Factura C** sin entrar a la web de ARCA, por **WhatsApp** (texto, audio o foto), desde la web o el celular, o con una **carga masiva por Excel**. También factura solo las ventas de Mercado Pago, Mercado Libre, Tienda Nube, Shopify y Ualá, y avisa cuando el monotributista se acerca al tope de su categoría.

- **Empresa:** FACTURITAS S.R.L., CUIT 33-71952900-9. Cofundadores: Agustín Zeppa, Tomás Behringer e Iván Casanova.
- **Escala que declaran:** más de 10.000 usuarios registrados y más de 500.000 facturas emitidas.
- **Cómo se conecta con ARCA:** igual que lo que habíamos planeado para honorapp (`arca.md`). El usuario **delega en ARCA el servicio "Facturación Electrónica" al CUIT de Facturitas** (Administrador de Relaciones → Nueva relación → Web Services → Facturación Electrónica) y crea un **punto de venta "Monotributo - Webservice"**. No hace falta darles la clave fiscal (el registro rápido la pide, pero es opcional).

### Precios (por mes, con 2 meses gratis si se paga el año)

| Plan | Precio | Qué incluye |
|---|---|---|
| Gratis | $ 0 | 14 días de prueba |
| WhatsApp | $ 12.499 | Comprobantes ilimitados por WhatsApp |
| Profesional | $ 28.999 | Además: **carga masiva por Excel**, integración con tiendas y billeteras, logo en la factura, soporte prioritario |

Hay un plan para contadores (varios CUIT) y un servicio para empresas que trabajan con monotributistas.

## Lo importante para conectarlo: no tiene API pública

No encontré API, webhooks ni documentación para desarrolladores, ni en el sitio ni en el centro de ayuda ni en la prensa. Hay tres puertas de entrada posibles:

1. **Carga masiva por Excel** (plan Profesional). Se baja un «modelo» desde web.facturitas.app → Facturación Masiva, se completa y se sube; Facturitas emite todas las facturas en ARCA. Las columnas exactas **[sin verificar]**: el artículo menciona fecha, descripción, precio, cantidad y condición de venta, y aparte se pueden activar «varios ítems», «fecha de vencimiento» y un **CSV resumen** al descargar lo emitido.
2. **Convenio de empresa (B2B)**, como el que tienen con RappiBoy: la empresa le manda a Facturitas los montos, y Facturitas le escribe por WhatsApp a cada monotributista para que confirme y emite la factura. Dicen que lo ofrecen «a cualquier empresa que trabaje con monotributistas». Contacto: hola@facturitas.ai.
3. **Sus integraciones** (Mercado Pago, etc.): no sirven para honorapp, que no procesa pagos.

## Cómo encaja con honorapp

honorapp ya tiene la pantalla **Para facturar**: los pagos sin Factura C con los datos que pide ARCA, y «Ya la hice» para anotar el número. Facturitas resuelve justo el paso que falta: **emitir**.

### Opción A: Excel para Facturitas (recomendada para empezar)
- En «Para facturar», un botón **«Descargar Excel para Facturitas»**: los pagos elegidos, en el formato exacto del modelo de carga masiva.
- La profesional lo sube a Facturitas y se emiten todas las facturas juntas.
- Para cerrar el círculo: **subir a honorapp el CSV resumen** que da Facturitas, y honorapp marca cada pago como facturado con su número (por fecha, monto y paciente).
- **Ventajas:** no depende de ningún acuerdo y se puede hacer en pocos días.
- **Límites:** la profesional necesita el plan Profesional de Facturitas ($ 28.999 por mes) y son dos pasos manuales (descargar y subir).

### Opción B: convenio con Facturitas
- honorapp le manda a Facturitas los pagos para facturar; Facturitas le escribe a la profesional por WhatsApp y emite. La respuesta (número de factura) vuelve a honorapp.
- **Ventajas:** la experiencia ideal, sin Excel, y la puerta a un acuerdo comercial (comisión o precio especial para quienes usan honorapp).
- **Límites:** depende de que Facturitas quiera y de cómo lo armen. Hay que escribirles.

### Opción C: emitir desde honorapp (lo de `arca.md`)
- Delegación al CUIT de honorapp, certificado propio y web services de ARCA (o Afip SDK).
- **Ventajas:** no depende de nadie.
- **Límites:** es lo más trabajoso, competís con Facturitas y honorapp pasa a ser responsable de emitir comprobantes fiscales.

**Recomendación:** hacer la **A** como función de la versión paga y, en paralelo, **escribirle a Facturitas** para explorar la **B**. Si la B sale, reemplaza a la A sin tirar nada: los datos son los mismos que ya arma «Para facturar». Dejar la C para cuando haya muchas usuarias pagas.

## Sobre la versión paga de honorapp

Hoy honorapp no tiene planes ni cobro. Para «sumarlo a la versión paga» hace falta, antes:
1. **Definir qué es pago.** Por ejemplo: Excel para Facturitas, resumen mensual por mail, recordatorios y obras sociales.
2. **Cobrar.** Suscripción con Mercado Pago (débito automático) y un campo `plan` en el perfil que habilite esas funciones.
3. **Precio.** Tiene que cerrar sumado al de Facturitas, que la profesional paga aparte salvo que haya convenio.

## Qué necesito de vos para la opción A
- **El modelo de Excel de Facturitas.** Con una cuenta (la prueba gratis alcanza), entrá a web.facturitas.app → Facturación Masiva → descargar el modelo, y pasámelo.
- **Un CSV resumen de ejemplo** (después de emitir alguna factura de prueba), para armar la importación del número.

## Fuentes
- [Sitio de Facturitas](https://www.facturitas.app/)
- [Centro de ayuda](https://help.facturitas.app/es)
- [Registro manual (delegación y punto de venta)](https://help.facturitas.app/es/articles/10596308-paso-a-paso-registro-facturitas-manual)
- [¿Tengo que compartir mi clave fiscal?](https://help.facturitas.app/es/articles/10622853-tengo-que-compartir-mi-clave-fiscal-para-usar-facturitas)
- [Facturación masiva](https://help.facturitas.app/es/articles/11439169-como-puedo-facturar-de-forma-masiva)
- [Columnas de la facturación masiva](https://help.facturitas.app/es/articles/15183458-como-agrego-columnas-a-la-facturacion-masiva)
- [Facturación automática (integraciones)](https://help.facturitas.app/es/collections/19773714-facturacion-automatica)
- [iProUP: integración con Mercado Pago y Tienda Nube](https://www.iproup.com/startups/69692-app-monotributistas-iaemitir-facturas-whatsapp-mercado-pago-tienda-nube-facturitas)
- [iProUP: facturas por WhatsApp](https://www.iproup.com/startups/52993-facturitas-la-app-que-permite-a-monotributistas-crear-facturas-a-traves-de-whatsapp)
- [iProfesional: la herramienta por WhatsApp](https://www.iprofesional.com/impuestos/425395-arca-monotributo-la-herramienta-digital-que-permite-generar-facturas-por-whatsapp)
- [ITSitio: IA que emite facturas por WhatsApp](https://www.itsitio.com/ar/inteligencia-artificial/crearon-una-ia-que-emite-facturas-por-whatsapp-y-simplifica-la-vida-de-los-monotributistas/)
- [InfoNegocios: un audio por WhatsApp y listo](https://infonegocios.info/default/un-audio-por-whatsapp-y-listo-facturitas-la-app-que-simplifica-la-facturacion-en-arca-para-monotributistas-pronto-tambien-ri-y-autonomos)
