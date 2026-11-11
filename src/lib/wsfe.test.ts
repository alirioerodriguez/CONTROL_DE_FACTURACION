import { describe, expect, it } from 'vitest'
import forge from 'node-forge'
import {
  armarTRA,
  condicionIvaReceptor,
  CONDICIONES_IVA_RECEPTOR,
  condicionValida,
  leerCondicionesIvaReceptor,
  pedidoCondicionesIvaReceptor,
  documento,
  DOC,
  erroresArca,
  firmarTRA,
  leerCae,
  leerCotizacion,
  leerTicket,
  leerUltimo,
  linkQr,
  mensajeErrores,
  numeroFactura,
  pedidoFacturaC,
  pedidoUltimo,
  sobreLoginCms,
} from '../../supabase/functions/arca-factura/wsfe'

const auth = { token: 'TOK', sign: 'SIG', cuit: '27301234564' }

// Certificado de prueba hecho en el momento (no es de ARCA)
function certificadoDePrueba() {
  const claves = forge.pki.rsa.generateKeyPair(1024)
  const cert = forge.pki.createCertificate()
  cert.publicKey = claves.publicKey
  cert.serialNumber = '01'
  cert.validity.notBefore = new Date()
  cert.validity.notAfter = new Date(Date.now() + 86400000)
  const nombre = [{ name: 'commonName', value: 'honorapp' }, { name: 'serialNumber', value: 'CUIT 20111111112' }]
  cert.setSubject(nombre)
  cert.setIssuer(nombre)
  cert.sign(claves.privateKey, forge.md.sha256.create())
  return { cert: forge.pki.certificateToPem(cert), key: forge.pki.privateKeyToPem(claves.privateKey) }
}

describe('WSAA', () => {
  it('arma el pedido de ticket con 10 minutos de margen y hora argentina', () => {
    const tra = armarTRA('wsfe', Date.UTC(2026, 10, 1, 15, 0, 0))
    expect(tra).toContain('<service>wsfe</service>')
    expect(tra).toContain('<generationTime>2026-11-01T11:50:00-03:00</generationTime>')
    expect(tra).toContain('<expirationTime>2026-11-01T12:10:00-03:00</expirationTime>')
  })

  it('firma el pedido (CMS con el contenido adentro) y se puede leer de vuelta', () => {
    const { cert, key } = certificadoDePrueba()
    const tra = armarTRA('wsfe', Date.now())
    const b64 = firmarTRA(tra, cert, key, forge as never)
    const p7 = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(forge.util.decode64(b64))) as unknown as {
      rawCapture: { content: { value: { value: string }[] } }
      certificates: forge.pki.Certificate[]
    }
    expect(p7.certificates[0].subject.getField('CN').value).toBe('honorapp')
    const contenido = p7.rawCapture.content.value[0].value
    expect(contenido).toBe(tra)
    expect(sobreLoginCms(b64)).toContain(`<wsaa:in0>${b64}</wsaa:in0>`)
  })

  it('lee el ticket de la respuesta (viene escapado adentro de loginCmsReturn)', () => {
    const interno = '<loginTicketResponse><header><expirationTime>2026-11-02T03:00:00.000-03:00</expirationTime></header><credentials><token>T0K3N</token><sign>S1GN</sign></credentials></loginTicketResponse>'
    const resp = `<soapenv:Envelope><soapenv:Body><loginCmsResponse><loginCmsReturn>${interno.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</loginCmsReturn></loginCmsResponse></soapenv:Body></soapenv:Envelope>`
    expect(leerTicket(resp)).toEqual({ token: 'T0K3N', sign: 'S1GN', vence: '2026-11-02T06:00:00.000Z' })
  })

  it('un error de acceso se explica', () => {
    const resp = '<soapenv:Envelope><soapenv:Body><soapenv:Fault><faultcode>ns1:cms.cert.untrusted</faultcode><faultstring>Certificado no emitido por AC de confianza</faultstring></soapenv:Fault></soapenv:Body></soapenv:Envelope>'
    expect(() => leerTicket(resp)).toThrow('Certificado no emitido por AC de confianza')
  })
})

