'use client'
import { useState, useEffect, useCallback } from 'react'

interface Plan {
  id: number
  nombre: string
  descripcion: string | null
  precio: number
  duracion_dias: number
  tipo: 'recurrente' | 'pase'
  activo: boolean
}

interface MembresiaRow {
  persona_id: number
  nombre_completo: string
  rut: string
  telefono: string | null
  membresia_id: number | null
  estado: string | null
  fecha_inicio: string | null
  fecha_vencimiento: string | null
  notas: string | null
  plan_id: number | null
  plan_nombre: string | null
  plan_precio: number | null
  estado_efectivo: 'activa' | 'vencida' | 'suspendida' | 'cancelada' | 'sin_plan'
}

const ESTADO_BADGE: Record<string, string> = {
  activa: 'bg-emerald-100 text-emerald-700',
  vencida: 'bg-red-100 text-red-700',
  suspendida: 'bg-amber-100 text-amber-700',
  cancelada: 'bg-slate-100 text-slate-500',
  sin_plan: 'bg-slate-100 text-slate-400',
}
const ESTADO_LABEL: Record<string, string> = {
  activa: 'Activa', vencida: 'Vencida', suspendida: 'Suspendida', cancelada: 'Cancelada', sin_plan: 'Sin plan',
}

function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}
function diasRestantes(s: string | null) {
  if (!s) return null
  const dias = Math.ceil((new Date(s).getTime() - Date.now()) / 86400000)
  return dias
}
function fmtMoney(n: number) {
  return '$' + (n || 0).toLocaleString('es-CL')
}

