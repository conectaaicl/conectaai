'use client'
import { useState, useEffect, useCallback } from 'react'

interface Visita {
  id: number
  nombre_visitante: string
  rut_visitante?: string
  depto_destino?: string
  motivo?: string
  vehiculo_patente?: string
  estado: string
  creado_en: string
  aprobado_por?: string
}

function formatDateTime(ts: string) {
  if (!ts) return '—'
  try {
    const d = new Date(ts)
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' }) + ' ' +
           d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
  } catch { return ts.slice(0, 16) }
}

const ESTADO_COLORS: Record<string, string> = {
  pendiente: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  aprobado:  'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  ingresado: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  rechazado: 'bg-red-500/20 text-red-300 border-red-500/30',
  salida:    'bg-slate-600/60 text-slate-300 border-slate-500/30',
}

export default function ConserjeVisitas() {
  const [visitas, setVisitas] = useState<Visita[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'pendiente' | 'aprobado' | 'todos'>('pendiente')
  const [acting, setActing] = useState<number | null>(null)
  const tid = () => localStorage.getItem('current_condominio_id') || '1'

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ tenant_id: tid(), limit: '30' })
      if (filtro !== 'todos') params.append('estado', filtro)
      const r = await fetch('/api/visitas?' + params, { credentials: 'include' })
      if (r.ok) setVisitas(await r.json())
    } finally { setLoading(false) }
  }, [filtro])

  useEffect(() => { setLoading(true); load(); const iv = setInterval(load, 15000); return () => clearInterval(iv) }, [load])

  async function accion(id: number, estado: string) {
    setActing(id)
    try {
      const r = await fetch('/api/visitas/' + id, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      })
      if (r.ok) load()
    } finally { setActing(null) }
  }

  return (
    <div className="p-4 space-y-4">
      {/* Filtros */}
      <div className="flex gap-2">
        {(['pendiente', 'aprobado', 'todos'] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold capitalize transition ${filtro === f ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            {f === 'todos' ? 'Todos' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>}

      {!loading && visitas.length === 0 && <p className="text-center text-slate-500 py-12">Sin visitas en este filtro</p>}

      <div className="space-y-3">
        {visitas.map(v => (
          <div key={v.id} className="bg-slate-800 border border-slate-700/50 rounded-2xl p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-bold text-white">{v.nombre_visitante}</p>
                {v.rut_visitante && <p className="text-xs text-slate-400">RUT: {v.rut_visitante}</p>}
              </div>
              <span className={`px-2.5 py-1 rounded-xl text-xs font-semibold border ${ESTADO_COLORS[v.estado] || 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                {v.estado}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 mb-3">
              <span>🏠 Depto: <span className="text-slate-200">{v.depto_destino || '—'}</span></span>
              {v.vehiculo_patente && <span>🚗 Patente: <span className="text-slate-200">{v.vehiculo_patente}</span></span>}
              {v.motivo && <span className="col-span-2">📋 {v.motivo}</span>}
              <span className="col-span-2">🕐 {formatDateTime(v.creado_en)}</span>
            </div>

            {v.estado === 'pendiente' && (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => accion(v.id, 'ingresado')} disabled={acting === v.id}
                  className="py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white text-sm font-bold transition active:scale-95">
                  ✓ Permitir entrada
                </button>
                <button onClick={() => accion(v.id, 'rechazado')} disabled={acting === v.id}
                  className="py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 text-sm font-bold transition active:scale-95 border border-red-500/30">
                  ✗ Rechazar
                </button>
              </div>
            )}
            {v.estado === 'ingresado' && (
              <button onClick={() => accion(v.id, 'salida')} disabled={acting === v.id}
                className="w-full py-2.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-sm font-bold transition border border-blue-500/30">
                Registrar salida
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
