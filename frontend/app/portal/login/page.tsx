'use client'
import PWAInstallBanner from '@/components/PWAInstallBanner'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Eye, EyeOff } from 'lucide-react'

export default function PortalLogin() {
  const router = useRouter()
  const [rut, setRut] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/portal/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rut, password, tenant_id: 1 })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.detail || 'Error al iniciar sesion'); setLoading(false); return }
      localStorage.setItem('portal_token', data.token)
      localStorage.setItem('portal_residente', JSON.stringify(data.residente))
      router.push('/portal/dashboard')
    } catch { setError('Error de conexion'); setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-brand-900 flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-4">
          <Building2 size={24} className="text-white" strokeWidth={1.75} />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">ConectaAI</h1>
        <p className="text-brand-200 mt-1 text-sm">Portal de residentes</p>
      </div>
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900 mb-6">Iniciar sesion</h2>
        {error && (
          <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg p-3 text-sm mb-4">{error}</div>
        )}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">RUT</label>
            <input
              value={rut} onChange={e => setRut(e.target.value)}
              placeholder="12.345.678-9" required
              autoComplete="username"
              className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm bg-white text-slate-900 font-semibold focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Contrasena</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password} onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm bg-white text-slate-900 font-semibold focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none pr-11"
              />
              <button
                type="button" onClick={() => setShowPw(!showPw)}
                aria-label={showPw ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >{showPw ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full bg-brand-700 text-white py-3 rounded-xl font-semibold hover:bg-brand-800 disabled:opacity-50 transition-colors"
          >{loading ? 'Ingresando...' : 'Ingresar'}</button>
        </form>
        <PWAInstallBanner />
        <p className="text-center text-sm text-slate-500 mt-6">
          Primera vez?{' '}
          <a href="/portal/registro" className="text-brand-700 font-semibold hover:underline">Registrate aqui</a>
        </p>
      </div>
    </div>
  )
}
