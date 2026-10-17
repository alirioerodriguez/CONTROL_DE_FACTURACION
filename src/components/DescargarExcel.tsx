import { useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { useDatos } from '../lib/datos'
import { mensajeError } from '../lib/supabase'
import { Boton } from './ui'

/**
 * "Descargar Excel": sin datos, baja la plantilla vacía para completar;
 * con datos, baja una planilla con el mismo formato y lo ya cargado.
 * En los dos casos se puede completar y volver a subir desde Importar
 * (lo que ya estaba no se duplica).
 */
export function DescargarExcel({
  vacia,
  etiqueta = 'Descargar Excel',
  soloIcono,
  className = '',
  alto,
  ...resto
}: {
  /** true: siempre la plantilla vacía. */
  vacia?: boolean
  etiqueta?: string
  soloIcono?: boolean
  className?: string
  alto?: string
  'data-tour'?: string
}) {
  const { perfil, pacientes, sesionesGuardadas: sesiones, pagos } = useDatos()
  const [cargando, setCargando] = useState(false)

  async function descargar() {
    if (vacia || pacientes.length === 0) {
      const a = document.createElement('a')
      a.href = '/plantilla-cobros.xlsx'
      a.download = 'plantilla-honorapp.xlsx'
      a.click()
      toast.success('Planilla descargada: completala y subila en Importar')
      return
    }
    setCargando(true)
    try {
      const { exportarBackup } = await import('../lib/exportar')
      await exportarBackup(perfil, pacientes, sesiones, pagos)
      toast.success('Excel descargado con tus datos')
    } catch (e) {
      toast.error(`No se pudo descargar: ${mensajeError(e)}`)
    } finally {
      setCargando(false)
    }
  }

  return (
    <Boton
      variante="borde"
      icono={Download}
      alto={alto}
      cargando={cargando}
      onClick={descargar}
      aria-label={etiqueta}
      title={etiqueta}
      className={className}
      {...resto}
    >
      {soloIcono ? <span className="hidden md:inline">{etiqueta}</span> : etiqueta}
    </Boton>
  )
}