export default function GymMembresiasPage() {
  const [tab, setTab] = useState<'membresias' | 'planes'>('membresias')
  const [planes, setPlanes] = useState<Plan[]>([])
  const [membresias, setMembresias] = useState<MembresiaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Modal: renovar/asignar plan
  const [showRenovar, setShowRenovar] = useState<MembresiaRow | null>(null)
  const [renovarForm, setRenovarForm] = useState({ plan_id: '', monto: '', metodo_pago: 'efectivo', notas: '' })
  const [guardando, setGuardando] = useState(false)

  // Modal: plan
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [planForm, setPlanForm] = useState({ nombre: '', descripcion: '', precio: '', duracion_dias: '30', tipo: 'recurrente' as 'recurrente' | 'pase' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pRes, mRes] = await Promise.all([
        fetch('/api/gym/planes'),
        fetch('/api/gym/membresias'),
      ])
      if (pRes.ok) setPlanes(await pRes.json())
      if (mRes.ok) setMembresias(await mRes.json())
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function showMsg(type: 'ok' | 'err', text: string) {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 4000)
  }

  function openRenovar(row: MembresiaRow) {
    const planActual = planes.find(p => p.id === row.plan_id)
    setRenovarForm({
      plan_id: row.plan_id ? String(row.plan_id) : (planes.find(p => p.tipo === 'recurrente' && p.activo)?.id.toString() || ''),
      monto: planActual ? String(planActual.precio) : '',
      metodo_pago: 'efectivo', notas: '',
    })
    setShowRenovar(row)
  }

  async function handleRenovar(e: React.FormEvent) {
    e.preventDefault()
    if (!showRenovar || !renovarForm.plan_id) return
    setGuardando(true)
    try {
      const r = await fetch(`/api/gym/membresias/${showRenovar.persona_id}/renovar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: parseInt(renovarForm.plan_id),
          monto: parseFloat(renovarForm.monto) || 0,
          metodo_pago: renovarForm.metodo_pago,
          notas: renovarForm.notas || null,
        }),
      })
      if (r.ok) {
        setShowRenovar(null)
        load()
        showMsg('ok', 'Membresia renovada')
      } else {
        const d = await r.json()
        showMsg('err', d.detail || 'Error al renovar')
      }
    } catch { showMsg('err', 'Error de conexion') } finally { setGuardando(false) }
  }

  async function handleSuspender(row: MembresiaRow) {
    const motivo = prompt('Motivo de la suspension (ej: atraso en el pago):') ?? ''
    const r = await fetch(`/api/gym/membresias/${row.persona_id}/suspender`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivo }),
    })
    if (r.ok) { load(); showMsg('ok', 'Socio suspendido') }
    else { const d = await r.json(); showMsg('err', d.detail || 'Error') }
  }

  async function handleReactivar(row: MembresiaRow) {
    const r = await fetch(`/api/gym/membresias/${row.persona_id}/reactivar`, { method: 'POST' })
    if (r.ok) { load(); showMsg('ok', 'Socio reactivado') }
    else { const d = await r.json(); showMsg('err', d.detail || 'Error') }
  }

  function openNewPlan() {
    setEditingPlan(null)
    setPlanForm({ nombre: '', descripcion: '', precio: '', duracion_dias: '30', tipo: 'recurrente' })
    setShowPlanModal(true)
  }
  function openEditPlan(p: Plan) {
    setEditingPlan(p)
    setPlanForm({ nombre: p.nombre, descripcion: p.descripcion || '', precio: String(p.precio), duracion_dias: String(p.duracion_dias), tipo: p.tipo })
    setShowPlanModal(true)
  }

  async function handleSubmitPlan(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    try {
      const body = {
        nombre: planForm.nombre,
        descripcion: planForm.descripcion || null,
        precio: parseFloat(planForm.precio) || 0,
        duracion_dias: parseInt(planForm.duracion_dias) || 1,
        tipo: planForm.tipo,
      }
      const url = editingPlan ? `/api/gym/planes/${editingPlan.id}` : '/api/gym/planes'
      const method = editingPlan ? 'PATCH' : 'POST'
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (r.ok) { setShowPlanModal(false); load(); showMsg('ok', editingPlan ? 'Plan actualizado' : 'Plan creado') }
      else { const d = await r.json(); showMsg('err', d.detail || 'Error al guardar') }
    } catch { showMsg('err', 'Error de conexion') } finally { setGuardando(false) }
  }

  async function handleTogglePlanActivo(p: Plan) {
    const r = await fetch(`/api/gym/planes/${p.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo: !p.activo }),
    })
    if (r.ok) load()
  }

  async function handleDeletePlan(p: Plan) {
    if (!confirm(`¿Eliminar el plan "${p.nombre}"?`)) return
    const r = await fetch(`/api/gym/planes/${p.id}`, { method: 'DELETE' })
    const d = await r.json().catch(() => ({}))
    if (r.ok) { load(); showMsg('ok', d.detail || (d.accion === 'desactivado' ? 'Plan desactivado (tenia socios asignados)' : 'Plan eliminado')) }
  }

  const filtradas = membresias.filter(m => {
    if (filtroEstado && m.estado_efectivo !== filtroEstado) return false
    if (busqueda) {
      const t = busqueda.toLowerCase()
      return m.nombre_completo.toLowerCase().includes(t) || m.rut.toLowerCase().includes(t)
    }
    return true
  })

  const counts = {
    activa: membresias.filter(m => m.estado_efectivo === 'activa').length,
    vencida: membresias.filter(m => m.estado_efectivo === 'vencida').length,
    suspendida: membresias.filter(m => m.estado_efectivo === 'suspendida').length,
    sin_plan: membresias.filter(m => m.estado_efectivo === 'sin_plan').length,
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Planes y Membresías</h1>
          <p className="text-sm text-slate-500">Vencimiento, suspensión por pago y pases de día</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTab('membresias')}
            className={'px-3 py-1.5 rounded-lg text-sm font-medium ' + (tab === 'membresias' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200')}>
            Membresías
          </button>
          <button onClick={() => setTab('planes')}
            className={'px-3 py-1.5 rounded-lg text-sm font-medium ' + (tab === 'planes' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200')}>
            Planes
          </button>
        </div>
      </div>

      {msg && (
        <div className={'rounded-lg p-3 text-sm flex items-center justify-between ' + (msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200')}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="ml-2 text-lg leading-none opacity-60 hover:opacity-100">x</button>
        </div>
      )}

      {tab === 'membresias' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-slate-100 p-4"><p className="text-xs text-slate-500">Activas</p><p className="text-2xl font-bold text-emerald-600 mt-1">{counts.activa}</p></div>
            <div className="bg-white rounded-xl border border-slate-100 p-4"><p className="text-xs text-slate-500">Vencidas</p><p className="text-2xl font-bold text-red-600 mt-1">{counts.vencida}</p></div>
            <div className="bg-white rounded-xl border border-slate-100 p-4"><p className="text-xs text-slate-500">Suspendidas</p><p className="text-2xl font-bold text-amber-600 mt-1">{counts.suspendida}</p></div>
            <div className="bg-white rounded-xl border border-slate-100 p-4"><p className="text-xs text-slate-500">Sin plan</p><p className="text-2xl font-bold text-slate-400 mt-1">{counts.sin_plan}</p></div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex gap-2 flex-wrap">
              {[['', 'Todos'], ['activa', 'Activas'], ['vencida', 'Vencidas'], ['suspendida', 'Suspendidas'], ['sin_plan', 'Sin plan']].map(([v, l]) => (
                <button key={v} onClick={() => setFiltroEstado(v)}
                  className={'px-3 py-1.5 rounded-lg text-sm font-medium ' + (filtroEstado === v ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50')}>
                  {l}
                </button>
              ))}
            </div>
            <div className="relative flex-1">
              <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre o RUT..."
                className="w-full pl-4 pr-4 border border-slate-200 rounded-lg py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" /></div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>{['Socio', 'RUT', 'Plan', 'Vencimiento', 'Estado', 'Acciones'].map(h => (
                      <th key={h} className="text-slate-500 font-medium text-left px-4 py-3 text-xs uppercase tracking-wide">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filtradas.map(m => {
                      const dias = diasRestantes(m.fecha_vencimiento)
                      return (
                        <tr key={m.persona_id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-800">{m.nombre_completo}</td>
                          <td className="px-4 py-3 text-slate-500 font-mono text-xs">{m.rut}</td>
                          <td className="px-4 py-3 text-slate-600 text-xs">{m.plan_nombre || '—'}</td>
                          <td className="px-4 py-3 text-xs">
                            <p className="text-slate-600">{fmtDate(m.fecha_vencimiento)}</p>
                            {dias !== null && m.estado_efectivo === 'activa' && (
                              <p className={dias <= 5 ? 'text-amber-600' : 'text-slate-400'}>
                                {dias >= 0 ? `${dias} dia${dias === 1 ? '' : 's'} restantes` : 'vencida'}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={'px-2 py-0.5 rounded-full text-xs font-medium ' + ESTADO_BADGE[m.estado_efectivo]}>
                              {ESTADO_LABEL[m.estado_efectivo]}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1.5 flex-wrap">
                              <button onClick={() => openRenovar(m)} className="text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 font-medium">
                                {m.estado_efectivo === 'sin_plan' ? 'Asignar plan' : 'Renovar'}
                              </button>
                              {(m.estado_efectivo === 'activa' || m.estado_efectivo === 'vencida') && (
                                <button onClick={() => handleSuspender(m)} className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200">
                                  Suspender
                                </button>
                              )}
                              {m.estado_efectivo === 'suspendida' && (
                                <button onClick={() => handleReactivar(m)} className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200">
                                  Reactivar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {filtradas.length === 0 && (
                <div className="text-center py-12"><p className="text-4xl mb-2">💳</p><p className="text-slate-400 text-sm">No hay socios que coincidan</p></div>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'planes' && (
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">Planes de Membresía</h2>
            <button onClick={openNewPlan} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-1.5">
              <span className="text-base leading-none">+</span> Nuevo Plan
            </button>
          </div>
          {planes.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">No hay planes creados. Crea el primero (ej: Mensual, Pase de 1 día).</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {planes.map(p => (
                <div key={p.id} className={'rounded-xl border-2 p-4 ' + (p.activo ? 'border-slate-100' : 'border-slate-100 opacity-50')}>
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-slate-800">{p.nombre}</h3>
                    <span className={'px-2 py-0.5 rounded-full text-xs font-medium ' + (p.tipo === 'pase' ? 'bg-orange-100 text-orange-700' : 'bg-indigo-100 text-indigo-700')}>
                      {p.tipo === 'pase' ? 'Pase' : 'Recurrente'}
                    </span>
                  </div>
                  {p.descripcion && <p className="text-xs text-slate-500 mt-1">{p.descripcion}</p>}
                  <p className="text-lg font-bold text-slate-800 mt-2">{fmtMoney(p.precio)}</p>
                  <p className="text-xs text-slate-400">{p.duracion_dias} día{p.duracion_dias === 1 ? '' : 's'} de acceso</p>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => openEditPlan(p)} className="text-xs px-2 py-1 rounded bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200">Editar</button>
                    <button onClick={() => handleTogglePlanActivo(p)} className="text-xs px-2 py-1 rounded bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200">
                      {p.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    <button onClick={() => handleDeletePlan(p)} className="text-xs px-2 py-1 rounded bg-red-50 text-red-500 hover:bg-red-100 border border-red-200">Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Renovar / Asignar plan */}
      {showRenovar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-800">{showRenovar.estado_efectivo === 'sin_plan' ? 'Asignar Plan' : 'Renovar Membresía'}</h3>
                <p className="text-xs text-slate-500">{showRenovar.nombre_completo} · {showRenovar.rut}</p>
              </div>
              <button onClick={() => setShowRenovar(null)} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
            </div>
            <form onSubmit={handleRenovar} className="p-5 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Plan *</label>
                <select required value={renovarForm.plan_id} onChange={e => {
                  const plan = planes.find(p => p.id === parseInt(e.target.value))
                  setRenovarForm({ ...renovarForm, plan_id: e.target.value, monto: plan ? String(plan.precio) : renovarForm.monto })
                }} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                  <option value="">Selecciona un plan</option>
                  {planes.filter(p => p.activo).map(p => <option key={p.id} value={p.id}>{p.nombre} — {fmtMoney(p.precio)} ({p.duracion_dias}d)</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Monto pagado</label>
                <input type="number" min={0} value={renovarForm.monto} onChange={e => setRenovarForm({ ...renovarForm, monto: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Método de pago</label>
                <select value={renovarForm.metodo_pago} onChange={e => setRenovarForm({ ...renovarForm, metodo_pago: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="webpay">Webpay / Flow</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
                <input value={renovarForm.notas} onChange={e => setRenovarForm({ ...renovarForm, notas: e.target.value })}
                  placeholder="Opcional" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              {showRenovar.estado_efectivo === 'activa' && showRenovar.fecha_vencimiento && new Date(showRenovar.fecha_vencimiento) > new Date() && (
                <p className="text-xs text-slate-400">Como la membresía actual sigue vigente, el nuevo período se sumará a partir de su vencimiento ({fmtDate(showRenovar.fecha_vencimiento)}).</p>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowRenovar(null)} className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={guardando} className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {guardando ? 'Guardando...' : 'Confirmar Pago'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Nuevo/Editar Plan */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">{editingPlan ? 'Editar Plan' : 'Nuevo Plan'}</h3>
              <button onClick={() => setShowPlanModal(false)} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
            </div>
            <form onSubmit={handleSubmitPlan} className="p-5 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
                <input required value={planForm.nombre} onChange={e => setPlanForm({ ...planForm, nombre: e.target.value })}
                  placeholder="Mensual, Trimestral, Pase de 1 día..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                <input value={planForm.descripcion} onChange={e => setPlanForm({ ...planForm, descripcion: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Precio ($) *</label>
                  <input required type="number" min={0} value={planForm.precio} onChange={e => setPlanForm({ ...planForm, precio: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Duración (días) *</label>
                  <input required type="number" min={1} value={planForm.duracion_dias} onChange={e => setPlanForm({ ...planForm, duracion_dias: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPlanForm({ ...planForm, tipo: 'recurrente' })}
                    className={'flex-1 px-3 py-2 rounded-lg text-sm font-medium border ' + (planForm.tipo === 'recurrente' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-slate-200 text-slate-500')}>
                    Recurrente (mensual, etc.)
                  </button>
                  <button type="button" onClick={() => setPlanForm({ ...planForm, tipo: 'pase' })}
                    className={'flex-1 px-3 py-2 rounded-lg text-sm font-medium border ' + (planForm.tipo === 'pase' ? 'bg-orange-50 border-orange-300 text-orange-700' : 'border-slate-200 text-slate-500')}>
                    Pase temporal (día, semana)
                  </button>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowPlanModal(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={guardando} className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {guardando ? 'Guardando...' : (editingPlan ? 'Guardar Cambios' : 'Crear Plan')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
