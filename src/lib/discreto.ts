// «Ocultar montos»: para abrir la app frente al paciente sin que vea lo cobrado.
// Solo cambia lo que se ve en pantalla. Los mensajes de WhatsApp, lo que se copia para ARCA,
// los PDF y los Excel siguen usando formatMonto con el monto real.
import { useSyncExternalStore } from 'react'
import { formatMonto, partesMonto, type Moneda } from './formato'
import { guardarPreferencia, preferencia } from './tema'

let oculto = preferencia<string>('ocultar_montos', '0') === '1'
const avisos = new Set<() => void>()

export function montosOcultos(): boolean {
  return oculto
}

export function cambiarMontosOcultos(valor: boolean) {
  oculto = valor
  guardarPreferencia('ocultar_montos', valor ? '1' : '0')
  avisos.forEach((f) => f())
}

export function useMontosOcultos(): boolean {
  return useSyncExternalStore(
    (f) => {
      avisos.add(f)
      return () => avisos.delete(f)
    },
    () => oculto,
  )
}

const TAPADO = '•••••'
const prefijo = (moneda: Moneda) => (moneda === 'USD' ? 'US$' : '$')

/** Como formatMonto, pero tapa el número si la profesional ocultó los montos. Solo para mostrar. */
export function verMonto(monto: number, moneda: Moneda): string {
  return oculto ? `${prefijo(moneda)} ${TAPADO}` : formatMonto(monto, moneda)
}

/** Como partesMonto, pero tapada si los montos están ocultos. */
export function verPartes(monto: number, moneda: Moneda): { entero: string; decimales: string } {
  return oculto ? { entero: `${prefijo(moneda)} ${TAPADO}`, decimales: '' } : partesMonto(monto, moneda)
}
