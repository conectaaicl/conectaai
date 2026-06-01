'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Lead {
  id: number
  nombre: string
  telefono: string
  email: string
  temperatura: string
  canal_origen: string
  interes: string
  notas: string
  created_at: string
  tenant_id: number
}

const TEMP_CONFIG: Record<string, { label: string; dot: string; col: string; text: string; border: string }> = {
  frio:     { label: 'Frío',      dot: 'bg-blue-500',    col: 'text-blue-400',    text: 'text-blue-400',    border: 'border-blue-600/30' },
  tibio:    { label: 'Tibio',     dot: 'bg-amber-500',   col: 'text-amber-400',   text: 'text-amber-400',   border: 'border-amber-600/30' },
  caliente: { label: 'Caliente',  dot: 'bg-orange-500',  col: 'text-orange-400',  text: 'text-orange-400',  border: 'border-orange-600/30' },
  ganado:   { label: 'Ganado',    dot: 'bg-emerald-500', col: 'text-emerald-400', text: 'text-emerald-400', border: 'border-emerald-600/30' },
}

const CANAL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp', instagram: 'Instagram', facebook: 'Facebook',
  telegram: 'Telegram', messenger: 'Messenger', tiktok: 'TikTok',
  email: 'Email', webchat: 'WebChat',
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Lead | null>(null)
  const [tenantId, setTenantId] = useState<number | null>(null)

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    try {
      const r = await fetch('/api/auth/me', { credentials: 'include' })
      if (r.ok) {
        const u = await r.json()
        setTenantId(u.tenant_id)
        await cargarLeads(u.tenant_id)
      }
    } catch {}
    setLoading(false)
  }

  async function cargarLeads(tid: number) {
    try {
      const r = await fetch(`/api/whatsapp360/leads?tenant_id=${tid}`, { credentials: 'include' })
      if (r.ok) setLeads(await r.json())
    } catch {}
  }

  async function cambiarTemperatura(leadId: number, temp: string) {
    if (!tenantId) return
    try {
      const r = await fetch(`/api/whatsapp360/leads/${leadId}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temperatura: temp, tenant_id: tenantId }),
      })
      if (r.ok) cargarLeads(tenantId)
    } catch {}
  }

  const byTemp = (t: string) => leads.filter(l => l.temperatura === t)
  const fmtDate = (s: string) => new Date(s).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const COLUMNAS: Array<{ key: string; next: string[]; prev: string[] }> = [
    { key: 'frio',     next: ['tibio'],            prev: [] },
    { key: 'tibio',    next: ['caliente'],          prev: ['frio'] },
    { key: 'caliente', next: ['ganado'],            prev: ['tibio'] },
    { key: 'ganado',   next: [],                    prev: ['caliente'] },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Panel de Leads</h1>
          <p className="text-sm text-slate-400 mt-0.5">Prospectos desde todos los canales</p>
        </div>
        <Link href="/dashboard/ventas" className="px-4 py-2 text-sm text-slate-300 border border-slate-700 rounded-lg hover:border-slate-500 hover:text-white transition-colors">
          ← Pipeline
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(TEMP_CONFIG).map(([key, cfg]) => (
          <div key={key} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex items-center gap-3">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
            <div>
              <p className={`text-2xl font-bold ${cfg.col}`}>{byTemp(key).length}</p>
              <p className="text-xs text-slate-500">{cfg.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {COLUMNAS.map(col => {
          const cfg = TEMP_CONFIG[col.key]
          const items = byTemp(col.key)
          return (
            <div key={col.key} className="flex flex-col">
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                <span className={`text-xs font-semibold uppercase tracking-wider ${cfg.col}`}>{cfg.label}</span>
                <span className="text-xs text-slate-500 ml-auto">{items.length}</span>
              </div>
              <div className={`flex-1 min-h-80 rounded-xl border ${cfg.border} bg-slate-800/20 p-2 space-y-2`}>
                {items.map(lead => (
                  <div key={lead.id} onClick={() => setSelected(lead)}
                    className="bg-slate-800 border border-slate-700/60 rounded-lg p-3 cursor-pointer hover:border-slate-600 hover:bg-slate-700/50 transition-all">
                    <p className="text-sm font-semibold text-white leading-tight mb-0.5 truncate">{lead.nombre}</p>
                    <p className="text-xs text-slate-500 mb-2 truncate">{CANAL_LABELS[lead.canal_origen?.toLowerCase()] ?? lead.canal_origen}</p>
                    {lead.interes && <p className="text-xs text-slate-400 line-clamp-2 mb-2">{lead.interes}</p>}
                    <div className="flex gap-1.5 flex-wrap">
                      {col.prev.map(p => (
                        <button key={p} onClick={e => { e.stopPropagation(); cambiarTemperatura(lead.id, p) }}
                          className="text-xs px-2 py-1 border border-slate-600 text-slate-400 rounded hover:text-white transition-colors">
                          ← {TEMP_CONFIG[p].label}
                        </button>
                      ))}
                      {col.next.map(n => (
                        <button key={n} onClick={e => { e.stopPropagation(); cambiarTemperatura(lead.id, n) }}
                          className="text-xs px-2 py-1 border border-slate-600 text-slate-400 rounded hover:text-white transition-colors">
                          {TEMP_CONFIG[n].label} →
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {items.length === 0 && <p className="text-center text-slate-600 text-xs pt-8">Sin leads</p>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Lead detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <h3 className="font-semibold text-white">Detalle del Lead</h3>
              <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-white">&times;</button>
            </div>
            <div className="p-5 space-y-4">
              {[
                { l: 'Nombre', v: selected.nombre },
                { l: 'Teléfono', v: selected.telefono },
                { l: 'Email', v: selected.email },
                { l: 'Canal', v: CANAL_LABELS[selected.canal_origen?.toLowerCase()] ?? selected.canal_origen },
                { l: 'Temperatura', v: TEMP_CONFIG[selected.temperatura]?.label ?? selected.temperatura },
                { l: 'Interés', v: selected.interes },
                { l: 'Notas', v: selected.notas },
                { l: 'Fecha', v: selected.created_at ? fmtDate(selected.created_at) : '' },
              ].filter(f => f.v).map(f => (
                <div key={f.l}>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">{f.l}</p>
                  <p className="text-sm text-slate-200">{f.v}</p>
                </div>
              ))}
            </div>
            <div className="p-5 border-t border-slate-700">
              <button onClick={() => setSelected(null)} className="w-full py-2 text-sm border border-slate-600 text-slate-400 rounded-lg hover:text-white transition-colors">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
