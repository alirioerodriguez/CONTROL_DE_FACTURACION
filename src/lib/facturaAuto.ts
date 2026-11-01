// Facturación automática: cuando la profesional lo activa (Ajustes → Facturar con ARCA), cada pago nuevo
// se factura solo en ARCA apenas se registra, y avisa con el número o con el motivo si ARCA no la aceptó.
import { toast } from 'sonner'
import type { Pago } from './datos'
import { emitirFacturas } from './facturaArca'
import { formatPeriodo } from './formato'

export async function facturarSolos(pagos: Pago[], alTerminar: () => void) {
  try {
    const r = await emitirFacturas(pagos.map((p) => ({ pagos: [p.id], descripcion: `Honorarios profesionales de ${formatPeriodo(p.periodo)}` })))
    r.forEach((x) => (x.ok ? toast.success(`Factura ${x.numero} hecha sola en ARCA`) : toast.error(`La factura automática no salió: ${x.error}. Hacela desde Para facturar.`)))
  } catch (e) {
    toast.error(`La factura automática no salió: ${e instanceof Error ? e.message : String(e)}. Hacela desde Para facturar.`)
  } finally {
    alTerminar()
  }
}
