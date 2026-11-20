// Lo que muestran los widgets de la pantalla de inicio del celular (app de mobile/): cobros del mes, quién debe,
// la agenda de hoy y el monotributo. La web hace las cuentas y le manda a la app los textos ya escritos, así las
// cifras nunca difieren de la pantalla. Respeta «ocultar montos».
// Sin nombres de pacientes (decisión de Alirio, 20/11/2026): la pantalla de inicio la ve cualquiera que tenga el celular en la mano.
// «Te deben» lleva el total y cuántos pacientes; «Hoy», solo los horarios.
// Lógica pura: se prueba en widgetsApp.test.ts.
import type { Paciente, Pago, Perfil, Sesion } from './datos'
import { estadoVisible } from './estados'
import { formatCompacto, formatMonto, nombreMes, periodoDe, type Moneda } from './formato'
import { resumenMes } from './inicio'
import { controlTope, proximaRecategorizacion, type CategoriaTope } from './monotributo'
import { saldosDe } from './resumen'

export interface Turno { hora: string; nombre: string; hecho: boolean; proxima: boolean; enMin: number | null } // nombre: siempre «Sesión», nunca el paciente

export interface DatosWidgets {
  oculto: boolean
  mes: string // «noviembre»
  actualizado: string // «14:05»
  cobros: { cobrado: string; esperado: string; deben: string; pct: number; usd: string | null }
  deben: { total: string; cantidad: number; variosMeses: number; lista: [] }
  hoy: { dia: string; total: number; faltan: number; turnos: Turno[] }
  mono: { categoria: string; cobrado: string; tope: string; pct: number; estado: 'bien' | 'cerca' | 'pasado'; recat: string } | null
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const OCULTO = '•••••'

const minutos = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function datosWidgets(
  args: {
    perfil: Perfil
    pacientes: Paciente[]
    sesiones: Sesion[]
    pagos: Pago[]
    categorias?: readonly CategoriaTope[]
  },
  opciones: { hoy: string; ahora: string; oculto: boolean },
): DatosWidgets {
  const { perfil, pacientes, sesiones, pagos } = args
  const { hoy, ahora, oculto } = opciones
  // En el widget no entran los centavos: «$ 45.000» en lugar de «$ 45.000,00» (si no son redondos, van)
  const m = (n: number, moneda: Moneda = 'ARS') => (oculto ? OCULTO : formatMonto(n, moneda).replace(/,00$/, ''))
  const periodo = periodoDe(hoy)

  // Cobros del mes (en pesos; los dólares aparte)
  const r = resumenMes(periodo, pacientes, sesiones, pagos, hoy)
  const esperado = r.cobrado.ARS + Math.max(0, r.pendiente.ARS) + r.programado.ARS

  // Quién debe (en pesos), de lo que más debe a lo que menos
  const deudores: { valor: number; variosMeses: boolean }[] = []
  for (const p of pacientes) {
    const s = saldosDe(p.id, sesiones, pagos, hoy).find((x) => x.moneda === 'ARS')
    if (!s || s.saldo <= 0) continue
    const impagos = s.meses.filter((x) => x.pendiente > 0).map((x) => x.periodo)
    deudores.push({ valor: s.saldo, variosMeses: impagos.length > 1 })
  }
  const totalDeben = deudores.reduce((a, d) => a + d.valor, 0)

  // Agenda de hoy
  const deHoy = sesiones
    .filter((s) => s.fecha === hoy && estadoVisible(s, hoy) !== 'cancelada')
    .sort((a, b) => (a.hora ?? '99').localeCompare(b.hora ?? '99'))
  const ya = minutos(ahora)
  let proximaMarcada = false
  const turnos: Turno[] = deHoy.map((s) => {
    const hecho = !!s.hora && minutos(s.hora.slice(0, 5)) + Math.round(s.horas * 60) <= ya
    const proxima = !hecho && !proximaMarcada
    if (proxima) proximaMarcada = true
    const enMin = proxima && s.hora ? minutos(s.hora.slice(0, 5)) - ya : null
    return { hora: s.hora ? s.hora.slice(0, 5) : '—', nombre: 'Sesión', hecho, proxima, enMin: enMin != null && enMin > 0 ? enMin : null }
  })
  const [, mm, dd] = hoy.split('-').map(Number)
  const diaSemana = new Date(Date.UTC(Number(hoy.slice(0, 4)), mm - 1, dd)).getUTCDay()

  // Monotributo (si lo usa)
  let mono: DatosWidgets['mono'] = null
  const cat = perfil.monotributo_categoria
  if (cat && cat !== 'no') {
    const c = controlTope(pagos, cat, perfil.tipo_cambio_usd, hoy, args.categorias)
    if (c.elegida && c.estado !== 'fuera') {
      mono = {
        categoria: c.elegida.letra,
        cobrado: oculto ? OCULTO : formatCompacto(c.total, 'ARS') || '$ 0',
        tope: formatCompacto(c.elegida.tope, 'ARS'),
        pct: Math.round((c.uso ?? 0) * 100),
        estado: c.estado as 'bien' | 'cerca' | 'pasado',
        recat: nombreMes(proximaRecategorizacion(hoy).mes),
      }
    }
  }

  return {
    oculto,
    mes: nombreMes(periodo),
    actualizado: ahora,
    cobros: {
      cobrado: m(r.cobrado.ARS),
      esperado: m(esperado),
      deben: m(totalDeben),
      pct: esperado > 0 ? Math.min(100, Math.round((r.cobrado.ARS / esperado) * 100)) : 0,
      usd: r.cobrado.USD > 0 ? m(r.cobrado.USD, 'USD') : null,
    },
    deben: {
      total: m(totalDeben),
      cantidad: deudores.length,
      variosMeses: deudores.filter((d) => d.variosMeses).length,
      lista: [],
    },
    hoy: { dia: `${DIAS[diaSemana]} ${dd}`, total: turnos.length, faltan: turnos.filter((t) => !t.hecho).length, turnos: turnos.slice(0, 6) },
    mono,
  }
}
