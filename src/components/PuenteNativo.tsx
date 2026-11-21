import { useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useDatos, useTopesMonotributo } from '../lib/datos'
import { cambiarMontosOcultos, montosOcultos, useMontosOcultos } from '../lib/discreto'
import { formatHoraAR } from '../lib/colaOffline'
import { hoyAR } from '../lib/formato'
import { shellNativo } from '../lib/puenteApp'
import { datosInicioNativo, datosPacientesNativo } from '../lib/nativoApp'

function avisar(type: string, datos: unknown) {
  try {
    ;(window as unknown as { ReactNativeWebView: { postMessage: (m: string) => void } }).ReactNativeWebView.postMessage(JSON.stringify({ type, datos }))
  } catch {
    // Sin app: nada que avisar.
  }
}

/**
 * Solo dentro de la app nueva: le pasa a la app lo que dibujan sus pantallas nativas (Inicio y Pacientes), en qué
 * pantalla está la web y si hay una hoja abierta (para no taparla), y atiende lo que se toca en ellas.
 * Las apps viejas no avisan __shellNativo y la web sigue igual que siempre.
 */
export function PuenteNativo() {
  if (!shellNativo()) return null
  return <Puente />
}

function Puente() {
  const { perfil, pacientes, sesiones, pagos, cargando } = useDatos()
  const { categorias } = useTopesMonotributo()
  const oculto = useMontosOcultos()
  const { pathname } = useLocation()
  const navegar = useNavigate()
  const qc = useQueryClient()
  const ultimo = useRef<Record<string, string>>({})

  const enviar = (type: string, datos: unknown) => {
    const txt = JSON.stringify(datos)
    if (ultimo.current[type] === txt) return
    ultimo.current[type] = txt
    avisar(type, datos)
  }

  const inicio = useMemo(() => {
    if (!perfil || cargando) return null
    return datosInicioNativo({ perfil, pacientes, sesiones, pagos, categorias }, { hoy: hoyAR(), ahora: formatHoraAR(new Date().toISOString()), oculto })
  }, [perfil, pacientes, sesiones, pagos, categorias, oculto, cargando])

  const lista = useMemo(() => {
    if (!perfil || cargando) return null
    return datosPacientesNativo({ pacientes, sesiones, pagos }, { hoy: hoyAR(), oculto })
  }, [perfil, pacientes, sesiones, pagos, oculto, cargando])

  useEffect(() => { if (inicio) enviar('inicio', inicio) })
  useEffect(() => { if (lista) enviar('pacientes', { oculto, lista }) })
  useEffect(() => { enviar('seccion', { ruta: pathname }) }, [pathname])
  // Al cerrar sesión (se desmonta), la app vuelve a mostrar la web
  useEffect(() => () => { avisar('inicio', null) }, [])

  // Hojas y ventanas de la web (registrar, Más, confirmaciones): mientras haya una, la app esconde sus pantallas
  useEffect(() => {
    let abierta: boolean | null = null
    let cuadro = 0
    const mirar = () => {
      cuadro = 0
      const hay = !!document.querySelector('[role="dialog"]')
      if (hay === abierta) return
      abierta = hay
      avisar('hoja', hay)
    }
    const obs = new MutationObserver(() => { if (!cuadro) cuadro = requestAnimationFrame(mirar) })
    obs.observe(document.body, { childList: true, subtree: true })
    mirar()
    return () => { obs.disconnect(); if (cuadro) cancelAnimationFrame(cuadro) }
  }, [])

  // Lo que pide la app
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>
    w.__irA = (ruta: string) => { if (['/', '/pacientes', '/mes', '/ajustes', '/agenda', '/recordatorios'].includes(ruta)) navegar(ruta) }
    w.__abrirPacienteDesdeApp = (id: string) => { if (pacientes.some((p) => p.id === id)) navegar(`/pacientes/${id}`) }
    w.__ocultarDesdeApp = () => cambiarMontosOcultos(!montosOcultos())
    w.__refrescarDesdeApp = async () => {
      try { await qc.refetchQueries() } finally { ultimo.current = {}; avisar('refrescado', true) }
    }
  }, [navegar, pacientes, qc])

  return null
}