describe('Factura C', () => {
  it('condición frente al IVA y documento del receptor', () => {
    expect(condicionIvaReceptor('Consumidor final')).toBe(5)
    expect(condicionIvaReceptor(null)).toBe(5)
    expect(condicionIvaReceptor('Monotributista')).toBe(6)
    expect(condicionIvaReceptor('Responsable inscripto')).toBe(1)
    expect(condicionIvaReceptor('Exento')).toBe(4)
    expect(documento('27-30123456-4', null)).toEqual({ tipo: DOC.CUIL, numero: '27301234564' })
    expect(documento('30-71234567-1', null)).toEqual({ tipo: DOC.CUIT, numero: '30712345671' })
    expect(documento(null, '30.123.456')).toEqual({ tipo: DOC.DNI, numero: '30123456' })
    expect(documento(null, null)).toEqual({ tipo: DOC.SIN, numero: '0' })
  })

  it('arma el pedido de CAE de servicios en pesos', () => {
    const { cuerpo, soapAction } = pedidoFacturaC(auth, {
      puntoVenta: 3, numero: 124, fecha: '2026-11-01', desde: '2026-10-01', hasta: '2026-10-31', vencePago: '2026-11-01',
      total: 48000, moneda: 'ARS', doc: { tipo: DOC.DNI, numero: '30123456' }, condicionIva: 5,
    })
    expect(soapAction).toBe('http://ar.gov.afip.dif.FEV1/FECAESolicitar')
    expect(cuerpo).toContain('<Cuit>27301234564</Cuit>')
    expect(cuerpo).toContain('<PtoVta>3</PtoVta><CbteTipo>11</CbteTipo>')
    expect(cuerpo).toContain('<Concepto>2</Concepto><DocTipo>96</DocTipo><DocNro>30123456</DocNro>')
    expect(cuerpo).toContain('<CbteDesde>124</CbteDesde><CbteHasta>124</CbteHasta><CbteFch>20261101</CbteFch>')
    expect(cuerpo).toContain('<ImpTotal>48000.00</ImpTotal><ImpTotConc>0.00</ImpTotConc><ImpNeto>48000.00</ImpNeto>')
    expect(cuerpo).toContain('<FchServDesde>20261001</FchServDesde><FchServHasta>20261031</FchServHasta>')
    expect(cuerpo).toContain('<MonId>PES</MonId><MonCotiz>1</MonCotiz><CondicionIVAReceptorId>5</CondicionIVAReceptorId>')
  })

  it('RG 5616: todo pedido de CAE lleva la condición frente al IVA del receptor (ARCA rechaza sin ella desde el 01/12/2026)', () => {
    const casos = [
      { moneda: 'ARS' as const, doc: { tipo: DOC.SIN, numero: '0' } },
      { moneda: 'ARS' as const, doc: { tipo: DOC.DNI, numero: '30123456' } },
      { moneda: 'USD' as const, cotizacion: 1400, doc: { tipo: DOC.CUIT, numero: '30712345671' } },
    ]
    for (const c of casos) {
      for (const cond of [null, undefined, '', 'Consumidor final', 'Monotributista', 'Responsable inscripto', 'Exento', 'algo raro']) {
        const { cuerpo } = pedidoFacturaC(auth, {
          puntoVenta: 3, numero: 1, fecha: '2026-12-01', desde: '2026-11-01', hasta: '2026-11-30', vencePago: '2026-12-01',
          total: 1000, ...c, condicionIva: condicionIvaReceptor(cond),
        })
        const m = /<CondicionIVAReceptorId>(\d+)<\/CondicionIVAReceptorId>/.exec(cuerpo)
        expect(m, `sin condición para ${JSON.stringify(cond)}`).not.toBeNull()
        expect(Number(m![1])).toBeGreaterThan(0)
      }
    }
  })

  it('una condición desconocida cae en consumidor final (5), nunca en vacío', () => {
    expect(condicionIvaReceptor('algo raro')).toBe(5)
    expect(condicionIvaReceptor('')).toBe(5)
  })

  it('en dólares manda la cotización y que se cobra en la misma moneda', () => {
    const { cuerpo } = pedidoFacturaC(auth, {
      puntoVenta: 3, numero: 1, fecha: '2026-11-01', desde: '2026-10-01', hasta: '2026-10-31', vencePago: '2026-11-01',
      total: 50.5, moneda: 'USD', cotizacion: 1415.5, doc: { tipo: DOC.SIN, numero: '0' }, condicionIva: 5,
    })
    expect(cuerpo).toContain('<ImpTotal>50.50</ImpTotal>')
    expect(cuerpo).toContain('<MonId>DOL</MonId><MonCotiz>1415.5</MonCotiz><CanMisMonExt>S</CanMisMonExt>')
  })

  it('lee una factura aprobada con su CAE', () => {
    const resp = `<soap:Envelope><soap:Body><FECAESolicitarResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECAESolicitarResult>
      <FeCabResp><Cuit>27301234564</Cuit><PtoVta>3</PtoVta><CbteTipo>11</CbteTipo><Resultado>A</Resultado></FeCabResp>
      <FeDetResp><FECAEDetResponse><Concepto>2</Concepto><DocTipo>96</DocTipo><DocNro>30123456</DocNro><CbteDesde>124</CbteDesde><CbteHasta>124</CbteHasta>
      <CbteFch>20261101</CbteFch><Resultado>A</Resultado><CAE>76451234567890</CAE><CAEFchVto>20261111</CAEFchVto></FECAEDetResponse></FeDetResp>
      </FECAESolicitarResult></FECAESolicitarResponse></soap:Body></soap:Envelope>`
    expect(leerCae(resp)).toEqual({ ok: true, cae: '76451234567890', vence: '2026-11-11', numero: 124, observaciones: [] })
  })

  it('lee un rechazo con sus motivos', () => {
    const resp = `<soap:Envelope><soap:Body><FECAESolicitarResponse><FECAESolicitarResult>
      <FeCabResp><Resultado>R</Resultado></FeCabResp>
      <FeDetResp><FECAEDetResponse><Resultado>R</Resultado><Observaciones><Obs><Code>10015</Code><Msg>Factura B/C: si DocTipo es 99, DocNro debe ser 0</Msg></Obs></Observaciones></FECAEDetResponse></FeDetResp>
      </FECAESolicitarResult></FECAESolicitarResponse></soap:Body></soap:Envelope>`
    const r = leerCae(resp)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(mensajeErrores(r.errores)).toBe('Factura B/C: si DocTipo es 99, DocNro debe ser 0 (código 10015)')
  })

  it('sin permiso (no delegó) lo dice en castellano claro', () => {
    const resp = '<soap:Envelope><soap:Body><FECompUltimoAutorizadoResponse><FECompUltimoAutorizadoResult><Errors><Err><Code>600</Code><Msg>ValidacionDeToken: No aparecio CUIT en lista de relaciones: 27301234564</Msg></Err></Errors></FECompUltimoAutorizadoResult></FECompUltimoAutorizadoResponse></soap:Body></soap:Envelope>'
    expect(erroresArca(resp).errores[0].codigo).toBe('600')
    expect(() => leerUltimo(resp)).toThrow('revisá que delegaste «Facturación Electrónica» en ARCA')
  })

  it('último número y cotización', () => {
    expect(leerUltimo('<x><CbteNro>123</CbteNro></x>')).toBe(123)
    expect(leerUltimo('<x><PtoVta>3</PtoVta></x>')).toBe(0)
    expect(leerCotizacion('<x><ResultGet><MonId>DOL</MonId><MonCotiz>1415.5</MonCotiz></ResultGet></x>')).toBe(1415.5)
    expect(pedidoUltimo(auth, 3).cuerpo).toContain('<PtoVta>3</PtoVta><CbteTipo>11</CbteTipo>')
  })

  it('QR y número para el comprobante', () => {
    const link = linkQr(
      { fecha: '2026-11-01', cuit: '27301234564', puntoVenta: 3, numero: 124, total: 48000, moneda: 'ARS', doc: { tipo: 96, numero: '30123456' }, cae: '76451234567890' },
      (s) => Buffer.from(s).toString('base64'),
    )
    const datos = JSON.parse(Buffer.from(link.split('?p=')[1], 'base64').toString())
    expect(datos).toMatchObject({ ver: 1, cuit: 27301234564, ptoVta: 3, tipoCmp: 11, nroCmp: 124, importe: 48000, moneda: 'PES', tipoCodAut: 'E', codAut: 76451234567890 })
    expect(numeroFactura(3, 124)).toBe('C 00003-00000124')
  })
})

