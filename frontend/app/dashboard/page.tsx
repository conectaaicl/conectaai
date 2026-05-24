'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSession } from '@/hooks/useSession'

interface Puerta { id: number; nombre: string; estado: string; modo: string; activa: boolean; tipo: string }
interface Camara { id: number; nombre: string; ip: string; activa?: boolean }
interface Visita { id: number; nombre_visitante: string; depto_destino?: string; estado: string; creado_en: string }
interface Paquete { id: number; descripcion?: string; depto?: string; residente_nombre?: string; estado: string; creado_en: string; carrier?: string }
interface EventoAcceso { id: number | string; nombre: string; accion: string; puerta?: string; timestamp: string; fuente: string }

const DOOR_STATE: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  libre_paso: { label: 'Paso Libre', dot: 'bg-blue-400 animate-pulse', bg: 'rgba(59,130,246,0.1)', text: '#60a5fa' },
  abierta:    { label: 'Abierta',    dot: 'bg-green-400 animate-pulse', bg: 'rgba(34,197,94,0.1)', text: '#4ade80' },
  cerrada:    { label: 'Cerrada',    dot: 'bg-slate-500',               bg: 'rgba(100,116,139,0.1)', text: '#94a3b8' },
  bloqueada:  { label: 'Bloqueada',  dot: 'bg-red-400',                 bg: 'rgba(239,68,68,0.1)', text: '#f87171' },
  error:      { label: 'Error',      dot: 'bg-red-400 animate-pulse',   bg: 'rgba(239,68,68,0.1)', text: '#f87171' },
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

