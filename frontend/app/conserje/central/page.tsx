'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Puerta { id: number; nombre: string; ubicacion: string; tipo: string; estado: string; modo: string; activa: boolean }
interface Visita { id: number; nombre_visitante: string; rut_visitante?: string; depto_destino?: string; residente_nombre?: string; estado: string; creado_en: string }
interface Paquete { id: number; residente_nombre?: string; depto?: string; descripcion?: string; estado: string; carrier?: string; creado_en: string; notificado?: boolean }
interface EventoAcceso { id: number | string; fuente: string; nombre: string; depto?: string; accion: string; puerta?: string; timestamp: string; estado: string }

const DOOR_STYLE: Record<string, { label: string; dot: string; bg: string; border: string; text: string }> = {
  libre_paso: { label: 'Paso Libre', dot: 'bg-blue-400 animate-pulse',   bg: 'rgba(59,130,246,0.08)',   border: 'rgba(59,130,246,0.3)',   text: '#60a5fa' },
  abierta:    { label: 'Abierta',    dot: 'bg-green-400 animate-pulse',  bg: 'rgba(34,197,94,0.08)',    border: 'rgba(34,197,94,0.3)',    text: '#4ade80' },
  cerrada:    { label: 'Cerrada',    dot: 'bg-slate-500',                bg: 'rgba(100,116,139,0.05)',  border: 'rgba(100,116,139,0.2)',  text: '#94a3b8' },
  bloqueada:  { label: 'Bloqueada',  dot: 'bg-red-400',                  bg: 'rgba(239,68,68,0.08)',    border: 'rgba(239,68,68,0.3)',    text: '#f87171' },
  error:      { label: 'Error',      dot: 'bg-red-400 animate-pulse',    bg: 'rgba(239,68,68,0.08)',    border: 'rgba(239,68,68,0.3)',    text: '#f87171' },
}

function timeAgo(ds: string) {
  const diff = Date.now() - new Date(ds).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'ahora'
  if (m < 60) return 'hace ' + m + 'm'
  const h = Math.floor(m / 60)
  if (h < 24) return 'hace ' + h + 'h'
  return 'hace ' + Math.floor(h / 24) + 'd'
}

