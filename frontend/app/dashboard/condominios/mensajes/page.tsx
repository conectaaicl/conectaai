'use client'
import { useState, useEffect } from 'react'
import { useSession } from '@/hooks/useSession'

interface Mensaje {
  id: number
  depto_numero: string | null
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

const ESTADO_COLOR: Record<string, string> = {
  abierto: 'bg-yellow-100 text-yellow-700',
  respondido: 'bg-emerald-100 text-emerald-700',
  cerrado: 'bg-slate-100 text-slate-500',
}
const PRIORIDAD_COLOR: Record<string, string> = {
  baja: 'bg-slate-100 text-slate-500',
  normal: 'bg-blue-100 text-blue-700',
  alta: 'bg-orange-100 text-orange-700',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })
}

export default function AdminMensajesPage() {
  const { tenantId } = useSession()
  const [items, setItems] = useState<Mensaje[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [selected, setSelected] = useState<Mensaje | null>(null)
  const [respuesta, setRespuesta] = useState('')
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')

  const load = () => {
    const est = filtroEstado ? `&estado=${filtroEstado}` : ''
    fetch(`/api/portal/mensajes/admin/todos?tenant_id=${tenantId}${est}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => { setItems(data.items || []); setTotal(data.total || 0) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { if (tenantId) load() }, [tenantId, filtroEstado])

  const handleResponder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected || !respuesta.trim()) return
    setSending(true); setMsg('')
    try {
      const r = await fetch(`/api/portal/mensajes/${selected.id}/responder`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respuesta, estado: 'respondido' }),
      })
      if (r.ok) {
        setMsg('Respuesta enviada')
        setSelected(null)
        setRespuesta('')
        load()
      } else {
        const d = await r.json()
        setMsg(d.detail || 'Error al responder')
      }
    } catch { setMsg('Error de conexión') }
    finally { setSending(false) }
  }

  const pendientes = items.filter(i => !i.respuesta).length

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Mensajes Residentes</h1>
          <p className="text-slate-400 text-sm mt-1">{total} mensajes · {pendientes} sin responder</p>
        </div>
        <div className="flex gap-2">
          {['', 'abierto', 'respondido', 'cerrado'].map(est => (
            <button key={est} onClick={() => setFiltroEstado(est)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filtroEstado === est ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
              {est === '' ? 'Todos' : est.charAt(0).toUpperCase() + est.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {msg && (
        <div className={`rounded-xl p-3 text-sm ${msg.includes('enviada') ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-700' : 'bg-red-900/30 text-red-400 border border-red-700'}`}>
          {msg}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <div className="text-5xl mb-3">💬</div>
          <p className="font-medium text-slate-300">Sin mensajes</p>
          <p className="text-sm mt-1">Los mensajes de residentes aparecerán aquí</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {items.map(item => (
            <div key={item.id} className={`bg-slate-800 border rounded-xl p-5 space-y-3 transition-colors ${!item.respuesta ? 'border-yellow-600/50' : 'border-slate-700'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.depto_numero && (
                      <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full font-mono">
                        Depto {item.depto_numero}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORIDAD_COLOR[item.prioridad] || 'bg-slate-100 text-slate-500'}`}>
                      {item.prioridad}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADO_COLOR[item.estado] || 'bg-slate-100 text-slate-500'}`}>
                      {item.estado}
                    </span>
                  </div>
                  <h3 className="font-semibold text-slate-100 mt-2 text-sm">{item.asunto}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{fmt(item.created_at)}</p>
                </div>
              </div>

              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-1">Mensaje:</p>
                <p className="text-sm text-slate-200 whitespace-pre-wrap">{item.mensaje}</p>
              </div>

              {item.respuesta && (
                <div className="bg-indigo-900/30 border border-indigo-700/50 rounded-lg p-3">
                  <p className="text-xs text-indigo-400 mb-1">Respondido por {item.respondido_por}:</p>
                  <p className="text-sm text-indigo-200 whitespace-pre-wrap">{item.respuesta}</p>
                </div>
              )}

              {!item.respuesta && (
                <button
                  onClick={() => { setSelected(item); setRespuesta(''); setMsg('') }}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
                  </svg>
                  Responder
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal respuesta */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg bg-slate-800 rounded-2xl shadow-2xl border border-slate-700">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h2 className="font-semibold text-slate-100">Responder mensaje</h2>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <form onSubmit={handleResponder} className="p-6 space-y-4">
              <div>
                <p className="text-xs text-slate-400 mb-1">Asunto:</p>
                <p className="text-sm font-medium text-slate-200">{selected.asunto}</p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-1">Mensaje del residente:</p>
                <p className="text-sm text-slate-200 whitespace-pre-wrap">{selected.mensaje}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Tu respuesta</label>
                <textarea value={respuesta} onChange={e => setRespuesta(e.target.value)}
                  required rows={4}
                  placeholder="Escribe la respuesta al residente..."
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"/>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setSelected(null)}
                  className="flex-1 border border-slate-600 text-slate-300 py-2 rounded-xl text-sm hover:bg-slate-700">
                  Cancelar
                </button>
                <button type="submit" disabled={sending}
                  className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-indigo-700">
                  {sending ? 'Enviando...' : 'Enviar respuesta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
