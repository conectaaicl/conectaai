'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import ModalCotizacion from './components/ModalCotizacion'

interface Deal {
  id: number
  cliente: string
  monto: number
  etapa: string
  origen: string
  fecha: string
  contacto?: string
  email?: string
  telefono?: string
  probabilidad: number
}

interface Stats {
  total_pipeline: number
  total_deals: number
  tasa_conversion: number
  forecast_ponderado: number
  por_etapa: Record<string, { count: number; monto: number }>
}

const ETAPAS = [
  { key: 'prospecto', label: 'Prospecto', color: 'text-slate-400', border: 'border-slate-600/50', dot: 'bg-slate-500' },
  { key: 'calificado', label: 'Calificado', color: 'text-blue-400', border: 'border-blue-600/30', dot: 'bg-blue-500' },
  { key: 'propuesta', label: 'Propuesta', color: 'text-amber-400', border: 'border-amber-600/30', dot: 'bg-amber-500' },
  { key: 'negociacion', label: 'Negociación', color: 'text-orange-400', border: 'border-orange-600/30', dot: 'bg-orange-500' },
  { key: 'ganado', label: 'Ganado', color: 'text-emerald-400', border: 'border-emerald-600/30', dot: 'bg-emerald-500' },
  { key: 'perdido', label: 'Perdido', color: 'text-red-400', border: 'border-red-600/30', dot: 'bg-red-500' },
]

