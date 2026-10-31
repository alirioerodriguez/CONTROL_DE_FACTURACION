import { describe, expect, it } from 'vitest'
import { aprenderPagador, leerComprobante, posibleDuplicado, sugerir, type DatosComprobante, type PacienteConciliar } from './conciliar'

// Textos de ejemplo con el estilo de un comprobante de homebanking o de una billetera virtual (no son reales).
const HOY = '2026-04-01'
const leer = (t: string) => leerComprobante(t, HOY)

describe('leerComprobante: billetera virtual', () => {
  it('«Recibiste $ … de …»', () => {
    const c = leer('Recibiste $ 25.000 de Maria Elena Garcia\n12 de marzo de 2026\nNúmero de operación 123456789012')
    expect(c).toEqual({ monto: 25000, moneda: 'ARS', fecha: '2026-03-12', remitente: 'Maria Elena Garcia', documento: null, referencia: '123456789012' })
  })

  it('«Te transfirió …»', () => {
    const c = leer('Te transfirió Juan Pérez $25.000,50 el 3/3/26')
    expect(c).toMatchObject({ monto: 25000.5, moneda: 'ARS', fecha: '2026-03-03', remitente: 'Juan Pérez' })
  })

  it('en dólares', () => {
    expect(leer('Recibiste US$ 40,00 de Ana Lopez')).toMatchObject({ monto: 40, moneda: 'USD', remitente: 'Ana Lopez' })
    expect(leer('Te llegaron USD 40 de Ana Lopez').moneda).toBe('USD')
    expect(leer('Recibiste U$S 1.200 de Ana Lopez')).toMatchObject({ monto: 1200, moneda: 'USD' })
  })
})

describe('leerComprobante: homebanking', () => {
  const texto = `Transferencia recibida
Fecha: 12/03/2026 14:35
Ordenante: GARCIA MARIA ELENA
CUIL/CUIT: 27-12345678-4
Importe: $ 25.000,00
Comprobante: AB12CD34`

  it('lee monto, fecha, ordenante, documento y comprobante', () => {
    expect(leer(texto)).toEqual({ monto: 25000, moneda: 'ARS', fecha: '2026-03-12', remitente: 'GARCIA MARIA ELENA', documento: '27123456784', referencia: 'AB12CD34' })
  })

  it('el nombre puede venir en la línea de abajo', () => {
    expect(leer('Ordenante:\nPedro Ruiz\nImporte $ 8.000').remitente).toBe('Pedro Ruiz')
  })

  it('no toma el saldo ni la comisión como monto', () => {
    expect(leer('Saldo disponible $ 1.250.000,00\nImporte transferido: $ 30.000,00\nOrdenante: Pedro Ruiz').monto).toBe(30000)
    expect(leer('Comisión $ 150,00\nImporte $ 25.000,00').monto).toBe(25000)
  })

  it('un «Origen» que es un banco no es la persona: sigue buscando', () => {
    expect(leer('Origen: Banco Galicia\nOrdenante: Rosa Diaz\n$ 9.000').remitente).toBe('Rosa Diaz')
    expect(leer('Origen: Banco Galicia\n$ 9.000').remitente).toBeNull()
  })

  it('importe sin signo de pesos', () => {
    expect(leer('Importe: 18.000,00')).toMatchObject({ monto: 18000, moneda: 'ARS' })
  })

  it('nombres con conectores y con tilde', () => {
    expect(leer('Ordenante: María de los Ángeles Pérez\n$ 5.000').remitente).toBe('María de los Ángeles Pérez')
    expect(leer('Recibiste $ 5.000 de Juan José del Valle por transferencia').remitente).toBe('Juan José del Valle')
  })

  it('no deja pegadas las palabras que siguen al nombre', () => {
    expect(leer('Ordenante: Pedro Ruiz CUIL 20-30111222-5\n$ 5.000').remitente).toBe('Pedro Ruiz')
    expect(leer('Recibiste $ 5.000 de Pedro Ruiz el 12/03/2026').remitente).toBe('Pedro Ruiz')
  })
})

