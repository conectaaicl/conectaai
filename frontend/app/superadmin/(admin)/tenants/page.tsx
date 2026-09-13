'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Tenant {
  id: number; nombre: string; subdominio: string; email_contacto: string
  telefono?: string; plan: string; estado: string
  limite_condominios: number; limite_departamentos: number
  total_condominios: number; total_usuarios: number
  created_at: string | null; fecha_vencimiento: string | null
}

const PLAN_COLOR: Record<string, string> = {
  basico: 'bg-slate-700/50 text-slate-300',
  profesional: 'bg-indigo-600/20 text-indigo-300 border border-indigo-600/30',
  enterprise: 'bg-amber-600/20 text-amber-300 border border-amber-600/30',
}
const ESTADO_COLOR: Record<string, string> = {
  activo: 'bg-emerald-500/15 text-emerald-400',
  inactivo: 'bg-red-500/15 text-red-400',
}

export default function SATenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPlan, setFilterPlan] = useState('')
  const [filterEstado, setFilterEstado] = useState('')
  const [acting, setActing] = useState<number | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/superadmin/tenants', { credentials: 'include' })
      .then(r => r.json()).then(d => setTenants(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [])
  useEffect(load, [load])

  const filtered = tenants.filter(t => {
    if (search && !t.nombre.toLowerCase().includes(search.toLowerCase()) && !t.subdominio.includes(search.toLowerCase())) return false
    if (filterPlan && t.plan !== filterPlan) return false
    if (filterEstado && t.estado !== filterEstado) return false
    return true
  })

  const activos = tenants.filter(t => t.estado === 'activo').length
  const vencidos = tenants.filter(t => t.fecha_vencimiento && new Date(t.fecha_vencimiento) < new Date()).length
  const totalUsuarios = tenants.reduce((a, t) => a + t.total_usuarios, 0)

  async function toggleEstado(t: Tenant) {
    if (!confirm((t.estado === 'activo' ? 'Desactivar' : 'Activar') + ' tenant "' + t.nombre + '"?')) return
    setActing(t.id)
    try {
      await fetch('/api/superadmin/tenants/' + t.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ estado: t.estado === 'activo' ? 'inactivo' : 'activo' }),
      })
      load()
    } finally { setActing(null) }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Tenants</h1>
          <p className="text-slate-400 text-sm mt-1">{tenants.length} organizaciones registradas</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/superadmin/nuevo"
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-md shadow-teal-500/20">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Crear condominio
          </Link>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: tenants.length, color: 'text-white' },
          { label: 'Activos', value: activos, color: 'text-emerald-400' },
          { label: 'Vencidos', value: vencidos, color: 'text-red-400' },
          { label: 'Usuarios', value: totalUsuarios, color: 'text-indigo-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400 mb-1">{s.label}</div>
            <div className={'text-2xl font-bold ' + s.color}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre o subdominio..."
          className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
        />
        <select value={filterPlan} onChange={e => setFilterPlan(e.target.value)}
          className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">Todos los planes</option>
          <option value="basico">Basico</option>
          <option value="profesional">Profesional</option>
          <option value="enterprise">Enterprise</option>
        </select>
        <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)}
          className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {['Edificio', 'Plan', 'Estado', 'Limites', 'Uso', 'Vencimiento', 'Acciones'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filtered.map(t => (
                  <tr key={t.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-5 py-4">
                      <div className="font-medium text-white">{t.nombre}</div>
                      <div className="text-xs text-slate-500 font-mono">{t.subdominio}</div>
                      <div className="text-xs text-slate-500">{t.email_contacto}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={'px-2.5 py-1 rounded-lg text-xs font-semibold ' + (PLAN_COLOR[t.plan] || 'bg-slate-700 text-slate-300')}>{t.plan}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={'px-2.5 py-1 rounded-lg text-xs font-semibold ' + (ESTADO_COLOR[t.estado] || '')}>{t.estado}</span>
                    </td>
                    <td className="px-5 py-4 text-slate-400 text-xs">
                      <div>{t.limite_condominios} condominios</div>
                      <div>{t.limite_departamentos} deptos</div>
                    </td>
                    <td className="px-5 py-4 text-slate-300 text-xs">
                      <div>{t.total_condominios} condominios</div>
                      <div>{t.total_usuarios} usuarios</div>
                    </td>
                    <td className="px-5 py-4 text-slate-400 text-xs">
                      {t.fecha_vencimiento ? (
                        <span className={new Date(t.fecha_vencimiento) < new Date() ? 'text-red-400' : 'text-slate-400'}>
                          {t.fecha_vencimiento.slice(0, 10)}
                        </span>
                      ) : <span className="text-slate-600">Sin limite</span>}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Link href={'/superadmin/tenants/' + t.id}
                          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-xs text-white rounded-lg transition">
                          Ver
                        </Link>
                        <button onClick={() => toggleEstado(t)} disabled={acting === t.id}
                          className={'px-3 py-1.5 text-xs rounded-lg transition disabled:opacity-50 ' + (
                            t.estado === 'activo'
                              ? 'bg-red-500/15 hover:bg-red-500/25 text-red-400'
                              : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400'
                          )}>
                          {t.estado === 'activo' ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    {search || filterPlan || filterEstado ? 'Sin resultados para los filtros aplicados' : 'No hay tenants creados aun'}
                  </td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
