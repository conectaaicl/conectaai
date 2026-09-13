'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { usePortalSession } from '../usePortalSession'

interface Vehiculo { id: number; patente: string; marca?: string | null; modelo?: string | null; color?: string | null; estado: string; estacionamiento?: string | null; created_at: string }
const EST: Record<string, [string, string]> = { aprobado: ['Autorizada', 'bg-emerald-100 text-emerald-700'], pendiente: ['Esperando aprobación', 'bg-amber-100 text-amber-700'], bloqueado: ['Bloqueada', 'bg-red-100 text-red-700'] }

export default function PortalVehiculos() {
  const router = useRouter()
  const { token, loading, logout, authFetch } = usePortalSession()
  const [items, setItems] = useState<Vehiculo[]>([])
  const [fetching, setFetching] = useState(true)
  const [form, setForm] = useState({ patente: '', marca: '', modelo: '', color: '' })
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => { if (!loading && !token) router.push('/portal/login') }, [loading, token, router])
  const load = useCallback(() => { if (!token) return; authFetch('/api/vehiculos/portal/mis-vehiculos').then(r => r.ok ? r.json() : []).then(d => setItems(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setFetching(false)) }, [token, authFetch])
  useEffect(() => { load() }, [load])

  async function agregar(e: React.FormEvent) {
    e.preventDefault(); setSending(true); setMsg(null)
    try {
      const r = await authFetch('/api/vehiculos/portal/mis-vehiculos', { method: 'POST', body: JSON.stringify(form) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setMsg({ ok: false, t: d.detail || 'No se pudo registrar' }); return }
      setMsg({ ok: true, t: `Patente ${d.patente} enviada. Administración la aprobará y el portón te reconocerá al llegar.` })
      setForm({ patente: '', marca: '', modelo: '', color: '' }); load()
    } catch { setMsg({ ok: false, t: 'Error de conexión' }) } finally { setSending(false) }
  }
  async function quitar(id: number) { await authFetch('/api/vehiculos/portal/mis-vehiculos/' + id, { method: 'DELETE' }); load() }

  if (loading || fetching) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white px-4 pt-8 pb-6">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-indigo-200 hover:text-white"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
            <div><h1 className="text-lg font-bold">Mis vehículos</h1><p className="text-indigo-200 text-xs">Patentes para que el portón te abra solo</p></div>
          </div>
          <button onClick={logout} className="text-indigo-200 hover:text-white text-xs">Salir</button>
        </div>
      </div>
      <div className="max-w-lg mx-auto px-4 -mt-3 space-y-4">
        <form onSubmit={agregar} className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
          <p className="font-semibold text-slate-800">Inscribir una patente</p>
          {msg && <p className={`text-sm rounded-xl px-3 py-2 ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{msg.t}</p>}
          <input className="w-full border border-slate-200 rounded-xl px-3 py-3 text-base font-mono uppercase text-slate-900" placeholder="Patente (ej: ABCD12)" value={form.patente} onChange={e => setForm({ ...form, patente: e.target.value.toUpperCase() })} required />
          <div className="grid grid-cols-3 gap-2">
            <input className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900" placeholder="Marca" value={form.marca} onChange={e => setForm({ ...form, marca: e.target.value })} />
            <input className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900" placeholder="Modelo" value={form.modelo} onChange={e => setForm({ ...form, modelo: e.target.value })} />
            <input className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900" placeholder="Color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} />
          </div>
          <button type="submit" disabled={sending} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl">{sending ? 'Enviando…' : 'Enviar a administración'}</button>
          <p className="text-[11px] text-slate-400">Máximo 4 vehículos por departamento. Administración aprueba cada patente.</p>
        </form>
        {items.length > 0 && (
          <div className="space-y-2">
            {items.map(v => (
              <div key={v.id} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3">
                <div className="text-2xl">🚗</div>
                <div className="flex-1 min-w-0"><p className="font-mono font-bold text-slate-900">{v.patente}</p><p className="text-xs text-slate-500">{[v.marca, v.modelo, v.color].filter(Boolean).join(' ') || 'Sin datos'}{v.estacionamiento ? ` · Estac. ${v.estacionamiento}` : ''}</p></div>
                <span className={`text-[11px] font-bold px-2 py-1 rounded-lg ${EST[v.estado]?.[1] || 'bg-slate-100 text-slate-600'}`}>{EST[v.estado]?.[0] || v.estado}</span>
                <button onClick={() => quitar(v.id)} className="text-slate-400 hover:text-red-500 text-lg">×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
