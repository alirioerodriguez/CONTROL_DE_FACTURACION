import { describe, expect, it } from 'vitest'
import { avisoCerradoHace, DIAS_SIN_AVISO, navegadorDe, plataformaDe } from './instalar'

const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36'
const SAMSUNG = 'Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
const WIN_EDGE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Edg/126.0'

describe('plataformaDe', () => {
  it('reconoce Android, iPhone, iPad (que se hace pasar por Mac) y la compu', () => {
    expect(plataformaDe(ANDROID_CHROME)).toBe('android')
    expect(plataformaDe(IPHONE)).toBe('ios')
    expect(plataformaDe(IPAD, 5)).toBe('ios')
    expect(plataformaDe(IPAD, 0)).toBe('escritorio')
    expect(plataformaDe(WIN_EDGE)).toBe('escritorio')
  })
})

describe('navegadorDe', () => {
  it('distingue Samsung Internet, Edge, Chrome y Safari', () => {
    expect(navegadorDe(SAMSUNG)).toBe('samsung')
    expect(navegadorDe(WIN_EDGE)).toBe('edge')
    expect(navegadorDe(ANDROID_CHROME)).toBe('chrome')
    expect(navegadorDe(IPHONE)).toBe('safari')
  })
})

describe('avisoCerradoHace', () => {
  const ahora = Date.UTC(2026, 9, 19)
  it('no vuelve hasta que pasan los días', () => {
    expect(avisoCerradoHace(null, ahora)).toBe(false)
    expect(avisoCerradoHace('basura', ahora)).toBe(false)
    expect(avisoCerradoHace(String(ahora - 86_400_000), ahora)).toBe(true)
    expect(avisoCerradoHace(String(ahora - (DIAS_SIN_AVISO + 1) * 86_400_000), ahora)).toBe(false)
  })
})
