'use client'
import { useState, useEffect, useCallback } from 'react'

interface Reserva {
  id: number
  espacio_nombre?: string
  residente_nombre?: string
  departamento?: string
  fecha_inicio: string
  fecha_fin?: string
  estado: string
  observaciones?: string
}

function formatDT(ts: string) {
  if (!ts) return '—'
  try {
    const d = new Date(ts)
    return d.toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: 'short' }) + ' ' +
           d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
  } catch { return ts.slice(0, 16) }
}

const ESTADO_COLORS: Record<string, string> = {
  pendiente:  'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  aprobada:   'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  rechazada:  'bg-red-500/20 text-red-300 border-red-500/30',
  cancelada:  'bg-slate-600/60 text-slate-400 border-slate-500/30',
  completada: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
}

export default function ConserjeReservas() {
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'hoy' | 'pendiente' | 'todos'>('hoy')
  const tid = () => localStorage.getItem('current_condominio_id') || '1'

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ tenant_id: tid(), limit: '30' })
      if (filtro === 'hoy') {
        const hoy = new Date().toISOString().slice(0, 10)
        params.append('fecha', hoy)
      } else if (filtro === 'pendiente') {
        params.append('estado', 'pendiente')
      }
      const r = await fetch('/api/reservas?' + params, { credentials: 'include' })
      if (r.ok) setReservas(await r.json())
    } finally { setLoading(false) }
  }, [filtro])

  useEffect(() => { setLoading(true); load() }, [load])

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2">
        {(['hoy', 'pendiente', 'todos'] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold capitalize transition ${filtro === f ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            {f === 'hoy' ? 'Hoy' : f === 'pendiente' ? 'Pendientes' : 'Todos'}
          </button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" /></div>}
      {!loading && reservas.length === 0 && <p className="text-center text-slate-500 py-12">Sin reservas en este filtro</p>}

      <div className="space-y-3">
        {reservas.map(r => (
          <div key={r.id} className="bg-slate-800 border border-slate-700/50 rounded-2xl p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-bold text-white">{r.espacio_nombre || 'Espacio'}</p>
                <p className="text-sm text-slate-300">{r.residente_nombre || '—'} · Depto {r.departamento || '—'}</p>
              </div>
              <span className={`px-2.5 py-1 rounded-xl text-xs font-semibold border ${ESTADO_COLORS[r.estado] || 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                {r.estado}
              </span>
            </div>
            <div className="text-xs text-slate-400 space-y-0.5">
              <p>⏰ Inicio: <span className="text-slate-200">{formatDT(r.fecha_inicio)}</span></p>
              {r.fecha_fin && <p>⏰ Fin: <span className="text-slate-200">{formatDT(r.fecha_fin)}</span></p>}
              {r.observaciones && <p>📋 {r.observaciones}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
