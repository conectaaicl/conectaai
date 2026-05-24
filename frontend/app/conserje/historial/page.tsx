'use client'
import { useState, useEffect, useCallback } from 'react'

interface Evento {
  id: number | string
  fuente: string
  nombre: string
  depto?: string
  accion: string
  puerta?: string
  timestamp: string
  estado: string
}

function formatDT(ts: string) {
  if (!ts) return '—'
  try {
    const d = new Date(ts)
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' }) + ' ' +
           d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch { return ts.slice(0, 19) }
}

export default function ConserjeHistorial() {
  const [eventos, setEventos] = useState<Evento[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const LIMIT = 30
  const tid = () => localStorage.getItem('current_condominio_id') || '1'

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/accesos/live?tenant_id=' + tid() + '&limit=' + LIMIT + '&offset=' + (page * LIMIT), { credentials: 'include' })
      if (r.ok) setEventos(await r.json())
    } finally { setLoading(false) }
  }, [page])

  useEffect(() => { setLoading(true); load() }, [load])

  return (
    <div className="p-4 space-y-4">
      {loading && <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>}

      {!loading && eventos.length === 0 && <p className="text-center text-slate-500 py-12">Sin eventos registrados</p>}

      <div className="space-y-2">
        {eventos.map((e, i) => {
          const entrada = e.accion?.includes('entra') || e.accion === 'entrada'
          const ok = e.estado !== 'denegado'
          return (
            <div key={e.id || i} className="bg-slate-800 border border-slate-700/50 rounded-xl p-3 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 font-bold ${ok ? (entrada ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400') : 'bg-red-500/20 text-red-400'}`}>
                {ok ? (entrada ? '→' : '←') : '✗'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-white truncate">{e.nombre || 'Desconocido'}</p>
                <p className="text-xs text-slate-400 truncate">{e.puerta || e.fuente}{e.depto ? ' · Depto ' + e.depto : ''}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-slate-400">{formatDT(e.timestamp)}</p>
                <p className={`text-xs font-semibold mt-0.5 ${ok ? 'text-emerald-400' : 'text-red-400'}`}>
                  {ok ? e.accion || 'OK' : 'Denegado'}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex gap-2 pt-2">
        <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
          className="flex-1 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-400 disabled:opacity-30 hover:text-white transition">
          ← Anterior
        </button>
        <button onClick={() => setPage(p => p + 1)} disabled={eventos.length < LIMIT}
          className="flex-1 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-400 disabled:opacity-30 hover:text-white transition">
          Siguiente →
        </button>
      </div>
    </div>
  )
}