describe('leerComprobante: fechas y documentos', () => {
  it('fecha con mes escrito, con y sin año', () => {
    expect(leer('12 de marzo de 2026').fecha).toBe('2026-03-12')
    expect(leer('el 5 de enero').fecha).toBe('2026-01-05') // sin año: el del día de hoy
    expect(leer('3 de setiembre del 2025').fecha).toBe('2025-09-03')
  })

  it('fecha ISO, con puntos y con guiones; las inexistentes se descartan', () => {
    expect(leer('2026-03-12').fecha).toBe('2026-03-12')
    expect(leer('12.03.2026').fecha).toBe('2026-03-12')
    expect(leer('12-03-26').fecha).toBe('2026-03-12')
    expect(leer('31/02/2026').fecha).toBeNull()
  })

  it('DNI con y sin puntos', () => {
    expect(leer('DNI: 30.123.456').documento).toBe('30123456')
    expect(leer('DNI 30123456').documento).toBe('30123456')
  })

  it('CUIL con y sin guiones', () => {
    expect(leer('CUIL 27-12345678-4').documento).toBe('27123456784')
    expect(leer('CUIT: 20301234565').documento).toBe('20301234565')
  })

  it('un texto sin nada no inventa nada', () => {
    expect(leer('hola, cómo estás')).toEqual({ monto: null, moneda: null, fecha: null, remitente: null, documento: null, referencia: null })
    expect(leer('')).toEqual({ monto: null, moneda: null, fecha: null, remitente: null, documento: null, referencia: null })
  })

  it('un número de operación largo no se confunde con el monto', () => {
    expect(leer('Recibiste $ 25.000 de Ana Lopez\nOperación 998877665544').monto).toBe(25000)
  })
})

// ---- Sugerencias ----------------------------------------------------------------

const pac = (id: string, nombre: string, apellido: string, extra: Partial<PacienteConciliar> = {}): PacienteConciliar => ({
  id, nombre, apellido, dni: null, cuil_cuit: null, moneda: 'ARS', activo: true, ...extra,
})
const lucia = pac('l', 'Lucía', 'Fernández', { dni: '30.123.456', cuil_cuit: '27-30123456-4' })
const maria = pac('m', 'María Elena', 'García')
const sofia = pac('s', 'Sofía', 'García')
const pedro = pac('p', 'Pedro', 'Ruiz')
const todos = [lucia, maria, sofia, pedro]
const comp = (extra: Partial<DatosComprobante>): DatosComprobante => ({ monto: null, moneda: null, fecha: null, remitente: null, documento: null, referencia: null, ...extra })

