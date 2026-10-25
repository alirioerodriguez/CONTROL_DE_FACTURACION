import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Alerta, Boton } from '../../components/ui'
import { mensajeError, supabase } from '../../lib/supabase'
import { useAuth } from './AuthProvider'
import { AuthLayout, CampoAuth, claseBotonAuth, claseLinkAuth } from './AuthLayout'

/** Segundo paso del ingreso: el código de 6 números de la app autenticadora (para quien activó el doble factor). */
export function SegundoPasoPage() {
  const { revisarSegundoPaso } = useAuth()
  const [codigo, setCodigo] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  async function verificar(e: FormEvent) {
    e.preventDefault()
    if (!/^\d{6}$/.test(codigo)) return setError('El código tiene 6 números.')
    setCargando(true)
    setError('')
    try {
      const { data: factores, error: e1 } = await supabase.auth.mfa.listFactors()
      if (e1) throw e1
      const totp = factores.totp.find((f) => f.status === 'verified')
      if (!totp) throw new Error('No encontré tu app autenticadora. Escribinos para ayudarte.')
      const { error: e2 } = await supabase.auth.mfa.challengeAndVerify({ factorId: totp.id, code: codigo })
      if (e2) throw e2
      await revisarSegundoPaso()
      toast.success('¡Hola de nuevo!')
    } catch (err) {
      setError(/invalid|expired/i.test(mensajeError(err)) ? 'El código no es correcto o ya cambió. Probá con el que muestra ahora la app.' : mensajeError(err))
    } finally {
      setCargando(false)
    }
  }

  return (
    <AuthLayout titulo="Un paso más" sub="Abrí tu app autenticadora (Google Authenticator, Authy…) y escribí el código de 6 números de honorapp.">
      <form onSubmit={verificar} noValidate className="flex flex-col gap-5">
        <CampoAuth
          etiqueta="Código"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="123456"
          value={codigo}
          onChange={(e) => { setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }}
          autoFocus
        />
        {error && <Alerta>{error}</Alerta>}
        <Boton type="submit" cargando={cargando} className={claseBotonAuth}>
          {cargando ? 'Verificando…' : 'Entrar'}
        </Boton>
      </form>
      <button type="button" onClick={() => supabase.auth.signOut()} className={`${claseLinkAuth} text-ink2`}>
        Salir y entrar con otra cuenta
      </button>
    </AuthLayout>
  )
}
