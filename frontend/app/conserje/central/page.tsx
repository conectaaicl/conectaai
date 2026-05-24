'use client'
import { useState, useEffect, useCallback } from 'react'

interface Puerta {
  id: number
  nombre: string
  ubicacion: string
  tipo: string
  estado: string
  modo: string
  activa: boolean
}

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

interface Visita {
  id: number
  nombre_visitante: string
  depto_destino?: string
  estado: string
  creado_en: string
}

interface Paquete {
  id: number
  residente_nombre?: string
  depto?: string
  descripcion?: string
  estado: string
  creado_en: string
}

const ESTADO_PUERTA: Record<string, { label: string; color: string; dot: string }> = {
  libre_paso: { label: 'Paso Libre', color: 'bg-blue-500/10 border-blue-500/40 text-blue-300', dot: 'bg-blue-400 animate-pulse' },
  bloqueada:  { label: 'Bloqueada',  color: 'bg-red-500/10 border-red-500/40 text-red-300',   dot: 'bg-red-400' },
  abierta:  { label: 'Abierta',   color: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300', dot: 'bg-emerald-400 animate-pulse' },
  cerrada:  { label: 'Cerrada',   color: 'bg-slate-700/60 border-slate-600/40 text-slate-300',       dot: 'bg-slate-500' },
  error:    { label: 'Error',     color: 'bg-red-500/10 border-red-500/40 text-red-300',              dot: 'bg-red-400 animate-pulse' },
  unknown:  { label: 'Sin señal', color: 'bg-yellow-500/10 border-yellow-500/40 text-yellow-300',    dot: 'bg-yellow-400' },
}

export default function CentralConserje() {
  const [puertas, setPuertas] = useState<Puerta[]>([])
  const [eventos, setEventos] = useState<Evento[]>([])
  const [visitas, setVisitas] = useState<Visita[]>([])
  const [paquetes, setPaquetes] = useState<Paquete[]>([])
  const [alertCount, setAlertCount] = useState(0)
  const [comandando, setComandando] = useState<number | null>(null)
  const [cmdResult, setCmdResult] = useState<{ id: number; ok: boolean; msg: string } | null>(null)
  const [tab, setTab] = useState<'puertas' | 'visitas' | 'eventos'>('puertas')
  const [loading, setLoading] = useState(true)

  const tid = () => typeof window !== 'undefined' ? (localStorage.getItem('current_condominio_id') || '1') : '1'

  const loadData = useCallback(async () => {
    try {
      const t = tid()
      const [pRes, eRes, vRes, pqRes, aRes] = await Promise.allSettled([
        fetch('/api/condominios/puertas?tenant_id=' + t, { credentials: 'include' }),
        fetch('/api/accesos/live?tenant_id=' + t + '&limit=12', { credentials: 'include' }),
        fetch('/api/visitas?tenant_id=' + t + '&estado=pendiente&limit=8', { credentials: 'include' }),
        fetch('/api/paquetes?tenant_id=' + t + '&estado=pendiente&limit=8', { credentials: 'include' }),
        fetch('/api/alertas-sistema?tenant_id=' + t + '&limit=5', { credentials: 'include' }),
      ])
      if (pRes.status === 'fulfilled' && pRes.value.ok) setPuertas(await pRes.value.json())
      if (eRes.status === 'fulfilled' && eRes.value.ok) setEventos(await eRes.value.json())
      if (vRes.status === 'fulfilled' && vRes.value.ok) setVisitas(await vRes.value.json())
      if (pqRes.status === 'fulfilled' && pqRes.value.ok) setPaquetes(await pqRes.value.json())
      if (aRes.status === 'fulfilled' && aRes.value.ok) {
        const alerts = await aRes.value.json()
        setAlertCount(Array.isArray(alerts) ? alerts.length : 0)
      }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    loadData()
    const iv = setInterval(loadData, 15000)
    return () => clearInterval(iv)
  }, [loadData])

  async function comando(puertaId: number, accion: string) {
    setComandando(puertaId)
    try {
      const r = await fetch('/api/condominios/puertas/' + puertaId + '/comando', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion }),
      })
      const data = await r.json()
      setCmdResult({ id: puertaId, ok: r.ok, msg: data.mensaje || (r.ok ? 'Ejecutado' : 'Error') })
      setTimeout(() => setCmdResult(null), 3000)
      setTimeout(loadData, 1500)
    } finally { setComandando(null) }
  }

  function formatTime(ts: string) {
    if (!ts) return ''
    try { return new Date(ts).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) } catch { return ts.slice(11, 16) }
  }

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      {/* Toast */}
      {cmdResult && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-2xl text-sm font-semibold transition-all
          ${cmdResult.ok ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
          {cmdResult.ok ? '✓' : '✗'} {cmdResult.msg}
        </div>
      )}

      {alertCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
          <svg className="w-5 h-5 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm font-semibold text-amber-300">{alertCount} alerta{alertCount > 1 ? 's' : ''} activa{alertCount > 1 ? 's' : ''}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-800">
        {[
          { key: 'puertas', label: 'Puertas', count: puertas.length },
          { key: 'visitas', label: 'Visitas', count: visitas.length },
          { key: 'eventos', label: 'Accesos', count: eventos.length },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`flex-1 py-3 text-sm font-medium transition relative ${tab === t.key ? 'text-emerald-400' : 'text-slate-400 hover:text-white'}`}>
            {t.label}
            {t.count > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-md text-xs ${tab === t.key ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-400'}`}>{t.count}</span>
            )}
            {tab === t.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full" />}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* PUERTAS */}
      {!loading && tab === 'puertas' && (
        <div className="space-y-4">
          {puertas.length === 0 && <p className="text-center text-slate-500 py-12">No hay puertas configuradas</p>}
          {puertas.map(p => {
            const st = (p.modo && ESTADO_PUERTA[p.modo]) ? ESTADO_PUERTA[p.modo] : (ESTADO_PUERTA[p.estado] || ESTADO_PUERTA.unknown)
            const busy = comandando === p.id
            return (
              <div key={p.id} className={`border rounded-2xl p-5 ${st.color}`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${st.dot}`} />
                      <h3 className="font-bold text-lg">{p.nombre}</h3>
                    </div>
                    <p className="text-xs opacity-70 ml-5.5 mt-0.5">{p.ubicacion} · {st.label} · <span className="capitalize">{p.tipo}</span></p>
                  </div>
                </div>
                {/* 2x2 touch buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => comando(p.id, 'libre_paso')} disabled={busy}
                    className="flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40 text-white font-bold transition-all active:scale-95 shadow-lg shadow-blue-900/40">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                    <span className="text-xs font-bold">{busy ? '...' : 'Paso Libre'}</span>
                  </button>
                  <button onClick={() => comando(p.id, 'abrir')} disabled={busy}
                    className="flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-40 text-white font-bold transition-all active:scale-95 shadow-lg shadow-emerald-900/40">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs font-bold">{busy ? '...' : 'Abrir'}</span>
                  </button>
                  <button onClick={() => comando(p.id, 'cerrar')} disabled={busy}
                    className="flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl bg-slate-600 hover:bg-slate-500 active:bg-slate-700 disabled:opacity-40 text-white font-bold transition-all active:scale-95 shadow-lg shadow-black/30">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zM10 7a2 2 0 114 0v3H10V7z" />
                    </svg>
                    <span className="text-xs font-bold">{busy ? '...' : 'Cerrar'}</span>
                  </button>
                  <button onClick={() => comando(p.id, 'bloquear')} disabled={busy}
                    className="flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl bg-rose-700 hover:bg-rose-600 active:bg-rose-800 disabled:opacity-40 text-white font-bold transition-all active:scale-95 shadow-lg shadow-red-900/40">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    <span className="text-xs font-bold">{busy ? '...' : 'Bloquear'}</span>
                  </button>
                </div>
              </div>
            )
          })}

          {/* Paquetes pendientes */}
          {paquetes.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
              <h3 className="font-semibold text-amber-300 mb-3 flex items-center gap-2 text-sm">
                📦 Paquetes pendientes de entrega ({paquetes.length})
              </h3>
              <div className="space-y-2">
                {paquetes.slice(0, 4).map(pkg => (
                  <div key={pkg.id} className="flex items-center justify-between text-sm">
                    <span className="text-amber-200 font-medium">{pkg.residente_nombre || 'Residente'} · Depto {pkg.depto || '—'}</span>
                    <span className="text-amber-400/70 text-xs">{formatTime(pkg.creado_en)}</span>
                  </div>
                ))}
                {paquetes.length > 4 && <p className="text-amber-400/60 text-xs">+{paquetes.length - 4} más</p>}
              </div>
            </div>
          )}

          <p className="text-center text-xs text-slate-600 pt-2">Auto-actualiza cada 15 segundos</p>
        </div>
      )}

      {/* VISITAS */}
      {!loading && tab === 'visitas' && (
        <div className="space-y-3">
          {visitas.length === 0 && <p className="text-center text-slate-500 py-12">Sin visitas pendientes de autorización</p>}
          {visitas.map(v => (
            <div key={v.id} className="bg-slate-800 border border-slate-700/50 rounded-2xl p-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-white">{v.nombre_visitante}</p>
                <p className="text-sm text-slate-400 mt-0.5">Depto {v.depto_destino || '—'} · {formatTime(v.creado_en)}</p>
              </div>
              <span className="px-3 py-1.5 bg-yellow-500/20 text-yellow-300 text-xs rounded-xl font-semibold border border-yellow-500/30 whitespace-nowrap">
                Pendiente
              </span>
            </div>
          ))}
        </div>
      )}

      {/* EVENTOS */}
      {!loading && tab === 'eventos' && (
        <div className="space-y-2">
          {eventos.length === 0 && <p className="text-center text-slate-500 py-12">Sin eventos recientes</p>}
          {eventos.map((e, i) => {
            const ok = e.estado !== 'denegado'
            return (
              <div key={e.id || i} className="bg-slate-800 border border-slate-700/50 rounded-xl p-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base font-bold flex-shrink-0 ${ok ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  {ok ? '→' : '✗'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-white truncate">{e.nombre || 'Desconocido'}</p>
                  <p className="text-xs text-slate-400 truncate">{e.puerta || e.fuente}{e.depto ? ' · Depto ' + e.depto : ''}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-slate-400">{formatTime(e.timestamp)}</p>
                  <p className={`text-xs font-semibold mt-0.5 ${ok ? 'text-emerald-400' : 'text-red-400'}`}>
                    {ok ? e.accion || 'OK' : 'Denegado'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
