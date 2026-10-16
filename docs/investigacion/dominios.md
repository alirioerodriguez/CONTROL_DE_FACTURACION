# honorapp — Disponibilidad y precios de dominios

Consulta hecha el **16/10/2026**. La disponibilidad cambia todos los días: un dominio libre hoy puede no estarlo mañana. **Si te gusta alguno, registralo pronto.**

Cómo lo verifiqué:
- **.ar y .com.ar:** buscador oficial de **NIC Argentina** (nic.ar).
- **Resto:** registros oficiales de cada extensión (consulta RDAP) y el buscador de **Porkbun**, un registrador internacional que vende al costo.
- **Precios internacionales en dólares**, tomados de Porkbun ese día. Otros registradores (Cloudflare, Namecheap) cobran parecido; compará al renovar.

---

## 0. Resumen

- **Libres y recomendados:** **honorapp.com.ar** ($8.500 por año) y **honorapp.ar** ($25.500 por año), los dos en NIC Argentina.
- **Libre como .com:** **gethonorapp.com** (USD 11,08 por año).
- **Ojo:** **honorapp.com** está **en venta** en el mercado de reventa por **USD 36.550**. **honorapp.xyz** también está tomado y lo revenden por USD 589.
- **Fijate en la renovación, no solo en el primer año:** varios dominios cuestan USD 2 el primer año y USD 26 a 29 desde el segundo.

---

## 1. Tabla de dominios

| Dominio | Estado | Primer año | Renovación anual | Dónde comprarlo |
|---|---|---|---|---|
| **honorapp.com.ar** | ✅ Libre | **$8.500** | **$8.500** | NIC Argentina |
| **honorapp.ar** | ✅ Libre | **$25.500** | **$25.500** | NIC Argentina |
| honorapp.io | ✅ Libre | USD 28,12 | USD 51,80 | Porkbun u otro registrador |
| honorapp.co | ✅ Libre | USD 15,76 | USD 31,20 | Porkbun u otro registrador |
| **Variantes** | | | | |
| gethonorapp.com | ✅ Libre | USD 11,08 | USD 11,08 | Porkbun u otro registrador |
| usehonorapp.com | ✅ Libre | ≈ USD 11 | ≈ USD 11 | Porkbun u otro registrador |
| tryhonorapp.com | ✅ Libre | ≈ USD 11 | ≈ USD 11 | Porkbun u otro registrador |
| mihonorapp.com | ✅ Libre | ≈ USD 11 | ≈ USD 11 | Porkbun u otro registrador |
| honorappar.com | ✅ Libre | ≈ USD 11 | ≈ USD 11 | Porkbun u otro registrador |
| honorapp.online | ✅ Libre | USD 1,96 | USD 28,84 | Porkbun u otro registrador |
| honorapp.site | ✅ Libre | USD 1,96 | USD 28,84 | Porkbun u otro registrador |
| honorapp.lat | ✅ Libre | USD 1,54 | USD 26,26 | Porkbun u otro registrador |
| honorapp.ai | ✅ Libre | USD 82,70 | USD 82,70 | Porkbun u otro registrador |
| honorapp.xyz | ❌ Tomado (en reventa) | USD 589 de compra + transferencia | — | Mercado de reventa |
| **Ya tomados** | | | | |
| honorapp.com | ❌ Tomado, **en venta** | USD 36.550 + transferencia | — | Afternic (reventa) |
| honorapp.app | ❌ Tomado | — | — | Registrado el 10/07/2026, apunta a Vercel |
| honorapp.net | ❌ Tomado | — | — | Registrado el 23/04/2025 |

Notas:
- Los **.com** que figuran como "≈ USD 11" dieron **libres** en el registro oficial de .com (Verisign). Tienen el mismo precio que gethonorapp.com, que sí miré en Porkbun.
- **honorapp.ai:** algunos registradores exigen registrarlo por **2 años** de una vez. Confirmalo al comprar.
- **honorapp.com** tiene los servidores de Afternic, que es un mercado de dominios en venta. El precio de reventa se puede negociar, pero hoy no tiene sentido pagarlo para una app gratuita.
- Pagar en dólares con tarjeta argentina suma los **impuestos a la compra de moneda extranjera** que correspondan.

---

## 2. Cómo registrar .com.ar y .ar en NIC Argentina

### 2.1 Qué necesitás
- **CUIT o CUIL** y **clave fiscal nivel 2 o superior**.
- El dominio queda a nombre de quien lo registra. Si vas a armar una sociedad para honorapp (pendiente de legal.md), podés registrarlo a tu nombre y **transferirlo** después ($8.500 o $25.500, según la zona).

### 2.2 Pasos
1. Entrá a **nic.ar**, escribí `honorapp`, elegí la zona (**.ar** o **.com.ar**) y tocá **Buscar**.
2. Si dice **"El dominio está disponible para registrarlo"**, tocá **Quiero registrarlo**.
3. Elegí ingresar con **CUIT/CUIL y clave fiscal**. Te lleva a **Trámites a Distancia (TAD)**.
4. En TAD tocá **Registrar**, revisá los datos y tocá **Confirmar trámite**.
5. Revisá tus **datos de facturación** y que el nombre del dominio esté bien escrito: **una vez pagado no se puede revocar**.
6. Elegí el **medio de pago**:
   - **Tarjeta de crédito** o **PagoMisCuentas**: se acredita dentro de las 24 horas.
   - **Rapipago**: se acredita dentro de las 72 horas hábiles.
7. Listo. Después hay que **delegarlo**: cargar los servidores DNS de donde esté la web (por ejemplo, Vercel o Cloudflare). NIC tiene un instructivo de delegación.

**Excepción:** si el dominio fuera de una zona especial, tuviera un término reservado o fuera un .ar de 1 a 3 letras, NIC Argentina tiene que aprobarlo antes (dentro de las 48 horas hábiles). **No es el caso de honorapp.**

### 2.3 Lo que hay que saber
- Los dominios **duran 1 año** y se renuevan cada año. Conviene activar un recordatorio: si se vence, cualquiera lo puede registrar.
- Una **disputa de dominio** cuesta $28.800, igual en todas las zonas.

Fuentes: [Dominios y aranceles de NIC Argentina](https://nic.ar/es/dominios/dominios_y_aranceles) · [Instructivo de registro de dominio](https://nic.ar/es/ayuda/instructivos/registro-de-dominio)

---

## 3. Recomendación

1. **Registrar ya `honorapp.com.ar` y `honorapp.ar`.** Entre los dos son **$34.000 por año**. Son los únicos donde la marca va limpia, sin prefijos, y son los que más confianza le dan a una profesional argentina.
2. **Usar `honorapp.com.ar` como dirección principal.** Es lo que la mayoría tipea de memoria en Argentina, y es el más barato. [INFERENCIA] `honorapp.ar` es más corto: si preferís ese como principal, `.com.ar` puede redirigir a él.
3. **Opcional: `gethonorapp.com` (USD 11,08 por año)** para tener un .com y, si algún día salís de Argentina, una dirección internacional. Redirigilo al principal.
4. **No compraría** los de USD 1-2 el primer año (.online, .site, .lat): se renuevan a USD 26-29 y no suman confianza.
5. **No pagaría** los USD 36.550 de honorapp.com.

> **Antes de lanzar con la marca**, conviene buscar "honorapp" en el **INPI** (registro de marcas). Que el dominio esté libre no significa que la marca lo esté. [INFERENCIA; no lo verifiqué]
