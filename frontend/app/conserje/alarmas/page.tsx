'use client'
import { useState, useEffect, useCallback } from 'react'

interface Zona {
  id: number
  nombre: string
  descripcion?: string
  tipo: string
  estado: string
  activa: boolean
}

interface Alerta {
  id: number
  zona_nombre?: string
  tipo: string
  descripcion?: string
  nivel: string
  resuelta: boolean
  created_at: string
}

const ZONA_ESTADO: Record<string, { label: string; bg: string; border: string; text: string; dot: string }> = {
  armada:   { label: 'Armada',    bg: 'bg-red-500/10',     border: 'border-red-500/40',     text: 'text-red-300',    dot: 'bg-red-400 animate-pulse' },
  desarmada:{ label: 'Desarmada', bg: 'bg-slate-800',       border: 'border-slate-700/60',  text: 'text-slate-300',  dot: 'bg-slate-500' },
  parcial:  { label: 'Parcial',   bg: 'bg-yellow-500/10',  border: 'border-yellow-500/40',  text: 'text-yellow-300', dot: 'bg-yellow-400' },
}

const NIVEL_COLORS: Record<string, string> = {
  baja:    'bg-slate-700 text-slate-300',
  media:   'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
  alta:    'bg-orange-500/20 text-orange-300 border border-orange-500/30',
  critica: 'bg-red-500/20 text-red-300 border border-red-500/30 animate-pulse',
}

