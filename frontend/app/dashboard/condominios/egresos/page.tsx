'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from '@/hooks/useSession'

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')

const CATEGORIAS = [
  'Electricidad', 'Gas', 'Agua / Alcantarillado', 'Internet / Telefonia',
  'Personal / Remuneraciones', 'Mantencion y Reparaciones', 'Limpieza',
  'Administracion', 'Seguro Edificio', 'Fondo de Reserva',
  'Ascensor', 'Piscina / Jardin', 'Otros',
]

const CAT_COLOR: Record<string, string> = {
  'Electricidad': '#f59e0b', 'Gas': '#f97316', 'Agua / Alcantarillado': '#06b6d4',
  'Internet / Telefonia': '#3b82f6', 'Personal / Remuneraciones': '#8b5cf6',
  'Mantencion y Reparaciones': '#ef4444', 'Limpieza': '#10b981',
  'Administracion': '#0891b2', 'Seguro Edificio': '#6366f1',
  'Fondo de Reserva': '#22c55e', 'Ascensor': '#f43f5e',
  'Piscina / Jardin': '#84cc16', 'Otros': '#94a3b8',
}

interface Egreso {
  id: number
  fecha: string
  categoria: string
  concepto: string
  monto: number
  proveedor: string | null
  numero_factura: string | null
  notas: string | null
  condominio_nombre: string | null
}

