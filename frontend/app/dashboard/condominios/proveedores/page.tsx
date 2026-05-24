'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from '@/hooks/useSession'

const RUBROS = ['plomeria', 'electricidad', 'gas', 'ascensores', 'jardines', 'limpieza', 'seguridad', 'pintura', 'cerrajeria', 'otro']
const ESTADOS_OT = ['solicitada', 'aprobada', 'en_proceso', 'completada', 'cancelada']
const PRIORIDADES = ['urgente', 'alta', 'normal', 'baja']

const ESTADO_COLORS: Record<string, string> = {
  solicitada: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  aprobada: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  en_proceso: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  completada: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  cancelada: 'bg-red-500/20 text-red-300 border-red-500/30',
}

const PRIORIDAD_COLORS: Record<string, string> = {
  urgente: 'bg-red-500/20 text-red-300 border-red-500/30',
  alta: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  normal: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  baja: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
}

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${colorClass} capitalize`}>
      {label.replace('_', ' ')}
    </span>
  )
}

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange?.(n)} className={`text-lg leading-none ${n <= value ? 'text-amber-400' : 'text-slate-600'} ${onChange ? 'cursor-pointer hover:text-amber-300' : 'cursor-default'}`}>
          ★
        </button>
      ))}
    </div>
  )
}

interface Proveedor {
  id: number
  nombre: string
  rubro: string
  rut: string
  contacto_nombre: string
  telefono: string
  email: string
  calificacion: number
  notas: string
  ultima_contratacion: string
  activo: boolean
}

interface OrdenTrabajo {
  id: number
  titulo: string
  descripcion: string
  estado: string
  prioridad: string
  monto_presupuesto: number
  monto_final: number
  fecha_solicitud: string
  fecha_inicio: string
  proveedor_id: number
  proveedor_nombre: string
  solicitado_por: string
  notas: string
}

const emptyProvForm = { nombre: '', rubro: 'plomeria', rut: '', contacto_nombre: '', telefono: '', email: '', calificacion: 0, notas: '', ultima_contratacion: '' }
const emptyOtForm = { titulo: '', descripcion: '', proveedor_id: '', prioridad: 'normal', monto_presupuesto: '', fecha_inicio: '', solicitado_por: '', notas: '' }

export default function ProveedoresPage() {
  const { user } = useSession()
  const tenantId = typeof window !== 'undefined' ? Number(localStorage.getItem('current_condominio_id') || 0) : 0

  const [tab, setTab] = useState<'proveedores' | 'ordenes'>('proveedores')
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([])
  const [loading, setLoading] = useState(true)
  const [filterRubro, setFilterRubro] = useState('')
  const [filterEstado, setFilterEstado] = useState('')
  const [filterPrioridad, setFilterPrioridad] = useState('')

  const [showProvModal, setShowProvModal] = useState(false)
  const [showOtModal, setShowOtModal] = useState(false)
  const [editProvId, setEditProvId] = useState<number | null>(null)
  const [editOtId, setEditOtId] = useState<number | null>(null)
  const [provForm, setProvForm] = useState({ ...emptyProvForm })
  const [otForm, setOtForm] = useState({ ...emptyOtForm })
  const [estadoUpdate, setEstadoUpdate] = useState<{ id: number; estado: string; notas: string; monto_final: string } | null>(null)

  const fetchProveedores = useCallback(async () => {
    if (!tenantId) return
    const params = new URLSearchParams({ tenant_id: String(tenantId) })
    if (filterRubro) params.set('rubro', filterRubro)
    const res = await fetch(`/api/proveedores?${params}`)
    if (res.ok) setProveedores(await res.json())
  }, [tenantId, filterRubro])

  const fetchOrdenes = useCallback(async () => {
    if (!tenantId) return
    const params = new URLSearchParams({ tenant_id: String(tenantId) })
    if (filterEstado) params.set('estado', filterEstado)
    if (filterPrioridad) params.set('prioridad', filterPrioridad)
    const res = await fetch(`/api/proveedores/ordenes?${params}`)
    if (res.ok) setOrdenes(await res.json())
  }, [tenantId, filterEstado, filterPrioridad])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchProveedores(), fetchOrdenes()]).finally(() => setLoading(false))
  }, [fetchProveedores, fetchOrdenes])

  function openCreateProv() { setEditProvId(null); setProvForm({ ...emptyProvForm }); setShowProvModal(true) }
  function openEditProv(p: Proveedor) {
    setEditProvId(p.id)
    setProvForm({ nombre: p.nombre, rubro: p.rubro, rut: p.rut || '', contacto_nombre: p.contacto_nombre || '', telefono: p.telefono || '', email: p.email || '', calificacion: p.calificacion || 0, notas: p.notas || '', ultima_contratacion: p.ultima_contratacion || '' })
    setShowProvModal(true)
  }

  async function handleSaveProv() {
    const body = { ...provForm, tenant_id: tenantId, calificacion: Number(provForm.calificacion) || 0, ultima_contratacion: provForm.ultima_contratacion || null }
    if (editProvId) {
      await fetch(`/api/proveedores/${editProvId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    } else {
      await fetch('/api/proveedores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    }
    setShowProvModal(false)
    fetchProveedores()
  }

  async function handleDeleteProv(id: number) {
    if (!confirm('Desactivar proveedor?')) return
    await fetch(`/api/proveedores/${id}`, { method: 'DELETE' })
    fetchProveedores()
  }

  async function handleSaveOt() {
    const body = {
      ...otForm,
      tenant_id: tenantId,
      proveedor_id: otForm.proveedor_id ? Number(otForm.proveedor_id) : null,
      monto_presupuesto: otForm.monto_presupuesto ? parseFloat(otForm.monto_presupuesto) : null,
      fecha_inicio: otForm.fecha_inicio || null,
    }
    await fetch('/api/proveedores/ordenes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setShowOtModal(false)
    fetchOrdenes()
  }

  async function handleUpdateEstado() {
    if (!estadoUpdate) return
    const body: any = { estado: estadoUpdate.estado }
    if (estadoUpdate.notas) body.notas = estadoUpdate.notas
    if (estadoUpdate.monto_final) body.monto_final = parseFloat(estadoUpdate.monto_final)
    await fetch(`/api/proveedores/ordenes/${estadoUpdate.id}/estado`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setEstadoUpdate(null)
    fetchOrdenes()
  }

  const completadasMes = ordenes.filter(o => {
    if (o.estado !== 'completada') return false
    const now = new Date()
    const f = new Date(o.fecha_solicitud)
    return f.getMonth() === now.getMonth() && f.getFullYear() === now.getFullYear()
  }).length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Proveedores</h1>
          <p className="text-slate-400 text-sm mt-1">Directorio de proveedores y ordenes de trabajo</p>
        </div>
        <button
          onClick={tab === 'proveedores' ? openCreateProv : () => { setOtForm({ ...emptyOtForm, solicitado_por: user?.nombre_completo || '' }); setShowOtModal(true) }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
          style={{ background: 'linear-gradient(135deg, #6366f1, #9333ea)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {tab === 'proveedores' ? 'Agregar Proveedor' : 'Nueva Orden de Trabajo'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(51,65,85,0.5)' }}>
        {(['proveedores', 'ordenes'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${tab === t ? 'text-white' : 'text-slate-400 hover:text-white'}`}
            style={tab === t ? { background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(147,51,234,0.3))', boxShadow: '0 0 12px rgba(99,102,241,0.2)' } : {}}
          >
            {t === 'ordenes' ? 'Ordenes de Trabajo' : 'Proveedores'}
          </button>
        ))}
      </div>

      {/* PROVEEDORES TAB */}
      {tab === 'proveedores' && (
        <>
          {/* Rubro filters */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setFilterRubro('')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${!filterRubro ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' : 'text-slate-400 border-slate-700 hover:border-slate-500'}`}>
              Todos los rubros
            </button>
            {RUBROS.map(r => (
              <button key={r} onClick={() => setFilterRubro(filterRubro === r ? '' : r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${filterRubro === r ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' : 'text-slate-400 border-slate-700 hover:border-slate-500'}`}>
                {r}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-20 text-slate-500">Cargando...</div>
          ) : proveedores.length === 0 ? (
            <div className="text-center py-20 text-slate-500">No hay proveedores registrados</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {proveedores.map(p => (
                <div key={p.id} className="pro-card rounded-xl border border-slate-700/50 p-5 space-y-3" style={{ background: 'rgba(15,23,42,0.9)' }}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-white font-bold">{p.nombre}</p>
                      {p.rut && <p className="text-slate-500 text-xs">RUT: {p.rut}</p>}
                    </div>
                    <Badge label={p.rubro} colorClass="bg-indigo-500/20 text-indigo-300 border-indigo-500/30" />
                  </div>
                  <div className="space-y-1 text-xs text-slate-400">
                    {p.contacto_nombre && <p><span className="text-slate-500">Contacto:</span> {p.contacto_nombre}</p>}
                    {p.telefono && <p><span className="text-slate-500">Tel:</span> {p.telefono}</p>}
                    {p.email && <p><span className="text-slate-500">Email:</span> {p.email}</p>}
                    {p.ultima_contratacion && <p><span className="text-slate-500">Ultima contratacion:</span> {p.ultima_contratacion}</p>}
                  </div>
                  <StarRating value={p.calificacion || 0} />
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => openEditProv(p)} className="flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30 transition-all">
                      Editar
                    </button>
                    <button
                      onClick={() => { setOtForm({ ...emptyOtForm, proveedor_id: String(p.id), solicitado_por: user?.nombre_completo || '' }); setShowOtModal(true) }}
                      className="flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-all"
                    >
                      Nueva OT
                    </button>
                    <button onClick={() => handleDeleteProv(p.id)} className="px-2 py-1.5 rounded-lg text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition-all">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ORDENES TAB */}
      {tab === 'ordenes' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Solicitadas', value: ordenes.filter(o => o.estado === 'solicitada').length, color: 'text-slate-300' },
              { label: 'En Proceso', value: ordenes.filter(o => o.estado === 'en_proceso').length, color: 'text-amber-400' },
              { label: 'Completadas (mes)', value: completadasMes, color: 'text-emerald-400' },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-4 border border-slate-700/50" style={{ background: 'rgba(15,23,42,0.8)' }}>
                <p className="text-slate-400 text-xs mb-1">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setFilterEstado('')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${!filterEstado ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' : 'text-slate-400 border-slate-700 hover:border-slate-500'}`}>
              Todos
            </button>
            {ESTADOS_OT.map(e => (
              <button key={e} onClick={() => setFilterEstado(filterEstado === e ? '' : e)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${filterEstado === e ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' : 'text-slate-400 border-slate-700 hover:border-slate-500'}`}>
                {e.replace('_', ' ')}
              </button>
            ))}
            <div className="w-px bg-slate-700 mx-1" />
            {PRIORIDADES.map(p => (
              <button key={p} onClick={() => setFilterPrioridad(filterPrioridad === p ? '' : p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${filterPrioridad === p ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'text-slate-400 border-slate-700 hover:border-slate-500'}`}>
                {p}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="rounded-xl border border-slate-700/50 overflow-hidden" style={{ background: 'rgba(15,23,42,0.8)' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm pro-table">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    {['Titulo', 'Proveedor', 'Estado', 'Prioridad', 'Presupuesto', 'Fecha', 'Acciones'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {loading ? (
                    <tr><td colSpan={7} className="text-center py-12 text-slate-500">Cargando...</td></tr>
                  ) : ordenes.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-slate-500">No hay ordenes de trabajo</td></tr>
                  ) : ordenes.map(o => (
                    <tr key={o.id}>
                      <td className="px-4 py-3 text-white font-semibold max-w-[180px] truncate" title={o.titulo}>{o.titulo}</td>
                      <td className="px-4 py-3 text-slate-300">{o.proveedor_nombre || '-'}</td>
                      <td className="px-4 py-3"><Badge label={o.estado} colorClass={ESTADO_COLORS[o.estado] || ''} /></td>
                      <td className="px-4 py-3"><Badge label={o.prioridad} colorClass={PRIORIDAD_COLORS[o.prioridad] || ''} /></td>
                      <td className="px-4 py-3 text-slate-300">{o.monto_presupuesto ? `$${Number(o.monto_presupuesto).toLocaleString('es-CL')}` : '-'}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{o.fecha_solicitud}</td>
                      <td className="px-4 py-3">
                        {o.estado !== 'completada' && o.estado !== 'cancelada' && (
                          <button
                            onClick={() => setEstadoUpdate({ id: o.id, estado: o.estado, notas: '', monto_final: '' })}
                            className="px-2 py-1 rounded-lg text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30 transition-all"
                          >
                            Actualizar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Proveedor Modal */}
      {showProvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 p-6 space-y-4" style={{ background: '#0f172a' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">{editProvId ? 'Editar Proveedor' : 'Agregar Proveedor'}</h2>
              <button onClick={() => setShowProvModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs text-slate-400 mb-1 block">Nombre <span className="text-red-400">*</span></label>
                <input value={provForm.nombre} onChange={e => setProvForm(f => ({ ...f, nombre: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm focus:outline-none focus:border-indigo-500" placeholder="Nombre empresa o persona" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Rubro <span className="text-red-400">*</span></label>
                <select value={provForm.rubro} onChange={e => setProvForm(f => ({ ...f, rubro: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm focus:outline-none focus:border-indigo-500">
                  {RUBROS.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">RUT</label>
                <input value={provForm.rut} onChange={e => setProvForm(f => ({ ...f, rut: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm focus:outline-none focus:border-indigo-500" placeholder="12.345.678-9" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Contacto</label>
                <input value={provForm.contacto_nombre} onChange={e => setProvForm(f => ({ ...f, contacto_nombre: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm focus:outline-none focus:border-indigo-500" placeholder="Nombre contacto" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Telefono</label>
                <input value={provForm.telefono} onChange={e => setProvForm(f => ({ ...f, telefono: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm focus:outline-none focus:border-indigo-500" placeholder="+56 9 1234 5678" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Email</label>
                <input type="email" value={provForm.email} onChange={e => setProvForm(f => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm focus:outline-none focus:border-indigo-500" placeholder="correo@empresa.cl" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Ultima Contratacion</label>
                <input type="date" value={provForm.ultima_contratacion} onChange={e => setProvForm(f => ({ ...f, ultima_contratacion: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Calificacion</label>
                <StarRating value={provForm.calificacion} onChange={v => setProvForm(f => ({ ...f, calificacion: v }))} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-400 mb-1 block">Notas</label>
                <textarea value={provForm.notas} onChange={e => setProvForm(f => ({ ...f, notas: e.target.value }))} rows={2} className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowProvModal(false)} className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 border border-slate-600 hover:bg-slate-800 transition-all">Cancelar</button>
              <button onClick={handleSaveProv} className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all" style={{ background: 'linear-gradient(135deg, #6366f1, #9333ea)' }}>{editProvId ? 'Guardar' : 'Agregar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Orden Modal */}
      {showOtModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 p-6 space-y-4" style={{ background: '#0f172a' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Nueva Orden de Trabajo</h2>
              <button onClick={() => setShowOtModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs text-slate-400 mb-1 block">Titulo <span className="text-red-400">*</span></label>
                <input value={otForm.titulo} onChange={e => setOtForm(f => ({ ...f, titulo: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm focus:outline-none focus:border-indigo-500" placeholder="Reparacion bomba de agua" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Proveedor</label>
                <select value={otForm.proveedor_id} onChange={e => setOtForm(f => ({ ...f, proveedor_id: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm focus:outline-none focus:border-indigo-500">
                  <option value="">Sin asignar</option>
                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Prioridad</label>
                <select value={otForm.prioridad} onChange={e => setOtForm(f => ({ ...f, prioridad: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm focus:outline-none focus:border-indigo-500">
                  {PRIORIDADES.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Presupuesto ($)</label>
                <input type="number" value={otForm.monto_presupuesto} onChange={e => setOtForm(f => ({ ...f, monto_presupuesto: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm focus:outline-none focus:border-indigo-500" placeholder="0" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Fecha Inicio</label>
                <input type="date" value={otForm.fecha_inicio} onChange={e => setOtForm(f => ({ ...f, fecha_inicio: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Solicitado por</label>
                <input value={otForm.solicitado_por} onChange={e => setOtForm(f => ({ ...f, solicitado_por: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm focus:outline-none focus:border-indigo-500" placeholder="Nombre admin/conserje" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-400 mb-1 block">Descripcion</label>
                <textarea value={otForm.descripcion} onChange={e => setOtForm(f => ({ ...f, descripcion: e.target.value }))} rows={3} className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowOtModal(false)} className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 border border-slate-600 hover:bg-slate-800 transition-all">Cancelar</button>
              <button onClick={handleSaveOt} className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all" style={{ background: 'linear-gradient(135deg, #6366f1, #9333ea)' }}>Crear Orden</button>
            </div>
          </div>
        </div>
      )}

      {/* Estado Update Modal */}
      {estadoUpdate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md rounded-2xl border border-slate-700 p-6 space-y-4" style={{ background: '#0f172a' }}>
            <h2 className="text-lg font-bold text-white">Actualizar Estado</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Nuevo Estado</label>
                <select value={estadoUpdate.estado} onChange={e => setEstadoUpdate(s => s ? { ...s, estado: e.target.value } : null)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm focus:outline-none focus:border-indigo-500">
                  {ESTADOS_OT.map(e => <option key={e} value={e}>{e.replace('_', ' ')}</option>)}
                </select>
              </div>
              {estadoUpdate.estado === 'completada' && (
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Monto Final ($)</label>
                  <input type="number" value={estadoUpdate.monto_final} onChange={e => setEstadoUpdate(s => s ? { ...s, monto_final: e.target.value } : null)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm focus:outline-none focus:border-indigo-500" />
                </div>
              )}
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Notas</label>
                <textarea value={estadoUpdate.notas} onChange={e => setEstadoUpdate(s => s ? { ...s, notas: e.target.value } : null)} rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEstadoUpdate(null)} className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 border border-slate-600 hover:bg-slate-800 transition-all">Cancelar</button>
              <button onClick={handleUpdateEstado} className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all" style={{ background: 'linear-gradient(135deg, #6366f1, #9333ea)' }}>Actualizar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
