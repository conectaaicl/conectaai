'use client'
import { useState, useEffect, useCallback } from 'react'

interface AccesoQR {
  id: number
  residente_nombre: string
  departamento?: string
  qr_code?: string
  estado: string
  valido_hasta?: string
  ultimo_uso?: string
}

function formatDate(ts?: string) {
  if (!ts) return '—'
  try { return new Date(ts).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit' }) } catch { return ts.slice(0, 10) }
}

export default function ConserjeAccesos() {
  const [accesos, setAccesos] = useState<AccesoQR[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const tid = () => localStorage.getItem('current_condominio_id') || '1'

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/accesos?tenant_id=' + tid() + '&limit=50', { credentials: 'include' })
      if (r.ok) setAccesos(await r.json())
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = accesos.filter(a =>
    !search || a.residente_nombre?.toLowerCase().includes(search.toLowerCase()) || a.departamento?.includes(search)
  )

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre o depto..."
          className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
        />
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <p className="text-center text-slate-500 py-12">Sin accesos QR registrados</p>
      )}

      <div className="space-y-2">
        {filtered.map(a => (
          <div key={a.id} className="bg-slate-800 border border-slate-700/50 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500/20 border border-emerald-500/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white text-sm truncate">{a.residente_nombre}</p>
              <p className="text-xs text-slate-400 mt-0.5">Depto {a.departamento || '—'}</p>
              {a.ultimo_uso && <p className="text-xs text-slate-500 mt-0.5">Último uso: {formatDate(a.ultimo_uso)}</p>}
            </div>
            <div className="text-right flex-shrink-0">
              <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${a.estado === 'activo' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                {a.estado === 'activo' ? '✓ Activo' : a.estado}
              </span>
              {a.valido_hasta && <p className="text-xs text-slate-500 mt-1">Vence: {formatDate(a.valido_hasta)}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
