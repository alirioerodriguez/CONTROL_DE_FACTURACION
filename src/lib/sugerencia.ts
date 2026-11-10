// «Queremos escucharte»: arma la sugerencia que se manda al panel de Alirio (App de apps, api/sugerir).
// Las mismas reglas que valida el panel, para avisar antes de mandar.

export const SUGERIR_URL = 'https://app-de-apps-alirio.vercel.app/api/sugerir'
export type TipoSugerencia = 'idea' | 'problema' | 'otra'

export function armarSugerencia(d: { tipo: TipoSugerencia; texto: string; mail: string; web: string }):
  | { cuerpo: { app: 'honorapp'; tipo: TipoSugerencia; texto: string; mail: string | null; web: string; version: string } }
  | { error: string } {
  const texto = d.texto.trim()
  const mail = d.mail.trim()
  if (texto.length < 3) return { error: 'Escribí un poco más, así entendemos qué nos querés contar.' }
  if (texto.length > 2000) return { error: 'Es muy largo: hasta 2000 letras.' }
  if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return { error: 'Revisá el mail: tiene que ser como nombre@ejemplo.com.' }
  return { cuerpo: { app: 'honorapp', tipo: d.tipo, texto, mail: mail || null, web: d.web, version: 'web' } }
}
