'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from '@/hooks/useSession'

const ESTADOS = ['pendiente','notificado','retirado']
const estadoColor: Record<string,string> = {
  pendiente: 'bg-amber-50 text-amber-700 border border-amber-200',
  notificado: 'bg-blue-50 text-blue-700 border border-blue-200',
  retirado: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
}
const estadoLabel: Record<string,string> = {
  pendiente: 'Pendiente', notificado: 'Notificado', retirado: 'Retirado'
}

export default function PaquetesPage() {
  const { user } = useSession()
  const tenantId = (user as any)?.tenant_id || 1
  const [paquetes, setPaquetes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterEstado, setFilterEstado] = useState('')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ remitente:'', descripcion:'', codigo_seguimiento:'', departamento_id:'' })
  const [departamentos, setDepartamentos] = useState<any[]>([])
  const [msg, setMsg] = useState<{type:'ok'|'err',text:string}|null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = filterEstado ? '&estado=' + filterEstado : ''
      const r = await fetch('/api/condominios/paquetes?tenant_id=' + tenantId + qs)
      if (r.ok) setPaquetes(await r.json())
    } finally { setLoading(false) }
  }, [tenantId, filterEstado])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    fetch('/api/condominios/departamentos?tenant_id=' + tenantId)
      .then(r => r.ok ? r.json() : []).then(setDepartamentos).catch(() => {})
  }, [tenantId])

  const handleCreate = async () => {
    const body = { ...form, tenant_id: tenantId, departamento_id: form.departamento_id ? Number(form.departamento_id) : null }
    const r = await fetch('/api/condominios/paquetes', {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)
    })
    if (r.ok) {
      setMsg({type:'ok',text:'Paquete registrado'})
      setShowModal(false)
      setForm({remitente:'',descripcion:'',codigo_seguimiento:'',departamento_id:''})
      load()
    } else setMsg({type:'err',text:'Error al registrar'})
  }

  const handleEstado = async (id: number, estado: string) => {
    await fetch('/api/condominios/paquetes/' + id + '/estado', {
      method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ estado })
    })
    load()
  }

  const handleDelete = async (id: number) => {
    await fetch('/api/condominios/paquetes/' + id, { method: 'DELETE' })
    load()
  }

  const filtered = paquetes.filter(p =>
    (p.remitente||'').toLowerCase().includes(search.toLowerCase()) ||
    (p.descripcion||'').toLowerCase().includes(search.toLowerCase())
  )
  const counts = {
    pendiente: paquetes.filter(p=>p.estado==='pendiente').length,
    notificado: paquetes.filter(p=>p.estado==='notificado').length,
    retirado: paquetes.filter(p=>p.estado==='retirado').length,
    total: paquetes.length
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Paquetes y Correspondencia</h1>
          <p className="text-slate-500 text-sm mt-1">Registro de encomiendas y correspondencia en porteria</p>
        </div>
        <button onClick={()=>setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          Nuevo paquete
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {label:'Total',val:counts.total,color:'text-slate-800'},
          {label:'Pendientes',val:counts.pendiente,color:'text-amber-600'},
          {label:'Notificados',val:counts.notificado,color:'text-blue-600'},
          {label:'Retirados',val:counts.retirado,color:'text-emerald-600'}
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-100 p-4">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={'text-2xl font-bold mt-1 ' + s.color}>{s.val}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar remitente o descripcion..." className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
        <select value={filterEstado} onChange={e=>setFilterEstado(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
          <option value="">Todos los estados</option>
          {ESTADOS.map(e => <option key={e} value={e}>{estadoLabel[e]}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Descripcion','Remitente','Departamento','Tracking','Recibido','Estado','Acciones'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-slate-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">Cargando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">No hay paquetes registrados</td></tr>
              ) : filtered.map(p => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-700 font-medium">{p.descripcion || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{p.remitente || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{p.departamento_id ? 'Depto ' + p.departamento_id : 'General'}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{p.codigo_seguimiento || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{p.fecha_recepcion ? new Date(p.fecha_recepcion).toLocaleDateString('es-CL') : '—'}</td>
                  <td className="px-4 py-3">
                    <select value={p.estado} onChange={e => handleEstado(p.id, e.target.value)} className={'text-xs px-2 py-1 rounded-full border font-medium cursor-pointer ' + (estadoColor[p.estado] || '')}>
                      {ESTADOS.map(e => <option key={e} value={e}>{estadoLabel[e]}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={()=>handleDelete(p.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded transition-colors">
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
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">Registrar Paquete</h2>
              <button onClick={()=>setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {[
                {label:'Remitente',key:'remitente',ph:'Nombre del remitente'},
                {label:'Descripcion',key:'descripcion',ph:'Ej: Caja Amazon, Carta certificada'},
                {label:'Codigo de seguimiento',key:'codigo_seguimiento',ph:'Opcional'}
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{f.label}</label>
                  <input value={(form as any)[f.key]} onChange={e => setForm(prev => ({...prev, [f.key]: e.target.value}))} placeholder={f.ph} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Departamento destinatario</label>
                <select value={form.departamento_id} onChange={e => setForm(prev => ({...prev, departamento_id: e.target.value}))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                  <option value="">Sin asignar</option>
                  {departamentos.map((d:any) => <option key={d.id} value={d.id}>Depto {d.numero}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-slate-100">
              <button onClick={()=>setShowModal(false)} className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 text-sm">Cancelar</button>
              <button onClick={handleCreate} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">Registrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
