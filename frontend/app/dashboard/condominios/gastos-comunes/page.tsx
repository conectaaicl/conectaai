'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from '@/hooks/useSession'

const API = '/api/gastos-comunes'

function formatCLP(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CL')
}

function currentPeriodo() {
  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  return `${now.getFullYear()}-${mm}`
}

type Estado = 'borrador' | 'emitido' | 'cerrado'

interface Periodo {
  id: number
  periodo: string
  estado: Estado
  total_monto: number
  total_cobros: number
  cobros_count: number
  monto_calculado: number
  emitido_at: string | null
  notas: string | null
}

interface Cobro {
  id: number
  depto_numero: string
  nombre_residente: string
  concepto: string
  monto: number
  estado: string
  fecha_vencimiento: string | null
  periodo: string
}

interface Item {
  id: number
  concepto: string
  monto_total: number
  tipo_distribucion: string
}

interface Resumen {
  total_count: number
  total_monto: number
  pendiente_count: number
  pendiente_monto: number
  pagado_count: number
  pagado_monto: number
  vencido_count: number
  vencido_monto: number
}

const BADGE: Record<Estado, string> = {
  borrador: 'bg-slate-100 text-slate-600',
  emitido: 'bg-indigo-100 text-indigo-700',
  cerrado: 'bg-emerald-100 text-emerald-700',
}