describe('sugerir', () => {
  it('el CUIL del comprobante es el del paciente: seguro', () => {
    const s = sugerir(comp({ documento: '27301234564', remitente: 'Alguien Otro' }), todos)
    expect(s.candidatos[0]).toMatchObject({ patient_id: 'l', puntaje: 100 })
    expect(s.confianza).toBe('alta')
  })

  it('el CUIL lleva el DNI en el medio: 27-DNI-4 también se reconoce con el DNI cargado', () => {
    const solo = pac('x', 'Ana', 'Lopez', { dni: '12345678' })
    expect(sugerir(comp({ documento: '27123456784' }), [solo]).candidatos[0]).toMatchObject({ patient_id: 'x', puntaje: 100 })
    expect(sugerir(comp({ documento: '12345678' }), [solo]).candidatos[0].puntaje).toBe(100)
  })

  it('un DNI corto con ceros adelante también coincide', () => {
    const viejo = pac('v', 'Rosa', 'Diaz', { dni: '5123456' })
    expect(sugerir(comp({ documento: '05123456' }), [viejo]).candidatos[0].puntaje).toBe(100)
  })

  it('el nombre del paciente, sin tildes ni mayúsculas ni orden', () => {
    const s = sugerir(comp({ remitente: 'FERNANDEZ LUCIA' }), todos)
    expect(s.candidatos[0]).toMatchObject({ patient_id: 'l', puntaje: 80 })
    expect(s.confianza).toBe('media')
    expect(s.candidatos).toHaveLength(1)
  })

  it('un familiar con el mismo apellido: dos candidatos y confianza baja', () => {
    const s = sugerir(comp({ remitente: 'Jose Garcia' }), todos)
    expect(s.candidatos.map((c) => [c.patient_id, c.puntaje])).toEqual([['m', 35], ['s', 35]])
    expect(s.candidatos[0].motivos[0]).toMatch(/familiar/)
    expect(s.confianza).toBe('baja')
  })

  it('el monto desempata: coincide con lo que debe una de las dos hermanas', () => {
    const s = sugerir(comp({ remitente: 'Jose Garcia', monto: 25000, moneda: 'ARS' }), todos, { deudas: { m: { moneda: 'ARS', total: 25000, porMes: [25000] } } })
    expect(s.candidatos[0]).toMatchObject({ patient_id: 'm', puntaje: 60 })
    expect(s.candidatos[0].motivos).toContain('el monto es justo lo que debe')
    expect(s.candidatos[1]).toMatchObject({ patient_id: 's', puntaje: 35 })
    expect(s.confianza).toBe('media')
  })

  it('el monto de un mes (aunque deba más) también suma, un poco menos', () => {
    const s = sugerir(comp({ remitente: 'Jose Garcia', monto: 30000 }), todos, { deudas: { s: { moneda: 'ARS', total: 90000, porMes: [30000, 30000, 30000] } } })
    expect(s.candidatos[0]).toMatchObject({ patient_id: 's', puntaje: 55 })
    expect(s.candidatos[0].motivos).toContain('el monto es lo de un mes')
  })

  it('el monto solo no alcanza para sugerir a alguien', () => {
    expect(sugerir(comp({ monto: 25000 }), todos, { deudas: { m: { moneda: 'ARS', total: 25000, porMes: [25000] } } }).candidatos).toEqual([])
  })

  it('un pagador conocido (la mamá que ya pagó antes) se reconoce aunque no tenga nada que ver con el nombre', () => {
    const conocidos = [{ nombre: 'Roberto Fernández', patient_id: 'l' }]
    const s = sugerir(comp({ remitente: 'FERNANDEZ ROBERTO' }), todos, { conocidos })
    expect(s.candidatos[0]).toMatchObject({ patient_id: 'l', puntaje: 90 })
    expect(s.confianza).toBe('alta')
    expect(s.candidatos[0].motivos[0]).toMatch(/ya pagó antes/)
  })

  it('un pagador conocido de OTRO paciente no sirve para este', () => {
    const s = sugerir(comp({ remitente: 'Roberto Perez' }), todos, { conocidos: [{ nombre: 'Roberto Perez', patient_id: 'p' }] })
    expect(s.candidatos).toHaveLength(1)
    expect(s.candidatos[0].patient_id).toBe('p')
  })

  it('moneda distinta resta puntos', () => {
    const s = sugerir(comp({ remitente: 'Pedro Ruiz', monto: 40, moneda: 'USD' }), todos)
    expect(s.candidatos[0]).toMatchObject({ patient_id: 'p', puntaje: 50 })
    expect(s.candidatos[0].motivos.join(' ')).toMatch(/paga en ARS/)
    expect(s.confianza).toBe('baja')
  })

  it('el paciente de baja resta puntos', () => {
    const baja = pac('b', 'Pedro', 'Ruiz', { activo: false })
    expect(sugerir(comp({ remitente: 'Pedro Ruiz' }), [baja]).candidatos[0].puntaje).toBe(70)
  })

  it('solo el nombre de pila: candidato débil', () => {
    const s = sugerir(comp({ remitente: 'Pedro Gomez' }), todos)
    expect(s.candidatos).toHaveLength(1)
    expect(s.candidatos[0]).toMatchObject({ patient_id: 'p', puntaje: 15 })
    expect(s.confianza).toBe('baja')
  })

  it('«Mariana» no es «Ana», y «Sofi» no es «Sofía»', () => {
    const ana = pac('a', 'Ana', 'Lopez')
    expect(sugerir(comp({ remitente: 'Mariana Lopez' }), [ana]).candidatos[0].puntaje).toBe(35) // solo el apellido
    expect(sugerir(comp({ remitente: 'Sofi Torres' }), [sofia]).candidatos).toEqual([])
  })

  it('sin remitente ni documento no sugiere a nadie', () => {
    const s = sugerir(comp({ monto: 25000 }), todos)
    expect(s).toEqual({ candidatos: [], confianza: 'baja' })
  })

  it('devuelve como mucho 5, de mayor a menor puntaje', () => {
    const muchos = Array.from({ length: 8 }, (_, i) => pac(`g${i}`, `Nombre${i}`, 'García'))
    const s = sugerir(comp({ remitente: 'Pepe García' }), muchos)
    expect(s.candidatos).toHaveLength(5)
    expect(s.candidatos.every((c, i, a) => i === 0 || a[i - 1].puntaje >= c.puntaje)).toBe(true)
  })

  it('el puntaje nunca pasa de 100 ni baja de 0', () => {
    const s = sugerir(comp({ documento: '27301234564', monto: 25000 }), [lucia], { deudas: { l: { moneda: 'ARS', total: 25000, porMes: [25000] } } })
    expect(s.candidatos[0].puntaje).toBe(100)
  })
})