export default function VentasPage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null)
  const [showDrawer, setShowDrawer] = useState(false)
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [showModalCotizacion, setShowModalCotizacion] = useState(false)
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null)
  const [showNewDeal, setShowNewDeal] = useState(false)
  const [newDeal, setNewDeal] = useState({ cliente: '', contacto: '', email: '', telefono: '', monto: 0, etapa: 'prospecto', origen: 'manual', notas: '' })

  useEffect(() => { fetchDeals(); fetchStats() }, [])

  async function fetchDeals() {
    try { const r = await fetch('/api/ventas/deals'); if (r.ok) setDeals(await r.json()) } catch {}
    setLoading(false)
  }
  async function fetchStats() {
    try { const r = await fetch('/api/ventas/stats'); if (r.ok) setStats(await r.json()) } catch {}
  }

  async function handleDrop(etapa: string) {
    if (!draggedDeal || draggedDeal.etapa === etapa) return
    try {
      const r = await fetch(`/api/ventas/deals/${draggedDeal.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etapa })
      })
      if (r.ok) { fetchDeals(); fetchStats() }
    } catch {}
    setDraggedDeal(null)
  }

  async function handleDeleteDeal() {
    if (!selectedDeal || !confirm(`¿Eliminar "${selectedDeal.cliente}"?`)) return
    try {
      const r = await fetch(`/api/ventas/deals/${selectedDeal.id}`, { method: 'DELETE' })
      if (r.ok) { setShowDrawer(false); setSelectedDeal(null); fetchDeals(); fetchStats() }
    } catch {}
  }

  async function handleSaveEdit() {
    if (!editingDeal) return
    try {
      const r = await fetch(`/api/ventas/deals/${editingDeal.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editingDeal)
      })
      if (r.ok) { setEditingDeal(null); fetchDeals(); fetchStats() }
    } catch {}
  }

  async function handleCreateDeal() {
    try {
      const r = await fetch('/api/ventas/deals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newDeal)
      })
      if (r.ok) {
        setShowNewDeal(false)
        setNewDeal({ cliente: '', contacto: '', email: '', telefono: '', monto: 0, etapa: 'prospecto', origen: 'manual', notas: '' })
        fetchDeals(); fetchStats()
      }
    } catch {}
  }

  const fmt = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Pipeline de Ventas</h1>
          <p className="text-sm text-slate-400 mt-0.5">Gestión de deals y oportunidades comerciales</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/ventas/cotizaciones" className="px-4 py-2 text-sm text-slate-300 border border-slate-700 rounded-lg hover:border-slate-500 hover:text-white transition-colors">Cotizaciones</Link>
          <Link href="/dashboard/ventas/reportes" className="px-4 py-2 text-sm text-slate-300 border border-slate-700 rounded-lg hover:border-slate-500 hover:text-white transition-colors">Reportes</Link>
          <button onClick={() => setShowNewDeal(true)} className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">+ Nuevo Deal</button>
        </div>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Pipeline Total', value: fmt(stats.total_pipeline), color: 'text-blue-400' },
            { label: 'Deals Activos', value: String(stats.total_deals), color: 'text-white' },
            { label: 'Conversión', value: stats.tasa_conversion.toFixed(1) + '%', color: 'text-emerald-400' },
            { label: 'Forecast', value: fmt(stats.forecast_ponderado), color: 'text-amber-400' },
          ].map(k => (
            <div key={k.label} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{k.label}</p>
              <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Kanban Board */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-4 min-w-max">
          {ETAPAS.map(etapa => {
            const col = (Array.isArray(deals) ? deals : []).filter(d => d.etapa === etapa.key)
            const total = col.reduce((s, d) => s + d.monto, 0)
            return (
              <div key={etapa.key} onDragOver={e => e.preventDefault()} onDrop={() => handleDrop(etapa.key)} className="w-56 flex-shrink-0 flex flex-col">
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${etapa.dot}`} />
                    <span className={`text-xs font-semibold uppercase tracking-wider ${etapa.color}`}>{etapa.label}</span>
                  </div>
                  <span className="text-xs text-slate-500">{col.length}</span>
                </div>
                <p className="text-xs text-slate-500 px-1 mb-2">{fmt(total)}</p>
                <div className={`flex-1 min-h-96 rounded-xl border ${etapa.border} bg-slate-800/20 p-2 space-y-2`}>
                  {col.map(deal => (
                    <div key={deal.id} draggable onDragStart={() => setDraggedDeal(deal)}
                      onClick={() => { setSelectedDeal(deal); setShowDrawer(true) }}
                      className="bg-slate-800 border border-slate-700/60 rounded-lg p-3 cursor-grab hover:border-slate-600 hover:bg-slate-700/50 transition-all">
                      <p className="text-sm font-semibold text-white leading-tight mb-1 truncate">{deal.cliente}</p>
                      {deal.contacto && <p className="text-xs text-slate-500 mb-2 truncate">{deal.contacto}</p>}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-emerald-400">{fmt(deal.monto)}</span>
                        <span className="text-xs text-slate-500 bg-slate-700/60 px-1.5 py-0.5 rounded">{deal.probabilidad}%</span>
                      </div>
                    </div>
                  ))}
                  {col.length === 0 && <p className="text-center text-slate-600 text-xs pt-8">Sin deals</p>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Deal Detail Drawer */}
      {showDrawer && selectedDeal && (
        <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setShowDrawer(false)}>
          <div className="absolute right-0 top-0 h-full w-80 bg-slate-900 border-l border-slate-700 p-6 overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-base font-bold text-white leading-tight pr-4">{selectedDeal.cliente}</h2>
              <button onClick={() => setShowDrawer(false)} className="text-slate-500 hover:text-white text-xl">&times;</button>
            </div>
            <div className="space-y-4 mb-6">
              {[
                { l: 'Contacto', v: selectedDeal.contacto },
                { l: 'Email', v: selectedDeal.email },
                { l: 'Teléfono', v: selectedDeal.telefono },
                { l: 'Origen', v: selectedDeal.origen },
              ].filter(f => f.v).map(f => (
                <div key={f.l}>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">{f.l}</p>
                  <p className="text-sm text-slate-200">{f.v}</p>
                </div>
              ))}
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Monto</p>
                <p className="text-2xl font-bold text-emerald-400">{fmt(selectedDeal.monto)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Probabilidad — {selectedDeal.probabilidad}%</p>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${selectedDeal.probabilidad}%` }} />
                </div>
              </div>
            </div>
            <div className="space-y-2 pt-4 border-t border-slate-700">
              <button onClick={() => { setShowDrawer(false); setShowModalCotizacion(true) }}
                className="w-full py-2.5 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">
                Crear Cotización
              </button>
              <button onClick={() => { setEditingDeal(selectedDeal); setShowDrawer(false) }}
                className="w-full py-2.5 text-sm border border-slate-600 text-slate-300 hover:border-slate-500 hover:text-white rounded-lg transition-colors">
                Editar Deal
              </button>
              <button onClick={handleDeleteDeal}
                className="w-full py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Deal Modal */}
      {editingDeal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <h3 className="font-semibold text-white">Editar Deal</h3>
              <button onClick={() => setEditingDeal(null)} className="text-slate-500 hover:text-white">&times;</button>
            </div>
            <div className="p-5 space-y-3">
              {(['cliente', 'contacto', 'email', 'telefono'] as const).map(f => (
                <div key={f}>
                  <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">{f}</label>
                  <input type="text" value={(editingDeal as any)[f] || ''} onChange={e => setEditingDeal({ ...editingDeal, [f]: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
                </div>
              ))}
              <div>
                <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">Monto (CLP)</label>
                <input type="number" value={editingDeal.monto} onChange={e => setEditingDeal({ ...editingDeal, monto: parseFloat(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">Probabilidad (%)</label>
                <input type="number" min="0" max="100" value={editingDeal.probabilidad} onChange={e => setEditingDeal({ ...editingDeal, probabilidad: parseInt(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-700">
              <button onClick={() => setEditingDeal(null)} className="flex-1 py-2 text-sm border border-slate-600 text-slate-400 rounded-lg hover:text-white transition-colors">Cancelar</button>
              <button onClick={handleSaveEdit} className="flex-1 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* New Deal Modal */}
      {showNewDeal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <h3 className="font-semibold text-white">Nuevo Deal</h3>
              <button onClick={() => setShowNewDeal(false)} className="text-slate-500 hover:text-white">&times;</button>
            </div>
            <div className="p-5 space-y-3">
              {(['cliente', 'contacto', 'email', 'telefono'] as const).map(f => (
                <div key={f}>
                  <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">{f}</label>
                  <input type="text" value={(newDeal as any)[f] || ''} onChange={e => setNewDeal({ ...newDeal, [f]: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none" />
                </div>
              ))}
              <div>
                <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">Monto (CLP)</label>
                <input type="number" value={newDeal.monto} onChange={e => setNewDeal({ ...newDeal, monto: parseFloat(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">Etapa</label>
                <select value={newDeal.etapa} onChange={e => setNewDeal({ ...newDeal, etapa: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none">
                  {ETAPAS.map(e => <option key={e.key} value={e.key}>{e.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">Origen</label>
                <select value={newDeal.origen} onChange={e => setNewDeal({ ...newDeal, origen: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none">
                  {['manual', 'web', 'referido', 'llamada', 'whatsapp'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">Notas</label>
                <textarea value={newDeal.notas} onChange={e => setNewDeal({ ...newDeal, notas: e.target.value })} rows={2}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none resize-none" />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-700">
              <button onClick={() => setShowNewDeal(false)} className="flex-1 py-2 text-sm border border-slate-600 text-slate-400 rounded-lg hover:text-white transition-colors">Cancelar</button>
              <button onClick={handleCreateDeal} className="flex-1 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">Crear</button>
            </div>
          </div>
        </div>
      )}

      {showModalCotizacion && selectedDeal && (
        <ModalCotizacion dealId={selectedDeal.id} dealCliente={selectedDeal.cliente} dealMonto={selectedDeal.monto}
          onClose={() => setShowModalCotizacion(false)} onCreated={() => { fetchDeals(); fetchStats() }} />
      )}
    </div>
  )
}
