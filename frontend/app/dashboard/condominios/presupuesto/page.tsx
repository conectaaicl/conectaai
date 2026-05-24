'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from '@/hooks/useSession'

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MESES_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

interface MesData { mes: number; proyectado: number; real: number; varianza: number; pct: number; notas?: string }
interface Categoria { id: number; nombre: string; icono: string; color: string; meses: MesData[]; total_proyectado: number; total_real: number; total_varianza: number }
interface Resumen { anio: number; mes_actual: number; gran_total_proyectado: number; gran_total_real: number; proy_acumulado: number; real_acumulado: number; pct_ejecutado: number; varianza_global: number; top_desviaciones: { nombre: string; icono: string; varianza: number }[] }

function fmt(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

function VarianzaBadge({ varianza, pct }: { varianza: number; pct?: number }) {
  if (varianza === 0) return <span className="text-slate-500 text-xs">—</span>
  const over = varianza > 0
  return (
    <span className={`text-xs font-semibold ${over ? 'text-red-400' : 'text-emerald-400'}`}>
      {over ? '+' : ''}{fmt(varianza)}
      {pct !== undefined && pct !== 0 && <span className="ml-1 opacity-70">({over ? '+' : ''}{pct}%)</span>}
    </span>
  )
}

function CellEditor({
  value, onSave, onClose
}: { value: number; onSave: (v: number) => void; onClose: () => void }) {
  const [v, setV] = useState(String(value === 0 ? '' : value))
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])

  function commit() {
    const n = parseFloat(v.replace(/\./g, '').replace(',', '.'))
    onSave(isNaN(n) ? 0 : n)
  }

  return (
    <input
      ref={ref}
      value={v}
      onChange={e => setV(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onClose() }}
      onBlur={commit}
      className="w-24 bg-slate-700 border border-indigo-500 rounded-lg px-2 py-1 text-xs text-white text-right focus:outline-none"
    />
  )
}

