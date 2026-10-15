import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import type { Paciente, Pago, Sesion } from '../../lib/datos'
import { PacienteHoja } from './PacienteHoja'
import { RegistroHoja } from './RegistroHoja'

export type Apertura =
  | { modo: 'sesion' | 'pago'; pacienteId?: string }
  | { modo: 'editar-sesion'; sesion: Sesion }
  | { modo: 'editar-pago'; pago: Pago }
  | { modo: 'paciente'; paciente?: Paciente }

interface RegistroApi {
  abrir: (a: Apertura) => void
  abierto: boolean
}

/** Cambia cuando hay que reiniciar el formulario (otro modo u otro registro). */
function claveDe(a: Apertura): string {
  if (a.modo === 'editar-sesion') return a.sesion.id
  if (a.modo === 'editar-pago') return a.pago.id
  return a.modo
}

const Ctx = createContext<RegistroApi | null>(null)

/** Maneja el panel de "Registrar" desde cualquier pantalla. */
export function RegistroProvider({ children }: { children: ReactNode }) {
  const [apertura, setApertura] = useState<Apertura | null>(null)
  const cerrar = useCallback(() => setApertura(null), [])

  return (
    <Ctx.Provider value={{ abrir: setApertura, abierto: apertura !== null }}>
      {children}
      {apertura?.modo === 'paciente' && <PacienteHoja paciente={apertura.paciente} onCerrar={cerrar} />}
      {apertura && apertura.modo !== 'paciente' && (
        <RegistroHoja key={claveDe(apertura)} apertura={apertura} onCerrar={cerrar} onCambiarModo={setApertura} />
      )}
    </Ctx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRegistro() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useRegistro fuera de RegistroProvider')
  return ctx
}
