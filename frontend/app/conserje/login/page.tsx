'use client'
import PWAInstallBanner from '@/components/PWAInstallBanner'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'

export default function ConserjeLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    // Mismo camino que el login de admin: /api/login (route de Next) reenvia como formulario al backend y fija la cookie
    const fd = new FormData(); fd.append('email', email.trim().toLowerCase()); fd.append('password', password)
    const r = await fetch('/api/login', { method: 'POST', credentials: 'include', body: fd })
    const data = await r.json().catch(() => ({}))
    setLoading(false)
    if (r.ok && data?.success) { router.replace('/conserje/central') }
    else { setError(data?.error || data?.detail || 'Credenciales incorrectas') }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-brand-700 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={26} className="text-white" strokeWidth={1.75} />
          </div>
          <h1 className="text-2xl font-bold text-white">Portal conserje</h1>
          <p className="text-slate-400 text-sm mt-1">ConectaAI Condominios</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          {error && <p className="text-red-400 text-sm text-center bg-red-500/10 rounded-xl p-3">{error}</p>}
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">Usuario</label>
            <input type="text" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="email@condominio.cl" autoComplete="username" />
          </div>
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">Contrasena</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="********" autoComplete="current-password" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 bg-brand-700 hover:bg-brand-600 disabled:opacity-50 text-white font-bold rounded-xl transition-colors text-base">
            {loading ? 'Verificando...' : 'Entrar al turno'}
          </button>
        </form>
        <PWAInstallBanner />
      </div>
    </div>
  )
}
