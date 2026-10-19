# Revisión con tres miradas (19/10/2026)

1. Un auditor de seguridad: claves expuestas, validación de datos, pagos y datos sensibles.
2. Una persona nueva que no sabe nada: dónde se trabaría.
3. Qué pasa si se corta la red a mitad de un guardado: duplicados o datos perdidos.

---

## 1. Auditoría de seguridad

### Claves expuestas en el frontend — ✅ sin problemas
- El código publicado solo trae la clave pública `anon` (lo verificamos bajando el sitio como lo haría un atacante). No hay `service_role` ni claves secretas.
- Las claves privadas (`SMTP_PASS`, `ENLACE_SECRETO`) viven solo en los secretos de las funciones de Supabase.
- Pendiente: cambiar `ENLACE_SECRETO`, porque se pegó en un chat.

### Validación de datos — ✅ con dos mejoras hechas
- La base es la última barrera y no depende de la pantalla: montos mayores a 0, monedas y estados de una lista cerrada, 31 límites de largo en los textos, y RLS en todas las tablas.
- **Corregido:** se sumaron topes de sentido común: fechas entre 2000 y 2100 (atrapa errores como «20026») y como máximo 24 horas por sesión.
- **Corregido:** si algún dato choca con una regla, ahora se ve un mensaje claro en castellano en lugar del error técnico en inglés.
- Importación: tope de 5 MB, fórmulas maliciosas neutralizadas, y todo o nada en una sola operación de la base.

### Pagos y datos sensibles — ✅ sin problemas
- honorapp **no procesa dinero**: no pide ni guarda tarjetas ni datos bancarios de pacientes; solo registra lo que la profesional ya cobró.
- No se guarda nada clínico.
- A Mis Cuentas solo viajan el mail verificado y totales por mes. Al calendario de Google solo van iniciales. El resumen mensual va al mail verificado de la cuenta.
- En el navegador solo quedan preferencias (tema, letra, último medio de pago, pacientes excluidos del reporte), nunca datos de pacientes.
- Un detalle menor: el código del link del calendario lo genera el navegador. Alguien que use la API a mano podría ponerse uno fácil de adivinar, pero solo expondría su propio calendario (con iniciales).

---

## 2. Una persona nueva que no sabe nada

Revisión de los textos y del recorrido de pantallas, pensando en alguien que entra por primera vez. Lo marcado con ✅ se corrigió.

1. ✅ **«Facturado» en el reporte del mes.** Significaba «el total de las sesiones», pero suena a facturas de ARCA, y en la misma app está «Para facturar». Ahora dice **«A cobrar»** en la pantalla, en el Excel y en el tutorial.
2. **«Mes que paga» al cargar un pago.** La idea de imputar un pago a un mes no es obvia. Ya viene sugerido, pero conviene una ayuda corta: «¿De qué mes son las sesiones que te paga?».
3. **En el celular, Contadora, Importar y Recordatorios no están en la barra de abajo.** Se llega desde «Mes» (botón «Para contadora»), Ajustes e Inicio, pero alguien nuevo puede no encontrarlos. Una opción es un botón «Más» en la barra.
4. **Ajustes es muy largo.** Tiene tarifa, profesión, letra, monotributo, funciones opcionales, calendario, Mis Cuentas, Excel, tutorial y cuenta. Convendría agruparlo en secciones con títulos (Cobros, Apariencia, Conexiones, Cuenta).
5. **«Tarifa estándar» y «personalizada».** Son palabras de la app. Una ayuda: «La estándar es tu precio de siempre; la personalizada, un precio distinto para este paciente».
6. **El tutorial tiene 18 pasos.** Está completo pero es largo. Se puede saltear y repetir; quizás convenga ofrecer una versión corta de 6 pasos al principio.
7. **Con abono mensual, cada sesión muestra «su parte» del abono** (por ejemplo $ 60.000 si hubo dos sesiones). Puede confundir: convendría un cartelito «parte del abono».
8. **«Para facturar» solo aparece en Contadora y solo si hay pagos sin factura.** Quien quiere facturar no sabe que existe hasta que la encuentra. El tutorial ya la muestra.
9. **Recordatorios marca «enviado» al tocar WhatsApp,** aunque después no se mande el mensaje. Se puede desmarcar, pero vale aclararlo.

---

## 3. Si se corta la red a mitad de un guardado

### Lo que encontramos
- Al registrar una sesión «ya pagada» se hacían **dos guardados separados** (la sesión y después el pago). Si se cortaba entre uno y otro, quedaba la sesión sin el pago; al tocar Guardar de nuevo se creaba **otra sesión duplicada**.
- Si la red se cortaba justo después de guardar (el servidor guardó, pero la respuesta no llegó), al reintentar se duplicaba la sesión, el pago o el paciente.

### Lo que se corrigió ✅
- Cada formulario crea el identificador del registro **al abrirse**. Si se reintenta, la base reconoce que ese registro ya existe y no lo crea de nuevo. Aplica a sesiones, pagos, pacientes nuevos y «Cargar sesiones del mes».
- La sesión y su pago van en el mismo envío.
- Probado en la base: dos intentos con el mismo id dejan un solo paciente, una sesión y un pago, y otra cuenta no puede usar ese id para pisar nada.
- El mensaje de corte ahora dice: «Se cortó la conexión. Revisá internet y volvé a tocar Guardar: no se duplica nada».

### Lo que ya estaba bien
- Sin conexión, la app avisa y no deja guardar.
- Mientras guarda, el botón queda deshabilitado (no se puede tocar dos veces).
- La importación es todo o nada.
- Editar y borrar se pueden repetir sin daño. El envío a Mis Cuentas y los recordatorios también: actualizan en lugar de duplicar.
- Marcar varios pagos como facturados (Para facturar) va uno por uno: si se corta a mitad, quedan algunos marcados, y volver a subir el resumen termina el resto sin duplicar.
