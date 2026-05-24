'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from '@/hooks/useSession'

interface ResumenListItem {
  id: number
  tenant_id: number
  fecha_desde: string | null
  fecha_hasta: string | null
  preview: string
  estado_general: string
  generado_por: string
  created_at: string | null
}

interface ResumenDetalle {
  id: number
  tenant_id: number
  fecha_desde: string | null
  fecha_hasta: string | null
  resumen_texto: string
  recomendaciones: string[]
  estado_general: string
  stats: Record<string, unknown>
  generado_por: string
  created_at: string | null
}

const ESTADO_CONFIG = {
  bueno:   { label: 'Bueno',   bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
  regular: { label: 'Regular', bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-amber-500/30',   dot: 'bg-amber-400' },
  critico: { label: 'Critico', bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-500/30',     dot: 'bg-red-400' },
}

type EstadoKey = keyof typeof ESTADO_CONFIG

function DocIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function SpinIcon() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function fmtDate(s: string | null) {
  if (!s) return ''
  try {
    return new Date(s).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return s }
}

function estadoCfg(e: string) {
  return ESTADO_CONFIG[(e as EstadoKey)] || ESTADO_CONFIG.regular
}

// ── Sub-components ───────────────────────────────────────────────────────────

function ResumenDetallado({ detalle }: { detalle: ResumenDetalle }) {
  const cfg = estadoCfg(detalle.estado_general)
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          Estado general: {cfg.label}
        </span>
        {detalle.fecha_desde && detalle.fecha_hasta && (
          <span className="text-slate-500 text-xs">
            Semana del {fmtDate(detalle.fecha_desde)} al {fmtDate(detalle.fecha_hasta)}
          </span>
        )}
      </div>

      <div className="rounded-lg p-4" style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(30,41,59,0.6)' }}>
        <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-line">{detalle.resumen_texto}</p>
      </div>

      {detalle.recomendaciones && detalle.recomendaciones.length > 0 && (
        <div>
          <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Recomendaciones de accion</h3>
          <div className="space-y-2">
            {detalle.recomendaciones.map((rec, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg px-3 py-2.5"
                style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-indigo-300 text-xs font-bold shrink-0 mt-0.5"
                  style={{ background: 'rgba(99,102,241,0.3)' }}>
                  {i + 1}
                </div>
                <p className="text-slate-200 text-sm leading-snug">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {detalle.stats && Object.keys(detalle.stats).length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300 transition flex items-center gap-1.5 select-none">
            <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Ver datos recopilados
          </summary>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {Object.entries(detalle.stats).filter(([k]) => k !== 'periodo').map(([key, val]) => {
              const obj = val as Record<string, number>
              return (
                <div key={key} className="rounded-lg p-2.5"
                  style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(30,41,59,0.8)' }}>
                  <p className="text-slate-500 text-xs capitalize mb-1">{key.replace(/_/g, ' ')}</p>
                  {Object.entries(obj).map(([subk, subv]) => (
                    <div key={subk} className="flex justify-between items-center">
                      <span className="text-slate-400 text-xs capitalize">{subk.replace(/_/g, ' ')}</span>
                      <span className={'text-xs font-bold ' + (subv === -1 ? 'text-slate-600' : 'text-white')}>
                        {subv === -1 ? 'N/D' : String(subv)}
                      </span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </details>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ResumenesSemalesPage() {
  const { user } = useSession()
  const tid = typeof window !== 'undefined' ? localStorage.getItem('current_condominio_id') : null

  const [resumenes, setResumenes] = useState<ResumenListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [detalle, setDetalle] = useState<Record<number, ResumenDetalle>>({})
  const [loadingDetalle, setLoadingDetalle] = useState<number | null>(null)
  const [mensaje, setMensaje] = useState('')
  const [nuevoResumen, setNuevoResumen] = useState<ResumenDetalle | null>(null)

  const fetchResumenes = useCallback(async () => {
    if (!tid) return
    setLoading(true)
    try {
      const res = await fetch('/api/resumenes?tenant_id=' + tid + '&limit=20')
      if (res.ok) setResumenes(await res.json())
    } catch {}
    setLoading(false)
  }, [tid])

  useEffect(() => { fetchResumenes() }, [fetchResumenes])

  async function generar() {
    if (!tid || generating) return
    setGenerating(true)
    setMensaje('')
    setNuevoResumen(null)
    try {
      const res = await fetch('/api/resumenes/generar?tenant_id=' + tid, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Error desconocido' }))
        setMensaje('Error: ' + (err.detail || res.statusText))
      } else {
        const data: ResumenDetalle = await res.json()
        setNuevoResumen(data)
        setMensaje('Resumen generado exitosamente')
        await fetchResumenes()
      }
    } catch {
      setMensaje('Error de conexion al generar resumen')
    }
    setGenerating(false)
  }

  async function toggleExpand(id: number) {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (detalle[id]) return
    setLoadingDetalle(id)
    try {
      const res = await fetch('/api/resumenes/' + id)
      const data = await res.json(); if (res.ok) setDetalle(prev => ({ ...prev, [id]: data }))
    } catch {}
    setLoadingDetalle(null)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-indigo-300"
            style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.3))', border: '1px solid rgba(99,102,241,0.4)' }}>
            <DocIcon />
          </div>
          <div>
            <h1 className="text-white font-bold text-xl leading-none">Resumenes Semanales</h1>
            <p className="text-slate-400 text-sm mt-0.5">Reportes ejecutivos generados con IA</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {mensaje && (
            <span className={'text-sm px-3 py-1.5 rounded-lg ' + (mensaje.startsWith('Error') ? 'text-red-300' : 'text-emerald-300')}
              style={{
                background: mensaje.startsWith('Error') ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                border: mensaje.startsWith('Error') ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(16,185,129,0.3)',
              }}>
              {mensaje}
            </span>
          )}
          <button onClick={generar} disabled={generating || !tid}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #6366f1, #9333ea)' }}>
            {generating ? <><SpinIcon />Generando...</> : <><DocIcon />Generar Resumen</>}
          </button>
        </div>
      </div>

      {/* Generating indicator */}
      {generating && (
        <div className="rounded-xl p-5 flex items-center gap-4"
          style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.3)' }}>
          <SpinIcon />
          <div>
            <p className="text-white font-medium text-sm">Claude esta analizando los datos del condominio...</p>
            <p className="text-slate-400 text-xs mt-0.5">Esto puede tardar 5-10 segundos. No cierres esta pagina.</p>
          </div>
        </div>
      )}

      {/* Nuevo resumen destacado */}
      {nuevoResumen && (
        <div className="rounded-xl p-5 space-y-4"
          style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.4)' }}>
          <p className="text-indigo-300 text-xs font-bold uppercase tracking-wider">Resumen recien generado</p>
          <ResumenDetallado detalle={nuevoResumen} />
        </div>
      )}

      {/* Historial */}
      <div>
        <h2 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-3">Historial de resumenes</h2>
        {loading ? (
          <div className="flex justify-center py-12"><SpinIcon /></div>
        ) : resumenes.length === 0 ? (
          <div className="rounded-xl p-10 flex flex-col items-center gap-3"
            style={{ background: 'rgba(15,23,42,0.6)', border: '1px dashed rgba(30,41,59,0.8)' }}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-slate-500"
              style={{ background: 'rgba(30,41,59,0.5)' }}>
              <DocIcon />
            </div>
            <p className="text-slate-400 font-medium">Aun no hay resumenes generados</p>
            <p className="text-slate-500 text-sm">Haz clic en Generar Resumen para crear el primero</p>
          </div>
        ) : (
          <div className="space-y-3">
            {resumenes.map(r => {
              const cfg = estadoCfg(r.estado_general)
              const isExpanded = expanded === r.id
              const det = detalle[r.id]
              return (
                <div key={r.id} className="rounded-xl overflow-hidden transition-all"
                  style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(30,41,59,0.8)' }}>
                  <button className="w-full flex items-center gap-4 px-4 py-4 text-left hover:bg-slate-800/30 transition"
                    onClick={() => toggleExpand(r.id)}>
                    <div className={'flex-shrink-0 w-2.5 h-2.5 rounded-full ' + cfg.dot} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white text-sm font-semibold">
                          {fmtDate(r.fecha_desde)} - {fmtDate(r.fecha_hasta)}
                        </span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                          {cfg.label}
                        </span>
                        {r.generado_por === 'automatico' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-900/30 text-indigo-300 border border-indigo-700/30">IA</span>
                        )}
                      </div>
                      <p className="text-slate-400 text-xs mt-1 truncate">{r.preview}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-slate-500 text-xs">
                      <span>{fmtDate(r.created_at)}</span>
                      <svg className={'w-4 h-4 transition-transform ' + (isExpanded ? 'rotate-180' : '')}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-slate-800/60 pt-4">
                      {loadingDetalle === r.id ? (
                        <div className="flex justify-center py-4"><SpinIcon /></div>
                      ) : det ? (
                        <ResumenDetallado detalle={det} />
                      ) : (
                        <p className="text-slate-500 text-sm">Error al cargar el detalle</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
