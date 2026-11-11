# Factura electrónica con ARCA: puesta en marcha

honorapp hace la Factura C por la profesional con el web service WSFEv1 de ARCA. La profesional **delega**
«Facturación Electrónica» al CUIT de honorapp (Administrador de Relaciones) y crea un punto de venta de web
services; honorapp entra con **su** certificado. Nunca se pide ni se guarda la clave fiscal.
Detalle técnico y fuentes: `docs/investigacion/arca.md`.

| Pieza | Dónde |
|---|---|
| Mensajes de ARCA (WSAA, WSFEv1, QR) | `supabase/functions/arca-factura/wsfe.ts` (pruebas: `src/lib/wsfe.test.ts`) |
| Función que habla con ARCA | `supabase/functions/arca-factura/index.ts` (`probar` y `emitir`) |
| Tablas | `supabase/schema.sql`: `facturas_arca`, `arca_tickets`, columnas `arca_*` en profiles y `cae`/`factura_id` en payments |
| Mail del día 1 a la contadora | `supabase/functions/facturas-contadora` (tabla + planilla CSV; pruebas: `src/lib/mailContadora.test.ts`) |
| Pantallas | Ajustes → «Facturar con ARCA» (`ArcaAjustes.tsx`); Para facturar (`FacturarConArca.tsx`) |
| PDF con QR | `src/lib/facturaArca.ts` |

## 1. Probar en homologación (ARCA de prueba, sin validez fiscal)
1. Clave y pedido de certificado (en la compu, una vez):
   ```bash
   openssl genrsa -out honorapp.key 2048
   openssl req -new -key honorapp.key -subj "/C=AR/O=honorapp/CN=honorapp/serialNumber=CUIT 20XXXXXXXXX" -out honorapp.csr
   ```
2. En ARCA, con la clave fiscal de quien tenga el CUIT: **WSASS – Autogestión Certificados Homologación** → nuevo
   certificado con el `.csr` → bajar el `.crt` → «Crear autorización a servicio» para **wsfe**.
3. Secretos de la función (Supabase → Edge Functions → Secrets): `ARCA_ENTORNO=homo`, `ARCA_CERT` (contenido del
   `.crt`) y `ARCA_KEY` (contenido del `.key`). **El `.key` no se sube a GitHub ni se manda por chat.**
4. Desplegar: `supabase functions deploy arca-factura` y `supabase functions deploy facturas-contadora --no-verify-jwt`
   (la segunda la llama pg_cron el día 1 y usa el mismo secreto `SMTP_PASS` que `aviso-mensual`).
5. En Vercel: `VITE_ARCA_CUIT` con el CUIT de honorapp. En homologación se puede probar con el mismo CUIT del
   certificado como profesional (sin delegar) y un punto de venta cualquiera.
6. En la app: Ajustes → Facturar con ARCA → número de punto de venta → **Conectar**. Después, en Para facturar,
   **Hacer Factura C**. Las facturas de prueba salen marcadas «PRUEBA · SIN VALIDEZ FISCAL».

## 2. Producción
1. CUIT de honorapp (idealmente la SAS) con clave fiscal nivel 3.
2. **Administración de Certificados Digitales** (producción) → alias → subir un `.csr` nuevo → bajar el `.crt`.
3. **Administrador de Relaciones** → asociar el certificado («computador fiscal») al servicio de Facturación Electrónica.
4. Secretos con `ARCA_ENTORNO=prod` y el certificado de producción.
5. Por cada profesional que delega: aceptar la designación en el Administrador de Relaciones y asignarle el
   computador fiscal (ver la sección 2 de `docs/investigacion/arca.md`). Automatizarlo queda para después.

## Pendiente antes de producción
- Probar todo el circuito en homologación (no se pudo desde el entorno donde se programó: ARCA estaba bloqueado).
- Revisar con un contador: responsabilidad de emitir por terceros y textos del PDF.
- Facturas a obras sociales: siguen a mano (falta guardar el CUIT de la obra social).
