'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Tenant { id: number; nombre: string; tipo: string; email_admin?: string }

const TIPO_COLORS: Record<string, string> = {
  condominio: 'bg-blue-100 text-blue-700',
  bodega: 'bg-amber-100 text-amber-700',
  pyme: 'bg-green-100 text-green-700',
  cowork: 'bg-purple-100 text-purple-700',
}

export default function SuperAdminPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/features/tenants', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(d => { setTenants(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = tenants.filter(t =>
    t.nombre?.toLowerCase().includes(search.toLowerCase()) ||
    t.email_admin?.toLowerCase().includes(search.toLowerCase())
  )

  const byTipo = (tipo: string) => tenants.filter(t => t.tipo === tipo).length

  const cards = [
    { label: 'Condominios', tipo: 'condominio', color: 'bg-blue-600' },
    { label: 'Bodegas',     tipo: 'bodega',     color: 'bg-amber-600' },
    { label: 'PyMEs',       tipo: 'pyme',       color: 'bg-green-600' },
    { label: 'Coworks',     tipo: 'cowork',     color: 'bg-purple-600' },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Panel SuperAdmin</h1>
        <p className="text-slate-400 text-sm mt-1">Gestión global de tenants y módulos del sistema</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {cards.map(c => (
          <div key={c.tipo} className={`${c.color} rounded-2xl p-4 text-white`}>
            <p className="text-3xl font-bold">{loading ? '—' : byTipo(c.tipo)}</p>
            <p className="text-xs opacity-80 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <Link href="/dashboard/superadmin/features"
        className="flex items-center gap-4 p-4 mb-8 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 transition group">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-white font-semibold text-sm">Feature Flags</p>
          <p className="text-slate-400 text-xs mt-0.5">Activa módulos y calcula precios por tenant</p>
        </div>
        <svg className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>

      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-3">
          <h2 className="text-sm font-semibold text-white flex-1">Todos los tenants ({tenants.length})</h2>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar..." className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-48" />
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {filtered.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-800/50 transition">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {t.nombre?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{t.nombre}</p>
                  <p className="text-slate-400 text-xs truncate">{t.email_admin}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TIPO_COLORS[t.tipo] ?? 'bg-slate-700 text-slate-300'}`}>
                  {t.tipo}
                </span>
                <Link href="/dashboard/superadmin/features" className="text-xs text-indigo-400 hover:text-indigo-300 shrink-0">
                  Features →
                </Link>
              </div>
            ))}
            {filtered.length === 0 && <p className="text-center text-slate-500 py-8 text-sm">Sin tenants registrados</p>}
          </div>
        )}
      </div>
    </div>
  )
}
