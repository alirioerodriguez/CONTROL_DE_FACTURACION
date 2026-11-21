// Lo que dibujan las pantallas nativas de la app del celular (mobile/nativo.tsx): Inicio y Pacientes.
// La web hace las cuentas y le pasa a la app los textos ya escritos, así las cifras nunca difieren de la web.
// A diferencia de los widgets, acá sí van los nombres de los pacientes: es la app abierta, como la web.
// Respeta «ocultar montos». Lógica pura: se prueba en nativoApp.test.ts.
import { nombreCompleto, type Paciente, type Pago, type Perfil, type Sesion } from './datos'
import { estadoVisible } from './estados'
import { formatMonto } from './formato'
import { saldosDe } from './resumen'
import { datosWidgets, type DatosWidgets } from './widgetsApp'
import type { CategoriaTope } from './monotributo'

export interface TurnoNativo { hora: string; paciente: string; pacienteId: string; hecho: boolean; proxima: boolean }
export interface DeudorNativo { id: string; nombre: string; monto: string; variosMeses: boolean }

export interface InicioNativo {
  nombre: string
  mes: string
  oculto: boolean
  cobros: DatosWidgets['cobros']
  hoy: { dia: string; total: number; turnos: TurnoNativo[] }
  deben: { total: string; cantidad: number; lista: DeudorNativo[] }
  mono: DatosWidgets['mono']
}

export interface PacienteNativo { id: string; nombre: string; sub: string; saldo: string | null; debe: boolean; activo: boolean }

const OCULTO = '•••••'

interface Args { perfil: Perfil; pacientes: Paciente[]; sesiones: Sesion[]; pagos: Pago[]; categorias?: readonly CategoriaTope[] }
interface Opciones { hoy: string; ahora: string; oculto: boolean }

const monto = (n: number, moneda: 'ARS' | 'USD', oculto: boolean) =>
  oculto ? `${moneda === 'USD' ? 'US$' : '$'} ${OCULTO}` : formatMonto(n, moneda).replace(/,00$/, '')

export function datosInicioNativo(args: Args, op: Opciones): InicioNativo {
  const w = datosWidgets(args, op)
  const porId = new Map(args.pacientes.map((p) => [p.id, p]))
  // Los turnos de hoy, en el mismo orden y con el mismo estado que los widgets, pero con el nombre
  const deHoy = args.sesiones
    .filter((s) => s.fecha === op.hoy && estadoVisible(s, op.hoy) !== 'cancelada')
    .sort((a, b) => (a.hora ?? '99').localeCompare(b.hora ?? '99'))
  const turnos: TurnoNativo[] = w.hoy.turnos.map((t, i) => {
    const s = deHoy[i]
    const p = s ? porId.get(s.patient_id) : undefined
    return { hora: t.hora, paciente: p ? nombreCompleto(p) : 'Sesión', pacienteId: p?.id ?? '', hecho: t.hecho, proxima: t.proxima }
  })
  // Quién debe, de lo que más debe a lo que menos (en pesos y en dólares, cada uno en su moneda)
  const deudores: (DeudorNativo & { valor: number })[] = []
  for (const p of args.pacientes) {
    for (const s of saldosDe(p.id, args.sesiones, args.pagos, op.hoy)) {
      if (s.saldo <= 0) continue
      const impagos = s.meses.filter((x) => x.pendiente > 0).length
      deudores.push({ id: p.id, nombre: nombreCompleto(p), monto: monto(s.saldo, s.moneda, op.oculto), variosMeses: impagos > 1, valor: s.moneda === 'ARS' ? s.saldo : s.saldo * 1000 })
    }
  }
  deudores.sort((a, b) => b.valor - a.valor)
  return {
    nombre: (args.perfil as { nombre?: string | null }).nombre ?? '',
    mes: w.mes,
    oculto: op.oculto,
    cobros: w.cobros,
    hoy: { dia: w.hoy.dia, total: w.hoy.total, turnos },
    deben: { total: w.deben.total, cantidad: w.deben.cantidad, lista: deudores.slice(0, 5).map((d) => ({ id: d.id, nombre: d.nombre, monto: d.monto, variosMeses: d.variosMeses })) },
    mono: w.mono,
  }
}

export function datosPacientesNativo(args: Pick<Args, 'pacientes' | 'sesiones' | 'pagos'>, op: Pick<Opciones, 'hoy' | 'oculto'>): PacienteNativo[] {
  return args.pacientes
    .map((p) => {
      const deudas = saldosDe(p.id, args.sesiones, args.pagos, op.hoy).filter((s) => s.saldo > 0)
      const sub = [p.obra_social, p.frecuencia, p.activo ? '' : 'inactivo'].filter(Boolean).join(' · ')
      return {
        id: p.id,
        nombre: nombreCompleto(p),
        sub,
        saldo: deudas.length ? deudas.map((s) => monto(s.saldo, s.moneda, op.oculto)).join(' + ') : null,
        debe: deudas.length > 0,
        activo: p.activo,
      }
    })
    .sort((a, b) => Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre, 'es'))
}
