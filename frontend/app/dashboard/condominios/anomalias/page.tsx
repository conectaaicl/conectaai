'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from '@/hooks/useSession'

interface Anomalia {
  id: number
  tipo: string
  descripcion: string
  severidad: 'critica' | 'alta' | 'media' | 'baja'
  entidad_tipo: string
  entidad_id: number | null
  revisada: boolean
  falso_positivo: boolean
  created_at: string
}

interface Resumen {
  critica: number
  alta: number
  media: number
  baja: number
  total: number
}

const SEV_CONFIG = {
  critica: { label: 'Critica', bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30', dot: 'bg-red-400' },
  alta:    { label: 'Alta',    bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30', dot: 'bg-orange-400' },
  media:   { label: 'Media',   bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', dot: 'bg-amber-400' },
  baja:    { label: 'Baja',    bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30', dot: 'bg-slate-400' },
}

function ShieldIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
}

export default function AnomaliasPage() {
  const { user } = useSession()
  const tenantId = typeof window !== 'undefined' ? localStorage.getItem('current_condominio_id') : null
  const [anomalias, setAnomalias] = useState<Anomalia[]>([])
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeMsg, setAnalyzeMsg] = useState('')
  const [filterSev, setFilterSev] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [showRevisadas, setShowRevisadas] = useState(false)

  const fetchData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ tenant_id: tenantId })
      if (!showRevisadas) params.set('revisada', 'false')
      if (filterSev) params.set('severidad', filterSev)
      const [listRes, resRes] = await Promise.all([
        fetch('/api/anomalias?' + params.toString()),
        fetch('/api/anomalias/resumen?tenant_id=' + tenantId)
      ])
      if (listRes.ok) setAnomalias(await listRes.json())
      if (resRes.ok) setResumen(await resRes.json())
    } catch {}
    setLoading(false)
  }, [tenantId, showRevisadas, filterSev])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-analyze on first load
  useEffect(() => {
    if (!tenantId) return
    analyzeNow(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  async function analyzeNow(silent = false) {
    if (!tenantId || analyzing) return
    setAnalyzing(true)
    if (!silent) setAnalyzeMsg('')
    try {
      const res = await fetch('/api/anomalias/analizar?tenant_id=' + tenantId, { method: 'POST' })
      const data = await res.json()
      if (!silent) setAnalyzeMsg(data.mensaje || (data.nuevas + ' nuevas anomalias detectadas'))
      await fetchData()
    } catch {
      if (!silent) setAnalyzeMsg('Error al analizar')
    }
    setAnalyzing(false)
  }

  async function revisar(id: number) {
    await fetch('/api/anomalias/' + id + '/revisar', { method: 'PATCH' })
    setAnomalias(prev => prev.map(a => a.id === id ? { ...a, revisada: true } : a))
    if (resumen) setResumen({ ...resumen, total: Math.max(0, resumen.total - 1) })
  }

  async function marcarFalsoPositivo(id: number) {
    await fetch('/api/anomalias/' + id + '/falso-positivo', { method: 'PATCH' })
    setAnomalias(prev => prev.map(a => a.id === id ? { ...a, falso_positivo: true, revisada: true } : a))
    if (resumen) setResumen({ ...resumen, total: Math.max(0, resumen.total - 1) })
  }

  const filtered = anomalias.filter(a => {
    if (filterTipo && !a.tipo.includes(filterTipo)) return false
    return true
  })

  const tiposUnicos = Array.from(new Set(anomalias.map(a => a.tipo)))

  function formatDate(s: string) {
    try {
      return new Date(s).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })
    } catch { return s }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-indigo-300"
            style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.3))', border: '1px solid rgba(99,102,241,0.4)' }}>
            <ShieldIcon />
          </div>
          <div>
            <h1 className="text-white font-bold text-xl leading-none">Anomalias Detectadas</h1>
            <p className="text-slate-400 text-sm mt-0.5">Monitoreo inteligente de seguridad</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {analyzeMsg && (
            <span className="text-indigo-300 text-sm px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)' }}>
              {analyzeMsg}
            </span>
          )}
          <button
            onClick={() => analyzeNow(false)}
            disabled={analyzing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #6366f1, #9333ea)' }}>
            {analyzing ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analizando...
              </>
            ) : (
              <>
                <ShieldIcon />
                Analizar Ahora
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats */}
      {resumen && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {(['critica', 'alta', 'media', 'baja'] as const).map(sev => {
            const cfg = SEV_CONFIG[sev]
            return (
              <button key={sev}
                onClick={() => setFilterSev(filterSev === sev ? '' : sev)}
                className={`rounded-xl p-3 text-left transition-all ${cfg.bg} border ${cfg.border} ${filterSev === sev ? 'ring-1 ring-indigo-400' : ''}`}>
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <span className={`text-xs font-semibold ${cfg.text}`}>{cfg.label}</span>
                </div>
                <p className={`text-2xl font-bold ${cfg.text}`}>{resumen[sev]}</p>
              </button>
            )
          })}
          <div className="rounded-xl p-3 bg-slate-800/50 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-indigo-400" />
              <span className="text-xs font-semibold text-indigo-400">Total</span>
            </div>
            <p className="text-2xl font-bold text-white">{resumen.total}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={filterTipo}
          onChange={e => setFilterTipo(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 outline-none">
          <option value="">Todos los tipos</option>
          {tiposUnicos.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
          <input type="checkbox" checked={showRevisadas} onChange={e => setShowRevisadas(e.target.checked)}
            className="rounded" />
          Mostrar revisadas
        </label>
        {(filterSev || filterTipo) && (
          <button onClick={() => { setFilterSev(''); setFilterTipo('') }}
            className="text-xs text-slate-400 hover:text-white transition px-2 py-1 rounded-lg border border-slate-700">
            Limpiar filtros
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <svg className="w-8 h-8 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center text-emerald-400"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-white font-semibold">Sin anomalias detectadas</p>
          <p className="text-slate-400 text-sm">El sistema no encontro actividad sospechosa</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => {
            const cfg = SEV_CONFIG[a.severidad] || SEV_CONFIG.baja
            const isRevisada = a.revisada
            return (
              <div key={a.id}
                className={`rounded-xl p-4 transition-all ${isRevisada ? 'opacity-50' : ''}`}
                style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(30,41,59,0.8)' }}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-slate-800 text-slate-300 border border-slate-700">
                        {a.tipo.replace(/_/g, ' ')}
                      </span>
                      {a.entidad_tipo && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-900/30 text-indigo-300 border border-indigo-700/30">
                          {a.entidad_tipo}
                        </span>
                      )}
                      {a.falso_positivo && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-slate-700 text-slate-400">
                          Falso positivo
                        </span>
                      )}
                    </div>
                    <p className={`text-sm ${isRevisada ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                      {a.descripcion}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{formatDate(a.created_at)}</p>
                  </div>
                  {!isRevisada && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => revisar(a.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-300 transition hover:text-white"
                        style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
                        Revisar
                      </button>
                      <button onClick={() => marcarFalsoPositivo(a.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 transition hover:text-white"
                        style={{ background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(51,65,85,0.5)' }}>
                        Falso positivo
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
