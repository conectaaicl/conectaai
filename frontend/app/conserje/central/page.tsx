'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Package, RefreshCw, ExternalLink, Radio } from 'lucide-react'

interface Puerta { id: number; nombre: string; ubicacion: string; tipo: string; estado: string; modo: string; activa: boolean }
interface Visita { id: number; nombre_visitante: string; rut_visitante?: string; depto_destino?: string; residente_nombre?: string; estado: string; creado_en: string }
interface Paquete { id: number; residente_nombre?: string; depto?: string; descripcion?: string; estado: string; carrier?: string; creado_en: string; notificado?: boolean }
interface EventoAcceso { id: number | string; fuente: string; nombre: string; depto?: string; accion: string; puerta?: string; timestamp: string; estado: string }

const DOOR_STYLE: Record<string, { label: string; dot: string; card: string; text: string; badge: string }> = {
  libre_paso: { label: 'Paso libre', dot: 'bg-blue-400 animate-pulse',  card: 'bg-blue-500/10 border-blue-500/30',  text: 'text-blue-300',  badge: 'bg-blue-500/20 text-blue-300' },
  abierta:    { label: 'Abierta',    dot: 'bg-emerald-400 animate-pulse', card: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-300', badge: 'bg-emerald-500/20 text-emerald-300' },
  cerrada:    { label: 'Cerrada',    dot: 'bg-slate-500',                card: 'bg-slate-800/50 border-slate-700/60', text: 'text-slate-300', badge: 'bg-slate-700 text-slate-300' },
  bloqueada:  { label: 'Bloqueada',  dot: 'bg-red-400',                  card: 'bg-red-500/10 border-red-500/30',    text: 'text-red-300',   badge: 'bg-red-500/20 text-red-300' },
  error:      { label: 'Error',      dot: 'bg-red-400 animate-pulse',    card: 'bg-red-500/10 border-red-500/30',    text: 'text-red-300',   badge: 'bg-red-500/20 text-red-300' },
}

function timeAgo(ds?: string | null) {
  if (!ds) return 'sin fecha'
  const t = new Date(ds).getTime()
  if (Number.isNaN(t)) return 'sin fecha'
  const diff = Date.now() - t
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

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Central de conserjeria</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {time.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            {' · actualizado ' + timeAgo(lastUpdate.toISOString())}
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Link href="/conserje/visitas"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-brand-700 hover:bg-brand-600 border border-brand-500/40 transition-colors">
            <Plus size={16} /> Nueva visita
          </Link>
          <Link href="/conserje/paqueteria"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-amber-600 hover:bg-amber-500 border border-amber-400/40 transition-colors">
            <Package size={16} /> Registrar paquete
          </Link>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Puertas activas', value: puertas.filter(p => p.activa).length + '/' + puertas.length, sub: puertasAbiertas + ' en paso libre', text: 'text-emerald-400', dot: 'bg-emerald-400' },
          { label: 'Visitas hoy', value: visitasPendientes, sub: 'pendientes/activas', text: 'text-brand-300', dot: 'bg-brand-400' },
          { label: 'Paquetes', value: paquetesPendientes, sub: 'sin retirar', text: 'text-amber-400', dot: paquetesPendientes > 0 ? 'bg-amber-400 animate-pulse' : 'bg-amber-400' },
          { label: 'Eventos live', value: eventos.length, sub: 'ultimos registros', text: 'text-sky-400', dot: 'bg-sky-400 animate-pulse' },
        ].map(k => (
          <div key={k.label} className="rounded-2xl p-4 bg-slate-900/80 border border-slate-800">
            <div className="flex items-center gap-2 mb-2">
              <span className={'w-2 h-2 rounded-full shrink-0 ' + k.dot} />
              <span className="text-xs text-slate-500">{k.label}</span>
            </div>
            <p className={'text-2xl font-bold ' + k.text}>{k.value}</p>
            <p className="text-xs text-slate-600 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-12 gap-6">

        {/* PUERTAS */}
        <div className="lg:col-span-5 rounded-2xl p-5 bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[1.5px]">Control de puertas</h2>
            <button onClick={loadData} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors">
              <RefreshCw size={12} /> Actualizar
            </button>
          </div>
          {loading ? (
            <div className="text-center py-10 text-slate-600 text-sm">Cargando...</div>
          ) : puertas.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-slate-600 text-sm">Sin puertas configuradas</p>
              <Link href="/dashboard/condominios/puertas" className="text-brand-400 text-xs mt-2 inline-flex items-center gap-1">Ir al admin <ExternalLink size={11} /></Link>
            </div>
          ) : (
            <div className="space-y-3">
              {puertas.filter(p => p.activa).map(p => {
                const key = p.modo === 'bloqueada' ? 'bloqueada' : p.modo === 'libre_paso' ? 'libre_paso' : (p.estado || 'cerrada')
                const s = DOOR_STYLE[key] || DOOR_STYLE.cerrada
                const isBusy = comandando === p.id
                return (
                  <div key={p.id} className={'rounded-xl px-4 py-3 border ' + s.card}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className={'w-2.5 h-2.5 rounded-full shrink-0 ' + s.dot} />
                      <div className="flex-1 min-w-0">
                        <p className={'text-sm font-semibold truncate ' + s.text}>{p.nombre}</p>
                        <p className="text-xs text-slate-500">{p.tipo} · {p.ubicacion}</p>
                      </div>
                      <span className={'text-xs font-bold shrink-0 px-2 py-0.5 rounded-full ' + s.badge}>{s.label}</span>
                    </div>
                    {cmdMsg?.id === p.id && (
                      <p className={'text-xs mb-2 px-2 py-1 rounded ' + (cmdMsg.ok ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10')}>{cmdMsg.msg}</p>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => comando(p.id, 'abrir')} disabled={isBusy}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50 transition-colors">
                        {isBusy ? '...' : 'Abrir'}
                      </button>
                      <button onClick={() => comando(p.id, 'cerrar')} disabled={isBusy}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700/60 text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-colors">
                        Cerrar
                      </button>
                      <button onClick={() => comando(p.id, 'libre_paso')} disabled={isBusy}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 disabled:opacity-50 transition-colors">
                        Paso libre
                      </button>
                      <button onClick={() => comando(p.id, 'bloquear')} disabled={isBusy}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 disabled:opacity-50 transition-colors">
                        Bloquear
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* VISITAS + PAQUETES */}
        <div className="lg:col-span-4 space-y-5">
          <div className="rounded-2xl p-5 bg-slate-900/80 border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[1.5px]">Visitas</h2>
              <Link href="/conserje/visitas" className="text-xs text-brand-400 hover:text-brand-300">Ver todas →</Link>
            </div>
            {visitas.length === 0 ? (
              <p className="text-slate-600 text-sm text-center py-4">Sin visitas registradas</p>
            ) : (
              <div className="space-y-2.5">
                {visitas.slice(0, 5).map(v => (
                  <div key={v.id} className="flex items-center gap-3 py-1.5">
                    <div className="w-8 h-8 rounded-full bg-brand-500/15 flex items-center justify-center shrink-0">
                      <span className="text-brand-300 text-xs font-bold">{v.nombre_visitante.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-200 truncate">{v.nombre_visitante}</p>
                      <p className="text-xs text-slate-500">Depto {v.depto_destino || '—'} · {timeAgo(v.creado_en)}</p>
                    </div>
                    <span className={'text-xs px-1.5 py-0.5 rounded-full font-medium ' + (v.estado === 'autorizado' ? 'bg-emerald-500/20 text-emerald-300' : v.estado === 'pendiente' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-700 text-slate-400')}>
                      {v.estado}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <Link href="/conserje/visitas"
              className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-brand-300 border border-brand-500/30 hover:bg-brand-500/10 transition-colors">
              <Plus size={13} /> Nueva visita
            </Link>
          </div>

          <div className="rounded-2xl p-5 bg-slate-900/80 border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[1.5px]">Paquetes pendientes</h2>
              <Link href="/conserje/paqueteria" className="text-xs text-amber-400 hover:text-amber-300">Ver todos →</Link>
            </div>
            {paquetes.length === 0 ? (
              <p className="text-slate-600 text-sm text-center py-4">Sin paquetes pendientes</p>
            ) : (
              <div className="space-y-2.5">
                {paquetes.slice(0, 5).map(p => (
                  <div key={p.id} className="flex items-center gap-3 py-1.5">
                    <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                      <Package size={15} className="text-amber-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-200 truncate">{p.residente_nombre || 'Sin identificar'}</p>
                      <p className="text-xs text-slate-500">Depto {p.depto || '—'} · {p.carrier || 'courier'}</p>
                    </div>
                    {!p.notificado && <span className="text-xs bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full shrink-0">Sin notif.</span>}
                  </div>
                ))}
              </div>
            )}
            <Link href="/conserje/paqueteria"
              className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-amber-300 border border-amber-500/30 hover:bg-amber-500/10 transition-colors">
              <Plus size={13} /> Registrar paquete
            </Link>
          </div>
        </div>

        {/* EVENTOS LIVE */}
        <div className="lg:col-span-3 rounded-2xl p-5 bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[1.5px]">Feed de eventos</h2>
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <Radio size={11} className="animate-pulse" /> Live
            </span>
          </div>
          {eventos.length === 0 ? (
            <p className="text-slate-600 text-sm text-center py-6">Sin eventos</p>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[420px] pr-1">
              {eventos.map((ev, i) => (
                <div key={String(ev.id) + i} className="flex gap-3 items-start">
                  <div className={'w-2 h-2 rounded-full shrink-0 mt-1.5 ' + (ev.estado === 'ok' || ev.accion?.includes('entr') ? 'bg-emerald-400' : ev.estado === 'denegado' ? 'bg-red-400' : 'bg-brand-400')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-300 font-medium truncate">{ev.nombre}</p>
                    <p className="text-xs text-slate-500 truncate">{ev.accion}{ev.puerta ? ' · ' + ev.puerta : ''}</p>
                    <p className="text-xs text-slate-600">{timeAgo(ev.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-slate-800">
            <Link href="/conserje/accesos" className="text-xs text-brand-400 hover:text-brand-300">
              Ver accesos QR →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
