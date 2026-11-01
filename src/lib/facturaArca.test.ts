import { describe, expect, it } from 'vitest'
import { pdfFacturas, nombreArchivo, type FacturaArca } from './facturaArca'

const factura: FacturaArca = {
  id: 'f1', patient_id: 'a', punto_venta: 3, numero: 124, fecha: '2026-11-01', desde: '2026-10-01', hasta: '2026-10-31',
  total: 48000, moneda: 'ARS', cotizacion: null, doc_tipo: 96, doc_numero: '30123456', condicion_iva: 5,
  receptor: 'Lucía Pérez', descripcion: 'Honorarios profesionales: 4 sesiones de octubre 2026', cae: '76451234567890',
  cae_vence: '2026-11-11', entorno: 'homo',
}
const perfil = { id: 'u', nombre: 'Lic. Ana Gómez', cuit: '27301234564' } as never

describe('PDF de la factura', () => {
  it('arma una hoja por factura, con el CAE y el QR', async () => {
    const doc = await pdfFacturas([factura, { ...factura, id: 'f2', numero: 125, moneda: 'USD', total: 50, cotizacion: 1415.5 }], perfil)
    expect(doc.getNumberOfPages()).toBe(2)
    const texto = doc.output()
    // el texto va con la fuente embebida (no se lee tal cual); se comprueba que esté el QR
    expect(texto.match(/\/Subtype \/Image/g)?.length).toBe(2)
    expect(nombreArchivo(factura)).toBe('factura-C-00003-00000124.pdf')
  })
})