interface Stats {
  total_mes: number
  total_mes_anterior: number
  por_categoria: { categoria: string; monto: number }[]
}

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function EgresosPage() {
  const { tenantId } = useSession()
  const [egresos, setEgresos] = useState<Egreso[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState(currentMonth())
  const [catFilter, setCatFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Egreso | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)

  const [form, setForm] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    categoria: 'Electricidad',
    concepto: '',
    monto: '',
    proveedor: '',
    numero_factura: '',
    notas: '',
  })

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const desde = periodo + '-01'
    const lastDay = new Date(parseInt(periodo.slice(0, 4)), parseInt(periodo.slice(5, 7)), 0).getDate()
    const hasta = periodo + '-' + String(lastDay).padStart(2, '0')
    try {
      const [egRes, stRes] = await Promise.all([
        fetch(`/api/egresos?desde=${desde}&hasta=${hasta}${catFilter ? `&categoria=${encodeURIComponent(catFilter)}` : ''}`),
        fetch(`/api/egresos/stats`),
      ])
      if (egRes.ok) setEgresos(await egRes.json())
      if (stRes.ok) setStats(await stRes.json())
    } catch {}
    setLoading(false)
  }, [tenantId, periodo, catFilter])

  useEffect(() => { load() }, [load])

  function resetForm() {
    setForm({ fecha: new Date().toISOString().slice(0, 10), categoria: 'Electricidad', concepto: '', monto: '', proveedor: '', numero_factura: '', notas: '' })
    setEditItem(null)
  }

  function openEdit(e: Egreso) {
    setForm({
      fecha: e.fecha.slice(0, 10),
      categoria: e.categoria,
      concepto: e.concepto,
      monto: String(e.monto),
      proveedor: e.proveedor || '',
      numero_factura: e.numero_factura || '',
      notas: e.notas || '',
    })
    setEditItem(e)
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.concepto.trim() || !form.monto || !form.fecha) return
    setSaving(true)
    try {
      const body = {
        fecha: form.fecha,
        categoria: form.categoria,
        concepto: form.concepto.trim(),
        monto: parseFloat(form.monto.replace(/\./g, '').replace(',', '.')),
        proveedor: form.proveedor.trim() || null,
        numero_factura: form.numero_factura.trim() || null,
        notas: form.notas.trim() || null,
      }
      const url = editItem ? `/api/egresos/${editItem.id}` : '/api/egresos'
      const method = editItem ? 'PATCH' : 'POST'
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (r.ok) {
        showToast(editItem ? '✏️ Egreso actualizado' : '✅ Egreso registrado', true)
        setShowForm(false)
        resetForm()
        load()
      } else {
        const d = await r.json()
        showToast(`❌ ${d.detail || 'Error'}`, false)
      }
    } catch { showToast('❌ Error de conexión', false) }
    setSaving(false)
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este egreso?')) return
    setDeleting(id)
    try {
      await fetch(`/api/egresos/${id}`, { method: 'DELETE' })
      setEgresos(prev => prev.filter(e => e.id !== id))
      showToast('🗑️ Egreso eliminado', true)
    } catch { showToast('❌ Error al eliminar', false) }
    setDeleting(null)
  }

  const visible = egresos.filter(e =>
    !search || e.concepto.toLowerCase().includes(search.toLowerCase()) ||
    (e.proveedor || '').toLowerCase().includes(search.toLowerCase())
  )

  const totalVisible = visible.reduce((s, e) => s + e.monto, 0)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 lg:p-8">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-xl ${toast.ok ? 'bg-emerald-900 border border-emerald-500 text-emerald-200' : 'bg-red-900 border border-red-500 text-red-200'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">📊 Egresos del Condominio</h1>
          <p className="text-slate-400 text-sm mt-0.5">Gastos y pagos realizados por el edificio</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          + Nuevo egreso
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 col-span-2">
            <p className="text-xs text-slate-400 uppercase tracking-wider">Total este mes</p>
            <p className="text-2xl font-black text-orange-400 mt-1">{fmt(stats.total_mes)}</p>
            <p className="text-xs text-slate-500 mt-0.5">Mes anterior: {fmt(stats.total_mes_anterior)}</p>
          </div>
          {stats.por_categoria.slice(0, 2).map((c, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: CAT_COLOR[c.categoria] || '#94a3b8' }} />
                <p className="text-xs text-slate-400 truncate">{c.categoria}</p>
              </div>
              <p className="text-lg font-bold text-slate-100">{fmt(c.monto)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          type="month"
          value={periodo}
          onChange={e => setPeriodo(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500"
        />
        <select
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500"
        >
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input
          type="text"
          placeholder="Buscar por concepto o proveedor…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500"
        />
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
          <p className="text-sm text-slate-400">{visible.length} registro{visible.length !== 1 ? 's' : ''}</p>
          <p className="text-sm font-bold text-orange-400">Total: {fmt(totalVisible)}</p>
        </div>
        {loading ? (
          <div className="text-center py-12 text-slate-500 text-sm">Cargando…</div>
        ) : visible.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-3xl mb-3">📭</div>
            <p className="text-slate-400 text-sm">Sin egresos para este período</p>
            <button onClick={() => { resetForm(); setShowForm(true) }} className="mt-3 text-orange-400 text-sm hover:text-orange-300">
              + Registrar primer egreso
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 uppercase tracking-wider bg-slate-900/80">
              <tr>
                <th className="text-left px-5 py-3">Fecha</th>
                <th className="text-left px-3 py-3">Categoría</th>
                <th className="text-left px-3 py-3">Concepto</th>
                <th className="text-left px-3 py-3 hidden md:table-cell">Proveedor</th>
                <th className="text-right px-5 py-3">Monto</th>
                <th className="text-right px-5 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {visible.map(e => (
                <tr key={e.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-5 py-3 text-slate-400 whitespace-nowrap font-mono text-xs">
                    {new Date(e.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: (CAT_COLOR[e.categoria] || '#94a3b8') + '20', color: CAT_COLOR[e.categoria] || '#94a3b8' }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: CAT_COLOR[e.categoria] || '#94a3b8' }} />
                      {e.categoria}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-200 max-w-xs">
                    <p className="truncate">{e.concepto}</p>
                    {e.numero_factura && <p className="text-xs text-slate-500">N° {e.numero_factura}</p>}
                    {e.notas && <p className="text-xs text-slate-500 truncate">{e.notas}</p>}
                  </td>
                  <td className="px-3 py-3 text-slate-400 hidden md:table-cell text-xs">{e.proveedor || '—'}</td>
                  <td className="px-5 py-3 text-right font-bold text-slate-100 whitespace-nowrap">{fmt(e.monto)}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => openEdit(e)} className="text-xs text-slate-400 hover:text-blue-400 transition-colors">✏️</button>
                      <button
                        onClick={() => handleDelete(e.id)}
                        disabled={deleting === e.id}
                        className="text-xs text-slate-400 hover:text-red-400 transition-colors disabled:opacity-40"
                      >🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Categorías sidebar */}
      {stats && stats.por_categoria.length > 0 && (
        <div className="mt-4 bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-slate-200 mb-4">Composición por categoría — {periodo}</h3>
          <div className="space-y-2">
            {stats.por_categoria.map((c, i) => {
              const total = stats.total_mes
              const pct = total > 0 ? (c.monto / total) * 100 : 0
              return (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">{c.categoria}</span>
                    <span className="text-slate-300 font-medium">{fmt(c.monto)} <span className="text-slate-500">({Math.round(pct)}%)</span></span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: CAT_COLOR[c.categoria] || '#94a3b8' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h3 className="font-bold text-slate-100">{editItem ? 'Editar egreso' : 'Nuevo egreso'}</h3>
              <button onClick={() => { setShowForm(false); resetForm() }} className="text-slate-400 hover:text-white text-lg">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Fecha *</label>
                  <input type="date" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Monto (CLP) *</label>
                  <input type="number" placeholder="0" value={form.monto} onChange={e => setForm(p => ({ ...p, monto: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Categoría *</label>
                <select value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500">
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Concepto / Descripción *</label>
                <input type="text" placeholder="Ej: Factura Enel febrero 2026" value={form.concepto} onChange={e => setForm(p => ({ ...p, concepto: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Proveedor</label>
                  <input type="text" placeholder="Nombre empresa" value={form.proveedor} onChange={e => setForm(p => ({ ...p, proveedor: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">N° Factura / Boleta</label>
                  <input type="text" placeholder="Opcional" value={form.numero_factura} onChange={e => setForm(p => ({ ...p, numero_factura: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Notas</label>
                <textarea rows={2} placeholder="Observaciones adicionales…" value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-800">
              <button onClick={() => { setShowForm(false); resetForm() }}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 text-sm hover:bg-slate-800 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving || !form.concepto || !form.monto}
                className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold disabled:opacity-40 transition-colors">
                {saving ? 'Guardando…' : (editItem ? 'Actualizar' : 'Registrar egreso')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
