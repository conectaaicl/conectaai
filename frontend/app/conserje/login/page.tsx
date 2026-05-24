'use client'
import PWAInstallBanner from '@/components/PWAInstallBanner'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ConserjeLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const r = await fetch('/api/auth/login', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    setLoading(false)
    if (r.ok) { router.replace('/conserje/central') }
    else { setError('Credenciales incorrectas') }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🏢</div>
          <h1 className="text-2xl font-bold text-white">Portal Conserje</h1>
          <p className="text-slate-400 text-sm mt-1">ConectaAI Condominios</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-slate-800 rounded-2xl p-6 space-y-4">
          {error && <p className="text-red-400 text-sm text-center bg-red-500/10 rounded-xl p-3">{error}</p>}
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">Usuario</label>
            <input type="text" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="email@condominio.cl" autoComplete="username" />
          </div>
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••" autoComplete="current-password" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl transition text-lg">
            {loading ? 'Verificando...' : 'Entrar al turno'}
          </button>
        </form>
          <PWAInstallBanner />
      </div>
    </div>
  )
}
