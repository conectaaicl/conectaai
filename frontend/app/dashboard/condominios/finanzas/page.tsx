'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from '@/hooks/useSession'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DetalleItem {
  concepto: string
  categoria: string
  monto: number
  descripcion?: string
}

interface GastoComun {
  id: number
  departamento_id: number | null
  mes: number
  anio: number
  monto_base: number
  multas: number
  monto_total: number
  estado: string
  fecha_vencimiento: string
  fecha_pago: string | null
  categoria: string | null
  descripcion: string | null
  detalle: DetalleItem[]
  depto_numero?: string | null
  persona_nome?: string | null
  persona_nombre?: string | null
  persona_email?: string | null
}

interface Stats {
  total_gastos: number
  pagados: number
  pendientes: number
  atrasados: number
  monto_pendiente: number
  monto_pagado: number
  tasa_pago: number
}

interface CategoriaPredef {
  id: string
  label: string
  items: string[]
}

interface Departamento {
  id: number
  numero: string
}

interface ResumenDeptItem {
  concepto: string
  categoria: string | null
  monto: number
  gasto_id: number
  estado: string
}

interface ResumenDept {
  id: number
  numero: string
  piso: number | null
  torre: string | null
  residente: string | null
  items: ResumenDeptItem[]
  total: number
  pagado: boolean
}

interface ResumenResponse {
  periodo: string | null
  departamentos: ResumenDept[]
  total_general: number
  total_pagado: number
}

// ─── Utils ────────────────────────────────────────────────────────────────────

const formatCLP = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const estadoBadge = (estado: string) => {
  if (estado === 'pagado') return 'px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700'
  if (estado === 'pendiente') return 'px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700'
  return 'px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700'
}

