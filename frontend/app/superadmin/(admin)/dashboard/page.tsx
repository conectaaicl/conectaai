'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Stats {
  total_tenants: number
  tenants_activos: number
  total_condominios: number
  total_departamentos: number
  total_residentes: number
}
interface Tenant {
  id: number; nombre: string; subdominio: string; plan: string; estado: string
  total_condominios: number; total_usuarios: number; created_at: string | null
}

function StatCard({ label, value, sub, color }: { label: string; value: number|string; sub?: string; color: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <div className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-2">{label}</div>
      <div className={`text-3xl font-bold ${color} mb-1`}>{value}</div>
      {sub && <div className="text-slate-500 text-xs">{sub}</div>}
    </div>
  )
}

const PLAN_COLOR: Record<string,string> = { basico:'bg-slate-700 text-slate-300', profesional:'bg-indigo-600/20 text-indigo-300', enterprise:'bg-amber-600/20 text-amber-300' }
const ESTADO_COLOR: Record<string,string> = { activo:'bg-emerald-500/15 text-emerald-400', inactivo:'bg-red-500/15 text-red-400' }

export default function SADashboard() {
  const [stats, setStats] = useState<Stats|null>(null)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/superadmin/stats', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/superadmin/tenants', { credentials: 'include' }).then(r => r.json()),
    ]).then(([s, t]) => {
      setStats(s)
      setTenants(Array.isArray(t) ? t : [])
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Resumen de la plataforma ConectaAI</p>
        </div>
        <Link href="/superadmin/tenants/new"
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-md shadow-indigo-500/20">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nuevo Tenant
        </Link>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Tenants totales" value={stats.total_tenants} color="text-white"/>
          <StatCard label="Tenants activos" value={stats.tenants_activos} color="text-emerald-400" sub={`${stats.total_tenants - stats.tenants_activos} inactivos`}/>
          <StatCard label="Condominios" value={stats.total_condominios} color="text-indigo-400"/>
          <StatCard label="Departamentos" value={stats.total_departamentos} color="text-blue-400"/>
          <StatCard label="Residentes PWA" value={stats.total_residentes} color="text-cyan-400"/>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-semibold text-white">Tenants recientes</h2>
          <Link href="/superadmin/tenants" className="text-indigo-400 text-xs hover:text-indigo-300 transition">Ver todos →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                {["Nombre","Subdominio","Plan","Estado","Condominios","Admins","Creado"].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-6 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {tenants.slice(0,8).map(t => (
                <tr key={t.id} className="hover:bg-slate-800/40 transition">
                  <td className="px-6 py-3.5">
                    <Link href={`/superadmin/tenants/${t.id}`} className="font-medium text-white hover:text-indigo-300 transition">{t.nombre}</Link>
                  </td>
                  <td className="px-6 py-3.5 text-slate-400 font-mono text-xs">{t.subdominio}</td>
                  <td className="px-6 py-3.5">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${PLAN_COLOR[t.plan] || 'bg-slate-700 text-slate-300'}`}>{t.plan}</span>
                  </td>
                  <td className="px-6 py-3.5">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${ESTADO_COLOR[t.estado] || 'bg-slate-700 text-slate-300'}`}>{t.estado}</span>
                  </td>
                  <td className="px-6 py-3.5 text-slate-300">{t.total_condominios}</td>
                  <td className="px-6 py-3.5 text-slate-300">{t.total_usuarios}</td>
                  <td className="px-6 py-3.5 text-slate-500 text-xs">{t.created_at ? t.created_at.slice(0,10) : '-'}</td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-500">No hay tenants creados aún</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
