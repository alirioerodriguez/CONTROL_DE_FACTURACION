// Valida las filas importadas y arma lo que hay que guardar (funciones puras).
import { nombreCompleto, type Comprobante, type Medio, type Paciente, type Pago, type Sesion } from '../datos'
import { hoyAR, normalizar, parseFechaAR, parseMontoAR, periodoDe, redondear2, type Moneda } from '../formato'
import type { Celda, Hoja } from './leer'
import { normalizarDocumentos } from '../documentos'
import { tarifaVigente } from '../saldos'

export interface PacienteNuevo {
  ref: string
  nombre: string
  apellido: string | null
  codigo: string | null
  dni: string | null
  cuil_cuit: string | null
  condicion_iva: string | null
  telefono: string | null
  email: string | null
  domicilio: string | null
  frecuencia: string | null
  tipo_tarifa: 'estandar' | 'personalizada'
  tarifa_personalizada: number | null
  moneda: Moneda
  fecha_alta: string
  activo: boolean
  notas_admin: string | null
  /** Solo lo trae la planilla de citas. */
  obra_social?: string | null
}

/** Paciente ya existente (patient_id) o creado en esta misma importación (paciente_ref). */
type RefPaciente = { patient_id: string; paciente_ref?: undefined } | { patient_id?: undefined; paciente_ref: string }

export type SesionNueva = RefPaciente & {
  ref?: string
  fecha: string
  /** Hora de la cita 'HH:MM' (opcional). */
  hora?: string | null
  horas: number
  tarifa_hora: number
  moneda: Moneda
  observaciones: string | null
  /** Solo lo trae el Excel de la app; si falta, la sesión es normal. */
  estado?: 'ausente' | 'cancelada'
}

export type PagoNuevo = RefPaciente & {
  sesion_ref?: string
  fecha: string
  periodo: string
  monto: number
  moneda: Moneda
  medio: Medio
  comprobante: Comprobante
  punto_venta: string | null
  nro_factura: string | null
  observaciones: string | null
}

export interface ErrorFila {
  hoja: string
  fila: number
  mensaje: string
}

export interface Preparado {
  pacientes: PacienteNuevo[]
  sesiones: SesionNueva[]
  pagos: PagoNuevo[]
  errores: ErrorFila[]
  /** Filas que ya estaban cargadas (mismo paciente, fecha y monto): no se vuelven a insertar. */
  duplicadas: number
  /** Pacientes de la planilla que ya existían en la app. */
  pacientesExistentes: number
}

export interface Contexto {
  pacientes: Paciente[]
  sesiones: Sesion[]
  pagos: Pago[]
  monedaDefecto: Moneda
  tarifaEstandar: number
}

// ---------------------------------------------------------------------
// Interpretación de valores
// ---------------------------------------------------------------------

export function texto(c: Celda): string | null {
  if (c == null) return null
  if (c instanceof Date) return c.toISOString().slice(0, 10)
  const t = String(c).trim()
  return t === '' ? null : t
}

/** 'ARS', '$', 'pesos' → ARS; 'USD', 'US$', 'dólares' → USD; vacío → por defecto; otro → 'invalida'. */
export function parseMoneda(c: Celda, porDefecto: Moneda): Moneda | 'invalida' {
  const t = texto(c)
  if (!t) return porDefecto
  const n = normalizar(t).replace(/\s/g, '')
  if (['ars', '$', 'pesos', 'peso', 'arg'].includes(n)) return 'ARS'
  if (['usd', 'us$', 'u$s', 'dolares', 'dolar', 'u$d'].includes(n)) return 'USD'
  return 'invalida'
}

export function parseSiNo(c: Celda): boolean | null {
  if (typeof c === 'boolean') return c
  const t = texto(c)
  if (!t) return null
  const n = normalizar(t)
  if (['si', 's', 'x', '1', 'pagada', 'pagado', 'pago', 'true', 'yes'].includes(n)) return true
  if (['no', 'n', '0', 'pendiente', 'false'].includes(n)) return false
  return null
}

export function parseMedio(c: Celda): Medio {
  const n = normalizar(texto(c) ?? '').replace(/\s/g, '')
  if (n.startsWith('efect')) return 'efectivo'
  if (n.startsWith('transf')) return 'transferencia'
  if (n.startsWith('mercado') || n === 'mp') return 'mercadopago'
  if (!n) return 'transferencia'
  return 'otro'
}