const categoriaBadge = (cat: string | null) => {
  if (!cat) return 'px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600'
  const map: Record<string, string> = {
    suministros: 'bg-blue-100 text-blue-700',
    mantencion: 'bg-orange-100 text-orange-700',
    fondos: 'bg-purple-100 text-purple-700',
    personal: 'bg-pink-100 text-pink-700',
    administracion: 'bg-teal-100 text-teal-700',
  }
  return 'px-2 py-0.5 rounded-full text-xs font-medium ' + (map[cat] || 'bg-slate-100 text-slate-600')
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FinanzasPage() {
  const { tenantId } = useSession()

  // Tab
  const [tab, setTab] = useState<'gastos' | 'departamentos'>('gastos')

  // Data
  const [gastos, setGastos] = useState<GastoComun[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [categorias, setCategorias] = useState<CategoriaPredef[]>([])
  const [departamentos, setDepartamentos] = useState<Departamento[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroPeriodo, setFiltroPeriodo] = useState('')

  // Modals
  const [showModal, setShowModal] = useState(false)
  const [showDesgloseModal, setShowDesgloseModal] = useState(false)
  const [gastoSeleccionado, setGastoSeleccionado] = useState<GastoComun | null>(null)

  // Feedback
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Create form
  const [formPeriodo, setFormPeriodo] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [formVencimiento, setFormVencimiento] = useState('')
  const [formDeptId, setFormDeptId] = useState<number | null>(null)
  const [formDescripcion, setFormDescripcion] = useState('')
  const [desglose, setDesglose] = useState<DetalleItem[]>([])
  const [catExpandidas, setCatExpandidas] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [enviandoMasivo, setEnviandoMasivo] = useState(false)

  // Dept tab
  const [periodoResumen, setPeriodoResumen] = useState('')
  const [resumen, setResumen] = useState<ResumenResponse | null>(null)
  const [loadingResumen, setLoadingResumen] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  // ── Load on mount ───────────────────────────────────────────────────────────

  const fetchGastos = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (tenantId) params.set('tenant_id', String(tenantId))
      if (filtroPeriodo) {
        const [y, m] = filtroPeriodo.split('-')
        params.set('anio', y)
        params.set('mes', m)
      }
      if (filtroEstado) params.set('estado', filtroEstado)
      const [gastosRes, statsRes] = await Promise.all([
        fetch(`/api/finanzas/gastos-comunes?${params}`),
        fetch('/api/finanzas/stats/morosidad')
      ])
      if (gastosRes.ok) setGastos(await gastosRes.json())
      if (statsRes.ok) setStats(await statsRes.json())
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }, [filtroPeriodo, filtroEstado])

  useEffect(() => {
    fetchGastos()
    // Load categorias & departamentos only once
    const loadStatic = async () => {
      const [catRes, deptRes] = await Promise.all([
        fetch('/api/finanzas/categorias'),
        fetch(`/api/condominios/departamentos?tenant_id=${tenantId}`)
      ])
      if (catRes.ok) setCategorias(await catRes.json())
      if (deptRes.ok) setDepartamentos(await deptRes.json())
    }
    loadStatic()
  }, [tenantId, fetchGastos])

  // ── Create gasto ────────────────────────────────────────────────────────────

  const totalDesglose = desglose.reduce((s, i) => s + (parseFloat(i.monto as any) || 0), 0)

  function addDesglose(concepto: string, categoria: string) {
    setDesglose(prev => [...prev, { concepto, categoria, monto: 0, descripcion: '' }])
  }

  function removeDesglose(idx: number) {
    setDesglose(prev => prev.filter((_, i) => i !== idx))
  }

  function updateDesgloseItem(idx: number, field: keyof DetalleItem, value: any) {
    setDesglose(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  function toggleCat(catId: string) {
    setCatExpandidas(prev => {
      const next = new Set(prev)
      next.has(catId) ? next.delete(catId) : next.add(catId)
      return next
    })
  }

  function resetForm() {
    const d = new Date()
    setFormPeriodo(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    setFormVencimiento('')
    setFormDeptId(null)
    setFormDescripcion('')
    setDesglose([])
    setCatExpandidas(new Set())
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formVencimiento) { setMsg({ type: 'err', text: 'Ingresa fecha de vencimiento' }); return }
    if (desglose.length === 0) { setMsg({ type: 'err', text: 'Agrega al menos un concepto al desglose' }); return }
    setSaving(true)
    try {
      const [y, m] = formPeriodo.split('-')
      const body: any = {
        mes: parseInt(m),
        anio: parseInt(y),
        monto_base: 0,
        monto_total: totalDesglose,
        fecha_vencimiento: formVencimiento,
        descripcion: formDescripcion || null,
        departamento_id: formDeptId || null,
        detalle: desglose.map(d => ({ ...d, monto: parseFloat(d.monto as any) || 0 }))
      }
      const res = await fetch('/api/finanzas/gastos-comunes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (res.ok) {
        setShowModal(false)
        resetForm()
        fetchGastos()
        setMsg({ type: 'ok', text: 'Gasto común creado exitosamente' })
      } else {
        const err = await res.json()
        setMsg({ type: 'err', text: 'Error: ' + JSON.stringify(err.detail || err) })
      }
    } catch { setMsg({ type: 'err', text: 'Error de conexión' }) } finally { setSaving(false) }
  }


  async function handleEnviarGasto(id: number) {
    try {
      const r = await fetch(`/api/finanzas/gastos-comunes/${id}/enviar?tenant_id=${tenantId}`, { method: 'POST' })
      const data = await r.json()
      if (r.ok) setMsg({ type: 'ok', text: `Email enviado a ${data.nombre} (${data.enviado_a})` })
      else setMsg({ type: 'err', text: data.detail || 'Error al enviar' })
    } catch { setMsg({ type: 'err', text: 'Error de conexión' }) }
  }

  async function handleEnvioMasivo() {
    const periodo = filtroPeriodo || new Date().toISOString().slice(0, 7)
    const [y, m] = periodo.split('-')
    if (!confirm(`¿Enviar gastos de ${m}/${y} a todos los residentes?`)) return
    setEnviandoMasivo(true)
    try {
      const r = await fetch(`/api/finanzas/gastos-comunes/enviar-masivo?mes=${m}&anio=${y}&tenant_id=${tenantId}`, { method: 'POST' })
      const data = await r.json()
      if (r.ok) setMsg({ type: 'ok', text: `Enviados: ${data.enviados}/${data.total}` })
      else setMsg({ type: 'err', text: data.detail || 'Error en envío masivo' })
    } catch { setMsg({ type: 'err', text: 'Error de conexión' }) } finally { setEnviandoMasivo(false) }
  }

  async function handlePagar(id: number) {
    const ok = window.confirm('¿Registrar pago de este gasto?')
    if (!ok) return
    const res = await fetch(`/api/finanzas/gastos-comunes/${id}/pagar?metodo_pago=transferencia`, { method: 'POST' })
    if (res.ok) { fetchGastos(); setMsg({ type: 'ok', text: 'Pago registrado' }) }
    else setMsg({ type: 'err', text: 'Error al registrar pago' })
  }

  async function handleEliminar(id: number) {
    const ok = window.confirm('¿Eliminar este gasto común?')
    if (!ok) return
    const res = await fetch(`/api/finanzas/gastos-comunes/${id}`, { method: 'DELETE' })
    if (res.ok) { fetchGastos(); setMsg({ type: 'ok', text: 'Gasto eliminado' }) }
    else setMsg({ type: 'err', text: 'Error al eliminar' })
  }

  // ── Resumen departamentos ───────────────────────────────────────────────────

  async function fetchResumen() {
    if (!periodoResumen) { setMsg({ type: 'err', text: 'Selecciona un período' }); return }
    setLoadingResumen(true)
    try {
      const res = await fetch(`/api/finanzas/resumen-departamentos?tenant_id=${tenantId}&periodo=${periodoResumen}`)
      if (res.ok) setResumen(await res.json())
      else setMsg({ type: 'err', text: 'Error al cargar resumen' })
    } catch { setMsg({ type: 'err', text: 'Error de conexión' }) } finally { setLoadingResumen(false) }
  }

  function toggleRow(id: number) {
    setExpandedRows(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Filtered gastos ─────────────────────────────────────────────────────────

  const gastosFiltrados = gastos.filter(g => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      String(g.departamento_id || 'todos').includes(q) ||
      (g.descripcion || '').toLowerCase().includes(q) ||
      (g.categoria || '').toLowerCase().includes(q) ||
      `${g.mes}/${g.anio}`.includes(q)
    )
  })

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Finanzas</h1>
          <p className="text-sm text-slate-500">Gastos comunes, pagos y morosidad por departamento</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.open('/api/finanzas/gastos-comunes/exportar/pdf', '_blank')}
            className="border border-slate-200 text-slate-600 rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-50"
          >PDF</button>
          <button
            onClick={handleEnvioMasivo}
            disabled={enviandoMasivo}
            className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >{enviandoMasivo ? '⏳ Enviando...' : '📧 Envío Masivo'}</button>
          <button
            onClick={() => { resetForm(); setShowModal(true) }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo gasto
          </button>
        </div>
      </div>

      {/* Feedback */}
      {msg && (
        <div className={`rounded-lg p-3 text-sm flex items-center justify-between ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="ml-2 opacity-60 hover:opacity-100">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {(['gastos', 'departamentos'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t === 'gastos' ? 'Gastos Comunes' : 'Por Departamento'}
          </button>
        ))}
      </div>

      {/* ── TAB 1: Gastos Comunes ─────────────────────────────────────────── */}
      {tab === 'gastos' && (
        <>
          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl border border-slate-100 p-4">
                <p className="text-xs text-slate-500">Total período</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{stats.total_gastos}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-100 p-4">
                <p className="text-xs text-slate-500">Pagados</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.pagados}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-100 p-4">
                <p className="text-xs text-slate-500">Pendientes</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">{stats.pendientes}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-100 p-4">
                <p className="text-xs text-slate-500">Tasa pago</p>
                <p className="text-2xl font-bold text-indigo-600 mt-1">{stats.tasa_pago}%</p>
              </div>
            </div>
          )}

          {/* Amber banner */}
          {stats && stats.monto_pendiente > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-800">Total pendiente de cobro</p>
                <p className="text-2xl font-bold text-amber-700 mt-0.5">{formatCLP(stats.monto_pendiente)}</p>
              </div>
              <span className={estadoBadge('pendiente')}>{stats.atrasados} atrasados</span>
            </div>
          )}

          {/* Filter bar */}
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent flex-1 min-w-[160px]"
            />
            <input
              type="month"
              value={filtroPeriodo}
              onChange={e => setFiltroPeriodo(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <select
              value={filtroEstado}
              onChange={e => setFiltroEstado(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="pagado">Pagado</option>
              <option value="atrasado">Atrasado</option>
            </select>
            <button
              onClick={fetchGastos}
              className="border border-indigo-200 text-indigo-600 rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-50"
            >Filtrar</button>
          </div>

          {/* Table */}
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      {['Período', 'Categoría', 'Descripción', 'Monto Total', 'Depto', 'Residente', 'Vencimiento', 'Estado', 'Acciones'].map(h => (
                        <th key={h} className="text-slate-500 font-medium text-left px-4 py-3 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {gastosFiltrados.map(gasto => (
                      <tr key={gasto.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-slate-700 font-medium whitespace-nowrap">
                          {MESES[gasto.mes - 1]} {gasto.anio}
                        </td>
                        <td className="px-4 py-3">
                          <span className={categoriaBadge(gasto.categoria)}>{gasto.categoria || 'Sin categoría'}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 max-w-[180px] truncate">{gasto.descripcion || '-'}</td>
                        <td className="px-4 py-3 text-slate-800 font-semibold">{formatCLP(gasto.monto_total)}</td>
                        <td className="px-4 py-3 text-slate-500">
                          {gasto.departamento_id ? `Depto ${gasto.departamento_id}` : 'Todos'}
                        </td>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                          {gasto.fecha_vencimiento ? new Date(gasto.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-CL') : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={estadoBadge(gasto.estado)}>{gasto.estado}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => { setGastoSeleccionado(gasto); setShowDesgloseModal(true) }}
                              title="Ver desglose"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                            </button>
                            {gasto.estado !== 'pagado' && (
                              <button
                                onClick={() => handlePagar(gasto.id)}
                                title="Registrar pago"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={() => handleEliminar(gasto.id)}
                              title="Eliminar"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {gastosFiltrados.length === 0 && (
                <div className="text-center py-12">
                  <svg className="w-10 h-10 mx-auto text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-slate-400 mt-2 text-sm">No hay gastos comunes registrados</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── TAB 2: Por Departamento ───────────────────────────────────────── */}
      {tab === 'departamentos' && (
        <>
          {/* Period selector */}
          <div className="bg-white rounded-xl border border-slate-100 p-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Período</label>
              <input
                type="month"
                value={periodoResumen}
                onChange={e => setPeriodoResumen(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={fetchResumen}
              disabled={loadingResumen}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {loadingResumen ? 'Cargando...' : 'Ver resumen'}
            </button>
          </div>

          {/* Empty state */}
          {!resumen && !loadingResumen && (
            <div className="text-center py-16">
              <svg className="w-12 h-12 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <p className="text-slate-400 text-sm">Selecciona un período para ver el resumen por departamento</p>
            </div>
          )}

          {/* Results */}
          {resumen && (
            <>
              {/* Summary row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl border border-slate-100 p-4">
                  <p className="text-xs text-slate-500">Total general</p>
                  <p className="text-xl font-bold text-slate-800 mt-1">{formatCLP(resumen.total_general)}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-100 p-4">
                  <p className="text-xs text-slate-500">Total pagado</p>
                  <p className="text-xl font-bold text-emerald-600 mt-1">{formatCLP(resumen.total_pagado)}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-100 p-4">
                  <p className="text-xs text-slate-500">Total pendiente</p>
                  <p className="text-xl font-bold text-amber-600 mt-1">{formatCLP(resumen.total_general - resumen.total_pagado)}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-100 p-4">
                  <p className="text-xs text-slate-500">Departamentos</p>
                  <p className="text-xl font-bold text-indigo-600 mt-1">{resumen.departamentos.length}</p>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        {['Departamento', 'Torre/Piso', 'Residente', 'Conceptos', 'Total', 'Estado', 'Acción'].map(h => (
                          <th key={h} className="text-slate-500 font-medium text-left px-4 py-3 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {resumen.departamentos.map(dept => (
                        <>
                          <tr
                            key={dept.id}
                            className="hover:bg-slate-50 transition-colors cursor-pointer"
                            onClick={() => toggleRow(dept.id)}
                          >
                            <td className="px-4 py-3 font-medium text-slate-800">
                              Depto {dept.numero}
                            </td>
                            <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                              {dept.torre && <span>{dept.torre}</span>}
                              {dept.piso && <span className="ml-1 text-xs text-slate-400">P{dept.piso}</span>}
                              {!dept.torre && !dept.piso && '-'}
                            </td>
                            <td className="px-4 py-3 text-slate-500">{dept.residente || <span className="text-slate-300 italic">Sin asignar</span>}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {dept.items.slice(0, 3).map((item, i) => (
                                  <span key={i} className={categoriaBadge(item.categoria)}>
                                    {item.concepto.length > 15 ? item.concepto.slice(0, 14) + '…' : item.concepto}
                                  </span>
                                ))}
                                {dept.items.length > 3 && (
                                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                                    +{dept.items.length - 3}
                                  </span>
                                )}
                                {dept.items.length === 0 && <span className="text-slate-300 text-xs italic">Sin ítems</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-800 font-semibold">{formatCLP(dept.total)}</td>
                            <td className="px-4 py-3">
                              <span className={dept.pagado ? estadoBadge('pagado') : estadoBadge('pendiente')}>
                                {dept.pagado ? 'pagado' : 'pendiente'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <button className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600">
                                <svg
                                  className={`w-4 h-4 transition-transform ${expandedRows.has(dept.id) ? 'rotate-180' : ''}`}
                                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                          {expandedRows.has(dept.id) && (
                            <tr key={`${dept.id}-expand`} className="bg-indigo-50/40">
                              <td colSpan={7} className="px-6 py-4">
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Desglose completo</p>
                                {/* Group by category */}
                                {(() => {
                                  const groups: Record<string, ResumenDeptItem[]> = {}
                                  dept.items.forEach(item => {
                                    const cat = item.categoria || 'otros'
                                    if (!groups[cat]) groups[cat] = []
                                    groups[cat].push(item)
                                  })
                                  return Object.entries(groups).map(([cat, items]) => (
                                    <div key={cat} className="mb-3">
                                      <p className="text-xs font-semibold text-slate-500 capitalize mb-1.5">{cat}</p>
                                      <div className="space-y-1">
                                        {items.map((item, i) => (
                                          <div key={i} className="flex justify-between items-center py-1 border-b border-indigo-100/60 last:border-0">
                                            <span className="text-sm text-slate-700">{item.concepto}</span>
                                            <span className="text-sm font-medium text-slate-800">{formatCLP(item.monto)}</span>
                                          </div>
                                        ))}
                                        <div className="flex justify-between items-center pt-1">
                                          <span className="text-xs text-slate-400 font-medium">Subtotal {cat}</span>
                                          <span className="text-xs font-semibold text-slate-600">
                                            {formatCLP(items.reduce((s, i) => s + i.monto, 0))}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ))
                                })()}
                                <div className="flex justify-between items-center mt-3 pt-3 border-t border-indigo-200">
                                  <span className="font-semibold text-slate-700">TOTAL DEPARTAMENTO</span>
                                  <span className="text-lg font-bold text-slate-800">{formatCLP(dept.total)}</span>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
                {resumen.departamentos.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-slate-400 text-sm">No hay departamentos ni gastos para este período</p>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ── MODAL: Nuevo Gasto ────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800 text-lg">Nuevo Gasto Común</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">

              {/* Row 1: Periodo, Vencimiento, Departamento */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Período *</label>
                  <input
                    type="month"
                    value={formPeriodo}
                    onChange={e => setFormPeriodo(e.target.value)}
                    required
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Vencimiento *</label>
                  <input
                    type="date"
                    value={formVencimiento}
                    onChange={e => setFormVencimiento(e.target.value)}
                    required
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Departamento</label>
                  <select
                    value={formDeptId ?? ''}
                    onChange={e => setFormDeptId(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="">Todos los departamentos</option>
                    {departamentos.map(d => (
                      <option key={d.id} value={d.id}>Depto {d.numero}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Descripcion */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción general</label>
                <input
                  type="text"
                  value={formDescripcion}
                  onChange={e => setFormDescripcion(e.target.value)}
                  placeholder="Ej: Gastos comunes Enero 2025"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Desglose */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Desglose de Conceptos</p>

                {/* Quick-add categories */}
                <div className="space-y-2">
                  {categorias.map(cat => (
                    <div key={cat.id} className="border border-slate-200 rounded-lg bg-white overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleCat(cat.id)}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <span>{cat.label}</span>
                        <svg
                          className={`w-4 h-4 text-slate-400 transition-transform ${catExpandidas.has(cat.id) ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {catExpandidas.has(cat.id) && (
                        <div className="px-3 pb-3 flex flex-wrap gap-2">
                          {cat.items.map(item => (
                            <button
                              key={item}
                              type="button"
                              onClick={() => addDesglose(item, cat.id)}
                              className="px-3 py-1 text-xs rounded-full border border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-medium"
                            >
                              + {item}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Desglose rows */}
                {desglose.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <p className="text-xs text-slate-400 font-medium">Conceptos agregados</p>
                    {desglose.map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={item.concepto}
                          onChange={e => updateDesgloseItem(idx, 'concepto', e.target.value)}
                          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        <span className={categoriaBadge(item.categoria) + ' whitespace-nowrap text-xs'}>
                          {item.categoria}
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={item.monto || ''}
                          onChange={e => updateDesgloseItem(idx, 'monto', parseFloat(e.target.value) || 0)}
                          placeholder="Monto"
                          className="w-28 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        <button
                          type="button"
                          onClick={() => removeDesglose(idx)}
                          className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Custom concept */}
                <button
                  type="button"
                  onClick={() => addDesglose('', 'administracion')}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  + Agregar concepto personalizado
                </button>

                {/* Total */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex justify-between items-center">
                  <p className="text-sm font-medium text-emerald-700">Total</p>
                  <p className="text-xl font-bold text-emerald-700">{formatCLP(totalDesglose)}</p>
                </div>
              </div>
            </form>
            <div className="flex gap-3 p-6 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm hover:bg-slate-50"
              >Cancelar</button>
              <button
                onClick={handleSubmit as any}
                disabled={saving}
                className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm hover:bg-indigo-700 font-medium disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Desglose Detail ────────────────────────────────────────── */}
      {showDesgloseModal && gastoSeleccionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-800">Desglose Detallado</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {MESES[gastoSeleccionado.mes - 1]} {gastoSeleccionado.anio}
                  {' — '}
                  {gastoSeleccionado.departamento_id ? `Depto ${gastoSeleccionado.departamento_id}` : 'Todos los departamentos'}
                </p>
              </div>
              <button onClick={() => setShowDesgloseModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {gastoSeleccionado.descripcion && (
                <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">{gastoSeleccionado.descripcion}</p>
              )}
              {gastoSeleccionado.detalle && gastoSeleccionado.detalle.length > 0 ? (
                (() => {
                  const groups: Record<string, DetalleItem[]> = {}
                  gastoSeleccionado.detalle.forEach(item => {
                    const cat = item.categoria || 'otros'
                    if (!groups[cat]) groups[cat] = []
                    groups[cat].push(item)
                  })
                  return Object.entries(groups).map(([cat, items]) => (
                    <div key={cat}>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 capitalize">{cat}</p>
                      <div className="space-y-1">
                        {items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-50">
                            <span className="text-sm text-slate-700">{item.concepto}</span>
                            <span className="text-sm font-medium text-slate-800">{formatCLP(item.monto)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-xs text-slate-400">Subtotal</span>
                          <span className="text-xs font-semibold text-slate-600">{formatCLP(items.reduce((s, i) => s + i.monto, 0))}</span>
                        </div>
                      </div>
                    </div>
                  ))
                })()
              ) : (
                <p className="text-sm text-slate-400 italic">Sin desglose detallado</p>
              )}
              <div className="flex justify-between items-center bg-slate-50 rounded-lg p-3 mt-2">
                <span className="font-semibold text-slate-700">TOTAL</span>
                <span className="text-xl font-bold text-slate-800">{formatCLP(gastoSeleccionado.monto_total)}</span>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-slate-100">
              <button
                onClick={() => window.open(`/api/finanzas/gastos-comunes/${gastoSeleccionado.id}/pdf-individual`, '_blank')}
                className="flex-1 border border-indigo-200 text-indigo-600 rounded-lg py-2 text-sm hover:bg-indigo-50 font-medium"
              >Descargar PDF</button>
              <button
                onClick={() => setShowDesgloseModal(false)}
                className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm hover:bg-slate-50"
              >Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
