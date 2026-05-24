'use client'
import { useState, useEffect } from 'react'

interface Stats {
  total_tenants: number
  tenants_activos: number
  tenants_vencidos: number
  total_condominios: number
  total_departamentos: number
  total_residentes: number
  total_usuarios: number
}

function StatCard({ label, value, color, sub }: { label: string; value: number | string; color: string; sub?: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-2">{label}</div>
      <div className={'text-3xl font-bold ' + color}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  )
}

export default function SistemPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [info, setInfo] = useState<{ version: string; status: string } | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/superadmin/stats', { credentials: 'include' }).then(r => r.json()),
      fetch('/health').then(r => r.json()).catch(() => ({ status: 'unknown' })),
    ]).then(([s, h]) => {
      setStats(s)
      setInfo({ version: '2.0.0', status: h.status || 'ok' })
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Sistema</h1>
        <p className="text-slate-400 text-sm mt-1">Estado de la plataforma ConectaAI</p>
      </div>

      {/* API status */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="font-semibold text-white mb-4">Estado del sistema</h2>
        <div className="flex items-center gap-3 mb-4">
          <div className={'w-3 h-3 rounded-full ' + (info?.status === 'healthy' || info?.status === 'ok' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400')} />
          <span className="text-sm text-white font-medium">API Backend</span>
          <span className={'text-xs px-2 py-0.5 rounded ' + (info?.status === 'healthy' || info?.status === 'ok' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400')}>
            {info?.status || 'unknown'}
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-xs text-slate-500 mb-0.5">Version</dt>
            <dd className="text-sm text-white font-mono">{info?.version || '-'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 mb-0.5">Plataforma</dt>
            <dd className="text-sm text-white">ConectaAI Condominios</dd>
          </div>
        </dl>
      </div>

      {/* Stats grid */}
      {stats && (
        <div>
          <h2 className="font-semibold text-white mb-4">Metricas globales</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <StatCard label="Tenants totales" value={stats.total_tenants} color="text-white" />
            <StatCard label="Tenants activos" value={stats.tenants_activos} color="text-emerald-400"
              sub={(stats.total_tenants - stats.tenants_activos) + ' inactivos'} />
            <StatCard label="Vencidos" value={stats.tenants_vencidos} color="text-red-400" />
            <StatCard label="Usuarios" value={stats.total_usuarios} color="text-indigo-400" />
            <StatCard label="Condominios" value={stats.total_condominios} color="text-blue-400" />
            <StatCard label="Departamentos" value={stats.total_departamentos} color="text-cyan-400" />
            <StatCard label="Residentes PWA" value={stats.total_residentes} color="text-purple-400" />
          </div>
        </div>
      )}

      {/* Links */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="font-semibold text-white mb-4">Accesos rapidos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: 'API Docs (FastAPI)', href: '/docs', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
            { label: 'Health check', href: '/health', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
          ].map(l => (
            <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm text-white transition">
              <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={l.icon} />
              </svg>
              {l.label}
              <svg className="w-3.5 h-3.5 ml-auto text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
