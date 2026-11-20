import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDatos, useTopesMonotributo } from '../lib/datos'
import { useMontosOcultos } from '../lib/discreto'
import { formatHoraAR } from '../lib/colaOffline'
import { hoyAR } from '../lib/formato'
import { enLaApp } from '../lib/puenteApp'
import { preferencia } from '../lib/tema'
import { datosWidgets } from '../lib/widgetsApp'
import { useRegistro } from '../features/registro/RegistroContext'

/** Preferencia: en los widgets, solo las iniciales de los pacientes (se cambia en Ajustes). */
export const CLAVE_WIDGET_INICIALES = 'widget_iniciales'
/** Se dispara al cambiar esa preferencia, para volver a mandar los datos. */
export const EVENTO_WIDGETS = 'honorapp:widgets'

type Accion = 'sesion' | 'pago' | 'comprobante' | 'deben' | 'agenda' | 'inicio'
const ACCIONES: Accion[] = ['sesion', 'pago', 'comprobante', 'deben', 'agenda', 'inicio']

function enviar(datos: unknown) {
  try {
    ;(window as unknown as { ReactNativeWebView: { postMessage: (m: string) => void } }).ReactNativeWebView.postMessage(
      JSON.stringify({ type: 'widget', datos }),
    )
  } catch {
    // Sin app: nada que avisar.
  }
}

/**
 * Solo dentro de la app del celular: le manda a la app lo que muestran los widgets de la pantalla de inicio
 * (ver mobile/widget) y atiende lo que se toca en ellos (honorapp://sesion, pago, comprobante, deben, agenda).
 */
export function PuenteWidgets() {
  if (!enLaApp()) return null
  return <Puente />
}

function Puente() {
  const { perfil, pacientes, sesiones, pagos, cargando } = useDatos()
  const { categorias } = useTopesMonotributo()
  const oculto = useMontosOcultos()
  const navegar = useNavigate()
  const { abrir } = useRegistro()
  const ultimo = useRef('')
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const f = () => setVersion((v) => v + 1)
    window.addEventListener(EVENTO_WIDGETS, f)
    return () => window.removeEventListener(EVENTO_WIDGETS, f)
  }, [])

  const datos = useMemo(() => {
    if (!perfil || cargando) return null
    return datosWidgets(
      { perfil, pacientes, sesiones, pagos, categorias },
      { hoy: hoyAR(), ahora: formatHoraAR(new Date().toISOString()), oculto, iniciales: preferencia<string>(CLAVE_WIDGET_INICIALES, '0') === '1' },
    )
    // version: se vuelve a calcular cuando cambia «solo iniciales»
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil, pacientes, sesiones, pagos, categorias, oculto, cargando, version])

  useEffect(() => {
    if (!datos) return
    // Sin la hora: si solo cambió el reloj, no hace falta volver a dibujar los widgets
    const clave = JSON.stringify({ ...datos, actualizado: '' })
    if (clave === ultimo.current) return
    ultimo.current = clave
    enviar(datos)
  }, [datos])

  // Al cerrar sesión (se desmonta), los widgets piden abrir la app.
  useEffect(() => () => enviar(null), [])

  // Lo que se toca en un widget: la app llama a __accionDesdeApp, o abre la página con ?accion=… si estaba cerrada.
  useEffect(() => {
    const correr = (a: string) => {
      if (!ACCIONES.includes(a as Accion)) return
      if (a === 'sesion') abrir({ modo: 'sesion' })
      else if (a === 'pago') abrir({ modo: 'pago' })
      else if (a === 'comprobante') abrir({ modo: 'pago', pegar: true })
      // Recordatorios es opcional (Ajustes): si está apagado, Inicio tiene la lista de lo que falta cobrar
      else if (a === 'deben') navegar(perfil?.ver_recordatorios ? '/recordatorios' : '/')
      else if (a === 'agenda') navegar('/agenda')
      else navegar('/')
    }
    ;(window as unknown as { __accionDesdeApp: unknown }).__accionDesdeApp = correr
    const url = new URL(window.location.href)
    const a = url.searchParams.get('accion')
    if (a && !cargando) {
      url.searchParams.delete('accion')
      window.history.replaceState(null, '', url.pathname + url.search + url.hash)
      correr(a)
    }
  }, [abrir, navegar, cargando, perfil?.ver_recordatorios])

  return null
}
