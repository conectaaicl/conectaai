'use client'
import { useState, useEffect, useCallback } from 'react'

interface Tenant { id: number; nombre: string; tipo: string; email_admin?: string }
interface FeatureCatalog { key: string; label: string; descripcion?: string; categoria: string; precio_clp: number }
interface TenantFeature { feature_key: string; activo: boolean; label: string; categoria: string; precio_clp: number }

const TIPO_LABELS: Record<string, { label: string; color: string }> = {
  condominio: { label: 'Condominio', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  bodega:     { label: 'Bodega',     color: 'bg-amber-100 text-amber-700 border-amber-200' },
  pyme:       { label: 'PyME',       color: 'bg-green-100 text-green-700 border-green-200' },
  cowork:     { label: 'Cowork',     color: 'bg-purple-100 text-purple-700 border-purple-200' },
}

const CAT_LABELS: Record<string, string> = {
  operaciones: 'Operaciones', seguridad: 'Seguridad', finanzas: 'Finanzas',
  rrhh: 'RRHH', comunidad: 'Comunidad', ia: 'Inteligencia Artificial',
  comunicaciones: 'Comunicaciones', portal: 'Portal', analytics: 'Analítica', sistema: 'Sistema',
}

function fmtPrice(n: number) {
  if (n === 0) return 'Gratis'
  return '$' + n.toLocaleString('es-CL') + '/mes'
}

export default function FeaturesAdminPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [selected, setSelected] = useState<Tenant | null>(null)
  const [catalog, setCatalog] = useState<FeatureCatalog[]>([])
  const [features, setFeatures] = useState<TenantFeature[]>([])
  const [pricing, setPricing] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [tipoModal, setTipoModal] = useState(false)
  const [newTipo, setNewTipo] = useState('condominio')
  const [resetFeatures, setResetFeatures] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/features/tenants', { credentials: 'include' }).then(r => r.ok ? r.json() : []),
      fetch('/api/features/catalog', { credentials: 'include' }).then(r => r.ok ? r.json() : []),
    ]).then(([t, c]) => {
      setTenants(Array.isArray(t) ? t : (t.tenants ?? []))
      setCatalog(Array.isArray(c) ? c : [])
      setLoading(false)
    })
  }, [])

  const loadTenantFeatures = useCallback(async (t: Tenant) => {
    setSelected(t)
    setNewTipo(t.tipo || 'condominio')
    const [fr, pr] = await Promise.all([
      fetch(`/api/features/tenant/${t.id}`, { credentials: 'include' }).then(r => r.ok ? r.json() : null),
      fetch(`/api/features/pricing/${t.id}`, { credentials: 'include' }).then(r => r.ok ? r.json() : null),
    ])
    if (fr) setFeatures(fr.features || [])
    if (pr) setPricing(pr.precio_mensual_clp || 0)
  }, [])

  async function toggleFeature(featureKey: string, activo: boolean) {
    if (!selected) return
    setSaving(featureKey)
    try {
      await fetch(`/api/features/${featureKey}/toggle?tenant_id=${selected.id}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo }),
      })
      setFeatures(prev => prev.map(f => f.feature_key === featureKey ? { ...f, activo } : f))
      // recalc price
      const pr = await fetch(`/api/features/pricing/${selected.id}`, { credentials: 'include' }).then(r => r.json())
      setPricing(pr.precio_mensual_clp || 0)
    } finally { setSaving(null) }
  }

  async function changeTipo() {
    if (!selected) return
    setSaving('tipo')
    try {
      await fetch(`/api/features/tenant/${selected.id}/tipo`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: newTipo, reset_features: resetFeatures }),
      })
      setSelected(prev => prev ? { ...prev, tipo: newTipo } : prev)
      setTenants(prev => prev.map(t => t.id === selected.id ? { ...t, tipo: newTipo } : t))
      setTipoModal(false)
      await loadTenantFeatures({ ...selected, tipo: newTipo })
    } finally { setSaving(null) }
  }

  // Group features by category
  const cats = Array.from(new Set(catalog.map(c => c.categoria)))
  const featureMap = Object.fromEntries(features.map(f => [f.feature_key, f]))

  const filteredTenants = tenants.filter(t =>
    t.nombre?.toLowerCase().includes(search.toLowerCase()) ||
    t.email_admin?.toLowerCase().includes(search.toLowerCase())
  )

  const activeCount = features.filter(f => f.activo).length
  const totalCount = features.length

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  )

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Feature Flags</h1>
        <p className="text-sm text-gray-500 mt-1">Activa o desactiva módulos por tenant — el precio se calcula automáticamente</p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Tenant list */}
        <div className="col-span-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar tenant..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="divide-y divide-gray-50 max-h-[700px] overflow-y-auto">
            {filteredTenants.map(t => {
              const tl = TIPO_LABELS[t.tipo] ?? TIPO_LABELS.condominio
              return (
                <button key={t.id} onClick={() => loadTenantFeatures(t)}
                  className={`w-full text-left p-4 transition hover:bg-gray-50 ${selected?.id === t.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{t.nombre}</p>
                      <p className="text-xs text-gray-400 truncate">{t.email_admin}</p>
                    </div>
                    <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border ${tl.color}`}>{tl.label}</span>
                  </div>
                </button>
              )
            })}
            {filteredTenants.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">Sin resultados</p>}
          </div>
        </div>

        {/* Feature panel */}
        <div className="col-span-8">
          {!selected ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-center h-64">
              <div className="text-center text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                <p className="font-medium">Selecciona un tenant</p>
                <p className="text-sm mt-1">para gestionar sus features</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header tenant */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{selected.nombre}</h2>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${TIPO_LABELS[selected.tipo]?.color ?? TIPO_LABELS.condominio.color}`}>
                        {TIPO_LABELS[selected.tipo]?.label ?? selected.tipo}
                      </span>
                      <span className="text-xs text-gray-500">{activeCount}/{totalCount} features activos</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">${pricing.toLocaleString('es-CL')}</p>
                      <p className="text-xs text-gray-400">/mes calculado</p>
                    </div>
                    <button onClick={() => setTipoModal(true)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition">
                      Cambiar tipo
                    </button>
                  </div>
                </div>
              </div>

              {/* Features by category */}
              {cats.map(cat => {
                const catItems = catalog.filter(c => c.categoria === cat)
                if (catItems.length === 0) return null
                return (
                  <div key={cat} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                      <h3 className="text-sm font-semibold text-gray-700">{CAT_LABELS[cat] ?? cat}</h3>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {catItems.map(item => {
                        const tf = featureMap[item.key]
                        const isActive = tf?.activo ?? false
                        const isSaving = saving === item.key
                        return (
                          <div key={item.key} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50 transition">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-gray-900">{item.label}</p>
                                {item.precio_clp > 0
                                  ? <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{fmtPrice(item.precio_clp)}</span>
                                  : <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Incluido</span>
                                }
                              </div>
                              {item.descripcion && <p className="text-xs text-gray-400 mt-0.5">{item.descripcion}</p>}
                            </div>
                            <button
                              onClick={() => toggleFeature(item.key, !isActive)}
                              disabled={isSaving}
                              className={`relative ml-4 flex-shrink-0 w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none ${isActive ? 'bg-blue-600' : 'bg-gray-200'} ${isSaving ? 'opacity-50 cursor-wait' : ''}`}
                            >
                              <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${isActive ? 'translate-x-6' : 'translate-x-0'}`} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Tipo Modal */}
      {tipoModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Cambiar tipo de tenant</h2>
              <button onClick={() => setTipoModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(TIPO_LABELS).map(([k, v]) => (
                  <button key={k} onClick={() => setNewTipo(k)}
                    className={`p-3 rounded-xl border-2 text-left transition ${newTipo === k ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${v.color}`}>{v.label}</span>
                    <p className="text-xs text-gray-500 mt-2">
                      {k === 'condominio' && 'Edificios residenciales, housing'}
                      {k === 'bodega' && 'Bodegas y mini-warehouses'}
                      {k === 'pyme' && 'Oficinas y pequeñas empresas'}
                      {k === 'cowork' && 'Espacios de trabajo compartido'}
                    </p>
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={resetFeatures} onChange={e => setResetFeatures(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Resetear features al preset del tipo</p>
                  <p className="text-xs text-gray-500">Desactiva los features actuales y activa el preset de {TIPO_LABELS[newTipo]?.label}</p>
                </div>
              </label>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setTipoModal(false)} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition">Cancelar</button>
              <button onClick={changeTipo} disabled={saving === 'tipo'}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
                {saving === 'tipo' ? 'Aplicando...' : 'Aplicar cambio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