export function parseComprobante(c: Celda, nroFactura: string | null): Comprobante {
  const n = normalizar(texto(c) ?? '')
  if (n.startsWith('factura')) return 'factura_c'
  if (n.startsWith('recibo')) return 'recibo'
  if (!n && nroFactura) return 'factura_c'
  return 'sin_comprobante'
}

const esFilaEjemplo = (celdas: Celda[]) => celdas.some((c) => typeof c === 'string' && /fila de ejemplo/i.test(c))

const claveMovimiento = (paciente: string, fecha: string, monto: number, moneda: Moneda) =>
  `${paciente}|${fecha}|${Math.round(monto * 100)}|${moneda}`

/** Busca una columna por su encabezado (sin importar tildes ni mayúsculas). */
function columna(hoja: Hoja, ...nombres: string[]): number {
  const buscados = nombres.map((n) => normalizar(n))
  return hoja.encabezados.findIndex((e) => buscados.includes(normalizar(e)))
}

function indicePacientes(pacientes: Paciente[]) {
  const porNombre = new Map<string, string>()
  const porCodigo = new Map<string, string>()
  for (const p of pacientes) {
    porNombre.set(normalizar(nombreCompleto(p)), p.id)
    if (p.codigo) porCodigo.set(normalizar(p.codigo), p.id)
  }
  return { porNombre, porCodigo }
}

function clavesExistentes(ctx: Contexto) {
  return {
    sesiones: new Set(ctx.sesiones.map((s) => claveMovimiento(s.patient_id, s.fecha, s.monto, s.moneda))),
    pagos: new Set(ctx.pagos.map((p) => claveMovimiento(p.patient_id, p.fecha, p.monto, p.moneda))),
  }
}

const refDe = (r: RefPaciente) => r.patient_id ?? r.paciente_ref!

// ---------------------------------------------------------------------
// Planilla genérica: una fila por sesión, columnas elegidas a mano
// ---------------------------------------------------------------------

export const CAMPOS = [
  { k: 'paciente', l: 'Paciente', req: true, h: 'Nombre y apellido' },
  { k: 'fecha', l: 'Fecha', req: true, h: 'dd/mm/aaaa' },
  { k: 'monto', l: 'Monto', req: true, h: 'Honorario de la sesión' },
  { k: 'moneda', l: 'Moneda', req: false, h: 'ARS o USD · si falta, usamos la de Ajustes' },
  { k: 'pago', l: 'Pagó', req: false, h: 'Sí / No · si falta, quedan pendientes' },
  { k: 'notas', l: 'Notas', req: false, h: 'Observaciones administrativas' },
] as const

export type CampoGenerico = (typeof CAMPOS)[number]['k']
export type Mapeo = Record<CampoGenerico, number | null>

const SINONIMOS: Record<CampoGenerico, string[]> = {
  paciente: ['paciente', 'nombre', 'nombre y apellido', 'nombre completo', 'cliente'],
  fecha: ['fecha', 'fecha de sesion', 'dia', 'fecha sesion'],
  monto: ['monto', 'honorario', 'importe', 'valor', 'precio', 'total'],
  moneda: ['moneda', 'divisa'],
  pago: ['pago', 'pagó', 'pagado', 'pagada', 'abono', 'abonó', 'cobrado', 'estado'],
  notas: ['notas', 'observaciones', 'comentarios', 'nota'],
}

export function mapeoAutomatico(encabezados: string[]): Mapeo {
  const m = {} as Mapeo
  const usados = new Set<number>()
  for (const { k } of CAMPOS) {
    const i = encabezados.findIndex((e, j) => !usados.has(j) && SINONIMOS[k].includes(normalizar(e).trim()))
    m[k] = i >= 0 ? i : null
    if (i >= 0) usados.add(i)
  }
  return m
}

export function camposFaltantes(mapeo: Mapeo): string[] {
  return CAMPOS.filter((c) => c.req && mapeo[c.k] == null).map((c) => c.l)
}

