'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePortalSession } from '../usePortalSession'

interface Incidencia {
  id: number
  titulo: string
  tipo: string
  prioridad: string
  estado: string
  created_at: string
  fecha_resolucion: string | null
  descripcion: string
}

const PRIORIDAD_COLOR: Record<string, string> = {
  baja: 'bg-slate-100 text-slate-600',
  normal: 'bg-blue-100 text-blue-700',
  alta: 'bg-orange-100 text-orange-700',
  urgente: 'bg-red-100 text-red-700',
}
const ESTADO_COLOR: Record<string, string> = {
  abierta: 'bg-yellow-100 text-yellow-700',
  en_proceso: 'bg-blue-100 text-blue-700',
  resuelta: 'bg-emerald-100 text-emerald-700',
  cerrada: 'bg-slate-100 text-slate-500',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function PortalIncidencias() {
  const router = useRouter()
  const { token, loading, logout, authFetch } = usePortalSession()
  const [items, setItems] = useState<Incidencia[]>([])
  const [fetching, setFetching] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ titulo: '', descripcion: '', tipo: 'general', prioridad: 'normal' })
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { if (!loading && !token) router.push('/portal/login') }, [loading, token, router])

  const load = () => {
    if (!token) return
    authFetch('/api/portal/mis-incidencias')
      .then(r => r.json())
      .then(setItems)
      .catch(() => {})
      .finally(() => setFetching(false))
  }

  useEffect(() => { load() }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true); setMsg('')
    try {
      const r = await authFetch('/api/portal/mis-incidencias', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      if (r.ok) {
        setMsg('Incidencia reportada exitosamente')
        setShowForm(false)
        setForm({ titulo: '', descripcion: '', tipo: 'general', prioridad: 'normal' })
        load()
      } else {
        const d = await r.json()
        setMsg(d.detail || 'Error al reportar')
      }
    } catch { setMsg('Error de conexión') }
    finally { setSending(false) }
  }

  if (loading || fetching) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white px-4 pt-8 pb-6">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-indigo-200 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-bold">Mis Incidencias</h1>
              <p className="text-indigo-200 text-xs">Reportar y seguir fallas</p>
            </div>
          </div>
          <button onClick={logout} className="text-indigo-200 hover:text-white text-xs">Salir</button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {msg && (
          <div className={`rounded-xl p-3 text-sm ${msg.includes('exitosamente') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
            {msg}
          </div>
        )}

        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
          </svg>
          Reportar nueva incidencia
        </button>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 space-y-4 shadow-sm border border-slate-100">
            <h3 className="font-semibold text-slate-800">Nueva incidencia</h3>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Título</label>
              <input value={form.titulo} onChange={e => setForm(f => ({...f, titulo: e.target.value}))}
                required maxLength={100} placeholder="Ej: Goteras en pasillo"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
              <textarea value={form.descripcion} onChange={e => setForm(f => ({...f, descripcion: e.target.value}))}
                required rows={3} placeholder="Describe el problema con detalle..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
                <select value={form.tipo} onChange={e => setForm(f => ({...f, tipo: e.target.value}))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option value="general">General</option>
                  <option value="estructura">Estructura</option>
                  <option value="instalaciones">Instalaciones</option>
                  <option value="areas_comunes">Áreas comunes</option>
                  <option value="seguridad">Seguridad</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Prioridad</label>
                <select value={form.prioridad} onChange={e => setForm(f => ({...f, prioridad: e.target.value}))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option value="baja">Baja</option>
                  <option value="normal">Normal</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-xl text-sm hover:bg-slate-50">
                Cancelar
              </button>
              <button type="submit" disabled={sending}
                className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-50">
                {sending ? 'Enviando...' : 'Reportar'}
              </button>
            </div>
          </form>
        )}

        {items.length === 0 && !showForm ? (
          <div className="text-center py-12 text-slate-400">
            <div className="text-4xl mb-3">🔧</div>
            <p className="font-medium">Sin incidencias reportadas</p>
            <p className="text-sm mt-1">Usa el botón de arriba para reportar un problema</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(inc => (
              <div key={inc.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-slate-800 text-sm leading-tight">{inc.titulo}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${ESTADO_COLOR[inc.estado] || 'bg-slate-100 text-slate-500'}`}>
                    {inc.estado.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-2 mb-3">{inc.descripcion}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORIDAD_COLOR[inc.prioridad] || 'bg-slate-100 text-slate-500'}`}>
                    {inc.prioridad}
                  </span>
                  <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">{inc.tipo}</span>
                  <span className="text-xs text-slate-400 ml-auto">{fmt(inc.created_at)}</span>
                </div>
                {inc.fecha_resolucion && (
                  <p className="text-xs text-emerald-600 mt-2">Resuelta: {fmt(inc.fecha_resolucion)}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex">
        {[
          {href:'/portal/dashboard', icon:'🏠', label:'Inicio'},
          {href:'/portal/cuenta', icon:'💰', label:'Cuenta'},
          {href:'/portal/mensajes', icon:'💬', label:'Mensajes'},
          {href:'/portal/incidencias', icon:'🔧', label:'Incidencias'},
          {href:'/portal/avisos', icon:'📢', label:'Avisos'},
        ].map(item => (
          <a key={item.href} href={item.href}
            className="flex-1 flex flex-col items-center py-2 text-slate-400 hover:text-indigo-600 transition-colors">
            <span className="text-xl">{item.icon}</span>
            <span className="text-[10px] mt-0.5">{item.label}</span>
          </a>
        ))}
      </nav>
    </div>
  )
}
