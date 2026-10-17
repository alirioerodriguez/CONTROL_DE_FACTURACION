# Ideas y sugerencias para más adelante

Cosas charladas que quedaron anotadas para hacer cuando haga falta. No están en la app.

## Aumento de honorarios en lote
Con la inflación, cada tantos meses se suben las tarifas. Idea: en Ajustes, «Aumentar honorarios»: un porcentaje (por ejemplo +10 %) y desde qué fecha. Se actualizan la tarifa estándar y las personalizadas que se elijan; las sesiones ya cargadas conservan su precio (como hoy cuando se cambia la tarifa a mano). Mostrar antes de confirmar cómo queda cada paciente.

## Doble factor (MFA)
Además de la contraseña, un código de 6 números de una app del celular (Google Authenticator, Authy). Supabase lo trae (TOTP). Hacerlo optativo, desde Ajustes, con un paso a paso muy simple para gente mayor. Cuando esté, sumar la política de RLS restrictiva que exige sesión `aal2` a quien tenga un factor verificado.

## Facturación electrónica desde la app (ARCA)
Ver `docs/investigacion/arca.md`. Hoy está el «Resumen para facturar» (datos listos para cargar en ARCA y marcar como facturado). El paso siguiente es emitir la Factura C desde la app con delegación del servicio a un CUIT de honorapp.

## Recordatorios automáticos por WhatsApp
Ver `docs/investigacion/whatsapp.md`. Hoy el recordatorio se abre en el WhatsApp de la profesional y lo manda ella. La versión automática necesita la API oficial de Meta y tiene costo por mensaje.

## Proyecto de producción
Cuando el abogado confirme dónde pueden guardarse los datos (`docs/investigacion/legal.md`): crear el proyecto de Supabase de producción (quizás en la Unión Europea), copias de seguridad cifradas con un rol de solo lectura, y la tabla de supresiones para reaplicar borrados después de restaurar una copia.