export function prepararGenerico(hoja: Hoja, mapeo: Mapeo, ctx: Contexto): Preparado {
  const res: Preparado = { pacientes: [], sesiones: [], pagos: [], errores: [], duplicadas: 0, pacientesExistentes: 0 }
  const idx = indicePacientes(ctx.pacientes)
  const ya = clavesExistentes(ctx)
  const enArchivo = new Set<string>()
  const nuevos = new Map<string, PacienteNuevo>()
  const existentesUsados = new Set<string>()
  const celda = (celdas: Celda[], k: CampoGenerico) => (mapeo[k] == null ? null : celdas[mapeo[k]!])

  for (const { numero, celdas } of hoja.filas) {
    if (esFilaEjemplo(celdas)) continue
    const error = (mensaje: string) => res.errores.push({ hoja: hoja.nombre, fila: numero, mensaje })

    const nombre = texto(celda(celdas, 'paciente'))?.replace(/\s+/g, ' ')
    if (!nombre) {
      error('Falta el nombre del paciente')
      continue
    }
    const crudaFecha = celda(celdas, 'fecha')
    const fecha = parseFechaAR(crudaFecha)
    if (!fecha) {
      error(crudaFecha == null ? 'Fecha vacía' : `Fecha inválida: “${texto(crudaFecha)}”`)
      continue
    }
    const crudoMonto = celda(celdas, 'monto')
    const monto = parseMontoAR(crudoMonto)
    if (crudoMonto == null) {
      error('Monto vacío')
      continue
    }
    if (monto == null || monto <= 0) {
      error(`Monto inválido: “${texto(crudoMonto)}”`)
      continue
    }
    const moneda = parseMoneda(celda(celdas, 'moneda'), ctx.monedaDefecto)
    if (moneda === 'invalida') {
      error(`Moneda “${texto(celda(celdas, 'moneda'))}” no soportada`)
      continue
    }

    const clave = normalizar(nombre)
    let ref: RefPaciente
    const existente = idx.porNombre.get(clave)
    if (existente) {
      ref = { patient_id: existente }
      existentesUsados.add(existente)
    } else {
      const r = `n:${clave}`
      if (!nuevos.has(clave)) nuevos.set(clave, pacienteBasico(r, nombre, moneda, monto, ctx))
      ref = { paciente_ref: r }
    }

    const k = claveMovimiento(refDe(ref), fecha, monto, moneda)
    if (ya.sesiones.has(k) || enArchivo.has(k)) {
      res.duplicadas++
      continue
    }
    enArchivo.add(k)

    const refSesion = `f:${numero}`
    res.sesiones.push({ ...ref, ref: refSesion, fecha, horas: 1, tarifa_hora: monto, moneda, observaciones: texto(celda(celdas, 'notas')) })
    if (parseSiNo(celda(celdas, 'pago'))) {
      res.pagos.push({
        ...ref,
        sesion_ref: refSesion,
        fecha,
        periodo: periodoDe(fecha),
        monto,
        moneda,
        medio: 'transferencia',
        comprobante: 'sin_comprobante',
        punto_venta: null,
        nro_factura: null,
        observaciones: null,
      })
    }
  }
  res.pacientes = [...nuevos.values()]
  res.pacientesExistentes = existentesUsados.size
  return res
}

/** Paciente creado desde una sesión: usa la tarifa estándar si coincide; si no, la de esa sesión. */
function pacienteBasico(ref: string, nombre: string, moneda: Moneda, monto: number, ctx: Contexto): PacienteNuevo {
  const esEstandar = moneda === ctx.monedaDefecto && monto === ctx.tarifaEstandar
  return {
    ref,
    nombre,
    apellido: null,
    codigo: null,
    dni: null,
    cuil_cuit: null,
    condicion_iva: null,
    telefono: null,
    email: null,
    domicilio: null,
    frecuencia: null,
    tipo_tarifa: esEstandar ? 'estandar' : 'personalizada',
    tarifa_personalizada: esEstandar ? null : monto,
    moneda,
    fecha_alta: hoyAR(),
    activo: true,
    notas_admin: null,
  }
}

// ---------------------------------------------------------------------
// Plantilla de la app: hojas Pacientes, Sesiones y Pagos
// ---------------------------------------------------------------------

const hojaLlamada = (hojas: Hoja[], nombre: string) => hojas.find((h) => normalizar(h.nombre) === normalizar(nombre))