export default function GastosComunesPage() {
  const { user } = useSession()
  const tenantId = user?.tenant_id ?? 1

  const [periodos, setPeriodos] = useState<Periodo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  // Modals & panels
  const [showNuevo, setShowNuevo] = useState(false)
  const [showItem, setShowItem] = useState(false)
  const [showPagar, setShowPagar] = useState(false)
  const [showDistribuir, setShowDistribuir] = useState(false)
  const [panelPeriodoId, setPanelPeriodoId] = useState<number | null>(null)

  // Panel state
  const [cobros, setCobros] = useState<Cobro[]>([])
  const [cobrosLoading, setCobrosLoading] = useState(false)
  const [estadoFiltro, setEstadoFiltro] = useState('')
  const [deptoFiltro, setDeptoFiltro] = useState('')
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [items, setItems] = useState<Item[]>([])

  // Selected cobro for paying
  const [selectedCobro, setSelectedCobro] = useState<Cobro | null>(null)
  const [metodoPago, setMetodoPago] = useState('transferencia')

  // Forms
  const [nuevoPeriodo, setNuevoPeriodo] = useState({ periodo: currentPeriodo(), notas: '' })
  const [nuevoItem, setNuevoItem] = useState({ concepto: '', monto_total: '', tipo_distribucion: 'igualitaria' })
  const [distribFecha, setDistribFecha] = useState('')
  const [activePeriodoId, setActivePeriodoId] = useState<number | null>(null)

  // Fondo
  const [fondo, setFondo] = useState<number>(0)
  const [editFondo, setEditFondo] = useState(false)
  const [fondoVal, setFondoVal] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const loadPeriodos = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/periodos?tenant_id=${tenantId}`)
      if (r.ok) setPeriodos(await r.json())
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  const loadFondo = useCallback(async () => {
    const r = await fetch(`${API}/fondo?tenant_id=${tenantId}`)
    if (r.ok) {
      const d = await r.json()
      setFondo(Number(d.saldo) || 0)
    }
  }, [tenantId])

  useEffect(() => {
    loadPeriodos()
    loadFondo()
  }, [loadPeriodos, loadFondo])

  // Load cobros + resumen when panel opens or filters change
  useEffect(() => {
    if (panelPeriodoId === null) return
    setCobrosLoading(true)
    const params = new URLSearchParams({ tenant_id: String(tenantId), periodo_id: String(panelPeriodoId) })
    if (estadoFiltro) params.set('estado', estadoFiltro)
    if (deptoFiltro) params.set('depto', deptoFiltro)

    Promise.all([
      fetch(`${API}/cobros?${params}`).then(r => r.json()),
      fetch(`${API}/resumen?tenant_id=${tenantId}&periodo_id=${panelPeriodoId}`).then(r => r.json()),
      fetch(`${API}/periodos/${panelPeriodoId}`).then(r => r.json()),
    ]).then(([cobs, res, det]) => {
      setCobros(Array.isArray(cobs) ? cobs : [])
      setResumen(res)
      setItems(det.items || [])
    }).catch(() => {}).finally(() => setCobrosLoading(false))
  }, [panelPeriodoId, estadoFiltro, deptoFiltro, tenantId])

  // Stats from current month
  const thisPeriodo = periodos.find(p => p.periodo === currentPeriodo())
  const totalEmitido = periodos.filter(p => p.estado !== 'borrador').reduce((s, p) => s + Number(p.total_monto), 0)

  async function crearPeriodo() {
    const r = await fetch(`${API}/periodos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, ...nuevoPeriodo }),
    })
    if (r.ok) {
      setShowNuevo(false)
      setNuevoPeriodo({ periodo: currentPeriodo(), notas: '' })
      loadPeriodos()
      showToast('Periodo creado')
    } else {
      const d = await r.json()
      setError(d.detail || 'Error al crear periodo')
    }
  }

  async function emitirPeriodo(id: number) {
    if (!confirm('Emitir este periodo enviara notificaciones por email a todos los residentes. Confirmar?')) return
    const r = await fetch(`${API}/periodos/${id}/emitir?tenant_id=${tenantId}`, { method: 'PATCH' })
    if (r.ok) { loadPeriodos(); showToast('Periodo emitido y emails enviados') }
    else { const d = await r.json(); setError(d.detail || 'Error') }
  }

  async function cerrarPeriodo(id: number) {
    if (!confirm('Cerrar este periodo? No se podra reabrir.')) return
    const r = await fetch(`${API}/periodos/${id}/cerrar`, { method: 'PATCH' })
    if (r.ok) { loadPeriodos(); showToast('Periodo cerrado') }
  }

  async function eliminarPeriodo(id: number) {
    if (!confirm('Eliminar este periodo borrador?')) return
    const r = await fetch(`${API}/periodos/${id}`, { method: 'DELETE' })
    if (r.ok) { loadPeriodos(); showToast('Periodo eliminado') }
    else { const d = await r.json(); setError(d.detail || 'Error') }
  }

  async function agregarItem() {
    if (!activePeriodoId) return
    const r = await fetch(`${API}/periodos/${activePeriodoId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, concepto: nuevoItem.concepto, monto_total: Number(nuevoItem.monto_total), tipo_distribucion: nuevoItem.tipo_distribucion }),
    })
    if (r.ok) {
      setShowItem(false)
      setNuevoItem({ concepto: '', monto_total: '', tipo_distribucion: 'igualitaria' })
      if (panelPeriodoId === activePeriodoId) {
        // refresh items
        const det = await fetch(`${API}/periodos/${activePeriodoId}`).then(x => x.json())
        setItems(det.items || [])
      }
      loadPeriodos()
      showToast('Item agregado')
    } else {
      const d = await r.json()
      setError(d.detail || 'Error')
    }
  }

  async function eliminarItem(itemId: number) {
    if (!confirm('Eliminar este item?')) return
    const r = await fetch(`${API}/items/${itemId}`, { method: 'DELETE' })
    if (r.ok) {
      if (panelPeriodoId) {
        const det = await fetch(`${API}/periodos/${panelPeriodoId}`).then(x => x.json())
        setItems(det.items || [])
      }
      showToast('Item eliminado')
    }
  }

  async function distribuir() {
    if (!activePeriodoId || !distribFecha) return
    const r = await fetch(`${API}/periodos/${activePeriodoId}/distribuir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, fecha_vencimiento: distribFecha }),
    })
    if (r.ok) {
      const d = await r.json()
      setShowDistribuir(false)
      setDistribFecha('')
      loadPeriodos()
      if (panelPeriodoId === activePeriodoId) {
        // reload cobros
        setPanelPeriodoId(null)
        setTimeout(() => setPanelPeriodoId(activePeriodoId), 100)
      }
      showToast('Distribuido: ' + d.cobros_created + ' cobros creados')
    } else {
      const d = await r.json()
      setError(d.detail || 'Error al distribuir')
    }
  }

  async function marcarPagado() {
    if (!selectedCobro) return
    const r = await fetch(`${API}/cobros/${selectedCobro.id}/pagar`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metodo_pago: metodoPago }),
    })
    if (r.ok) {
      setShowPagar(false)
      setSelectedCobro(null)
      if (panelPeriodoId) setPanelPeriodoId(panelPeriodoId) // trigger reload
      showToast('Cobro marcado como pagado')
    }
  }

  async function exentarCobro(id: number) {
    const r = await fetch(`${API}/cobros/${id}/exentar`, { method: 'PATCH' })
    if (r.ok) {
      if (panelPeriodoId) setPanelPeriodoId(panelPeriodoId)
      showToast('Cobro exento')
    }
  }

  async function saveFondo() {
    const r = await fetch(`${API}/fondo`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, saldo: Number(fondoVal) }),
    })
    if (r.ok) {
      setFondo(Number(fondoVal))
      setEditFondo(false)
      showToast('Fondo actualizado')
    }
  }

  const estadoCobro: Record<string, string> = {
    pendiente: 'bg-amber-100 text-amber-700',
    pagado: 'bg-emerald-100 text-emerald-700',
    vencido: 'bg-red-100 text-red-700',
    exento: 'bg-slate-100 text-slate-500',
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg text-sm">
          {toast}
        </div>
      )}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError('')} className="ml-4 font-bold">x</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gastos Comunes</h1>
          <p className="text-slate-500 text-sm mt-1">Gestion de periodos, cobros y fondo de reserva</p>
        </div>
        <button
          onClick={() => setShowNuevo(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Periodo
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total emitido', value: formatCLP(totalEmitido), color: 'text-indigo-600' },
          { label: 'Cobrado este mes', value: formatCLP(resumen && panelPeriodoId ? Number(resumen.pagado_monto) : 0), color: 'text-emerald-600' },
          { label: 'Pendiente', value: formatCLP(resumen && panelPeriodoId ? Number(resumen.pendiente_monto) : 0), color: 'text-amber-600' },
          { label: 'Fondo de reserva', value: formatCLP(fondo), color: 'text-slate-700' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-100 p-4">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Fondo de reserva edit */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 mb-6 flex items-center gap-4">
        <div className="flex-1">
          <p className="text-xs text-slate-500 mb-1">Fondo de Reserva</p>
          {editFondo ? (
            <div className="flex items-center gap-2">
              <input type="number" value={fondoVal} onChange={e => setFondoVal(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-40"
                placeholder="Nuevo saldo" />
              <button onClick={saveFondo} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm">Guardar</button>
              <button onClick={() => setEditFondo(false)} className="text-slate-500 px-3 py-1.5 text-sm">Cancelar</button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-slate-800">{formatCLP(fondo)}</span>
              <button onClick={() => { setFondoVal(String(fondo)); setEditFondo(true) }}
                className="text-indigo-600 text-xs hover:underline">Actualizar</button>
            </div>
          )}
        </div>
      </div>

      {/* Periods table */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Periodo', 'Estado', 'Total Items', 'Cobros', 'Emitido', 'Acciones'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Cargando...</td></tr>
              ) : periodos.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No hay periodos. Crea el primero.</td></tr>
              ) : periodos.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold text-slate-800">{p.periodo}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${BADGE[p.estado]}`}>
                      {p.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{formatCLP(Number(p.total_monto))}</td>
                  <td className="px-4 py-3 text-slate-600">{p.cobros_count || p.total_cobros}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{p.emitido_at ? new Date(p.emitido_at).toLocaleDateString('es-CL') : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 flex-wrap">
                      <button onClick={() => setPanelPeriodoId(p.id)}
                        className="text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded text-xs font-medium">
                        Ver cobros
                      </button>
                      {p.estado === 'borrador' && (
                        <>
                          <button onClick={() => { setActivePeriodoId(p.id); setShowItem(true) }}
                            className="text-slate-600 hover:bg-slate-100 px-2 py-1 rounded text-xs">
                            + Item
                          </button>
                          <button onClick={() => { setActivePeriodoId(p.id); setShowDistribuir(true) }}
                            className="text-slate-600 hover:bg-slate-100 px-2 py-1 rounded text-xs">
                            Distribuir
                          </button>
                          <button onClick={() => emitirPeriodo(p.id)}
                            className="text-emerald-600 hover:bg-emerald-50 px-2 py-1 rounded text-xs font-medium">
                            Emitir
                          </button>
                          <button onClick={() => eliminarPeriodo(p.id)}
                            className="text-red-400 hover:bg-red-50 px-2 py-1 rounded text-xs">
                            Eliminar
                          </button>
                        </>
                      )}
                      {p.estado === 'emitido' && (
                        <>
                          <button onClick={() => { setActivePeriodoId(p.id); setShowItem(true) }}
                            className="text-slate-600 hover:bg-slate-100 px-2 py-1 rounded text-xs">
                            + Item
                          </button>
                          <button onClick={() => cerrarPeriodo(p.id)}
                            className="text-slate-500 hover:bg-slate-100 px-2 py-1 rounded text-xs">
                            Cerrar
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SIDE PANEL ── */}
      {panelPeriodoId !== null && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/20" onClick={() => setPanelPeriodoId(null)} />
          <div className="w-full max-w-2xl bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
            {/* Panel header */}
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="font-bold text-slate-800">
                  Cobros — Periodo {periodos.find(p => p.id === panelPeriodoId)?.periodo}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {periodos.find(p => p.id === panelPeriodoId)?.estado}
                </p>
              </div>
              <button onClick={() => setPanelPeriodoId(null)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Resumen card */}
            {resumen && (
              <div className="mx-6 mt-4 bg-slate-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">Progreso de pago</span>
                  <span className="text-sm text-slate-500">
                    {formatCLP(Number(resumen.pagado_monto))} / {formatCLP(Number(resumen.total_monto))}
                  </span>
                </div>
                <div className="bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-emerald-500 rounded-full h-2 transition-all"
                    style={{ width: resumen.total_monto > 0 ? `${Math.round((resumen.pagado_monto / resumen.total_monto) * 100)}%` : '0%' }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div className="text-center">
                    <p className="text-xs text-amber-600 font-medium">Pendiente</p>
                    <p className="text-sm font-bold text-slate-700">{resumen.pendiente_count}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-emerald-600 font-medium">Pagado</p>
                    <p className="text-sm font-bold text-slate-700">{resumen.pagado_count}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-red-500 font-medium">Vencido</p>
                    <p className="text-sm font-bold text-slate-700">{resumen.vencido_count}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Items list */}
            {items.length > 0 && (
              <div className="mx-6 mt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Items de Gasto</p>
                <div className="space-y-1">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center justify-between bg-white border border-slate-100 rounded-lg px-3 py-2 text-sm">
                      <span className="text-slate-700">{item.concepto}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">{formatCLP(Number(item.monto_total))}</span>
                        <span className="text-xs text-slate-400">{item.tipo_distribucion}</span>
                        <button onClick={() => eliminarItem(item.id)} className="text-red-400 hover:text-red-600 ml-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="mx-6 mt-4 flex gap-2 flex-wrap">
              {['', 'pendiente', 'pagado', 'vencido', 'exento'].map(e => (
                <button
                  key={e}
                  onClick={() => setEstadoFiltro(e)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${estadoFiltro === e ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {e || 'Todos'}
                </button>
              ))}
              <input
                type="text"
                placeholder="Buscar depto..."
                value={deptoFiltro}
                onChange={e => setDeptoFiltro(e.target.value)}
                className="border border-slate-200 rounded-full px-3 py-1 text-xs w-32"
              />
            </div>

            {/* Cobros table */}
            <div className="flex-1 px-6 mt-4 pb-6">
              {cobrosLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : cobros.length === 0 ? (
                <p className="text-center text-slate-400 py-8 text-sm">No hay cobros para este periodo</p>
              ) : (
                <div className="space-y-1">
                  {cobros.map(c => (
                    <div key={c.id} className="bg-white border border-slate-100 rounded-xl p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">
                            {c.depto_numero || '—'}
                          </span>
                          <span className="text-xs text-slate-600 truncate">{c.nombre_residente}</span>
                        </div>
                        <p className="text-xs text-slate-500">{c.concepto}</p>
                        {c.fecha_vencimiento && (
                          <p className="text-xs text-slate-400 mt-0.5">Vence: {c.fecha_vencimiento}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-slate-800 text-sm">{formatCLP(Number(c.monto))}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoCobro[c.estado] || 'bg-slate-100 text-slate-500'}`}>
                          {c.estado}
                        </span>
                      </div>
                      {c.estado === 'pendiente' || c.estado === 'vencido' ? (
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          <button onClick={() => { setSelectedCobro(c); setShowPagar(true) }}
                            className="text-emerald-600 hover:bg-emerald-50 px-2 py-1 rounded text-xs font-medium">
                            Pagar
                          </button>
                          <button onClick={() => exentarCobro(c.id)}
                            className="text-slate-400 hover:bg-slate-50 px-2 py-1 rounded text-xs">
                            Exentar
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODALS ── */}

      {/* Nuevo Periodo */}
      {showNuevo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Nuevo Periodo</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Periodo (YYYY-MM)</label>
                <input type="text" value={nuevoPeriodo.periodo}
                  onChange={e => setNuevoPeriodo(prev => ({ ...prev, periodo: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                  placeholder="2026-05" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notas (opcional)</label>
                <textarea value={nuevoPeriodo.notas}
                  onChange={e => setNuevoPeriodo(prev => ({ ...prev, notas: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm h-20 resize-none"
                  placeholder="Observaciones para este periodo..." />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowNuevo(false)}
                className="flex-1 border border-slate-200 text-slate-700 py-2 rounded-xl text-sm hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={crearPeriodo}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-xl text-sm font-medium">
                Crear Periodo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Agregar Item */}
      {showItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Agregar Item de Gasto</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Concepto</label>
                <input type="text" value={nuevoItem.concepto}
                  onChange={e => setNuevoItem(prev => ({ ...prev, concepto: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                  placeholder="Ej: Electricidad areas comunes" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Monto Total ($)</label>
                <input type="number" value={nuevoItem.monto_total}
                  onChange={e => setNuevoItem(prev => ({ ...prev, monto_total: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                  placeholder="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de distribucion</label>
                <select value={nuevoItem.tipo_distribucion}
                  onChange={e => setNuevoItem(prev => ({ ...prev, tipo_distribucion: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white">
                  <option value="igualitaria">Igualitaria (partes iguales)</option>
                  <option value="proporcional">Proporcional</option>
                  <option value="manual">Manual</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowItem(false)}
                className="flex-1 border border-slate-200 text-slate-700 py-2 rounded-xl text-sm hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={agregarItem}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-xl text-sm font-medium">
                Agregar Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Distribuir */}
      {showDistribuir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Distribuir Cobros</h3>
            <p className="text-sm text-slate-500 mb-4">Se generaran cobros individuales por departamento para cada item de gasto.</p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de vencimiento</label>
              <input type="date" value={distribFecha}
                onChange={e => setDistribFecha(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowDistribuir(false)}
                className="flex-1 border border-slate-200 text-slate-700 py-2 rounded-xl text-sm hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={distribuir}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-xl text-sm font-medium">
                Distribuir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Marcar Pagado */}
      {showPagar && selectedCobro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-1">Marcar como Pagado</h3>
            <p className="text-sm text-slate-500 mb-4">
              Depto {selectedCobro.depto_numero} — {selectedCobro.concepto} — {formatCLP(Number(selectedCobro.monto))}
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Metodo de pago</label>
              <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white">
                <option value="transferencia">Transferencia</option>
                <option value="efectivo">Efectivo</option>
                <option value="cheque">Cheque</option>
                <option value="app">App / Plataforma</option>
              </select>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowPagar(false)}
                className="flex-1 border border-slate-200 text-slate-700 py-2 rounded-xl text-sm hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={marcarPagado}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-sm font-medium">
                Confirmar Pago
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