export default function ConserjeAlarmas() {
  const [zonas, setZonas] = useState<Zona[]>([])
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [tab, setTab] = useState<'zonas' | 'alertas'>('alertas')

  const tid = () => typeof window !== 'undefined' ? (localStorage.getItem('current_condominio_id') || '1') : '1'

  const load = useCallback(async () => {
    try {
      const t = tid()
      const [zRes, aRes] = await Promise.allSettled([
        fetch('/api/alarmas/zonas?tenant_id=' + t, { credentials: 'include' }),
        fetch('/api/alarmas/alertas?tenant_id=' + t + '&resuelta=false&limit=30', { credentials: 'include' }),
      ])
      if (zRes.status === 'fulfilled' && zRes.value.ok) setZonas(await zRes.value.json())
      if (aRes.status === 'fulfilled' && aRes.value.ok) setAlertas(await aRes.value.json())
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    load()
    const iv = setInterval(load, 20000)
    return () => clearInterval(iv)
  }, [load])

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 4000)
  }

  async function armar(zonaId: number, estado: string) {
    setBusy(zonaId)
    try {
      const r = await fetch('/api/alarmas/zonas/' + zonaId + '/estado', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado, tenant_id: Number(tid()) }),
      })
      const d = await r.json()
      showToast(r.ok, d.zona ? d.zona + ' → ' + d.estado : (r.ok ? 'OK' : 'Error'))
      setTimeout(load, 800)
    } finally { setBusy(null) }
  }

  async function panico() {
    if (!confirm('Confirma activar alerta de PANICO?')) return
    const r = await fetch('/api/alarmas/panico?tenant_id=' + tid(), {
      method: 'POST', credentials: 'include',
    })
    const d = await r.json()
    showToast(r.ok, d.mensaje || (r.ok ? 'Panico activado' : 'Error'))
    setTimeout(load, 800)
  }

  async function resolver(alertaId: number) {
    const r = await fetch('/api/alarmas/alertas/' + alertaId + '/resolver', {
      method: 'PATCH', credentials: 'include',
    })
    if (r.ok) {
      showToast(true, 'Alerta resuelta')
      setTimeout(load, 500)
    }
  }

  function formatTime(ts: string) {
    if (!ts) return ''
    try { return new Date(ts).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) } catch { return ts }
  }

  const alertasActivas = alertas.filter(a => !a.resuelta)
  const hasCriticas = alertasActivas.some(a => a.nivel === 'critica' || a.nivel === 'alta')

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-2xl text-sm font-semibold transition-all ${toast.ok ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast.ok ? '✓' : '✗'} {toast.msg}
        </div>
      )}

      {hasCriticas && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/40 rounded-2xl animate-pulse">
          <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm font-bold text-red-300">ALERTA CRITICA ACTIVA — revisar inmediatamente</p>
        </div>
      )}

      {/* Panico button */}
      <button
        onClick={panico}
        className="w-full py-4 rounded-2xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold text-lg transition-all active:scale-95 shadow-lg shadow-red-900/50 flex items-center justify-center gap-3"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        BOTON DE PANICO
      </button>

      {/* Tabs */}
      <div className="flex border-b border-slate-800">
        {[
          { key: 'alertas', label: 'Alertas activas', count: alertasActivas.length },
          { key: 'zonas', label: 'Zonas', count: zonas.length },
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

      {/* ALERTAS */}
      {!loading && tab === 'alertas' && (
        <div className="space-y-3">
          {alertasActivas.length === 0 && (
            <div className="text-center py-12">
              <p className="text-2xl mb-2">✓</p>
              <p className="text-slate-400 font-medium">Sin alertas activas</p>
            </div>
          )}
          {alertasActivas.map(a => (
            <div key={a.id} className="bg-slate-800 border border-slate-700/50 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${NIVEL_COLORS[a.nivel] || NIVEL_COLORS.media}`}>
                      {a.nivel.toUpperCase()}
                    </span>
                    <span className="font-semibold text-white text-sm">{a.tipo}</span>
                  </div>
                  {a.zona_nombre && <p className="text-xs text-slate-400">Zona: {a.zona_nombre}</p>}
                  {a.descripcion && <p className="text-xs text-slate-300 mt-0.5">{a.descripcion}</p>}
                  <p className="text-xs text-slate-500 mt-1">{formatTime(a.created_at)}</p>
                </div>
                <button
                  onClick={() => resolver(a.id)}
                  className="flex-shrink-0 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all active:scale-95"
                >
                  Resolver
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ZONAS */}
      {!loading && tab === 'zonas' && (
        <div className="space-y-4">
          {zonas.length === 0 && (
            <p className="text-center text-slate-500 py-12">No hay zonas configuradas</p>
          )}
          {zonas.map(z => {
            const st = ZONA_ESTADO[z.estado] || ZONA_ESTADO.desarmada
            const isBusy = busy === z.id
            return (
              <div key={z.id} className={`rounded-2xl border p-5 ${st.bg} ${st.border}`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${st.dot}`} />
                      <h3 className={`font-bold text-lg ${st.text}`}>{z.nombre}</h3>
                    </div>
                    {z.descripcion && <p className="text-xs text-slate-400 mt-1 ml-5">{z.descripcion}</p>}
                    <p className="text-xs text-slate-500 mt-0.5 ml-5 capitalize">{z.tipo}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-xl text-xs font-bold border ${st.bg} ${st.text} ${st.border}`}>
                    {st.label}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => armar(z.id, 'armada')} disabled={isBusy}
                    className="flex flex-col items-center justify-center gap-1 h-16 rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:opacity-40 text-white text-xs font-bold transition-all active:scale-95 shadow-lg shadow-red-900/40">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    {isBusy ? '...' : 'Armar'}
                  </button>
                  <button onClick={() => armar(z.id, 'parcial')} disabled={isBusy}
                    className="flex flex-col items-center justify-center gap-1 h-16 rounded-xl bg-yellow-600 hover:bg-yellow-500 active:bg-yellow-700 disabled:opacity-40 text-white text-xs font-bold transition-all active:scale-95 shadow-lg shadow-yellow-900/40">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {isBusy ? '...' : 'Parcial'}
                  </button>
                  <button onClick={() => armar(z.id, 'desarmada')} disabled={isBusy}
                    className="flex flex-col items-center justify-center gap-1 h-16 rounded-xl bg-slate-700 hover:bg-slate-600 active:bg-slate-800 disabled:opacity-40 text-white text-xs font-bold transition-all active:scale-95 shadow-lg shadow-black/30">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                    {isBusy ? '...' : 'Desarmar'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && <p className="text-center text-xs text-slate-600 pt-2">Auto-actualiza cada 20 seg</p>}
    </div>
  )
}