/**
 * true si el archivo tiene la estructura de la app. Hay dos:
 * - la plantilla simple (public/plantilla-cobros.xlsx): se enlaza por la columna «Paciente», sin códigos;
 * - el Excel completo de copia de seguridad (Descargar Excel): se enlaza por «ID paciente».
 */
export function esPlantilla(hojas: Hoja[]): boolean {
  const s = hojaLlamada(hojas, 'Sesiones')
  const p = hojaLlamada(hojas, 'Pacientes')
  const tiene = (h: Hoja | undefined, ...cols: string[]) => !!h && cols.every((c) => columna(h, c) >= 0)
  const completa = tiene(p, 'ID paciente', 'Nombre')
  const simple = tiene(p, 'Paciente')
  const conSesiones = !!s && columna(s, 'Fecha') >= 0 && columna(s, 'Monto') >= 0 && columna(s, 'ID paciente', 'Paciente') >= 0
  return (completa || simple) && (conSesiones || !!hojaLlamada(hojas, 'Pagos'))
}

/** «DNI o CUIT» en una sola columna: con 11 dígitos es CUIT/CUIL; si no, DNI. */
function separarDocumento(valor: string | null): { dni: string | null; cuil_cuit: string | null } {
  if (!valor) return { dni: null, cuil_cuit: null }
  return valor.replace(/\D/g, '').length === 11 ? { dni: null, cuil_cuit: valor } : { dni: valor, cuil_cuit: null }
}

