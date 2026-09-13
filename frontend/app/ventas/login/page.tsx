'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { vfetch } from '../lib'

export default function VentasLogin() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const r = await vfetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setError(d.detail || 'No se pudo ingresar'); return }
      router.replace('/ventas/hoy')
    } catch { setError('Sin conexión') } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-3xl border border-[#DDE4E6] shadow-xl p-7 space-y-4">
        <div><div className="text-xs font-bold tracking-widest text-[#0F766E] uppercase">ConectaAI</div><h1 className="text-2xl font-extrabold">Ventas Terreno</h1><p className="text-sm text-[#7A8F98]">Tu cartera de edificios, desde la tablet.</p></div>
        <label className="block"><span className="text-xs font-semibold text-[#35505C]">Usuario o correo</span>
          <input type="text" autoComplete="username" autoCapitalize="none" value={email} onChange={e => setEmail(e.target.value)} required className="mt-1 w-full border border-[#DDE4E6] rounded-xl px-4 py-3 text-base text-[#0B1F2A] focus:outline-none focus:ring-2 focus:ring-[#14B8A6]" /></label>
        <label className="block"><span className="text-xs font-semibold text-[#35505C]">Clave</span>
          <input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required className="mt-1 w-full border border-[#DDE4E6] rounded-xl px-4 py-3 text-base text-[#0B1F2A] focus:outline-none focus:ring-2 focus:ring-[#14B8A6]" /></label>
        {error && <p className="text-sm text-rose-700 bg-rose-50 rounded-xl px-3 py-2">{error}</p>}
        <button disabled={loading} className="w-full bg-[#0F766E] hover:bg-[#0d6159] disabled:opacity-60 text-white font-bold py-3.5 rounded-xl text-base">{loading ? 'Entrando…' : 'Entrar'}</button>
        <p className="text-[11px] text-[#7A8F98] text-center">Misma clave que usabas en ventas.conectaai.cl</p>
      </form>
    </div>
  )
}
