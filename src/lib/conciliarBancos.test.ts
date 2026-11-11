import { describe, expect, it } from 'vitest'
import { leerComprobante } from './conciliar'

// Textos SINTÉTICOS con el estilo de cada app (nombres, CUIT y números inventados; no hay datos reales).
const HOY = '2026-11-10'
const leer = (t: string) => leerComprobante(t, HOY)

const CASOS: { nombre: string; texto: string; esperado: Partial<ReturnType<typeof leer>> }[] = [
  { nombre: 'Mercado Pago: recibiste', texto: 'Recibiste $ 30.000 de Lucia Fernandez\n5 de noviembre de 2026\nNúmero de operación 99887766554', esperado: { monto: 30000, fecha: '2026-11-05', remitente: 'Lucia Fernandez', referencia: '99887766554' } },
  { nombre: 'Mercado Pago: te transfirió con decimales', texto: 'Te transfirió Carlos Ruiz $ 18.500,50\n03/11/2026', esperado: { monto: 18500.5, fecha: '2026-11-03', remitente: 'Carlos Ruiz' } },
  { nombre: 'Mercado Pago: comprobante con CUIT', texto: 'Comprobante de transferencia\n$ 42.000\nDe Marta Soria\nCUIT/CUIL 27-30111222-4\nOperación 5544332211', esperado: { monto: 42000, remitente: 'Marta Soria', documento: '27301112224', referencia: '5544332211' } },
  { nombre: 'Mercado Pago: dinero recibido sin remitente', texto: 'Dinero recibido\n$ 25.000\n10/11/2026', esperado: { monto: 25000, fecha: '2026-11-10', remitente: null } },
  { nombre: 'Brubank: transferencia recibida', texto: 'Transferencia recibida\nImporte: $ 27.000,00\nOrdenante: PEREZ JUAN CARLOS\nFecha: 2026-11-04', esperado: { monto: 27000, fecha: '2026-11-04', remitente: 'PEREZ JUAN CARLOS' } },
  { nombre: 'Brubank: con CUIT y referencia', texto: 'Brubank\nTe enviaron $ 15.000\nEnviado por Sofia Navarro\nCUIT 20-28999888-1\nNúmero de operación: AB12345678', esperado: { monto: 15000, remitente: 'Sofia Navarro', documento: '20289998881', referencia: 'AB12345678' } },
  { nombre: 'Galicia: transferencia con titular', texto: 'Banco Galicia\nComprobante de transferencia\nImporte transferido: $ 60.000,00\nTitular cuenta origen: GOMEZ ANA MARIA\nFecha 07/11/2026\nNro. de comprobante 00123456', esperado: { monto: 60000, fecha: '2026-11-07', remitente: 'GOMEZ ANA MARIA' } },
  { nombre: 'Galicia: monto con signo y fecha corta', texto: 'Transferencia realizada\nMonto $ 12.000\nOrdenante: Diaz Pablo\n4/11/26', esperado: { monto: 12000, fecha: '2026-11-04', remitente: 'Diaz Pablo' } },
  { nombre: 'Galicia: ignora saldo disponible', texto: 'Transferencia recibida\nImporte: $ 20.000,00\nSaldo disponible: $ 1.500.000,00\nOrdenante: LOPEZ MARTA', esperado: { monto: 20000, remitente: 'LOPEZ MARTA' } },
  { nombre: 'Santander: transferencia recibida', texto: 'Santander\nTransferencia recibida\nImporte $ 35.000,00\nOrigen: RAMIREZ LAURA BEATRIZ\nCUIL 27-25111333-9\nFecha: 06/11/2026', esperado: { monto: 35000, fecha: '2026-11-06', remitente: 'RAMIREZ LAURA BEATRIZ', documento: '27251113339' } },
  { nombre: 'Santander: ignora comisión', texto: 'Transferencia enviada\nImporte: $ 50.000,00\nComisión: $ 100,00\nOrdenante: SUAREZ DIEGO', esperado: { monto: 50000, remitente: 'SUAREZ DIEGO' } },
  { nombre: 'Santander: DNI', texto: 'Recibiste una transferencia\nMonto: $ 22.500\nRemitente: Castro Elena\nDNI 30.123.456', esperado: { monto: 22500, remitente: 'Castro Elena', documento: '30123456' } },
  { nombre: 'Cuenta DNI: transferencia recibida', texto: 'Cuenta DNI\nRecibiste $ 16.000 de Romina Acosta\n09/11/2026\nCódigo de transferencia: CDN778899', esperado: { monto: 16000, fecha: '2026-11-09', remitente: 'Romina Acosta', referencia: 'CDN778899' } },
  { nombre: 'Cuenta DNI: te pagó', texto: 'Te pagó Hector Molina $ 9.800,00 el 8 de noviembre', esperado: { monto: 9800, fecha: '2026-11-08', remitente: 'Hector Molina' } },
  { nombre: 'Cuenta DNI: sin signo de pesos', texto: 'Comprobante\nImporte: 14.000,00\nOrigen: Vega Nicolas\nFecha 02-11-2026', esperado: { monto: 14000, fecha: '2026-11-02', remitente: 'Vega Nicolas' } },
  { nombre: 'USD en dólares', texto: 'Recibiste US$ 45,00 de Julia Ortega\n2026-11-01', esperado: { monto: 45, moneda: 'USD', fecha: '2026-11-01', remitente: 'Julia Ortega' } },
  { nombre: 'Whatsapp pegado con texto libre', texto: 'Ya te transferí! Comprobante: Transferencia por $ 28.000 el 5/11/2026', esperado: { monto: 28000, fecha: '2026-11-05' } },
  { nombre: 'Monto con miles sin decimales y mes en letras con año', texto: 'Recibiste $ 1.250.000 de Estudio Rivas\n1 de noviembre de 2026', esperado: { monto: 1250000, fecha: '2026-11-01' } },
  { nombre: 'Sin datos reconocibles no inventa', texto: 'hola, ya pagué, gracias', esperado: { monto: null, moneda: null, fecha: null, remitente: null, documento: null, referencia: null } },
  { nombre: 'Fecha sin año usa el del día de hoy', texto: 'Recibiste $ 5.000 de Ines Paz\n3 de noviembre', esperado: { monto: 5000, fecha: '2026-11-03', remitente: 'Ines Paz' } },
]

describe('leerComprobante: formatos de bancos y billeteras (textos sintéticos)', () => {
  it.each(CASOS)('$nombre', ({ texto, esperado }) => {
    expect(leer(texto)).toMatchObject(esperado)
  })
})