export function prepararPlantilla(hojas: Hoja[], ctx: Contexto): Preparado {
  const res: Preparado = { pacientes: [], sesiones: [], pagos: [], errores: [], duplicadas: 0, pacientesExistentes: 0 }
  const idx = indicePacientes(ctx.pacientes)
  const ya = clavesExistentes(ctx)
  const porCodigo = new Map<string, RefPaciente>()

  // Pacientes
  const hp = hojaLlamada(hojas, 'Pacientes')
  if (hp) {
    const c = {
      id: columna(hp, 'ID paciente'),
      // Plantilla simple: «Paciente» (nombre y apellido juntos) y «DNI o CUIT» en una sola columna.
      nombre: columna(hp, 'Nombre', 'Paciente', 'Nombre y apellido'),
      doc: columna(hp, 'DNI o CUIT'),
      apellido: columna(hp, 'Apellido'),
      dni: columna(hp, 'DNI'),
      cuil: columna(hp, 'CUIL / CUIT', 'CUIL', 'CUIT'),
      iva: columna(hp, 'Condición IVA', 'Condición frente al IVA'),
      tel: columna(hp, 'Teléfono'),
      email: columna(hp, 'Email'),
      domicilio: columna(hp, 'Domicilio'),
      honorario: columna(hp, 'Honorario'),
      moneda: columna(hp, 'Moneda'),
      frecuencia: columna(hp, 'Frecuencia'),
      alta: columna(hp, 'Fecha de alta'),
      activo: columna(hp, 'Activo'),
      notas: columna(hp, 'Notas administrativas'),
    }
    const v = (celdas: Celda[], i: number) => (i >= 0 ? celdas[i] : null)
    for (const { numero, celdas } of hp.filas) {
      if (esFilaEjemplo(celdas)) continue
      const codigo = texto(v(celdas, c.id))
      const nombre = texto(v(celdas, c.nombre))
      const apellido = texto(v(celdas, c.apellido))
      if (!codigo && !nombre) continue
      // Sin columna de ID (plantilla simple), el paciente se identifica por su nombre.
      if (!nombre || (c.id >= 0 && !codigo)) {
        res.errores.push({ hoja: hp.nombre, fila: numero, mensaje: nombre ? 'Falta el ID de paciente' : 'Falta el nombre' })
        continue
      }
      const moneda = parseMoneda(v(celdas, c.moneda), ctx.monedaDefecto)
      if (moneda === 'invalida') {
        res.errores.push({ hoja: hp.nombre, fila: numero, mensaje: `Moneda “${texto(v(celdas, c.moneda))}” no soportada` })
        continue
      }
      const completo = [nombre, apellido].filter(Boolean).join(' ')
      const clave = normalizar(codigo ?? completo)
      const existente = (codigo ? idx.porCodigo.get(normalizar(codigo)) : undefined) ?? idx.porNombre.get(normalizar(completo))
      if (existente) {
        porCodigo.set(clave, { patient_id: existente })
        res.pacientesExistentes++
        continue
      }
      const honorario = parseMontoAR(v(celdas, c.honorario))
      const esEstandar =
        honorario == null || (honorario === ctx.tarifaEstandar && moneda === ctx.monedaDefecto)
      const ref = `p:${clave}`
      porCodigo.set(clave, { paciente_ref: ref })
      const documento = c.doc >= 0 ? separarDocumento(texto(v(celdas, c.doc))) : null
      res.pacientes.push({
        ref,
        nombre,
        apellido,
        codigo,
        // Plantilla simple: «DNI o CUIT» en una sola columna; después se validan y se les da formato.
        ...normalizarDocumentos(
          documento ? documento.dni : texto(v(celdas, c.dni)),
          documento ? documento.cuil_cuit : texto(v(celdas, c.cuil)),
        ),
        condicion_iva: texto(v(celdas, c.iva)) ?? (documento ? 'Consumidor final' : null),
        telefono: texto(v(celdas, c.tel)),
        email: texto(v(celdas, c.email)),
        domicilio: texto(v(celdas, c.domicilio)),
        frecuencia: texto(v(celdas, c.frecuencia)),
        tipo_tarifa: esEstandar ? 'estandar' : 'personalizada',
        tarifa_personalizada: esEstandar ? null : honorario,
        moneda: esEstandar ? ctx.monedaDefecto : moneda,
        fecha_alta: parseFechaAR(v(celdas, c.alta)) ?? hoyAR(),
        activo: parseSiNo(v(celdas, c.activo)) ?? true,
        notas_admin: texto(v(celdas, c.notas)),
      })
    }
  }

  /** El paciente de una fila de Sesiones o Pagos: por ID (Excel completo) o por nombre (plantilla simple). */
  const pacienteDe = (hoja: Hoja, numero: number, codigo: string | null): RefPaciente | null => {
    if (!codigo) {
      res.errores.push({ hoja: hoja.nombre, fila: numero, mensaje: 'Falta el paciente' })
      return null
    }
    const enHoja = porCodigo.get(normalizar(codigo))
    if (enHoja) return enHoja
    const existente = idx.porCodigo.get(normalizar(codigo)) ?? idx.porNombre.get(normalizar(codigo))
    if (existente) return { patient_id: existente }
    res.errores.push({ hoja: hoja.nombre, fila: numero, mensaje: `El paciente “${codigo}” no está en la hoja Pacientes` })
    return null
  }

  // Sesiones
  const sesionesDelArchivo = new Set<string>()
  const refsSesion = new Set<string>()
  const hs = hojaLlamada(hojas, 'Sesiones')
  if (hs) {
    const c = {
      id: columna(hs, 'ID sesión'),
      fecha: columna(hs, 'Fecha'),
      paciente: columna(hs, 'ID paciente', 'Paciente'),
      monto: columna(hs, 'Monto'),
      moneda: columna(hs, 'Moneda'),
      horas: columna(hs, 'Horas'),
      hora: columna(hs, 'Hora'),
      obs: columna(hs, 'Observaciones'),
      estado: columna(hs, 'Estado'),
    }
    for (const { numero, celdas } of hs.filas) {
      if (esFilaEjemplo(celdas)) continue
      const v = (i: number) => (i >= 0 ? celdas[i] : null)
      if (v(c.fecha) == null && v(c.paciente) == null && v(c.monto) == null) continue
      const ref = pacienteDe(hs, numero, texto(v(c.paciente)))
      if (!ref) continue
      const fecha = parseFechaAR(v(c.fecha))
      if (!fecha) {
        res.errores.push({ hoja: hs.nombre, fila: numero, mensaje: v(c.fecha) == null ? 'Fecha vacía' : `Fecha inválida: “${texto(v(c.fecha))}”` })
        continue
      }
      const monto = parseMontoAR(v(c.monto))
      if (monto == null || monto <= 0) {
        res.errores.push({ hoja: hs.nombre, fila: numero, mensaje: v(c.monto) == null ? 'Monto vacío' : `Monto inválido: “${texto(v(c.monto))}”` })
        continue
      }
      const moneda = parseMoneda(v(c.moneda), ctx.monedaDefecto)
      if (moneda === 'invalida') {
        res.errores.push({ hoja: hs.nombre, fila: numero, mensaje: `Moneda “${texto(v(c.moneda))}” no soportada` })
        continue
      }
      const k = claveMovimiento(refDe(ref), fecha, monto, moneda)
      if (ya.sesiones.has(k) || sesionesDelArchivo.has(k)) {
        res.duplicadas++
        continue
      }
      sesionesDelArchivo.add(k)
      const idSesion = texto(v(c.id))
      const refSesion = idSesion ? `s:${normalizar(idSesion)}` : undefined
      if (refSesion) refsSesion.add(refSesion)
      const horas = parseMontoAR(v(c.horas)) ?? 1
      res.sesiones.push({
        ...ref,
        ref: refSesion,
        fecha,
        hora: c.hora >= 0 ? parseHora(v(c.hora)) : null,
        horas: horas > 0 ? horas : 1,
        tarifa_hora: redondear2(monto / (horas > 0 ? horas : 1)),
        moneda,
        observaciones: texto(v(c.obs)),
        ...estadoImportado(texto(v(c.estado))),
      })
    }
  }

  // Pagos
  const pagosDelArchivo = new Set<string>()
  const hg = hojaLlamada(hojas, 'Pagos')
  if (hg) {
    const c = {
      fecha: columna(hg, 'Fecha de pago', 'Fecha'),
      mes: columna(hg, 'Mes imputado', 'Mes que paga'),
      paciente: columna(hg, 'ID paciente', 'Paciente'),
      monto: columna(hg, 'Monto'),
      moneda: columna(hg, 'Moneda'),
      medio: columna(hg, 'Medio de pago'),
      comprobante: columna(hg, 'Comprobante'),
      pv: columna(hg, 'Punto de venta'),
      nro: columna(hg, 'Nº de factura', 'Nro de factura', 'N° de factura', 'Factura'),
      sesion: columna(hg, 'ID sesión (opcional)', 'ID sesión'),
      obs: columna(hg, 'Observaciones'),
    }
    for (const { numero, celdas } of hg.filas) {
      if (esFilaEjemplo(celdas)) continue
      const v = (i: number) => (i >= 0 ? celdas[i] : null)
      // Las filas vacías de la plantilla traen fórmulas: se ignoran si no hay fecha, paciente ni monto.
      if (v(c.fecha) == null && v(c.paciente) == null && v(c.monto) == null) continue
      const ref = pacienteDe(hg, numero, texto(v(c.paciente)))
      if (!ref) continue
      const fecha = parseFechaAR(v(c.fecha))
      if (!fecha) {
        res.errores.push({ hoja: hg.nombre, fila: numero, mensaje: v(c.fecha) == null ? 'Fecha de pago vacía' : `Fecha inválida: “${texto(v(c.fecha))}”` })
        continue
      }
      const monto = parseMontoAR(v(c.monto))
      if (monto == null || monto <= 0) {
        res.errores.push({ hoja: hg.nombre, fila: numero, mensaje: v(c.monto) == null ? 'Monto vacío' : `Monto inválido: “${texto(v(c.monto))}”` })
        continue
      }
      const moneda = parseMoneda(v(c.moneda), ctx.monedaDefecto)
      if (moneda === 'invalida') {
        res.errores.push({ hoja: hg.nombre, fila: numero, mensaje: `Moneda “${texto(v(c.moneda))}” no soportada` })
        continue
      }
      const k = claveMovimiento(refDe(ref), fecha, monto, moneda)
      if (ya.pagos.has(k) || pagosDelArchivo.has(k)) {
        res.duplicadas++
        continue
      }
      pagosDelArchivo.add(k)
      const mes = parseFechaAR(v(c.mes))
      const nro = texto(v(c.nro))
      const idSesion = texto(v(c.sesion))
      const refSesion = idSesion ? `s:${normalizar(idSesion)}` : undefined
      res.pagos.push({
        ...ref,
        sesion_ref: refSesion && refsSesion.has(refSesion) ? refSesion : undefined,
        fecha,
        periodo: periodoDe(mes ?? fecha),
        monto,
        moneda,
        medio: parseMedio(v(c.medio)),
        comprobante: parseComprobante(v(c.comprobante), nro),
        punto_venta: texto(v(c.pv)),
        nro_factura: nro,
        observaciones: texto(v(c.obs)),
      })
    }
  }

  return res
}