describe('tabla de condiciones del receptor (RG 5616)', () => {
  it('todo lo que la app puede mandar está en la tabla (1, 4, 5 y 6)', () => {
    for (const c of ['Consumidor final', 'Monotributista', 'Responsable inscripto', 'Exento', null, '', 'algo raro']) {
      expect(CONDICIONES_IVA_RECEPTOR[condicionIvaReceptor(c)], String(c)).toBeTruthy()
    }
  })

  it('los códigos 2, 3, 11, 12 y 14 no existen (según la guía consultada)', () => {
    for (const id of [2, 3, 11, 12, 14]) expect(CONDICIONES_IVA_RECEPTOR[id]).toBeUndefined()
    expect(Object.keys(CONDICIONES_IVA_RECEPTOR).map(Number)).toEqual([1, 4, 5, 6, 7, 8, 9, 10, 13, 15, 16])
  })

  it('arma el pedido de la tabla a ARCA, con o sin clase de comprobante', () => {
    const a = { token: 'T', sign: 'S', cuit: '27301234564' }
    expect(pedidoCondicionesIvaReceptor(a).soapAction).toBe('http://ar.gov.afip.dif.FEV1/FEParamGetCondicionIvaReceptor')
    expect(pedidoCondicionesIvaReceptor(a).cuerpo).not.toContain('<ClaseCmp>')
    expect(pedidoCondicionesIvaReceptor(a, 'C').cuerpo).toContain('<ClaseCmp>C</ClaseCmp>')
  })

  it('lee la respuesta, junta las clases por condición y rechaza lo vacío o con error', () => {
    const xml = `<soap:Envelope><soap:Body><FEParamGetCondicionIvaReceptorResponse><FEParamGetCondicionIvaReceptorResult><ResultGet>
      <CondicionIvaReceptor><Id>1</Id><Desc>IVA Responsable Inscripto</Desc><Cmp_Clase>A</Cmp_Clase></CondicionIvaReceptor>
      <CondicionIvaReceptor><Id>1</Id><Desc>IVA Responsable Inscripto</Desc><Cmp_Clase>C</Cmp_Clase></CondicionIvaReceptor>
      <CondicionIvaReceptor><Id>5</Id><Desc>Consumidor Final</Desc><Cmp_Clase>B</Cmp_Clase></CondicionIvaReceptor>
      <CondicionIvaReceptor><Id>5</Id><Desc>Consumidor Final</Desc><Cmp_Clase>C</Cmp_Clase></CondicionIvaReceptor>
    </ResultGet></FEParamGetCondicionIvaReceptorResult></FEParamGetCondicionIvaReceptorResponse></soap:Body></soap:Envelope>`
    const tabla = leerCondicionesIvaReceptor(xml)
    expect(tabla).toEqual([
      { id: 1, descripcion: 'IVA Responsable Inscripto', clases: ['A', 'C'] },
      { id: 5, descripcion: 'Consumidor Final', clases: ['B', 'C'] },
    ])
    expect(condicionValida(5, tabla, 'C')).toBe(true)
    expect(condicionValida(5, tabla, 'A')).toBe(false) // un consumidor final no recibe una A
    expect(condicionValida(6, tabla)).toBe(false) // no vino en la tabla
    expect(() => leerCondicionesIvaReceptor('<x/>')).toThrow('no devolvió condiciones')
    expect(() => leerCondicionesIvaReceptor('<Errors><Err><Code>600</Code><Msg>Token vencido</Msg></Err></Errors>')).toThrow('Token vencido')
  })
})
