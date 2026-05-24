'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from '@/hooks/useSession'

const QUICK_ACTIONS = [
  {
    href: '/dashboard/condominios/incidencias',
    label: 'Incidencias',
    sub: 'Reportar y gestionar',
    icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    gradient: 'from-red-600 to-rose-700',
    shadow: 'rgba(220,38,38,0.35)',
  },
  {
    href: '/dashboard/condominios/avisos',
    label: 'Avisos',
    sub: 'Publicar comunicados',
    icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
    gradient: 'from-amber-500 to-orange-600',
    shadow: 'rgba(245,158,11,0.35)',
  },
  {
    href: '/dashboard/condominios/finanzas',
    label: 'Finanzas',
    sub: 'Ver ingresos y egresos',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    gradient: 'from-emerald-600 to-teal-700',
    shadow: 'rgba(16,185,129,0.35)',
  },
  {
    href: '/dashboard/condominios/accesos',
    label: 'Accesos QR',
    sub: 'Gestionar entradas',
    icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
    gradient: 'from-indigo-600 to-violet-700',
    shadow: 'rgba(99,102,241,0.35)',
  },
  {
    href: '/dashboard/condominios/reservas',
    label: 'Reservas',
    sub: 'Espacios comunes',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    gradient: 'from-cyan-600 to-sky-700',
    shadow: 'rgba(6,182,212,0.35)',
  },
  {
    href: '/dashboard/condominios/mensajes',
    label: 'Mensajes',
    sub: 'Residentes a admin',
    icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
    gradient: 'from-purple-600 to-fuchsia-700',
    shadow: 'rgba(168,85,247,0.35)',
  },
]

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values)
  const min = Math.min(...values)
  const pts = values.map((v, i) => `${i * (48 / 6)},${32 - ((v - min) / (max - min || 1)) * 28}`).join(' ')
  return (
    <svg viewBox="0 0 48 32" className="w-12 h-8 opacity-70">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface HistorialItem {
  id: number
  accion: string
  created_at?: string
  descripcion?: string
}

export default function DashboardHome() {
  const { user, tenantId } = useSession()
  const [time, setTime] = useState(new Date())
  const [historial, setHistorial] = useState<HistorialItem[]>([])
  const [condCount, setCondCount] = useState(0)
  const [deptCount, setDeptCount] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!tenantId) return
    Promise.all([
      fetch('/api/condominios?tenant_id=' + tenantId).then(r => r.ok ? r.json() : []),
      fetch('/api/historial?tenant_id=' + tenantId + '&limit=5').then(r => r.ok ? r.json() : []),
    ]).then(([condData, histData]) => {
      const condList = Array.isArray(condData) ? condData : (condData.condominios || condData.data || [])
      const histList = Array.isArray(histData) ? histData : (histData.items || histData.data || [])
      setCondCount(condList.length)
      setDeptCount(condList.reduce((acc: number, c: { total_departamentos?: number }) => acc + (c.total_departamentos || 0), 0))
      setHistorial(histList.slice(0, 5))
    }).catch(() => {})
  }, [tenantId])

  const hour = time.getHours()
  const greeting = hour < 12 ? 'Buenos dias' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'
  const firstName = user?.nombre_completo?.split(' ')[0] || 'Administrador'
  const dateStr = time.toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const statCards = [
    { label: 'Condominios activos', sub: 'Bajo administracion', value: condCount, values: [2,3,2,4,3,4,Math.max(condCount,1)], color: '#818cf8', trend: '+0%', trendUp: true, icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { label: 'Departamentos', sub: 'Total registrados', value: deptCount, values: [10,18,22,28,30,35,Math.max(deptCount,1)], color: '#22d3ee', trend: '+5%', trendUp: true, icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { label: 'Incidencias abiertas', sub: 'Requieren atencion', value: 0, values: [5,8,6,10,7,9,3], color: '#f87171', trend: '-2', trendUp: false, icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
    { label: 'Pagos este mes', sub: 'Gastos comunes', value: 0, values: [3,5,4,7,6,8,2], color: '#34d399', trend: '+12%', trendUp: true, icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
  ]

  const timeAgo = (ds?: string) => {
    if (!ds) return ''
    const diff = Date.now() - new Date(ds).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `hace ${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `hace ${hrs}h`
    return `hace ${Math.floor(hrs / 24)}d`
  }

  const cardBg = { background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(30,41,59,0.8)' }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            {greeting},{' '}
            <span style={{ background: 'linear-gradient(90deg, #818cf8, #67e8f9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              {firstName}
            </span>
          </h1>
          <p className="text-slate-500 mt-1 capitalize text-sm">{dateStr}</p>
        </div>
        <a href="/portal" target="_blank" className="hidden sm:flex items-center gap-2 text-sm font-semibold text-white px-4 py-2 rounded-xl transition shrink-0" style={{ background: 'linear-gradient(135deg, #6366f1, #9333ea)', boxShadow: '0 4px 15px rgba(99,102,241,0.4)' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          Portal residentes
        </a>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(card => (
          <div key={card.label} className="rounded-2xl p-5 pro-card" style={cardBg}>
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: card.color + '20' }}>
                <svg className="w-4 h-4" fill="none" stroke={card.color} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={card.icon} />
                </svg>
              </div>
              <Sparkline values={card.values} color={card.color} />
            </div>
            <p className="text-3xl font-extrabold mb-1" style={{ background: 'linear-gradient(135deg, ' + card.color + ', #fff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              {card.value}
            </p>
            <p className="text-xs font-semibold text-slate-300">{card.label}</p>
            <p className="text-xs text-slate-500 mt-0.5">{card.sub}</p>
            <div className={`mt-2 flex items-center gap-1 text-xs font-semibold ${card.trendUp ? 'text-emerald-400' : 'text-red-400'}`}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.trendUp ? 'M7 11l5-5m0 0l5 5m-5-5v12' : 'M17 13l-5 5m0 0l-5-5m5 5V6'} />
              </svg>
              {card.trend} vs mes anterior
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions + historial */}
      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-[1.5px] mb-4">Acciones rapidas</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {QUICK_ACTIONS.map(action => (
              <Link
                key={action.href}
                href={action.href}
                className={`group rounded-2xl p-4 transition-all duration-200 hover:-translate-y-1 hover:scale-[1.02] bg-gradient-to-br ${action.gradient} relative overflow-hidden`}
                style={{ boxShadow: `0 4px 20px ${action.shadow}` }}
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200" style={{ background: 'rgba(255,255,255,0.08)' }} />
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 bg-white/20">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={action.icon} />
                  </svg>
                </div>
                <p className="text-sm font-bold text-white leading-tight">{action.label}</p>
                <p className="text-[11px] text-white/70 mt-0.5">{action.sub}</p>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-[1.5px] mb-4">Actividad reciente</h2>
          <div className="rounded-2xl p-4" style={cardBg}>
            {historial.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <svg className="w-8 h-8 text-slate-700 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-slate-600 text-xs">Sin actividad reciente</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {historial.map((item, idx) => (
                  <li key={item.id || idx} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-300 font-medium truncate">{item.accion || item.descripcion || 'Evento'}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{timeAgo(item.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/dashboard/historial" className="mt-4 block text-center text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition">
              Ver historial completo
            </Link>
          </div>
        </div>
      </div>

      {/* Module cards */}
      <div>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-[1.5px] mb-4">Modulos principales</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { href: '/dashboard/condominios/accesos', title: 'Control de Accesos', desc: 'Gestiona visitas con QR y monitorea quien entra y sale del condominio en tiempo real.', color: '#818cf8', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
            { href: '/dashboard/condominios/finanzas', title: 'Finanzas del Condominio', desc: 'Graficos de recaudacion, gastos comunes por periodo y estado de pagos por unidad.', color: '#34d399', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
            { href: '/portal', title: 'Portal del Residente', desc: 'Los residentes pagan sus gastos, reservan espacios y participan en votaciones.', color: '#22d3ee', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
          ].map(card => (
            <Link key={card.href} href={card.href} className="group rounded-2xl p-6 pro-card" style={cardBg}>
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4" style={{ background: card.color + '20' }}>
                <svg className="w-5 h-5" fill="none" stroke={card.color} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={card.icon} />
                </svg>
              </div>
              <h3 className="font-bold text-slate-100 mb-2">{card.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{card.desc}</p>
              <div className="mt-4 flex items-center gap-1 text-xs font-semibold" style={{ color: card.color }}>
                Ver modulo
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
