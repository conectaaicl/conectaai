'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from '@/hooks/useSession'

const TIPOS = ['mantencion','reparacion','emergencia','limpieza','inspeccion']
const PRIORIDADES = ['baja','media','alta','urgente']
const ESTADOS_ORDEN = ['abierta','asignada','en_progreso','completada','cerrada']

const tipoColor: Record<string,string> = {
  mantencion: 'bg-blue-50 text-blue-700 border border-blue-200',
  reparacion: 'bg-orange-50 text-orange-700 border border-orange-200',
  emergencia: 'bg-red-50 text-red-700 border border-red-200',
  limpieza: 'bg-teal-50 text-teal-700 border border-teal-200',
  inspeccion: 'bg-slate-50 text-slate-700 border border-slate-200',
}
const prioridadColor: Record<string,string> = {
  baja: 'bg-slate-100 text-slate-600',
  media: 'bg-amber-50 text-amber-700',
  alta: 'bg-orange-50 text-orange-700',
  urgente: 'bg-red-50 text-red-700 font-semibold',
}
const estadoColor: Record<string,string> = {
  abierta: 'bg-amber-50 text-amber-700 border border-amber-200',
  asignada: 'bg-blue-50 text-blue-700 border border-blue-200',
  en_progreso: 'bg-violet-50 text-violet-700 border border-violet-200',
  completada: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  cerrada: 'bg-slate-50 text-slate-500 border border-slate-200',
}
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace('_',' ')