export default function CentralConserje() {
  const [puertas, setPuertas] = useState<Puerta[]>([])
  const [visitas, setVisitas] = useState<Visita[]>([])
  const [paquetes, setPaquetes] = useState<Paquete[]>([])
  const [eventos, setEventos] = useState<EventoAcceso[]>([])
  const [comandando, setComandando] = useState<number | null>(null)
  const [cmdMsg, setCmdMsg] = useState<{ id: number; ok: boolean; msg: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [time, setTime] = useState(new Date())

  const tid = () => typeof window !== 'undefined' ? (localStorage.getItem('current_condominio_id') || '1') : '1'

  const loadData = useCallback(async () => {
    try {
      const t = tid()
      const [pRes, eRes, vRes, pqRes] = await Promise.allSettled([
        fetch('/api/condominios/puertas?tenant_id=' + t, { credentials: 'include' }),
        fetch('/api/accesos/live?tenant_id=' + t + '&limit=15', { credentials: 'include' }),
        fetch('/api/visitas?tenant_id=' + t + '&limit=8', { credentials: 'include' }),
        fetch('/api/paquetes?tenant_id=' + t + '&estado=pendiente&limit=8', { credentials: 'include' }),
      ])
      if (pRes.status === 'fulfilled' && pRes.value.ok) setPuertas(await pRes.value.json())
      if (eRes.status === 'fulfilled' && eRes.value.ok) {
        const ed = await eRes.value.json()
        setEventos(Array.isArray(ed) ? ed : [])
      }
      if (vRes.status === 'fulfilled' && vRes.value.ok) {
        const vd = await vRes.value.json()
        setVisitas(Array.isArray(vd) ? vd : (vd.visitas || []))
      }
      if (pqRes.status === 'fulfilled' && pqRes.value.ok) {
        const pd = await pqRes.value.json()
        setPaquetes(Array.isArray(pd) ? pd : (pd.paquetes || []))
      }
      setLastUpdate(new Date())
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    loadData()
    const iv = setInterval(loadData, 15000)
    const tc = setInterval(() => setTime(new Date()), 1000)
    return () => { clearInterval(iv); clearInterval(tc) }
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
      setCmdMsg({ id: puertaId, ok: r.ok, msg: data.mensaje || (r.ok ? 'Ejecutado' : 'Error') })
      if (r.ok) loadData()
      setTimeout(() => setCmdMsg(null), 3000)
    } finally { setComandando(null) }
  }

  const puertasAbiertas = puertas.filter(p => p.estado === 'abierta' || p.modo === 'libre_paso').length
  const paquetesPendientes = paquetes.filter(p => p.estado === 'pendiente').length
  const visitasPendientes = visitas.filter(v => v.estado === 'pendiente' || v.estado === 'autorizado').length

  const cardBg = { background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(30,41,59,0.8)' }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Central de Conserjeria</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {time.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            {' · actualizado ' + timeAgo(lastUpdate.toISOString())}
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Link href="/conserje/visitas"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'rgba(124,58,237,0.8)', border: '1px solid rgba(139,92,246,0.5)' }}>
            + Nueva Visita
          </Link>
          <Link href="/conserje/paqueteria"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'rgba(217,119,6,0.8)', border: '1px solid rgba(245,158,11,0.5)' }}>
            + Registrar Paquete
          </Link>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Puertas Activas', value: puertas.filter(p => p.activa).length + '/' + puertas.length, sub: puertasAbiertas + ' en paso libre', color: '#4ade80', dot: 'bg-green-400' },
          { label: 'Visitas Hoy', value: visitasPendientes, sub: 'pendientes/activas', color: '#a78bfa', dot: 'bg-violet-400' },
          { label: 'Paquetes', value: paquetesPendientes, sub: 'sin retirar', color: '#fb923c', dot: paquetesPendientes > 0 ? 'bg-orange-400 animate-pulse' : 'bg-orange-400' },
          { label: 'Eventos Live', value: eventos.length, sub: 'ultimos registros', color: '#38bdf8', dot: 'bg-sky-400 animate-pulse' },
        ].map(k => (
          <div key={k.label} className="rounded-2xl p-4" style={cardBg}>
            <div className="flex items-center gap-2 mb-2">
              <span className={'w-2 h-2 rounded-full shrink-0 ' + k.dot} />
              <span className="text-xs text-slate-500">{k.label}</span>
            </div>
            <p className="text-2xl font-extrabold" style={{ color: k.color }}>{k.value}</p>
            <p className="text-xs text-slate-600 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-12 gap-6">

        {/* PUERTAS — 5 cols */}
        <div className="lg:col-span-5 rounded-2xl p-5" style={cardBg}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[1.5px]">Control de Puertas</h2>
            <button onClick={loadData} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Actualizar</button>
          </div>
          {loading ? (
            <div className="text-center py-10 text-slate-600 text-sm">Cargando...</div>
          ) : puertas.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-slate-600 text-sm">Sin puertas configuradas</p>
              <Link href="/dashboard/condominios/puertas" className="text-indigo-400 text-xs mt-2 inline-block">Ir al admin →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {puertas.filter(p => p.activa).map(p => {
                const key = p.modo === 'bloqueada' ? 'bloqueada' : p.modo === 'libre_paso' ? 'libre_paso' : (p.estado || 'cerrada')
                const s = DOOR_STYLE[key] || DOOR_STYLE.cerrada
                const isBusy = comandando === p.id
                return (
                  <div key={p.id} className="rounded-xl px-4 py-3" style={{ background: s.bg, border: '1px solid ' + s.border }}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className={'w-2.5 h-2.5 rounded-full shrink-0 ' + s.dot} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: s.text }}>{p.nombre}</p>
                        <p className="text-xs text-slate-500">{p.tipo} · {p.ubicacion}</p>
                      </div>
                      <span className="text-xs font-bold shrink-0 px-2 py-0.5 rounded-full" style={{ background: s.border, color: s.text }}>{s.label}</span>
                    </div>
                    {cmdMsg?.id === p.id && (
                      <p className={'text-xs mb-2 px-2 py-1 rounded ' + (cmdMsg.ok ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10')}>{cmdMsg.msg}</p>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => comando(p.id, 'abrir')} disabled={isBusy}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-50 transition-colors">
                        {isBusy ? '...' : 'Abrir'}
                      </button>
                      <button onClick={() => comando(p.id, 'cerrar')} disabled={isBusy}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700/60 text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-colors">
                        Cerrar
                      </button>
                      <button onClick={() => comando(p.id, 'libre_paso')} disabled={isBusy}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 disabled:opacity-50 transition-colors">
                        Paso Libre
                      </button>
                      <button onClick={() => comando(p.id, 'bloquear')} disabled={isBusy}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50 transition-colors">
                        Bloquear
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* VISITAS + PAQUETES — 4 cols */}
        <div className="lg:col-span-4 space-y-5">
          {/* Visitas */}
          <div className="rounded-2xl p-5" style={cardBg}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[1.5px]">Visitas</h2>
              <Link href="/conserje/visitas" className="text-xs text-violet-400 hover:text-violet-300">Ver todas →</Link>
            </div>
            {visitas.length === 0 ? (
              <p className="text-slate-600 text-sm text-center py-4">Sin visitas registradas</p>
            ) : (
              <div className="space-y-2.5">
                {visitas.slice(0, 5).map(v => (
                  <div key={v.id} className="flex items-center gap-3 py-1.5">
                    <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                      <span className="text-violet-400 text-xs font-bold">{v.nombre_visitante.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-200 truncate">{v.nombre_visitante}</p>
                      <p className="text-xs text-slate-500">Depto {v.depto_destino || '—'} · {timeAgo(v.creado_en)}</p>
                    </div>
                    <span className={'text-xs px-1.5 py-0.5 rounded-full font-medium ' + (v.estado === 'autorizado' ? 'bg-green-500/20 text-green-400' : v.estado === 'pendiente' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-400')}>
                      {v.estado}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <Link href="/conserje/visitas"
              className="mt-3 w-full flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-semibold text-violet-400 border border-violet-500/30 hover:bg-violet-500/10 transition-colors">
              + Nueva visita
            </Link>
          </div>

          {/* Paquetes */}
          <div className="rounded-2xl p-5" style={cardBg}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[1.5px]">Paquetes Pendientes</h2>
              <Link href="/conserje/paqueteria" className="text-xs text-amber-400 hover:text-amber-300">Ver todos →</Link>
            </div>
            {paquetes.length === 0 ? (
              <p className="text-slate-600 text-sm text-center py-4">Sin paquetes pendientes</p>
            ) : (
              <div className="space-y-2.5">
                {paquetes.slice(0, 5).map(p => (
                  <div key={p.id} className="flex items-center gap-3 py-1.5">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-200 truncate">{p.residente_nombre || 'Sin identificar'}</p>
                      <p className="text-xs text-slate-500">Depto {p.depto || '—'} · {p.carrier || 'courier'}</p>
                    </div>
                    {!p.notificado && <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">Sin notif.</span>}
                  </div>
                ))}
              </div>
            )}
            <Link href="/conserje/paqueteria"
              className="mt-3 w-full flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-semibold text-amber-400 border border-amber-500/30 hover:bg-amber-500/10 transition-colors">
              + Registrar paquete
            </Link>
          </div>
        </div>

        {/* EVENTOS LIVE — 3 cols */}
        <div className="lg:col-span-3 rounded-2xl p-5" style={cardBg}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[1.5px]">Feed de Eventos</h2>
            <span className="flex items-center gap-1 text-xs text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />Live
            </span>
          </div>
          {eventos.length === 0 ? (
            <p className="text-slate-600 text-sm text-center py-6">Sin eventos</p>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[420px] pr-1">
              {eventos.map((ev, i) => (
                <div key={String(ev.id) + i} className="flex gap-3 items-start">
                  <div className={'w-2 h-2 rounded-full shrink-0 mt-1.5 ' + (ev.estado === 'ok' || ev.accion?.includes('entr') ? 'bg-green-400' : ev.estado === 'denegado' ? 'bg-red-400' : 'bg-indigo-400')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-300 font-medium truncate">{ev.nombre}</p>
                    <p className="text-xs text-slate-500 truncate">{ev.accion}{ev.puerta ? ' · ' + ev.puerta : ''}</p>
                    <p className="text-xs text-slate-700">{timeAgo(ev.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-slate-800/60">
            <Link href="/conserje/accesos" className="text-xs text-indigo-400 hover:text-indigo-300">
              Ver accesos QR →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
