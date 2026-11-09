import { describe, expect, it } from 'vitest'
import { PAISES, terminosPais } from './pais'

describe('términos por país (Argentina, Uruguay y Chile)', () => {
  it('usa Argentina por defecto para cuentas existentes y conserva todas sus etiquetas', () => {
    expect(PAISES.map((p) => p.v)).toEqual(['AR', 'UY', 'CL'])
    const ar = terminosPais()
    expect(ar).toMatchObject({
      pais: 'AR',
      organismo: 'ARCA',
      regimen: 'Monotributo',
      comprobante: 'Factura C',
      docPersonal: 'DNI',
      docFiscal: 'CUIT',
      docPaciente: 'CUIL / CUIT',
      coberturaPlural: 'Obras sociales y prepagas',
      usaTopesMonotributo: true,
      usaFacturarArca: true,
    })
  })

  it('devuelve las etiquetas de DGI / Servicios personales para Uruguay', () => {
    const uy = terminosPais('UY')
    expect(uy).toMatchObject({
      pais: 'UY',
      organismo: 'DGI',
      regimen: 'Servicios personales',
      comprobante: 'e-Ticket / e-Factura',
      docPersonal: 'CI',
      docFiscal: 'RUT',
      docPaciente: 'RUT',
      coberturaPlural: 'Mutualistas y seguros',
      usaTopesMonotributo: false,
      usaFacturarArca: false,
    })
  })

  it('devuelve las etiquetas de SII / Boletas de honorarios para Chile', () => {
    const cl = terminosPais('CL')
    expect(cl).toMatchObject({
      pais: 'CL',
      organismo: 'SII',
      regimen: 'Boletas de honorarios',
      comprobante: 'Boleta de honorarios',
      docPersonal: 'RUT',
      docFiscal: 'RUT',
      docPaciente: 'RUT',
      coberturaPlural: 'Fonasa e Isapres',
      usaTopesMonotributo: false,
      usaFacturarArca: false,
    })
  })
})
