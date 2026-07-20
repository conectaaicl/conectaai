'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePortalSession } from '../usePortalSession'

interface Mensaje {
  id: number
  asunto: string
  mensaje: string
  respuesta: string | null
  respondido_por: string | null
  estado: string
  prioridad: string
  created_at: string
  respondido_at: string | null
  leido_residente: boolean
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function PortalMensajes() {
  const router = useRouter()
  const { token, loading, logout, authFetch } = usePortalSession()
  const [items, setItems] = useState<Mensaje[]>([])
  const [fetching, setFetching] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ asunto: '', mensaje: '', prioridad: 'normal' })
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => { if (!loading && !token) router.push('/portal/login') }, [loading, token, router])

  const load = () => {
    if (!token) return
    authFetch('/api/portal/mensajes')
      .then(r => r.json())
      .then(data => setItems(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setFetching(false))
  }

  useEffect(() => { load() }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true); setMsg('')
    try {
      const r = await authFetch('/api/portal/mensajes', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      if (r.ok) {
        setMsg('Mensaje enviado correctamente')
        setShowForm(false)
        setForm({ asunto: '', mensaje: '', prioridad: 'normal' })
        load()
      } else {
        const d = await r.json()
        setMsg(d.detail || 'Error al enviar')
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
              <h1 className="text-lg font-bold">Mensajes</h1>
              <p className="text-indigo-200 text-xs">Comunicación con administración</p>
            </div>
          </div>
          <button onClick={logout} className="text-indigo-200 hover:text-white text-xs">Salir</button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {msg && (
          <div className={`rounded-xl p-3 text-sm ${msg.includes('correctamente') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
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
          Nuevo mensaje
        </button>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 space-y-4 shadow-sm border border-slate-100">
            <h3 className="font-semibold text-slate-800">Nuevo mensaje a administración</h3>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Asunto</label>
              <input value={form.asunto} onChange={e => setForm(f => ({...f, asunto: e.target.value}))}
                required maxLength={200} placeholder="Tema del mensaje"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Mensaje</label>
              <textarea value={form.mensaje} onChange={e => setForm(f => ({...f, mensaje: e.target.value}))}
                required rows={4} placeholder="Escribe tu consulta o solicitud..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Prioridad</label>
              <select value={form.prioridad} onChange={e => setForm(f => ({...f, prioridad: e.target.value}))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                <option value="baja">Baja</option>
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-xl text-sm hover:bg-slate-50">
                Cancelar
              </button>
              <button type="submit" disabled={sending}
                className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-50">
                {sending ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </form>
        )}

        {items.length === 0 && !showForm ? (
          <div className="text-center py-12 text-slate-400">
            <div className="text-4xl mb-3">💬</div>
            <p className="font-medium">Sin mensajes</p>
            <p className="text-sm mt-1">Escribe a la administración usando el botón de arriba</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(item => (
              <div key={item.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {!item.leido_residente && item.respuesta && (
                          <span className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0"/>
                        )}
                        <h3 className="font-semibold text-slate-800 text-sm truncate">{item.asunto}</h3>
                      </div>
                      <p className="text-xs text-slate-400">{fmt(item.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.respuesta ? (
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Respondido</span>
                      ) : (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Pendiente</span>
                      )}
                      <svg className={`w-4 h-4 text-slate-400 transition-transform ${expanded === item.id ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                      </svg>
                    </div>
                  </div>
                </button>

                {expanded === item.id && (
                  <div className="px-4 pb-4 border-t border-slate-50">
                    <div className="mt-3 bg-slate-50 rounded-xl p-3">
                      <p className="text-xs font-medium text-slate-500 mb-1">Tu mensaje:</p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{item.mensaje}</p>
                    </div>
                    {item.respuesta && (
                      <div className="mt-3 bg-indigo-50 rounded-xl p-3 border-l-3 border-indigo-400">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-medium text-indigo-700">Respuesta de {item.respondido_por || 'Administración'}:</p>
                          {item.respondido_at && (
                            <p className="text-xs text-indigo-400">{fmt(item.respondido_at)}</p>
                          )}
                        </div>
                        <p className="text-sm text-indigo-800 whitespace-pre-wrap">{item.respuesta}</p>
                      </div>
                    )}
                  </div>
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
