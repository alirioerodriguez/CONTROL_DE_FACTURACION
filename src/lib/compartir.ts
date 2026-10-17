// Compartir un PDF con el menú del celular (WhatsApp, mail, etc.).

export type ResultadoCompartir = 'compartido' | 'cancelado' | 'sin-soporte'

/** Devuelve 'sin-soporte' si el navegador no puede compartir archivos (la mayoría de las computadoras). */
export async function compartirPdf(blob: Blob, nombreArchivo: string, titulo: string, texto: string): Promise<ResultadoCompartir> {
  if (typeof navigator === 'undefined' || !navigator.canShare) return 'sin-soporte'
  const archivo = new File([blob], nombreArchivo, { type: 'application/pdf' })
  if (!navigator.canShare({ files: [archivo] })) return 'sin-soporte'
  try {
    await navigator.share({ files: [archivo], title: titulo, text: texto })
    return 'compartido'
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'cancelado'
    throw e
  }
}

/** Link mailto con destinatario (puede ir vacío), asunto y cuerpo. */
export function linkMail(para: string | null | undefined, asunto: string, cuerpo: string): string {
  return `mailto:${encodeURIComponent(para ?? '')}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`
}
