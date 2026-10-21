// DNI y CUIL/CUIT de los pacientes: validación argentina, formato y sugerencia del CUIL a partir del DNI.
// Se guardan así: DNI solo con números ('30123456') y CUIL/CUIT con guiones ('27-30123456-4').
import type { Paciente } from './datos'

export const soloDigitos = (texto: string | null | undefined) => (texto ?? '').replace(/\D/g, '')

/** DNI válido: 7 u 8 números (con o sin puntos). */
export function dniValido(texto: string): boolean {
  return /^\d{7,8}$/.test(soloDigitos(texto))
}

/** '30123456' → '30.123.456' */
export function formatDni(texto: string | null | undefined): string {
  const d = soloDigitos(texto)
  return d ? d.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''
}

export const PREFIJOS_CUIL = ['20', '23', '24', '27', '30', '33', '34'] as const
const PESOS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]

/** Dígito verificador (módulo 11) de los 10 primeros números. 10 = no hay dígito posible con ese prefijo. */
export function digitoVerificador(diez: string): number {
  const suma = PESOS.reduce((s, peso, i) => s + peso * Number(diez[i]), 0)
  const r = 11 - (suma % 11)
  return r === 11 ? 0 : r
}

/** CUIL/CUIT válido: 11 números, prefijo conocido y dígito verificador correcto. */
export function cuilValido(texto: string): boolean {
  const d = soloDigitos(texto)
  if (!/^\d{11}$/.test(d) || !(PREFIJOS_CUIL as readonly string[]).includes(d.slice(0, 2))) return false
  const v = digitoVerificador(d.slice(0, 10))
  return v < 10 && v === Number(d[10])
}

/** '27301234564' → '27-30123456-4'. Con menos números arma lo que puede (sirve mientras se escribe). */
export function formatCuil(texto: string | null | undefined): string {
  const d = soloDigitos(texto).slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 10) return `${d.slice(0, 2)}-${d.slice(2)}`
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`
}

/**
 * CUIL que corresponde a un DNI: 20 (masculino) o 27 (femenino). Si el dígito da 10, ANSES usa el prefijo 23
 * con dígito 9 (para 20) o 4 (para 27). Devuelve null si el DNI no es válido.
 */
export function sugerirCuil(dni: string, sexo: 'M' | 'F'): string | null {
  if (!dniValido(dni)) return null
  const ocho = soloDigitos(dni).padStart(8, '0')
  const prefijo = sexo === 'M' ? '20' : '27'
  const v = digitoVerificador(prefijo + ocho)
  if (v === 10) return formatCuil(`23${ocho}${sexo === 'M' ? 9 : 4}`)
  return formatCuil(`${prefijo}${ocho}${v}`)
}

/** El CUIL de una persona lleva su DNI en el medio. false si los dos están cargados y no coinciden. */
export function cuilCoincideConDni(cuil: string, dni: string): boolean {
  const c = soloDigitos(cuil)
  const d = soloDigitos(dni)
  if (c.length !== 11 || !d) return true
  // Los CUIT de empresas (30, 33, 34) no llevan DNI.
  if (['30', '33', '34'].includes(c.slice(0, 2))) return true
  return c.slice(2, 10) === d.padStart(8, '0')
}

/** Otro paciente de la misma profesional con ese DNI (o CUIL), para avisar antes de guardar. */
export function pacienteConMismoDocumento(
  pacientes: Paciente[],
  campo: 'dni' | 'cuil_cuit',
  valor: string,
  idPropio?: string,
): Paciente | undefined {
  const buscado = soloDigitos(valor)
  if (!buscado) return undefined
  return pacientes.find((p) => p.id !== idPropio && soloDigitos(p[campo]) === buscado)
}

/** Para la búsqueda: el texto buscado (con o sin puntos y guiones) aparece en el DNI o el CUIL. */
export function coincideDocumento(p: Pick<Paciente, 'dni' | 'cuil_cuit'>, busqueda: string): boolean {
  const q = soloDigitos(busqueda)
  if (q.length < 3 || /[a-z]/i.test(busqueda)) return false
  return soloDigitos(p.dni).includes(q) || soloDigitos(p.cuil_cuit).includes(q)
}

/** 'CUIT 20-12345678-6 · DNI 12.345.678' de la profesional (vacío si no cargó ninguno). */
export function documentosProfesional(p: { dni?: string | null; cuit?: string | null } | undefined): string {
  return [p?.cuit && `CUIT ${formatCuil(p.cuit)}`, p?.dni && `DNI ${formatDni(p.dni)}`].filter(Boolean).join(' · ')
}

/** Para importar planillas: deja el DNI y el CUIL en el formato de la app si tienen la forma correcta; si no, como vinieron. */
export function normalizarDocumentos(dni: string | null, cuil: string | null): { dni: string | null; cuil_cuit: string | null } {
  return {
    dni: dni && dniValido(dni) ? soloDigitos(dni) : dni,
    cuil_cuit: cuil && soloDigitos(cuil).length === 11 ? formatCuil(cuil) : cuil,
  }
}
