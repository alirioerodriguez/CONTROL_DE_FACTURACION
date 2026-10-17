// Arma el mail mensual para la profesional (asunto, HTML y texto). Mismo estilo que docs/mails/.

export interface ResumenAviso {
  nombre: string | null
  termino: string | null
  deuda_ars: number
  deuda_usd: number
  pacientes_deben: number
  cobrado_ars: number
  cobrado_usd: number
}

const URL_APP = 'https://control-de-facturacion-eight.vercel.app'
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** Igual que formatMonto de src/lib/formato.ts: '$ 25.000,00', 'US$ 50,00' (lo controla aviso.test.ts). */
export function monto(n: number, moneda: 'ARS' | 'USD'): string {
  const [entero, dec] = Math.abs(n).toFixed(2).split('.')
  const conPuntos = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${n < 0 ? '-' : ''}${moneda === 'USD' ? 'US$' : '$'} ${conPuntos},${dec}`
}

const juntar = (ars: number, usd: number) =>
  [ars > 0 ? monto(ars, 'ARS') : '', usd > 0 ? monto(usd, 'USD') : ''].filter(Boolean).join(' y ')

const escapar = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Primer nombre, salteando «Lic.», «Dr.», «Dra.». */
function primerNombre(nombre: string | null): string {
  return nombre?.split(/\s+/).find((p) => p && !/^(lic|dr|dra)\.?$/i.test(p)) ?? ''
}

/** hoy = 'AAAA-MM-DD' del día en que se manda (el 1 del mes). Resume el mes anterior. */
export function armarAviso(r: ResumenAviso, hoy: string): { asunto: string; html: string; texto: string } {
  const [a, m] = hoy.split('-').map(Number)
  const mesAnterior = MESES[(m + 10) % 12]
  const anioAnterior = m === 1 ? a - 1 : a
  const nombre = primerNombre(r.nombre)
  const pacientes = r.pacientes_deben === 1 ? '1 paciente' : `${r.pacientes_deben} pacientes`

  const deuda = juntar(r.deuda_ars, r.deuda_usd)
  const cobrado = juntar(r.cobrado_ars, r.cobrado_usd)
  const lineaDeuda = deuda ? `Te deben ${deuda} entre ${pacientes}.` : 'Nadie te debe nada: todo al día.'
  const lineaCobrado = cobrado ? `En ${mesAnterior} cobraste ${cobrado}.` : `En ${mesAnterior} no registraste cobros.`
  const saludo = nombre ? `Hola, ${nombre}` : 'Hola'
  const boton = deuda ? 'Ver quién debe' : 'Abrir honorapp'

  const asunto = `Tu resumen de ${mesAnterior} ${anioAnterior} · honorapp`
  const texto = [
    `${saludo}:`,
    '',
    lineaDeuda,
    lineaCobrado,
    '',
    `${boton}: ${URL_APP}`,
    '',
    'Te llega porque prendiste el resumen mensual en Ajustes → Funciones opcionales. Ahí mismo lo podés apagar.',
  ].join('\n')

  const html = `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#F5F4F0;font-family:Helvetica,Arial,sans-serif;color:#1E2420">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F4F0;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border:1px solid #E3E2DB;border-radius:22px;padding:32px">
        <tr><td style="padding-bottom:24px">
          <img src="${URL_APP}/mail-logo.png" width="32" height="32" alt="honorapp" style="display:inline-block;width:32px;height:32px;border:0;border-radius:8px;vertical-align:middle;margin-right:8px"><span style="font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:22px;letter-spacing:-0.5px;color:#1E2420;vertical-align:middle">honorapp</span>
        </td></tr>
        <tr><td style="font-family:Georgia,serif;font-size:30px;line-height:1.15;padding-bottom:12px">${escapar(saludo)}</td></tr>
        <tr><td style="font-size:13px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#5D6660;padding-bottom:6px">Pendiente de cobro</td></tr>
        <tr><td style="font-size:26px;font-weight:bold;line-height:1.2;padding-bottom:4px">${escapar(deuda || 'Todo al día')}</td></tr>
        <tr><td style="font-size:16px;line-height:1.5;color:#5D6660;padding-bottom:20px">${escapar(deuda ? `Entre ${pacientes}.` : 'Nadie te debe nada.')}</td></tr>
        <tr><td style="font-size:16px;line-height:1.5;color:#5D6660;padding-bottom:24px">${escapar(lineaCobrado)}</td></tr>
        <tr><td style="padding-bottom:24px">
          <a href="${URL_APP}" style="display:inline-block;background:#557F69;color:#FFFFFF;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 28px;border-radius:999px">${boton}</a>
        </td></tr>
        <tr><td style="font-size:13px;line-height:1.5;color:#5D6660;border-top:1px solid #E3E2DB;padding-top:16px">Te llega porque prendiste el resumen mensual en Ajustes → Funciones opcionales. Ahí mismo lo podés apagar.</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`
  return { asunto, html, texto }
}