export default function OrdenesPage() {
  const { user } = useSession()
  const tenantId = (user as any)?.tenant_id || 1
  const [ordenes, setOrdenes] = useState<any[]>([])
  const [stats, setStats] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterEstado, setFilterEstado] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [msg, setMsg] = useState<{type:'ok'|'err',text:string}|null>(null)
  const [form, setForm] = useState({
    titulo:'', descripcion:'', tipo:'mantencion', prioridad:'media',
    asignado_a:'', proveedor:'', costo_estimado:'', fecha_estimada:''
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = '?tenant_id=' + tenantId +
        (filterEstado ? '&estado=' + filterEstado : '') +
        (filterTipo ? '&tipo=' + filterTipo : '')
      const [r1, r2] = await Promise.all([
        fetch('/api/condominios/ordenes' + qs),
        fetch('/api/condominios/ordenes/stats?tenant_id=' + tenantId)
      ])
      if (r1.ok) setOrdenes(await r1.json())
      if (r2.ok) setStats(await r2.json())
    } finally { setLoading(false) }
  }, [tenantId, filterEstado, filterTipo])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!form.titulo.trim()) { setMsg({type:'err',text:'El titulo es requerido'}); return }
    const body: any = { ...form, tenant_id: tenantId }
    if (body.costo_estimado) body.costo_estimado = Number(body.costo_estimado)
    else delete body.costo_estimado
    if (!body.fecha_estimada) delete body.fecha_estimada
    const r = await fetch('/api/condominios/ordenes', {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)
    })
    if (r.ok) {
      setMsg({type:'ok',text:'Orden creada'})
      setShowModal(false)
      setForm({titulo:'',descripcion:'',tipo:'mantencion',prioridad:'media',asignado_a:'',proveedor:'',costo_estimado:'',fecha_estimada:''})
      load()
    } else setMsg({type:'err',text:'Error al crear orden'})
  }

  const handleEstado = async (id: number, estado: string) => {
    await fetch('/api/condominios/ordenes/' + id, {
      method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ estado })
    })
    load()
  }

  const handleDelete = async (id: number) => {
    await fetch('/api/condominios/ordenes/' + id, { method: 'DELETE' })
    load()
  }

  const filtered = ordenes.filter(o =>
    (o.titulo||'').toLowerCase().includes(search.toLowerCase()) ||
    (o.asignado_a||'').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Ordenes de Trabajo</h1>
          <p className="text-slate-500 text-sm mt-1">Gestion de mantenciones, reparaciones y emergencias</p>
        </div>
        <button onClick={()=>setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          Nueva orden
        </button>
      </div>

      {msg && (
        <div className={'rounded-lg p-3 text-sm flex items-center justify-between ' + (msg.type==='ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200')}>
          <span>{msg.text}</span>
          <button onClick={()=>setMsg(null)} className="ml-2 opacity-60 hover:opacity-100">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          {label:'Total',val:stats.total||0,color:'text-slate-800'},
          {label:'Abiertas',val:stats.abiertas||0,color:'text-amber-600'},
          {label:'En progreso',val:stats.en_progreso||0,color:'text-violet-600'},
          {label:'Completadas',val:stats.completadas||0,color:'text-emerald-600'},
          {label:'Urgentes',val:stats.urgentes||0,color:'text-red-600'},
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-100 p-4">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={'text-2xl font-bold mt-1 ' + s.color}>{s.val}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar titulo o asignado..." className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
        <select value={filterEstado} onChange={e=>setFilterEstado(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
          <option value="">Todos los estados</option>
          {ESTADOS_ORDEN.map(e => <option key={e} value={e}>{capitalize(e)}</option>)}
        </select>
        <select value={filterTipo} onChange={e=>setFilterTipo(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
          <option value="">Todos los tipos</option>
          {TIPOS.map(t => <option key={t} value={t}>{capitalize(t)}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Titulo','Tipo','Prioridad','Asignado a','Estado','Fecha','Acciones'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-slate-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">Cargando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">No hay ordenes registradas</td></tr>
              ) : filtered.map(o => (
                <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-700 font-medium max-w-xs truncate">{o.titulo}</td>
                  <td className="px-4 py-3">
                    <span className={'text-xs px-2 py-0.5 rounded-full border ' + (tipoColor[o.tipo] || '')}>{capitalize(o.tipo)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={'text-xs px-2 py-0.5 rounded-full ' + (prioridadColor[o.prioridad] || '')}>{capitalize(o.prioridad)}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{o.asignado_a || '—'}</td>
                  <td className="px-4 py-3">
                    <select value={o.estado} onChange={e => handleEstado(o.id, e.target.value)} className={'text-xs px-2 py-1 rounded-full border font-medium cursor-pointer ' + (estadoColor[o.estado] || '')}>
                      {ESTADOS_ORDEN.map(e => <option key={e} value={e}>{capitalize(e)}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{o.creado_en ? new Date(o.creado_en).toLocaleDateString('es-CL') : '—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={()=>handleDelete(o.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">Nueva Orden de Trabajo</h2>
              <button onClick={()=>setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Titulo *</label>
                <input value={form.titulo} onChange={e=>setForm(p=>({...p,titulo:e.target.value}))} placeholder="Descripcion breve del trabajo" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripcion</label>
                <textarea value={form.descripcion} onChange={e=>setForm(p=>({...p,descripcion:e.target.value}))} rows={3} placeholder="Detalles del trabajo requerido..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                  <select value={form.tipo} onChange={e=>setForm(p=>({...p,tipo:e.target.value}))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                    {TIPOS.map(t => <option key={t} value={t}>{capitalize(t)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Prioridad</label>
                  <select value={form.prioridad} onChange={e=>setForm(p=>({...p,prioridad:e.target.value}))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                    {PRIORIDADES.map(pr => <option key={pr} value={pr}>{capitalize(pr)}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Asignado a</label>
                  <input value={form.asignado_a} onChange={e=>setForm(p=>({...p,asignado_a:e.target.value}))} placeholder="Nombre del tecnico" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Proveedor</label>
                  <input value={form.proveedor} onChange={e=>setForm(p=>({...p,proveedor:e.target.value}))} placeholder="Empresa externa" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Costo estimado ($)</label>
                  <input type="number" value={form.costo_estimado} onChange={e=>setForm(p=>({...p,costo_estimado:e.target.value}))} placeholder="0" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha estimada</label>
                  <input type="date" value={form.fecha_estimada} onChange={e=>setForm(p=>({...p,fecha_estimada:e.target.value}))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-slate-100">
              <button onClick={()=>setShowModal(false)} className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 text-sm">Cancelar</button>
              <button onClick={handleCreate} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">Crear Orden</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
