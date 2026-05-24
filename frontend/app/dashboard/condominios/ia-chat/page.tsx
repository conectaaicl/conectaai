'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession } from '@/hooks/useSession'

interface Message {
  id: string
  role: 'user' | 'ai'
  tipo?: string
  texto?: string
  explicacion?: string
  datos?: Record<string, unknown>[]
  total?: number
  timestamp: Date
}

function SparkleIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M5 3l1.5 4.5L11 9l-4.5 1.5L5 15l-1.5-4.5L-1 9l4.5-1.5L5 3zM19 11l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  )
}

function DataTable({ datos }: { datos: Record<string, unknown>[] }) {
  if (!datos || datos.length === 0) return (
    <p className="text-slate-400 text-sm italic mt-2">Sin resultados</p>
  )
  const keys = Object.keys(datos[0])
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-slate-700">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-800">
            {keys.map(k => (
              <th key={k} className="px-3 py-2 text-left text-slate-300 font-semibold whitespace-nowrap">{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {datos.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-slate-900/50' : 'bg-slate-800/30'}>
              {keys.map(k => (
                <td key={k} className="px-3 py-2 text-slate-300 whitespace-nowrap max-w-[200px] truncate">
                  {String(row[k] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function IAChatPage() {
  const { user } = useSession()
  const tenantId = typeof window !== 'undefined' ? localStorage.getItem('current_condominio_id') : null
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sugerencias, setSugerencias] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!tenantId) return
    fetch('/api/ia/chat/sugerencias?tenant_id=' + tenantId)
      .then(r => r.json())
      .then(setSugerencias)
      .catch(() => {})
  }, [tenantId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(texto: string) {
    if (!texto.trim() || !tenantId || loading) return
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      texto,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/ia/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: parseInt(tenantId), mensaje: texto })
      })
      const data = await res.json()
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        tipo: data.tipo,
        texto: data.texto || data.explicacion || '',
        explicacion: data.explicacion,
        datos: data.datos,
        total: data.total,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, aiMsg])
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        tipo: 'error',
        texto: 'Error de conexion con el servidor',
        timestamp: new Date()
      }])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-full bg-slate-950" style={{ minHeight: 'calc(100vh - 56px)' }}>
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-slate-800/60"
        style={{ background: 'rgba(15,23,42,0.9)', backdropFilter: 'blur(8px)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-indigo-300"
            style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.3))', border: '1px solid rgba(99,102,241,0.4)' }}>
            <SparkleIcon />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-none">Asistente IA ConectaAI</h1>
            <p className="text-indigo-400 text-xs mt-0.5">Potenciado por Claude</p>
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full gap-6 py-16">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))', border: '1px solid rgba(99,102,241,0.3)' }}>
              <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-white text-lg font-semibold">Haz una pregunta sobre tu edificio</p>
              <p className="text-slate-400 text-sm mt-1">Consulta visitas, paquetes, multas, accesos y mas</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {(sugerencias.length > 0 ? sugerencias.slice(0, 4) : [
                'Visitas de hoy',
                'Paquetes pendientes',
                'Multas activas',
                'Accesos esta semana'
              ]).map((s, i) => (
                <button key={i} onClick={() => sendMessage(s)}
                  className="px-3 py-1.5 rounded-lg text-xs text-indigo-300 transition-all hover:text-white"
                  style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-indigo-600 text-white rounded-tr-sm'
                : msg.tipo === 'error'
                ? 'bg-red-900/40 border border-red-500/30 text-red-300 rounded-tl-sm'
                : 'bg-slate-800 text-slate-200 rounded-tl-sm'
            }`}
              style={msg.role === 'ai' && msg.tipo !== 'error' ? { border: '1px solid rgba(51,65,85,0.8)' } : {}}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.texto}</p>
              {msg.tipo === 'query' && msg.datos && (
                <div>
                  <p className="text-xs text-slate-400 mt-2">{msg.total} resultado{msg.total !== 1 ? 's' : ''}</p>
                  <DataTable datos={msg.datos} />
                </div>
              )}
              <p className={`text-xs mt-1.5 ${msg.role === 'user' ? 'text-indigo-200' : 'text-slate-500'}`}>
                {msg.timestamp.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3"
              style={{ border: '1px solid rgba(51,65,85,0.8)' }}>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-2 h-2 bg-indigo-400 rounded-full"
                      style={{ animation: 'bounce 1.2s ease infinite', animationDelay: i * 0.2 + 's' }} />
                  ))}
                </div>
                <span className="text-slate-400 text-xs">Consultando datos...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Sugerencias chips */}
      {!isEmpty && sugerencias.length > 0 && (
        <div className="shrink-0 px-4 pb-2 flex gap-2 overflow-x-auto">
          {sugerencias.slice(0, 5).map((s, i) => (
            <button key={i} onClick={() => setInput(s)}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs text-slate-300 transition-all hover:text-white whitespace-nowrap"
              style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(51,65,85,0.6)' }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="shrink-0 px-4 pb-4 pt-2" style={{ background: 'rgba(2,6,23,0.95)' }}>
        <div className="flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(51,65,85,0.8)' }}>
          <button className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 transition shrink-0">
            <MicIcon />
          </button>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu pregunta... ej: Visitas de hoy después de las 10 PM"
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder-slate-600"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="p-1.5 rounded-lg transition shrink-0 disabled:opacity-40"
            style={{ background: input.trim() && !loading ? 'rgba(99,102,241,0.8)' : 'rgba(30,41,59,0.5)', color: 'white' }}>
            <SendIcon />
          </button>
        </div>
        {!tenantId && (
          <p className="text-amber-400 text-xs mt-2 text-center">
            Selecciona un condominio primero para usar el asistente
          </p>
        )}
      </div>

      <style>{`
        @keyframes bounce {
          0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)}
        }
      `}</style>
    </div>
  )
}