describe('de punta a punta', () => {
  it('pega el texto, lee y sugiere', () => {
    const texto = 'Recibiste $ 25.000 de Maria Elena Garcia\n12 de marzo de 2026\nNúmero de operación 123456789012'
    const c = leerComprobante(texto, HOY)
    const s = sugerir(c, todos, { deudas: { m: { moneda: 'ARS', total: 25000, porMes: [25000] } } })
    expect(s.candidatos[0].patient_id).toBe('m')
    expect(s.candidatos[0].puntaje).toBe(100) // 80 por el nombre + 25 por el monto, tope 100
    expect(s.confianza).toBe('alta')
  })

  it('el pago de la mamá: primera vez a revisar, y después se reconoce sola', () => {
    const c = leerComprobante('Te transfirió Roberto Fernandez $ 30.000 el 5/3/26', HOY)
    const primera = sugerir(c, todos)
    expect(primera.candidatos).toHaveLength(1) // solo por el apellido
    expect(primera.confianza).toBe('baja')
    const conocidos = aprenderPagador(c, lucia, [])
    const segunda = sugerir(leerComprobante('Recibiste $ 30.000 de FERNANDEZ ROBERTO', HOY), todos, { conocidos })
    expect(segunda.candidatos[0]).toMatchObject({ patient_id: 'l', puntaje: 90 })
    expect(segunda.confianza).toBe('alta')
  })
})

describe('posibleDuplicado', () => {
  const pagos = [{ patient_id: 'l', monto: 25000, moneda: 'ARS' as const, fecha: '2026-03-12', observaciones: null as string | null }]
  const c = comp({ monto: 25000, moneda: 'ARS', fecha: '2026-03-12', referencia: 'AB12CD34' })

  it('mismo paciente, monto, moneda y fecha', () => {
    expect(posibleDuplicado(c, pagos, 'l')).toBe(true)
  })
  it('la referencia anotada en observaciones también lo delata, aunque la fecha sea otra', () => {
    expect(posibleDuplicado({ ...c, fecha: '2026-03-15' }, [{ ...pagos[0], observaciones: 'op. ab12cd34' }], 'l')).toBe(true)
  })
  it('no es duplicado si cambia el paciente, el monto, la moneda o no hay fecha ni referencia en común', () => {
    expect(posibleDuplicado(c, pagos, 'p')).toBe(false)
    expect(posibleDuplicado({ ...c, monto: 30000 }, pagos, 'l')).toBe(false)
    expect(posibleDuplicado({ ...c, moneda: 'USD' }, pagos, 'l')).toBe(false)
    expect(posibleDuplicado({ ...c, fecha: '2026-04-12', referencia: 'ZZ99' }, pagos, 'l')).toBe(false)
    expect(posibleDuplicado({ ...c, monto: null }, pagos, 'l')).toBe(false)
  })
  it('dos pagos iguales en meses distintos (la cuota de siempre) no se marcan solo por el monto', () => {
    expect(posibleDuplicado({ ...c, fecha: '2026-04-12', referencia: null }, pagos, 'l')).toBe(false)
  })
})

describe('aprenderPagador', () => {
  it('suma al pagador nuevo', () => {
    expect(aprenderPagador(comp({ remitente: 'Roberto Fernandez' }), lucia, [])).toEqual([{ nombre: 'Roberto Fernandez', patient_id: 'l' }])
  })
  it('no suma al paciente mismo, ni a un pagador repetido (aunque venga con otro orden), ni sin remitente', () => {
    expect(aprenderPagador(comp({ remitente: 'FERNANDEZ LUCIA' }), lucia, [])).toEqual([])
    const ya = [{ nombre: 'Roberto Fernandez', patient_id: 'l' }]
    expect(aprenderPagador(comp({ remitente: 'FERNANDEZ ROBERTO' }), lucia, ya)).toBe(ya)
    expect(aprenderPagador(comp({}), lucia, ya)).toBe(ya)
  })
  it('el mismo remitente puede ser pagador de dos pacientes distintos', () => {
    const una = aprenderPagador(comp({ remitente: 'Roberto Garcia' }), maria, [])
    expect(aprenderPagador(comp({ remitente: 'Roberto Garcia' }), sofia, una)).toHaveLength(2)
  })
})
