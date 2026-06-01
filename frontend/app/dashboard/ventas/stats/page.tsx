'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Stats {
  conversaciones: { total: number; activas: number }
  leads: { total: number; calientes: number; ganados: number }
  mensajes: { total: number }
}

interface Lead {
  id: number
  nombre: string
  telefono: string
  temperatura: string
  canal_origen: string
  interes: string
  created_at: string
}

const CANAL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp', instagram: 'Instagram', facebook: 'Facebook',
  telegram: 'Telegram', messenger: 'Messenger', tiktok: 'TikTok',
  email: 'Email', webchat: 'WebChat',
}

const TEMP_COLORS: Record<string, string> = {
  frio: 'text-blue-400', tibio: 'text-amber-400', caliente: 'text-orange-400', ganado: 'text-emerald-400',
}
const TEMP_DOTS: Record<string, string> = {
  frio: 'bg-blue-500', tibio: 'bg-amber-500', caliente: 'bg-orange-500', ganado: 'bg-emerald-500',
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    try {
      const r = await fetch('/api/auth/me', { credentials: 'include' })
      if (r.ok) {
        const u = await r.json()
        const [sr, lr] = await Promise.all([
          fetch(`/api/whatsapp360/stats?tenant_id=${u.tenant_id}`, { credentials: 'include' }),
          fetch(`/api/whatsapp360/leads?tenant_id=${u.tenant_id}`, { credentials: 'include' }),
        ])
        if (sr.ok) setStats(await sr.json())
        if (lr.ok) setLeads(await lr.json())
      }
    } catch {}
    setLoading(false)
  }

  const leadsPorCanal = leads.reduce((acc, l) => {
    const c = l.canal_origen?.toLowerCase() || 'otro'
    acc[c] = (acc[c] || 0) + 1; return acc
  }, {} as Record<string, number>)

  const leadsPorTemp = leads.reduce((acc, l) => {
    acc[l.temperatura] = (acc[l.temperatura] || 0) + 1; return acc
  }, {} as Record<string, number>)

  const total = stats?.leads.total || 0
  const tasaConv = total > 0 ? ((stats!.leads.ganados / total) * 100).toFixed(1) : '0.0'
  const fmtDate = (s: string) => new Date(s).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

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
          <h1 className="text-2xl font-bold text-white">Dashboard de Estadísticas</h1>
          <p className="text-sm text-slate-400 mt-0.5">Métricas WhatsApp 360 — todos los canales</p>
        </div>
        <Link href="/dashboard/ventas" className="px-4 py-2 text-sm text-slate-300 border border-slate-700 rounded-lg hover:border-slate-500 hover:text-white transition-colors">
          ← Pipeline
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Conversaciones', value: String(stats?.conversaciones.total || 0), sub: `${stats?.conversaciones.activas || 0} activas`, color: 'text-blue-400' },
          { label: 'Leads Totales',  value: String(stats?.leads.total || 0),          sub: `${stats?.leads.calientes || 0} calientes`,   color: 'text-white' },
          { label: 'Clientes Ganados', value: String(stats?.leads.ganados || 0),      sub: `Tasa: ${tasaConv}%`,                         color: 'text-emerald-400' },
          { label: 'Mensajes',       value: String(stats?.mensajes.total || 0),        sub: 'Todos los canales',                          color: 'text-amber-400' },
        ].map(k => (
          <div key={k.label} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-slate-500 mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Por canal */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Leads por canal</h3>
          {Object.keys(leadsPorCanal).length === 0 ? (
            <p className="text-slate-600 text-sm text-center py-8">Sin datos</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(leadsPorCanal).sort((a, b) => b[1] - a[1]).map(([canal, cnt]) => {
                const pct = total > 0 ? (cnt / total) * 100 : 0
                return (
                  <div key={canal}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">{CANAL_LABELS[canal] ?? canal}</span>
                      <span className="text-slate-400">{cnt}</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Por temperatura */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Distribución por temperatura</h3>
          <div className="space-y-3">
            {['frio', 'tibio', 'caliente', 'ganado'].map(t => {
              const cnt = leadsPorTemp[t] || 0
              const pct = total > 0 ? (cnt / total) * 100 : 0
              return (
                <div key={t}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${TEMP_DOTS[t]}`} />
                      <span className={`${TEMP_COLORS[t]}`}>{t.charAt(0).toUpperCase() + t.slice(1)}</span>
                    </span>
                    <span className="text-slate-400">{cnt}</span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${TEMP_DOTS[t]}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Actividad reciente */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-700/50">
          <h3 className="text-sm font-semibold text-white">Actividad reciente</h3>
        </div>
        {leads.length === 0 ? (
          <p className="text-slate-600 text-sm text-center py-8">Sin actividad</p>
        ) : (
          <div className="divide-y divide-slate-700/30">
            {leads.slice(0, 10).map(lead => (
              <div key={lead.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-700/20 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-white">{lead.nombre}</p>
                  <p className="text-xs text-slate-500">{lead.telefono} · {CANAL_LABELS[lead.canal_origen?.toLowerCase()] ?? lead.canal_origen}</p>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-semibold ${TEMP_COLORS[lead.temperatura] ?? 'text-slate-400'}`}>
                    {lead.temperatura}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">{fmtDate(lead.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Métricas bottom */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Tasa de Respuesta', value: stats && stats.conversaciones.total > 0 ? ((stats.conversaciones.activas / stats.conversaciones.total) * 100).toFixed(1) + '%' : '0%', color: 'text-blue-400' },
          { label: 'Promedio Msgs/Conv', value: stats && stats.conversaciones.total > 0 ? (stats.mensajes.total / stats.conversaciones.total).toFixed(1) : '0', color: 'text-white' },
          { label: 'Tasa de Conversión', value: tasaConv + '%', color: 'text-emerald-400' },
        ].map(m => (
          <div key={m.label} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">{m.label}</p>
            <p className={`text-3xl font-bold ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
