'use client'
import { useState, useEffect, useCallback } from 'react'

interface Incidencia {
  id: number
  titulo: string
  descripcion?: string
  tipo?: string
  prioridad: string
  estado: string
  departamento?: string
  residente_nombre?: string
  created_at: string
}

const PRIORIDAD_COLORS: Record<string, string> = {
  alta:   'bg-red-500/20 text-red-300 border-red-500/30',
  media:  'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  baja:   'bg-slate-600/60 text-slate-300 border-slate-500/30',
}

const ESTADO_COLORS: Record<string, string> = {
  abierta:    'bg-red-500/20 text-red-300',
  en_proceso: 'bg-yellow-500/20 text-yellow-300',
  resuelta:   'bg-emerald-500/20 text-emerald-300',
  cerrada:    'bg-slate-600/60 text-slate-400',
}

function formatDate(ts: string) {
  if (!ts) return ''
  try { return new Date(ts).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) } catch { return ts.slice(0, 10) }
}

export default function ConserjeIncidencias() {
  const [items, setItems] = useState<Incidencia[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'abierta' | 'en_proceso' | 'todos'>('abierta')
  const [acting, setActing] = useState<number | null>(null)
  const tid = () => localStorage.getItem('current_condominio_id') || '1'

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ tenant_id: tid(), limit: '30' })
      if (filtro !== 'todos') params.append('estado', filtro)
      const r = await fetch('/api/incidencias?' + params, { credentials: 'include' })
      if (r.ok) setItems(await r.json())
    } finally { setLoading(false) }
  }, [filtro])

  useEffect(() => { setLoading(true); load() }, [load])

  async function cambiarEstado(id: number, estado: string) {
    setActing(id)
    try {
      await fetch('/api/incidencias/' + id, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      })
      load()
    } finally { setActing(null) }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2">
        {(['abierta', 'en_proceso', 'todos'] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition ${filtro === f ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            {f === 'abierta' ? 'Abiertas' : f === 'en_proceso' ? 'En proceso' : 'Todas'}
          </button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /></div>}
      {!loading && items.length === 0 && <p className="text-center text-slate-500 py-12">Sin incidencias en este filtro</p>}

      <div className="space-y-3">
        {items.map(inc => (
          <div key={inc.id} className="bg-slate-800 border border-slate-700/50 rounded-2xl p-4">
            <div className="flex items-start justify-between mb-2 gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white truncate">{inc.titulo}</p>
                <p className="text-xs text-slate-400 mt-0.5">{inc.residente_nombre || ''} · Depto {inc.departamento || '—'}</p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold border ${PRIORIDAD_COLORS[inc.prioridad] || 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                  {inc.prioridad}
                </span>
                <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${ESTADO_COLORS[inc.estado] || 'bg-slate-700 text-slate-300'}`}>
                  {inc.estado.replace('_', ' ')}
                </span>
              </div>
            </div>
            {inc.descripcion && <p className="text-xs text-slate-400 mb-2 line-clamp-2">{inc.descripcion}</p>}
            <p className="text-xs text-slate-500 mb-3">{formatDate(inc.created_at)}</p>
            {(inc.estado === 'abierta' || inc.estado === 'en_proceso') && (
              <div className="flex gap-2">
                {inc.estado === 'abierta' && (
                  <button onClick={() => cambiarEstado(inc.id, 'en_proceso')} disabled={acting === inc.id}
                    className="flex-1 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 text-xs font-bold rounded-xl border border-yellow-500/30 transition">
                    Tomar incidencia
                  </button>
                )}
                <button onClick={() => cambiarEstado(inc.id, 'resuelta')} disabled={acting === inc.id}
                  className="flex-1 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold rounded-xl border border-emerald-500/30 transition">
                  Marcar resuelta
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
