// Términos fiscales y administrativos por país (Argentina, Uruguay y Chile).
// Desacopla las etiquetas visibles («ARCA / Monotributo», «DNI», «CUIT», «Obras sociales») sin tocar el modelo de cobro.

export type Pais = 'AR' | 'UY' | 'CL'

export const PAISES: { v: Pais; l: string }[] = [
  { v: 'AR', l: 'Argentina' },
  { v: 'UY', l: 'Uruguay' },
  { v: 'CL', l: 'Chile' },
]

export interface TerminosPais {
  pais: Pais
  nombrePais: string
  /** Organismo recaudador: 'ARCA' | 'DGI' | 'SII' */
  organismo: string
  /** Régimen habitual: 'Monotributo' | 'Servicios personales' | 'Boletas de honorarios' */
  regimen: string
  regimenMinus: string
  /** Comprobante: 'Factura C' | 'e-Ticket / e-Factura' | 'Boleta de honorarios' */
  comprobante: string
  /** Documento personal: 'DNI' | 'CI' | 'RUT' */
  docPersonal: string
  /** Identificación fiscal de la profesional: 'CUIT' | 'RUT' */
  docFiscal: string
  /** Identificación fiscal del paciente: 'CUIL / CUIT' | 'RUT' */
  docPaciente: string
  /** Cobertura de salud: 'Obra social o prepaga' | 'Mutualista o seguro' | 'Fonasa o Isapre' */
  cobertura: string
  coberturaPlural: string
  /** Ejemplo para el campo de datos de pago en Ajustes. */
  datosPagoEjemplo: string
  /** Solo Argentina usa la escala A–K de ARCA y el asistente de Factura C. */
  usaTopesMonotributo: boolean
  usaFacturarArca: boolean
}

const POR_PAIS: Record<Pais, TerminosPais> = {
  AR: {
    pais: 'AR',
    nombrePais: 'Argentina',
    organismo: 'ARCA',
    regimen: 'Monotributo',
    regimenMinus: 'monotributo',
    comprobante: 'Factura C',
    docPersonal: 'DNI',
    docFiscal: 'CUIT',
    docPaciente: 'CUIL / CUIT',
    cobertura: 'Obra social o prepaga',
    coberturaPlural: 'Obras sociales y prepagas',
    datosPagoEjemplo: 'Alias, CBU o link de Mercado Pago',
    usaTopesMonotributo: true,
    usaFacturarArca: true,
  },
  UY: {
    pais: 'UY',
    nombrePais: 'Uruguay',
    organismo: 'DGI',
    regimen: 'Servicios personales',
    regimenMinus: 'servicios personales',
    comprobante: 'e-Ticket / e-Factura',
    docPersonal: 'CI',
    docFiscal: 'RUT',
    docPaciente: 'RUT',
    cobertura: 'Mutualista o seguro',
    coberturaPlural: 'Mutualistas y seguros',
    datosPagoEjemplo: 'Cuenta bancaria o link de Mercado Pago',
    usaTopesMonotributo: false,
    usaFacturarArca: false,
  },
  CL: {
    pais: 'CL',
    nombrePais: 'Chile',
    organismo: 'SII',
    regimen: 'Boletas de honorarios',
    regimenMinus: 'boletas de honorarios',
    comprobante: 'Boleta de honorarios',
    docPersonal: 'RUT',
    docFiscal: 'RUT',
    docPaciente: 'RUT',
    cobertura: 'Fonasa o Isapre',
    coberturaPlural: 'Fonasa e Isapres',
    datosPagoEjemplo: 'Datos de cuenta bancaria o link de pago',
    usaTopesMonotributo: false,
    usaFacturarArca: false,
  },
}

export function terminosPais(pais?: Pais | string | null): TerminosPais {
  if (pais === 'UY') return POR_PAIS.UY
  if (pais === 'CL') return POR_PAIS.CL
  return POR_PAIS.AR
}
