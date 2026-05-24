'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from '@/hooks/useSession'

interface Votacion {
  id: number
  titulo: string
  descripcion?: string
  opciones: string[]
  estado: string
  fecha_inicio: string
  fecha_fin?: string
  resultados?: Record<string, number>
}

export default function VotacionesPage() {
  const { tenantId } = useSession()
  const [items, setItems] = useState<Votacion[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [condominioId] = useState(1)
  const [form, setForm] = useState({ titulo: '', descripcion: '', opciones: 'A favor\nEn contra\nAbstención', fecha_fin: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/votaciones?tenant_id=${tenantId}&condominio_id=${condominioId}`)
      if (res.ok) setItems(await res.json())
    } finally { setLoading(false) }
  }, [tenantId, condominioId])

  useEffect(() => { load() }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const opciones = form.opciones.split('\n').map(o => o.trim()).filter(Boolean)
      const res = await fetch('/api/votaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: form.titulo, descripcion: form.descripcion, opciones, fecha_fin: form.fecha_fin || null, condominio_id: condominioId, tenant_id: tenantId }),
      })
      if (res.ok) { setShowForm(false); load() }
    } finally { setCreating(false) }
  }

  async function cerrar(id: number) {
    await fetch(`/api/votaciones/${id}/cerrar`, { method: 'POST' })
    load()
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Votaciones</h1>
          <p className="text-slate-500 text-sm mt-1">Asambleas y consultas a residentes</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition min-h-[44px]"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nueva votación
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[95vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Nueva votación</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <input
                required
                placeholder="Título de la votación"
                value={form.titulo}
                onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
              />
              <textarea
                placeholder="Descripción (opcional)"
                value={form.descripcion}
                onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                rows={2}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Opciones (una por línea)</label>
                <textarea
                  required
                  value={form.opciones}
                  onChange={e => setForm(p => ({ ...p, opciones: e.target.value }))}
                  rows={4}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fecha límite (opcional)</label>
                <input
                  type="datetime-local"
                  value={form.fecha_fin}
                  onChange={e => setForm(p => ({ ...p, fecha_fin: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-xl text-sm font-semibold min-h-[44px]">Cancelar</button>
                <button type="submit" disabled={creating} className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-60 min-h-[44px]">{creating ? 'Creando...' : 'Crear'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
      ) : (
        <div className="space-y-4">
          {items.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-slate-100">No hay votaciones. Crea la primera.</div>
          ) : items.map(v => (
            <div key={v.id} className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 hover:shadow-sm transition">
              <div className="flex items-start justify-between gap-3 sm:gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-slate-800">{v.titulo}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v.estado === 'activa' ? 'bg-green-100 text-green-700' : v.estado === 'cerrada' ? 'bg-slate-100 text-slate-500' : 'bg-yellow-100 text-yellow-700'}`}>{v.estado}</span>
                  </div>
                  {v.descripcion && <p className="text-sm text-slate-500 mb-3">{v.descripcion}</p>}
                  <div className="flex flex-wrap gap-2">
                    {v.opciones?.map((op, i) => (
                      <span key={i} className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full">
                        {op}{v.resultados?.[op] !== undefined ? ` (${v.resultados[op]})` : ''}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    {new Date(v.fecha_inicio).toLocaleDateString('es-CL')}
                    {v.fecha_fin && ` → ${new Date(v.fecha_fin).toLocaleDateString('es-CL')}`}
                  </p>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <a href={`/portal/votar/${v.id}`} target="_blank" className="text-xs border border-indigo-200 text-indigo-600 px-3 py-2 rounded-lg hover:bg-indigo-50 transition text-center min-h-[36px] flex items-center justify-center">Ver portal</a>
                  {v.estado === 'activa' && (
                    <button onClick={() => cerrar(v.id)} className="text-xs border border-slate-200 text-slate-500 px-3 py-2 rounded-lg hover:bg-slate-50 transition min-h-[36px]">Cerrar</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
