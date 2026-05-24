'use client'
import { useState, useEffect, useCallback } from 'react'

interface Paquete {
  id: number
  residente_nombre?: string
  residente_id?: number
  depto?: string
  descripcion?: string
  tipo?: string
  remitente?: string
  estado: string
  creado_en: string
  entregado_en?: string
}

function formatDate(ts?: string) {
  if (!ts) return '—'
  try { return new Date(ts).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) } catch { return ts.slice(0, 10) }
}

export default function ConserjePaquetes() {
  const [paquetes, setPaquetes] = useState<Paquete[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'pendiente' | 'entregado' | 'todos'>('pendiente')
  const [acting, setActing] = useState<number | null>(null)
  const [form, setForm] = useState(false)
  const [nuevo, setNuevo] = useState({ depto: '', descripcion: '', remitente: '', tipo: 'paquete' })
  const tid = () => localStorage.getItem('current_condominio_id') || '1'

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ tenant_id: tid(), limit: '40' })
      if (filtro !== 'todos') params.append('estado', filtro)
      const r = await fetch('/api/paquetes?' + params, { credentials: 'include' })
      if (r.ok) setPaquetes(await r.json())
    } finally { setLoading(false) }
  }, [filtro])

  useEffect(() => { setLoading(true); load() }, [load])

  async function marcarEntregado(id: number) {
    setActing(id)
    try {
      const r = await fetch('/api/paquetes/' + id + '/entregar', { method: 'POST', credentials: 'include' })
      if (r.ok) load()
    } finally { setActing(null) }
  }

  async function registrar() {
    const r = await fetch('/api/paquetes', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...nuevo, tenant_id: parseInt(tid()), estado: 'pendiente' }),
    })
    if (r.ok) { setForm(false); setNuevo({ depto: '', descripcion: '', remitente: '', tipo: 'paquete' }); load() }
  }

  const TIPO_ICONS: Record<string, string> = { paquete: '📦', sobre: '✉️', encomienda: '🗃️', otro: '📬' }

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2 items-center">
        {(['pendiente', 'entregado', 'todos'] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold capitalize transition ${filtro === f ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <button onClick={() => setForm(true)}
          className="w-10 h-10 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white flex items-center justify-center text-xl transition">+</button>
      </div>

      {/* Formulario registro */}
      {form && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
          <h3 className="font-bold text-white">Registrar paquete</h3>
          <input value={nuevo.depto} onChange={e => setNuevo({ ...nuevo, depto: e.target.value })}
            placeholder="Departamento destino" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500" />
          <input value={nuevo.remitente} onChange={e => setNuevo({ ...nuevo, remitente: e.target.value })}
            placeholder="Remitente / empresa" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500" />
          <input value={nuevo.descripcion} onChange={e => setNuevo({ ...nuevo, descripcion: e.target.value })}
            placeholder="Descripción (opcional)" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500" />
          <select value={nuevo.tipo} onChange={e => setNuevo({ ...nuevo, tipo: e.target.value })}
            className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white">
            <option value="paquete">Paquete</option>
            <option value="sobre">Sobre</option>
            <option value="encomienda">Encomienda</option>
            <option value="otro">Otro</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={registrar} className="py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold">Registrar</button>
            <button onClick={() => setForm(false)} className="py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm font-bold">Cancelar</button>
          </div>
        </div>
      )}

      {loading && <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>}
      {!loading && paquetes.length === 0 && <p className="text-center text-slate-500 py-12">Sin paquetes en este filtro</p>}

      <div className="space-y-3">
        {paquetes.map(p => (
          <div key={p.id} className={`border rounded-2xl p-4 transition ${p.estado === 'pendiente' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-800 border-slate-700/50'}`}>
            <div className="flex items-start gap-3">
              <div className="text-3xl flex-shrink-0">{TIPO_ICONS[p.tipo || 'paquete'] || '📦'}</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white">Depto {p.depto || p.residente_nombre || '—'}</p>
                {p.remitente && <p className="text-xs text-slate-400 mt-0.5">De: {p.remitente}</p>}
                {p.descripcion && <p className="text-xs text-slate-400">{p.descripcion}</p>}
                <p className="text-xs text-slate-500 mt-1">Llegó: {formatDate(p.creado_en)}</p>
                {p.entregado_en && <p className="text-xs text-emerald-400">Entregado: {formatDate(p.entregado_en)}</p>}
              </div>
              {p.estado === 'pendiente' && (
                <button onClick={() => marcarEntregado(p.id)} disabled={acting === p.id}
                  className="flex-shrink-0 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition">
                  Entregado
                </button>
              )}
              {p.estado === 'entregado' && (
                <span className="flex-shrink-0 px-2 py-1 bg-emerald-500/20 text-emerald-300 text-xs rounded-lg">✓</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