/** Columna «Estado» del Excel de la app: Ausente o Cancelada. Cualquier otra cosa (o vacía) es normal. */
export function estadoImportado(valor: string | null): { estado?: 'ausente' | 'cancelada' } {
  const v = normalizar(valor ?? '')
  if (v.startsWith('ausen')) return { estado: 'ausente' }
  if (v.startsWith('cancel')) return { estado: 'cancelada' }
  return {}
}

/**
 * Hora de una celda: '18:30', '18.30', '18 hs', un número de Excel (fracción del día) o una fecha con hora.
 * Devuelve 'HH:MM' o null si no se entiende.
 */
export function parseHora(c: Celda): string | null {
  if (c == null) return null
  let h: number
  let m: number
  if (c instanceof Date) {
    h = c.getUTCHours()
    m = c.getUTCMinutes()
  } else if (typeof c === 'number') {
    const minutos = Math.round((c % 1) * 24 * 60)
    h = Math.floor(minutos / 60)
    m = minutos % 60
  } else {
    const t = String(c)
      .trim()
      .toLowerCase()
      .match(/^(\d{1,2})(?:[:.h ](\d{2}))?\s*(?:hs?|horas?)?$/)
    if (!t) return null
    h = Number(t[1])
    m = Number(t[2] ?? 0)
  }
  if (h > 23 || m > 59) return null
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// ---------------------------------------------------------------------
// Planilla de una sola pestaña («Citas»): public/plantilla-cobros.xlsx
// Cada fila es una cita: datos del paciente (se crea la primera vez que aparece), fecha, hora, monto y si pagó.
// ---------------------------------------------------------------------

/** true si el archivo tiene la pestaña «Citas» con paciente y fecha. */
export function esPlanillaCitas(hojas: Hoja[]): boolean {
  const h = hojaLlamada(hojas, 'Citas')
  return !!h && columna(h, 'Paciente') >= 0 && columna(h, 'Fecha de la cita', 'Fecha') >= 0
}

export function prepararCitas(hojas: Hoja[], ctx: Contexto): Preparado {
  const res: Preparado = { pacientes: [], sesiones: [], pagos: [], errores: [], duplicadas: 0, pacientesExistentes: 0 }
  const h = hojaLlamada(hojas, 'Citas')
  if (!h) return res
  const idx = indicePacientes(ctx.pacientes)
  const ya = clavesExistentes(ctx)
  const porId = new Map(ctx.pacientes.map((p) => [p.id, p]))
  const c = {
    paciente: columna(h, 'Paciente'),
    dni: columna(h, 'DNI'),
    cuil: columna(h, 'CUIL / CUIT', 'CUIL/CUIT', 'CUIL', 'CUIT'),
    iva: columna(h, 'Condición frente al IVA', 'Condición IVA'),
    obra: columna(h, 'Obra social', 'Obra social o prepaga'),
    tel: columna(h, 'Teléfono'),
    fecha: columna(h, 'Fecha de la cita', 'Fecha'),
    hora: columna(h, 'Hora de la cita', 'Hora'),
    monto: columna(h, 'Monto', 'Honorario'),
    moneda: columna(h, 'Moneda'),
    pago: columna(h, 'Pagó', 'Pago'),
    factura: columna(h, 'Nº de factura', 'Nro de factura', 'N° de factura', 'Factura'),
  }
  const nuevos = new Map<string, PacienteNuevo>()
  const vistos = new Set<string>()
  const enArchivo = { sesiones: new Set<string>(), pagos: new Set<string>() }

  for (const { numero, celdas } of h.filas) {
    if (esFilaEjemplo(celdas)) continue
    const v = (i: number) => (i >= 0 ? celdas[i] : null)
    const nombre = texto(v(c.paciente))
    if (!nombre && v(c.fecha) == null && v(c.monto) == null) continue
    if (!nombre) {
      res.errores.push({ hoja: h.nombre, fila: numero, mensaje: 'Falta el paciente' })
      continue
    }
    const clave = normalizar(nombre.replace(/\s+/g, ' '))

    // Paciente: existente en la cuenta, o nuevo (con los datos de la primera fila en que aparece).
    const existente = idx.porNombre.get(clave)
    let ref: RefPaciente
    if (existente) {
      ref = { patient_id: existente }
      if (!vistos.has(clave)) res.pacientesExistentes++
    } else {
      let p = nuevos.get(clave)
      const docs = normalizarDocumentos(texto(v(c.dni)), texto(v(c.cuil)))
      if (!p) {
        p = {
          ref: `p:${clave}`,
          nombre,
          apellido: null,
          codigo: null,
          dni: docs.dni,
          cuil_cuit: docs.cuil_cuit,
          condicion_iva: texto(v(c.iva)) ?? 'Consumidor final',
          telefono: texto(v(c.tel)),
          email: null,
          domicilio: null,
          frecuencia: null,
          tipo_tarifa: 'estandar',
          tarifa_personalizada: null,
          moneda: ctx.monedaDefecto,
          fecha_alta: hoyAR(),
          activo: true,
          notas_admin: null,
          obra_social: texto(v(c.obra)),
        }
        nuevos.set(clave, p)
        res.pacientes.push(p)
      } else {
        // Si en una fila anterior faltaba algún dato, se completa con esta.
        p.dni ??= docs.dni
        p.cuil_cuit ??= docs.cuil_cuit
        p.telefono ??= texto(v(c.tel))
        p.obra_social ??= texto(v(c.obra))
      }
      ref = { paciente_ref: p.ref }
    }
    vistos.add(clave)

    // Cita (si tiene fecha). Sin monto, se usa el honorario del paciente o la tarifa estándar.
    if (v(c.fecha) == null) continue
    const fecha = parseFechaAR(v(c.fecha))
    if (!fecha) {
      res.errores.push({ hoja: h.nombre, fila: numero, mensaje: `Fecha inválida: “${texto(v(c.fecha))}”` })
      continue
    }
    const hora = v(c.hora) == null ? null : parseHora(v(c.hora))
    if (v(c.hora) != null && !hora) {
      res.errores.push({ hoja: h.nombre, fila: numero, mensaje: `Hora inválida: “${texto(v(c.hora))}” (usá 18:30)` })
      continue
    }
    const pacienteExistente = existente ? porId.get(existente) : undefined
    const moneda = parseMoneda(v(c.moneda), pacienteExistente?.moneda ?? ctx.monedaDefecto)
    if (moneda === 'invalida') {
      res.errores.push({ hoja: h.nombre, fila: numero, mensaje: `Moneda “${texto(v(c.moneda))}” no soportada` })
      continue
    }
    const tarifa = pacienteExistente ? tarifaVigente(pacienteExistente, ctx.tarifaEstandar) : ctx.tarifaEstandar
    const monto = v(c.monto) == null ? tarifa : parseMontoAR(v(c.monto))
    if (monto == null || monto <= 0) {
      res.errores.push({
        hoja: h.nombre,
        fila: numero,
        mensaje: v(c.monto) == null ? 'Falta el monto (o cargá tu tarifa estándar en Ajustes)' : `Monto inválido: “${texto(v(c.monto))}”`,
      })
      continue
    }
    const k = claveMovimiento(refDe(ref), fecha, monto, moneda)
    if (ya.sesiones.has(k) || enArchivo.sesiones.has(k)) {
      res.duplicadas++
      continue
    }
    enArchivo.sesiones.add(k)
    const refSesion = `s:fila${numero}`
    res.sesiones.push({ ...ref, ref: refSesion, fecha, hora, horas: 1, tarifa_hora: monto, moneda, observaciones: null })

    // Pago (si dice que pagó): mismo día y monto, imputado al mes de la cita.
    if (parseSiNo(v(c.pago)) === true && !ya.pagos.has(k) && !enArchivo.pagos.has(k)) {
      enArchivo.pagos.add(k)
      const nro = texto(v(c.factura))
      res.pagos.push({
        ...ref,
        sesion_ref: refSesion,
        fecha,
        periodo: periodoDe(fecha),
        monto,
        moneda,
        medio: 'transferencia',
        comprobante: nro ? 'factura_c' : 'sin_comprobante',
        punto_venta: null,
        nro_factura: nro,
        observaciones: null,
      })
    }
  }
  return res
}