export default function PresupuestoPage() {
  const { tenantId } = useSession()
  const [condId, setCondId] = useState<number | null>(null)
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [totales, setTotales] = useState<MesData[]>([])
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<{ catId: number; mes: number; campo: 'proyectado' | 'real' } | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [view, setView] = useState<'tabla' | 'resumen'>('resumen')
  const [newCat, setNewCat] = useState('')
  const [addingCat, setAddingCat] = useState(false)
  const [expandedCat, setExpandedCat] = useState<number | null>(null)
  const mesActual = new Date().getMonth() + 1

  useEffect(() => {
    const stored = localStorage.getItem('active_condominio')
    if (stored) { try { setCondId(JSON.parse(stored).id) } catch {} }
    window.addEventListener('storage', () => {
      const s = localStorage.getItem('active_condominio')
      if (s) { try { setCondId(JSON.parse(s).id) } catch {} }
    })
  }, [])

  const load = useCallback(async () => {
    if (!condId) return
    setLoading(true)
    try {
      const [presRes, resRes] = await Promise.all([
        fetch(`/api/presupuesto/anual?condominio_id=${condId}&anio=${anio}&tenant_id=${tenantId}`),
        fetch(`/api/presupuesto/resumen?condominio_id=${condId}&anio=${anio}&tenant_id=${tenantId}`),
      ])
      if (presRes.ok) { const d = await presRes.json(); setCategorias(d.categorias); setTotales(d.totales_mes) }
      if (resRes.ok) setResumen(await resRes.json())
    } finally { setLoading(false) }
  }, [condId, anio, tenantId])

  useEffect(() => { load() }, [load])

  async function save(catId: number, mes: number, campo: 'proyectado' | 'real', valor: number) {
    setSaving(true)
    try {
      const body: any = { categoria_id: catId, mes }
      if (campo === 'proyectado') body.monto_proyectado = valor
      else body.monto_real = valor

      await fetch(`/api/presupuesto/anual?condominio_id=${condId}&anio=${anio}&tenant_id=${tenantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setMsg('Guardado')
      setTimeout(() => setMsg(null), 2000)
      load()
    } finally { setSaving(false); setEditing(null) }
  }

  async function agregarCategoria() {
    if (!newCat.trim() || !condId) return
    await fetch(`/api/presupuesto/categorias?condominio_id=${condId}&tenant_id=${tenantId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: newCat.trim() }),
    })
    setNewCat('')
    setAddingCat(false)
    load()
  }

  const anioOpts = [anio - 1, anio, anio + 1]

  if (!condId) return (
    <div className="flex items-center justify-center h-64 text-slate-500">
      Selecciona un condominio para ver el presupuesto
    </div>
  )

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Presupuesto Anual</h1>
          <p className="text-sm text-slate-400 mt-0.5">Planificación y control de gastos por categoría</p>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className="text-xs text-emerald-400 font-semibold px-3 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">✓ {msg}</span>}
          {saving && <span className="text-xs text-slate-400">Guardando...</span>}
          <select
            value={anio}
            onChange={e => setAnio(Number(e.target.value))}
            className="bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
          >
            {anioOpts.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="flex rounded-xl overflow-hidden border border-slate-700">
            {(['resumen', 'tabla'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-4 py-2 text-sm font-medium transition ${view === v ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                {v === 'resumen' ? '📊 Resumen' : '📋 Tabla'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* ── RESUMEN VIEW ── */}
      {!loading && view === 'resumen' && resumen && (
        <div className="space-y-5">
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Proyectado', value: fmt(resumen.gran_total_proyectado), color: 'from-indigo-600 to-violet-700', icon: '🎯' },
              { label: 'Total Real (YTD)', value: fmt(resumen.real_acumulado), color: 'from-emerald-600 to-teal-700', icon: '✅' },
              { label: 'Ejecución Presupuestal', value: resumen.pct_ejecutado + '%', color: resumen.pct_ejecutado > 100 ? 'from-red-600 to-rose-700' : resumen.pct_ejecutado > 85 ? 'from-amber-500 to-orange-600' : 'from-sky-600 to-blue-700', icon: '📈' },
              { label: 'Varianza Acumulada', value: fmt(resumen.varianza_global), color: resumen.varianza_global > 0 ? 'from-red-600 to-rose-700' : 'from-emerald-600 to-teal-700', icon: resumen.varianza_global > 0 ? '⚠️' : '✓' },
            ].map((k, i) => (
              <div key={i} className={`bg-gradient-to-br ${k.color} rounded-2xl p-5 shadow-lg`}>
                <div className="text-2xl mb-2">{k.icon}</div>
                <p className="text-white/70 text-xs font-medium">{k.label}</p>
                <p className="text-white font-bold text-xl mt-1 leading-tight">{k.value}</p>
              </div>
            ))}
          </div>

          {/* Progreso por mes (barra) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="font-bold text-white mb-4">Ejecución mensual ({anio})</h2>
            <div className="space-y-3">
              {totales.map((t, i) => {
                const pct = t.proyectado > 0 ? Math.min((t.real / t.proyectado) * 100, 140) : 0
                const over = t.real > t.proyectado && t.proyectado > 0
                const isFuture = (i + 1) > mesActual
                return (
                  <div key={i} className={`${isFuture ? 'opacity-40' : ''}`}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className={`font-medium ${i + 1 === mesActual ? 'text-indigo-400' : 'text-slate-300'}`}>
                        {i + 1 === mesActual && '▶ '}{MESES_FULL[i]}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400">{fmt(t.proyectado)}</span>
                        {!isFuture && <span className={`font-semibold ${over ? 'text-red-400' : 'text-emerald-400'}`}>{fmt(t.real)}</span>}
                      </div>
                    </div>
                    <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-red-500' : 'bg-indigo-500'}`}
                        style={{ width: isFuture ? '0%' : `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Top desviaciones */}
          {resumen.top_desviaciones.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h2 className="font-bold text-white mb-4">Categorías con mayor desviación</h2>
              <div className="space-y-3">
                {resumen.top_desviaciones.map((d, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800 border border-slate-700/50">
                    <span className="text-2xl">{d.icono}</span>
                    <div className="flex-1">
                      <p className="font-semibold text-white text-sm">{d.nombre}</p>
                    </div>
                    <VarianzaBadge varianza={d.varianza} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Por categoría barra horizontal */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="font-bold text-white mb-4">Proyectado vs Real por categoría</h2>
            <div className="space-y-4">
              {categorias.filter(c => c.total_proyectado > 0 || c.total_real > 0).map(cat => {
                const max = Math.max(cat.total_proyectado, cat.total_real, 1)
                const pctReal = Math.min((cat.total_real / max) * 100, 100)
                const pctProy = Math.min((cat.total_proyectado / max) * 100, 100)
                const over = cat.total_real > cat.total_proyectado && cat.total_proyectado > 0
                return (
                  <div key={cat.id}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-medium text-slate-200">{cat.icono} {cat.nombre}</span>
                      <VarianzaBadge varianza={cat.total_varianza} />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 w-12 text-right">Proy.</span>
                        <div className="flex-1 h-2 bg-slate-800 rounded-full">
                          <div className="h-full bg-slate-500 rounded-full" style={{ width: `${pctProy}%` }} />
                        </div>
                        <span className="text-[10px] text-slate-400 w-20 text-right">{fmt(cat.total_proyectado)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 w-12 text-right">Real</span>
                        <div className="flex-1 h-2 bg-slate-800 rounded-full">
                          <div className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${pctReal}%`, background: cat.color }} />
                        </div>
                        <span className={`text-[10px] w-20 text-right font-semibold ${over ? 'text-red-400' : 'text-slate-300'}`}>{fmt(cat.total_real)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── TABLA VIEW ── */}
      {!loading && view === 'tabla' && (
        <div className="space-y-4">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" /> Proyectado (clic para editar)
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block ml-2" /> Real (clic para editar)
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block ml-2" /> Sobre presupuesto
          </div>

          {/* Desktop: full table */}
          <div className="hidden lg:block overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900">
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold w-40 sticky left-0 bg-slate-900">Categoría</th>
                  {MESES.map((m, i) => (
                    <th key={i} className={`text-center px-2 py-3 font-semibold min-w-[90px] ${i + 1 === mesActual ? 'text-indigo-400' : 'text-slate-400'}`}>
                      {i + 1 === mesActual ? `▶ ${m}` : m}
                    </th>
                  ))}
                  <th className="text-center px-3 py-3 text-slate-300 font-bold min-w-[110px]">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {categorias.map(cat => (
                  <tr key={cat.id} className="border-b border-slate-800/50 hover:bg-slate-900/50 group">
                    <td className="px-4 py-2 sticky left-0 bg-slate-950 group-hover:bg-slate-900/80">
                      <div className="flex items-center gap-2">
                        <span>{cat.icono}</span>
                        <span className="font-medium text-slate-200 truncate">{cat.nombre}</span>
                      </div>
                    </td>
                    {cat.meses.map(m => {
                      const isEditProy = editing?.catId === cat.id && editing.mes === m.mes && editing.campo === 'proyectado'
                      const isEditReal = editing?.catId === cat.id && editing.mes === m.mes && editing.campo === 'real'
                      const over = m.real > m.proyectado && m.proyectado > 0
                      return (
                        <td key={m.mes} className={`px-1 py-1 text-center ${m.mes === mesActual ? 'bg-indigo-950/30' : ''}`}>
                          <div className="space-y-0.5">
                            {/* Proyectado */}
                            {isEditProy ? (
                              <CellEditor
                                value={m.proyectado}
                                onSave={v => save(cat.id, m.mes, 'proyectado', v)}
                                onClose={() => setEditing(null)}
                              />
                            ) : (
                              <div
                                className="text-slate-400 cursor-pointer hover:text-indigo-300 hover:bg-indigo-500/10 rounded px-1 py-0.5 transition text-right tabular-nums"
                                onClick={() => setEditing({ catId: cat.id, mes: m.mes, campo: 'proyectado' })}
                              >
                                {m.proyectado > 0 ? fmt(m.proyectado) : <span className="text-slate-700">—</span>}
                              </div>
                            )}
                            {/* Real */}
                            {isEditReal ? (
                              <CellEditor
                                value={m.real}
                                onSave={v => save(cat.id, m.mes, 'real', v)}
                                onClose={() => setEditing(null)}
                              />
                            ) : (
                              <div
                                className={`cursor-pointer hover:bg-emerald-500/10 rounded px-1 py-0.5 transition text-right tabular-nums ${over ? 'text-red-400 font-bold' : 'text-emerald-400'}`}
                                onClick={() => setEditing({ catId: cat.id, mes: m.mes, campo: 'real' })}
                              >
                                {m.real > 0 ? fmt(m.real) : <span className="text-slate-700">—</span>}
                              </div>
                            )}
                          </div>
                        </td>
                      )
                    })}
                    <td className="px-3 py-2 text-center">
                      <div className="text-slate-400 font-semibold tabular-nums text-right">{fmt(cat.total_proyectado)}</div>
                      <div className={`font-bold tabular-nums text-right ${cat.total_real > cat.total_proyectado && cat.total_proyectado > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{fmt(cat.total_real)}</div>
                    </td>
                  </tr>
                ))}

                {/* Totales row */}
                <tr className="bg-slate-900 border-t-2 border-slate-700">
                  <td className="px-4 py-3 font-bold text-white sticky left-0 bg-slate-900">TOTAL</td>
                  {totales.map(t => {
                    const over = t.real > t.proyectado && t.proyectado > 0
                    return (
                      <td key={t.mes} className={`px-1 py-2 text-center ${t.mes === mesActual ? 'bg-indigo-950/30' : ''}`}>
                        <div className="text-slate-300 font-semibold tabular-nums text-right">{fmt(t.proyectado)}</div>
                        <div className={`font-bold tabular-nums text-right ${over ? 'text-red-400' : 'text-emerald-400'}`}>{fmt(t.real)}</div>
                      </td>
                    )
                  })}
                  <td className="px-3 py-2 text-center">
                    <div className="text-white font-bold tabular-nums text-right">{fmt(totales.reduce((s, t) => s + t.proyectado, 0))}</div>
                    <div className="text-white font-bold tabular-nums text-right">{fmt(totales.reduce((s, t) => s + t.real, 0))}</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Mobile: cards per category */}
          <div className="lg:hidden space-y-3">
            {categorias.map(cat => (
              <div key={cat.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-4"
                  onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{cat.icono}</span>
                    <div className="text-left">
                      <p className="font-semibold text-white text-sm">{cat.nombre}</p>
                      <p className="text-xs text-slate-400">Proy: {fmt(cat.total_proyectado)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-sm ${cat.total_real > cat.total_proyectado && cat.total_proyectado > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{fmt(cat.total_real)}</p>
                    <VarianzaBadge varianza={cat.total_varianza} />
                  </div>
                </button>
                {expandedCat === cat.id && (
                  <div className="border-t border-slate-800 p-3 grid grid-cols-2 gap-2">
                    {cat.meses.filter(m => m.proyectado > 0 || m.real > 0 || m.mes === mesActual).map(m => (
                      <div key={m.mes} className={`rounded-xl p-2 ${m.mes === mesActual ? 'bg-indigo-500/10 border border-indigo-500/20' : 'bg-slate-800'}`}>
                        <p className="text-xs text-slate-400 font-medium mb-1">{MESES_FULL[m.mes - 1]}</p>
                        <div
                          className="text-xs text-slate-400 cursor-pointer hover:text-indigo-300 transition"
                          onClick={() => setEditing({ catId: cat.id, mes: m.mes, campo: 'proyectado' })}
                        >
                          Proy: {m.proyectado > 0 ? fmt(m.proyectado) : <span className="text-slate-600">—</span>}
                        </div>
                        <div
                          className={`text-xs cursor-pointer transition ${m.real > m.proyectado && m.proyectado > 0 ? 'text-red-400 font-bold' : 'text-emerald-400'}`}
                          onClick={() => setEditing({ catId: cat.id, mes: m.mes, campo: 'real' })}
                        >
                          Real: {m.real > 0 ? fmt(m.real) : <span className="text-slate-600">—</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add category */}
          <div className="flex items-center gap-2">
            {addingCat ? (
              <>
                <input
                  value={newCat}
                  onChange={e => setNewCat(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') agregarCategoria(); if (e.key === 'Escape') setAddingCat(false) }}
                  placeholder="Nombre de la categoría..."
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  autoFocus
                />
                <button onClick={agregarCategoria} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition">Agregar</button>
                <button onClick={() => setAddingCat(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 text-sm rounded-xl transition">Cancelar</button>
              </>
            ) : (
              <button onClick={() => setAddingCat(true)} className="flex items-center gap-2 px-4 py-2 border border-dashed border-slate-700 hover:border-indigo-500 text-slate-400 hover:text-indigo-400 text-sm rounded-xl transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Agregar categoría
              </button>
            )}
          </div>

          <p className="text-xs text-slate-600 text-center">Haz clic en cualquier valor para editarlo · Presiona Enter para guardar · Esc para cancelar</p>
        </div>
      )}
    </div>
  )
}
