import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Boton, Confirmar, IC, Tarjeta } from '../../components/ui'
import { mensajeError, supabase } from '../../lib/supabase'

interface Alta {
  id: string
  qr: string
  secreto: string
}

/**
 * Tarjeta de Ajustes: doble factor optativo con una app autenticadora (TOTP de Supabase).
 * Quien lo activa necesita el código para entrar; la base de datos también lo exige (supabase/schema.sql, mfa_ok).
 */
export function DobleFactor() {
  const [activo, setActivo] = useState<string | null>(null) // id del factor verificado
  const [cargando, setCargando] = useState(true)
  const [alta, setAlta] = useState<Alta | null>(null)
  const [codigo, setCodigo] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  const [confirmarBaja, setConfirmarBaja] = useState(false)

  async function revisar() {
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (!error) setActivo(data.totp.find((f) => f.status === 'verified')?.id ?? null)
    setCargando(false)
  }
  useEffect(() => { revisar() }, [])

  async function empezar() {
    setTrabajando(true)
    try {
      // Si quedó un alta a medio hacer, se borra antes de empezar otra.
      const { data: previos } = await supabase.auth.mfa.listFactors()
      for (const f of previos?.all ?? []) if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id })
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'honorapp' })
      if (error) throw error
      setAlta({ id: data.id, qr: data.totp.qr_code, secreto: data.totp.secret })
      setCodigo('')
    } catch (e) {
      toast.error(`No se pudo empezar: ${mensajeError(e)}`)
    } finally {
      setTrabajando(false)
    }
  }

  async function confirmar() {
    if (!alta || !/^\d{6}$/.test(codigo)) return toast.error('Escribí el código de 6 números que muestra la app.')
    setTrabajando(true)
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: alta.id, code: codigo })
      if (error) throw error
      setAlta(null)
      await revisar()
      toast.success('Doble factor activado: la próxima vez que entres te va a pedir el código.')
    } catch (e) {
      toast.error(/invalid|expired/i.test(mensajeError(e)) ? 'El código no es correcto. Probá con el que muestra ahora la app.' : mensajeError(e))
    } finally {
      setTrabajando(false)
    }
  }

  async function desactivar() {
    if (!activo) return
    setTrabajando(true)
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: activo })
      if (error) throw error
      setConfirmarBaja(false)
      await revisar()
      toast.success('Doble factor desactivado')
    } catch (e) {
      toast.error(`No se pudo desactivar: ${mensajeError(e)}`)
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <Tarjeta className="flex flex-col gap-3 p-[1.375rem]">
      <h2 className="m-0 flex items-center gap-2 text-lg font-semibold">
        <ShieldCheck {...IC} /> Doble factor
      </h2>
      <p className="m-0 text-[0.9375rem] text-ink2">
        Además de la contraseña, al entrar te pide un código de 6 números de una app como Google Authenticator o Authy. Así, aunque alguien sepa tu contraseña, no puede ver a tus pacientes.
      </p>

      {cargando ? null : activo ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-semibold text-acc-strong">Activado</span>
          <Boton variante="borde" onClick={() => setConfirmarBaja(true)}>Desactivar</Boton>
        </div>
      ) : alta ? (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-[0.9375rem]">1. En la app autenticadora, agregá una cuenta nueva y escaneá este código:</p>
          <img src={alta.qr} alt="Código QR para la app autenticadora" width={176} height={176} className="size-44 self-start rounded-xl bg-white p-2" />
          <p className="m-0 text-sm text-ink2">
            ¿No podés escanear? Escribí esta clave a mano: <span className="font-mono break-all text-ink">{alta.secreto}</span>
          </p>
          <label className="flex flex-col gap-2 text-[0.9375rem] font-semibold">
            2. Escribí el código que te muestra
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              className="h-14 max-w-[12rem] rounded-[0.875rem] border border-line bg-fondo px-4 text-[1.375rem] tracking-[0.2em] outline-none focus:border-acc"
            />
          </label>
          <div className="flex flex-wrap gap-2.5">
            <Boton cargando={trabajando} onClick={confirmar}>Activar</Boton>
            <Boton variante="suave" onClick={() => setAlta(null)}>Cancelar</Boton>
          </div>
        </div>
      ) : (
        <Boton variante="borde" className="self-start" cargando={trabajando} onClick={empezar}>Activar doble factor</Boton>
      )}

      {confirmarBaja && (
        <Confirmar titulo="¿Desactivar el doble factor?" textoConfirmar="Desactivar" cargando={trabajando} onConfirmar={desactivar} onCancelar={() => setConfirmarBaja(false)}>
          Vas a poder entrar solo con la contraseña.
        </Confirmar>
      )}
    </Tarjeta>
  )
}
