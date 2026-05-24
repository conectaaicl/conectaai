'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from '@/hooks/useSession'

interface Incidencia {
  id: number
  titulo: string
  descripcion?: string
  categoria: string
  prioridad: string
  estado: string
  departamento_id?: number
  reportado_por?: string
  created_at: string
  fecha_resolucion?: string
}

const PRIORIDAD_COLOR: Record<string, string> = {
  baja: 'bg-slate-100 text-slate-600',
  media: 'bg-blue-100 text-blue-700',
  alta: 'bg-orange-100 text-orange-700',
  urgente: 'bg-red-100 text-red-700',
}
const ESTADO_COLOR: Record<string, string> = {
  abierta: 'bg-yellow-100 text-yellow-700',
  en_progreso: 'bg-blue-100 text-blue-700',
  resuelta: 'bg-green-100 text-green-700',
  cerrada: 'bg-slate-100 text-slate-500',
}

export default function IncidenciasPage() {
  const { tenantId } = useSession()
  const [items, setItems] = useState<Incidencia[]>([])
  const [stats, setStats] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [condominioId] = useState(1)
  const [form, setForm] = useState({ titulo: '', descripcion: '', categoria: 'general', prioridad: 'media', departamento_id: '', reportado_por: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [listRes, statsRes] = await Promise.all([
        fetch(`/api/incidencias?tenant_id=${tenantId}&condominio_id=${condominioId}`),
        fetch(`/api/incidencias/stats?tenant_id=${tenantId}&condominio_id=${condominioId}`),
      ])
      if (listRes.ok) setItems(await listRes.json())
      if (statsRes.ok) setStats(await statsRes.json())
    } finally { setLoading(false) }
  }, [tenantId, condominioId])

  useEffect(() => { load() }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await fetch('/api/incidencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, departamento_id: form.departamento_id ? Number(form.departamento_id) : null, condominio_id: condominioId, tenant_id: tenantId }),
      })
      if (res.ok) { setShowForm(false); load() }
    } finally { setCreating(false) }
  }

  async function updateEstado(id: number, estado: string) {
    await fetch(`/api/incidencias/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    })
    load()
  }

  const statCards = [
    { label: 'Abiertas', value: stats.abiertas || 0, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'En progreso', value: stats.en_progreso || 0, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Resueltas', value: stats.resueltas || 0, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Total', value: stats.total || 0, color: 'text-slate-700', bg: 'bg-slate-50' },
  ]

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Incidencias</h1>
          <p className="text-slate-500 text-sm mt-1">Seguimiento de averías y solicitudes de mantenimiento</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition min-h-[44px]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nueva incidencia
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {statCards.map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-sm text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[95vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Nueva incidencia</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <input required placeholder="Título" value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <textarea placeholder="Descripción" value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {['general','electricidad','plomeria','ascensor','seguridad','limpieza','otro'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={form.prioridad} onChange={e => setForm(p => ({ ...p, prioridad: e.target.value }))} className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {['baja','media','alta','urgente'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <input placeholder="Depto ID (opcional)" value={form.departamento_id} onChange={e => setForm(p => ({ ...p, departamento_id: e.target.value }))} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <input placeholder="Reportado por" value={form.reportado_por} onChange={e => setForm(p => ({ ...p, reportado_por: e.target.value }))} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-xl text-sm font-semibold">Cancelar</button>
                <button type="submit" disabled={creating} className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-60">{creating ? 'Creando...' : 'Crear'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
      ) : (
        <div className="space-y-3">
          {items.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-slate-100">No hay incidencias registradas</div>
          ) : items.map(inc => (
            <div key={inc.id} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-start gap-4 hover:shadow-sm transition">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-semibold text-slate-800">{inc.titulo}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORIDAD_COLOR[inc.prioridad] || 'bg-slate-100 text-slate-600'}`}>{inc.prioridad}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_COLOR[inc.estado] || 'bg-slate-100 text-slate-600'}`}>{inc.estado}</span>
                  <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">{inc.categoria}</span>
                </div>
                {inc.descripcion && <p className="text-sm text-slate-500 truncate">{inc.descripcion}</p>}
                <p className="text-xs text-slate-400 mt-1">{new Date(inc.created_at).toLocaleDateString('es-CL')} {inc.reportado_por && `· ${inc.reportado_por}`}</p>
              </div>
              <select
                value={inc.estado}
                onChange={e => updateEstado(inc.id, e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 shrink-0"
              >
                {['abierta','en_progreso','resuelta','cerrada'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
