'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Conversacion {
  id: number
  canal: string
  contacto_telefono: string
  contacto_nombre: string
  estado: string
  ultima_interaccion: string
  tenant_id: number
}

interface Mensaje {
  id: number
  conversacion_id: number
  tipo: string
  contenido: string
  created_at: string
  direccion: string
}

const CANALES = [
  { key: 'todos',     label: 'Todos'     },
  { key: 'whatsapp',  label: 'WhatsApp'  },
  { key: 'instagram', label: 'Instagram' },
  { key: 'facebook',  label: 'Facebook'  },
  { key: 'telegram',  label: 'Telegram'  },
  { key: 'messenger', label: 'Messenger' },
  { key: 'tiktok',    label: 'TikTok'    },
  { key: 'email',     label: 'Email'     },
  { key: 'webchat',   label: 'WebChat'   },
]

export default function InboxPage() {
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([])
  const [activa, setActiva] = useState<Conversacion | null>(null)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const [nuevoMsg, setNuevoMsg] = useState('')
  const [tenantId, setTenantId] = useState<number | null>(null)

  useEffect(() => { cargarDatos() }, [])
  useEffect(() => { if (activa) cargarMensajes(activa.id) }, [activa])

  async function cargarDatos() {
    try {
      const r = await fetch('/api/auth/me', { credentials: 'include' })
      if (r.ok) {
        const u = await r.json()
        setTenantId(u.tenant_id)
        await cargarConvs(u.tenant_id)
      }
    } catch {}
    setLoading(false)
  }

  async function cargarConvs(tid: number) {
    try {
      const r = await fetch(`/api/whatsapp360/conversaciones?tenant_id=${tid}`, { credentials: 'include' })
      if (r.ok) {
        const data = await r.json()
        setConversaciones(data)
        if (data.length > 0 && !activa) setActiva(data[0])
      }
    } catch {}
  }

  async function cargarMensajes(convId: number) {
    if (!tenantId) return
    try {
      const r = await fetch(`/api/whatsapp360/mensajes/${convId}?tenant_id=${tenantId}`, { credentials: 'include' })
      if (r.ok) setMensajes(await r.json())
    } catch {}
  }

  async function enviarMensaje(e: React.FormEvent) {
    e.preventDefault()
    if (!activa || !nuevoMsg.trim() || !tenantId) return
    try {
      const r = await fetch('/api/whatsapp360/mensajes', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversacion_id: activa.id, tipo: 'texto', contenido: nuevoMsg.trim(), direccion: 'saliente', enviado_por: 'agente', tenant_id: tenantId }),
      })
      if (r.ok) { setNuevoMsg(''); cargarMensajes(activa.id) }
    } catch {}
  }

  const convsFiltradas = filtro === 'todos' ? conversaciones : conversaciones.filter(c => c.canal.toLowerCase() === filtro)

  const fmtDate = (s: string) => {
    const d = new Date(s), hoy = new Date()
    if (d.toDateString() === hoy.toDateString()) return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Sidebar conversaciones */}
      <div className="w-80 flex-shrink-0 border-r border-slate-700/50 flex flex-col bg-slate-900">
        {/* Header */}
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-sm font-bold text-white">Bandeja de Mensajes</h1>
            <Link href="/dashboard/ventas" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Volver</Link>
          </div>
          {/* Canal filters */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {CANALES.map(c => (
              <button key={c.key} onClick={() => setFiltro(c.key)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${
                  filtro === c.key ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-700/30">
          {convsFiltradas.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-600 text-sm">Sin conversaciones</p>
            </div>
          ) : convsFiltradas.map(conv => (
            <div key={conv.id} onClick={() => setActiva(conv)}
              className={`p-4 cursor-pointer hover:bg-slate-800 transition-colors ${activa?.id === conv.id ? 'bg-slate-800 border-l-2 border-l-blue-500' : ''}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-white truncate flex-1 pr-2">
                  {conv.contacto_nombre || conv.contacto_telefono}
                </p>
                <span className="text-xs text-slate-500 flex-shrink-0">{fmtDate(conv.ultima_interaccion)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 capitalize">{conv.canal}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${
                  conv.estado === 'activa' ? 'bg-emerald-500/20 text-emerald-400' :
                  conv.estado === 'pendiente' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-slate-700 text-slate-400'
                }`}>{conv.estado}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat panel */}
      <div className="flex-1 flex flex-col bg-slate-950">
        {activa ? (
          <>
            {/* Chat header */}
            <div className="px-5 py-3.5 border-b border-slate-700/50 flex items-center gap-3 bg-slate-900">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                {(activa.contacto_nombre || activa.contacto_telefono).charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{activa.contacto_nombre || activa.contacto_telefono}</p>
                <p className="text-xs text-slate-500 capitalize">{activa.canal} · {activa.estado}</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {mensajes.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-slate-600 text-sm">Sin mensajes aún</p>
                </div>
              ) : mensajes.map(msg => (
                <div key={msg.id} className={`flex ${msg.direccion === 'saliente' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-sm px-4 py-2.5 rounded-xl text-sm leading-relaxed ${
                    msg.direccion === 'saliente'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-slate-800 text-slate-200 border border-slate-700/50 rounded-bl-sm'
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.contenido}</p>
                    <p className={`text-xs mt-1 ${msg.direccion === 'saliente' ? 'text-blue-200' : 'text-slate-500'}`}>
                      {fmtDate(msg.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-slate-700/50 bg-slate-900">
              <form onSubmit={enviarMensaje} className="flex gap-3">
                <input type="text" value={nuevoMsg} onChange={e => setNuevoMsg(e.target.value)}
                  placeholder="Escribe un mensaje..."
                  className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none" />
                <button type="submit" disabled={!nuevoMsg.trim()}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors">
                  Enviar
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-600 text-sm">Selecciona una conversación</p>
          </div>
        )}
      </div>
    </div>
  )
}
