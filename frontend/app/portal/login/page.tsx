'use client'
import PWAInstallBanner from '@/components/PWAInstallBanner'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
      if (!res.ok) { setError(data.detail || 'Error al iniciar sesión'); setLoading(false); return }
      localStorage.setItem('portal_token', data.token)
      localStorage.setItem('portal_residente', JSON.stringify(data.residente))
      router.push('/portal/dashboard')
    } catch { setError('Error de conexión'); setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-indigo-900 flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-white">ConectaAI</h1>
        <p className="text-indigo-200 mt-1">Portal Residentes</p>
      </div>
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        <h2 className="text-xl font-semibold text-slate-800 mb-6">Iniciar sesión</h2>
        {error && (
          <div className="bg-red-50 text-red-600 border border-red-200 rounded-lg p-3 text-sm mb-4">{error}</div>
        )}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">RUT</label>
            <input
              value={rut} onChange={e => setRut(e.target.value)}
              placeholder="12.345.678-9" required
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password} onChange={e => setPassword(e.target.value)}
                required
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none pr-16"
              />
              <button
                type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 text-xs font-medium"
              >{showPw ? 'Ocultar' : 'Ver'}</button>
            </div>
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >{loading ? 'Ingresando...' : 'Ingresar'}</button>
        </form>
        <PWAInstallBanner />
        <p className="text-center text-sm text-slate-500 mt-6">
          ¿Primera vez?{' '}
          <a href="/portal/registro" className="text-indigo-600 font-medium hover:underline">Regístrate aquí</a>
        </p>
      </div>
    </div>
  )
}