export default function DashboardHome() {
  const { user, tenantId } = useSession()
  const [time, setTime] = useState(new Date())
  const [puertas, setPuertas] = useState<Puerta[]>([])
  const [camaras, setCamaras] = useState<Camara[]>([])
  const [visitas, setVisitas] = useState<Visita[]>([])
  const [paquetes, setPaquetes] = useState<Paquete[]>([])
  const [eventos, setEventos] = useState<EventoAcceso[]>([])
  const [condCount, setCondCount] = useState(0)
  const [deptCount, setDeptCount] = useState(0)
  const [personaCount, setPersonaCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  const loadData = useCallback(async () => {
    if (!tenantId) return
    const tid = String(tenantId)
    try {
      const [cRes, dRes, pRes, camRes, vRes, pqRes, evRes] = await Promise.allSettled([
        fetch('/api/condominios?tenant_id=' + tid),
        fetch('/api/personas?tenant_id=' + tid + '&limit=1'),
        fetch('/api/condominios/puertas?tenant_id=' + tid),
        fetch('/api/camaras?tenant_id=' + tid),
        fetch('/api/visitas?tenant_id=' + tid + '&limit=6'),
        fetch('/api/paquetes?tenant_id=' + tid + '&limit=6'),
        fetch('/api/accesos/live?tenant_id=' + tid + '&limit=10'),
      ])
      if (cRes.status === 'fulfilled' && cRes.value.ok) {
        const cd = await cRes.value.json()
        const list = Array.isArray(cd) ? cd : (cd.condominios || cd.data || [])
        setCondCount(list.length)
        setDeptCount(list.reduce((a: number, c: any) => a + (c.total_departamentos || 0), 0))
      }
      if (dRes.status === 'fulfilled' && dRes.value.ok) {
        const dd = await dRes.value.json()
        setPersonaCount(dd.total || (Array.isArray(dd) ? dd.length : 0))
      }
      if (pRes.status === 'fulfilled' && pRes.value.ok) setPuertas(await pRes.value.json())
      if (camRes.status === 'fulfilled' && camRes.value.ok) {
        const cd = await camRes.value.json()
        setCamaras(Array.isArray(cd) ? cd : [])
      }
      if (vRes.status === 'fulfilled' && vRes.value.ok) {
        const vd = await vRes.value.json()
        setVisitas(Array.isArray(vd) ? vd : (vd.visitas || []))
      }
      if (pqRes.status === 'fulfilled' && pqRes.value.ok) {
        const pd = await pqRes.value.json()
        setPaquetes(Array.isArray(pd) ? pd : (pd.paquetes || []))
      }
      if (evRes.status === 'fulfilled' && evRes.value.ok) {
        const ed = await evRes.value.json()
        setEventos(Array.isArray(ed) ? ed : [])
      }
    } finally { setLoading(false) }
  }, [tenantId])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => {
    const iv = setInterval(loadData, 30000)
    return () => clearInterval(iv)
  }, [loadData])

  const hour = time.getHours()
  const greeting = hour < 12 ? 'Buenos dias' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'
  const firstName = user?.nombre_completo?.split(' ')[0] || 'Administrador'

  const puertasAbiertas = puertas.filter(p => p.estado === 'abierta' || p.modo === 'libre_paso').length
  const puertasCerradas = puertas.filter(p => p.estado === 'cerrada' && p.modo !== 'libre_paso' && p.modo !== 'bloqueada').length
  const puertasBloqueadas = puertas.filter(p => p.modo === 'bloqueada').length

  const cardBg = { background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(30,41,59,0.8)' }
  const cardBg2 = { background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(30,41,59,0.5)' }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            {greeting},{' '}
            <span style={{ background: 'linear-gradient(90deg, #818cf8, #67e8f9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              {firstName}
            </span>
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            {time.toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            {' — '}
            {time.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-medium text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Sistema Operativo
          </div>
          <a href="/portal" target="_blank"
            className="hidden sm:flex items-center gap-2 text-sm font-semibold text-white px-4 py-2 rounded-xl"
            style={{ background: 'linear-gradient(135deg, #6366f1, #9333ea)', boxShadow: '0 4px 15px rgba(99,102,241,0.4)' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            Portal Residentes
          </a>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Residentes', value: personaCount, sub: 'registrados', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', color: '#818cf8', href: '/dashboard/condominios/personas' },
          { label: 'Departamentos', value: deptCount, sub: 'total edificio', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', color: '#22d3ee', href: '/dashboard/condominios/estructura' },
          { label: 'Puertas Activas', value: puertas.filter(p => p.activa).length, sub: puertas.length + ' total', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', color: '#4ade80', href: '/dashboard/condominios/puertas' },
          { label: 'Camaras', value: camaras.length, sub: 'conectadas', icon: 'M15 10l4.553-2.069A1 1 0 0121 8.87V15.13a1 1 0 01-1.447.9L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z', color: '#f472b6', href: '/dashboard/condominios/camaras' },
        ].map(k => (
          <Link key={k.label} href={k.href}
            className="rounded-2xl p-5 pro-card group hover:-translate-y-0.5 transition-transform"
            style={cardBg}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: k.color + '20' }}>
                <svg className="w-4 h-4" fill="none" stroke={k.color} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={k.icon} />
                </svg>
              </div>
              <svg className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
            <p className="text-3xl font-extrabold mb-1" style={{ background: 'linear-gradient(135deg, ' + k.color + ', #fff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              {k.value}
            </p>
            <p className="text-xs font-semibold text-slate-300">{k.label}</p>
            <p className="text-xs text-slate-500">{k.sub}</p>
          </Link>
        ))}
      </div>

      {/* Main grid: Monitor de Puertas + Live Feeds */}
      <div className="grid lg:grid-cols-3 gap-6 mb-6">

        {/* MONITOR DE PUERTAS */}
        <div className="lg:col-span-2 rounded-2xl p-5" style={cardBg}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-[1.5px]">Monitor de Puertas</h2>
              <p className="text-xs text-slate-500 mt-0.5">Estado en tiempo real · actualiza cada 30s</p>
            </div>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1 text-green-400"><span className="w-2 h-2 rounded-full bg-green-400" />{puertasAbiertas} libre</span>
              <span className="flex items-center gap-1 text-slate-400"><span className="w-2 h-2 rounded-full bg-slate-500" />{puertasCerradas} cerrada</span>
              <span className="flex items-center gap-1 text-red-400"><span className="w-2 h-2 rounded-full bg-red-400" />{puertasBloqueadas} bloqueada</span>
            </div>
          </div>
          {puertas.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-slate-600 text-sm">Sin puertas configuradas</p>
              <Link href="/dashboard/condominios/puertas" className="text-indigo-400 text-xs mt-2 inline-block hover:text-indigo-300">Configurar puertas →</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {puertas.map(p => {
                const s = DOOR_STATE[p.modo === 'bloqueada' ? 'bloqueada' : p.modo === 'libre_paso' ? 'libre_paso' : (p.estado || 'cerrada')] || DOOR_STATE.cerrada
                return (
                  <div key={p.id} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: s.bg, border: '1px solid ' + s.text + '30' }}>
                    <div className={'w-2.5 h-2.5 rounded-full shrink-0 ' + s.dot} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: s.text }}>{p.nombre}</p>
                      <p className="text-xs text-slate-500">{p.tipo}</p>
                    </div>
                    <span className="text-xs font-bold shrink-0" style={{ color: s.text }}>{s.label}</span>
                  </div>
                )
              })}
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-slate-800/60 flex justify-between items-center">
            <Link href="/dashboard/condominios/puertas" className="text-xs text-indigo-400 hover:text-indigo-300">
              Gestionar puertas →
            </Link>
            <Link href="/dashboard/condominios/accesos-live" className="text-xs text-indigo-400 hover:text-indigo-300">
              Monitor de accesos →
            </Link>
          </div>
        </div>

        {/* EVENTOS LIVE */}
        <div className="rounded-2xl p-5" style={cardBg}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-[1.5px]">Eventos Live</h2>
            <span className="flex items-center gap-1 text-xs text-green-400"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />Live</span>
          </div>
          {eventos.length === 0 ? (
            <div className="text-center py-10 text-slate-600 text-sm">Sin eventos recientes</div>
          ) : (
            <div className="space-y-3">
              {eventos.slice(0, 8).map((ev, i) => (
                <div key={String(ev.id) + i} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5 shrink-0 animate-pulse" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-200 font-medium truncate">{ev.nombre}</p>
                    <p className="text-xs text-slate-500">{ev.accion}{ev.puerta ? ' · ' + ev.puerta : ''}</p>
                  </div>
                  <span className="text-xs text-slate-600 shrink-0 whitespace-nowrap">{timeAgo(ev.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-slate-800/60">
            <Link href="/dashboard/condominios/accesos-live" className="text-xs text-indigo-400 hover:text-indigo-300">
              Ver monitor completo →
            </Link>
          </div>
        </div>
      </div>

      {/* Visitas + Paquetes + Camaras */}
      <div className="grid lg:grid-cols-3 gap-6 mb-6">

        {/* VISITAS RECIENTES */}
        <div className="rounded-2xl p-5" style={cardBg}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-[1.5px]">Visitas Recientes</h2>
            <Link href="/dashboard/condominios/visitas" className="text-xs text-indigo-400 hover:text-indigo-300">Ver todas</Link>
          </div>
          {visitas.length === 0 ? (
            <p className="text-slate-600 text-sm text-center py-6">Sin visitas hoy</p>
          ) : (
            <div className="space-y-3">
              {visitas.slice(0, 5).map(v => (
                <div key={v.id} className="flex items-center gap-3 py-2 border-b border-slate-800/60 last:border-0">
                  <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                    <span className="text-violet-400 text-xs font-bold">{v.nombre_visitante.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">{v.nombre_visitante}</p>
                    <p className="text-xs text-slate-500">Depto {v.depto_destino || '—'}</p>
                  </div>
                  <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + (v.estado === 'autorizado' ? 'bg-green-500/20 text-green-400' : v.estado === 'pendiente' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-400')}>
                    {v.estado}
                  </span>
                </div>
              ))}
            </div>
          )}
          <Link href="/dashboard/condominios/visitas"
            className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold text-violet-400 border border-violet-500/30 hover:bg-violet-500/10 transition-colors">
            + Registrar visita
          </Link>
        </div>

        {/* PAQUETERIA */}
        <div className="rounded-2xl p-5" style={cardBg}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-[1.5px]">Paqueteria</h2>
            <Link href="/dashboard/condominios/paqueteria" className="text-xs text-indigo-400 hover:text-indigo-300">Ver todas</Link>
          </div>
          {paquetes.length === 0 ? (
            <p className="text-slate-600 text-sm text-center py-6">Sin paquetes pendientes</p>
          ) : (
            <div className="space-y-3">
              {paquetes.slice(0, 5).map(p => (
                <div key={p.id} className="flex items-center gap-3 py-2 border-b border-slate-800/60 last:border-0">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">{p.residente_nombre || 'Residente'}</p>
                    <p className="text-xs text-slate-500">Depto {p.depto || '—'} · {p.carrier || p.descripcion || ''}</p>
                  </div>
                  <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + (p.estado === 'entregado' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400')}>
                    {p.estado}
                  </span>
                </div>
              ))}
            </div>
          )}
          <Link href="/dashboard/condominios/paqueteria"
            className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold text-amber-400 border border-amber-500/30 hover:bg-amber-500/10 transition-colors">
            + Registrar paquete
          </Link>
        </div>

        {/* CAMARAS + ACCESOS RAPIDOS */}
        <div className="space-y-4">
          <div className="rounded-2xl p-5" style={cardBg2}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-[1.5px]">Camaras</h2>
              <Link href="/dashboard/condominios/camaras" className="text-xs text-indigo-400 hover:text-indigo-300">Ver</Link>
            </div>
            {camaras.length === 0 ? (
              <p className="text-slate-600 text-xs">Sin camaras configuradas</p>
            ) : (
              <div className="space-y-2">
                {camaras.slice(0, 4).map(c => (
                  <div key={c.id} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                    <span className="text-xs text-slate-300 truncate">{c.nombre}</span>
                    <span className="text-xs text-slate-600 ml-auto shrink-0 font-mono">{c.ip}</span>
                  </div>
                ))}
                {camaras.length > 4 && <p className="text-xs text-slate-600">+{camaras.length - 4} mas...</p>}
              </div>
            )}
          </div>
          <div className="rounded-2xl p-4" style={cardBg2}>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[1.5px] mb-3">Acciones Rapidas</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: '/dashboard/condominios/visitas', label: 'Nueva Visita', color: '#8b5cf6' },
                { href: '/dashboard/condominios/paqueteria', label: 'Nuevo Paquete', color: '#f59e0b' },
                { href: '/dashboard/condominios/avisos', label: 'Nuevo Aviso', color: '#3b82f6' },
                { href: '/dashboard/condominios/incidencias', label: 'Incidencia', color: '#ef4444' },
                { href: '/dashboard/condominios/reservas', label: 'Reserva', color: '#06b6d4' },
                { href: '/dashboard/condominios/gastos-comunes', label: 'Gasto Comun', color: '#10b981' },
              ].map(a => (
                <Link key={a.href} href={a.href}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white transition-all hover:scale-[1.02]"
                  style={{ background: a.color + '20', border: '1px solid ' + a.color + '30' }}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: a.color }} />
                  {a.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
