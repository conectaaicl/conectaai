'use client'
import { useState, useEffect, useCallback } from 'react'

const useSession = () => {
  const [user, setUser] = useState<any>(null)
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => d && setUser(d))
  }, [])
  return { user }
}

interface NocResumen {
  total_tenants: number
  tenants_activos: number
  tenants_vencidos: number
  total_usuarios: number
  total_eventos_hoy: number
  total_alertas_criticas: number
  total_paquetes_pendientes: number
  total_visitas_activas: number
}

interface NocTenant {
  id: number
  nombre: string
  subdominio: string
  plan: string
  estado: string
  fecha_vencimiento: string | null
  ultimo_login: string | null
  total_usuarios: number
  total_condominios: number
  eventos_hoy: number
  alertas_criticas: number
  paquetes_pendientes: number
  visitas_activas: number
  dispositivos_tcp: number
  semaforo: 'verde' | 'amarillo' | 'rojo'
}

interface NocHealth {
  db: string
  backend: string
  timestamp: string
  version: string
}

type SemaforoFilter = 'todos' | 'verde' | 'amarillo' | 'rojo'

const SEMAFORO_COLOR: Record<string, string> = {
  verde: '#34d399',
  amarillo: '#fbbf24',
  rojo: '#ef4444',
}
const SEMAFORO_BG: Record<string, string> = {
  verde: 'rgba(52,211,153,0.15)',
  amarillo: 'rgba(251,191,36,0.15)',
  rojo: 'rgba(239,68,68,0.15)',
}
const SEMAFORO_LABEL: Record<string, string> = {
  verde: 'Verde',
  amarillo: 'Amarillo',
  rojo: 'Rojo',
}

function timeAgo(ds: string | null) {
  if (!ds) return 'Nunca'
  const diff = Date.now() - new Date(ds).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Ahora'
  if (mins < 60) return 'hace ' + mins + 'm'
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return 'hace ' + hrs + 'h'
  return 'hace ' + Math.floor(hrs / 24) + 'd'
}

function isExpired(fecha: string | null): boolean {
  if (!fecha) return false
  return new Date(fecha) < new Date()
}

function StatCard({ label, value, icon, color, alert }: {
  label: string
  value: number
  icon: string
  color: string
  alert?: boolean
}) {
  const isAlert = alert && value > 0
  return (
    <div
      className="rounded-xl p-4 border flex items-center gap-4"
      style={{
        background: isAlert ? 'rgba(239,68,68,0.08)' : 'rgba(15,23,42,0.85)',
        borderColor: isAlert ? 'rgba(239,68,68,0.4)' : 'rgb(51,65,85)',
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: (isAlert ? '#ef4444' : color) + '20' }}
      >
        <svg className="w-5 h-5" fill="none" stroke={isAlert ? '#ef4444' : color} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={icon} />
        </svg>
      </div>
      <div>
        <p className={'text-2xl font-extrabold ' + (isAlert ? 'text-red-400' : 'text-white')}>{value}</p>
        <p className="text-xs text-slate-400 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

function HealthBar({ health, loadFailed }: { health: NocHealth | null, loadFailed?: boolean }) {
  if (!health) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-5 py-3 flex items-center gap-3 mb-6">
        <div className={"w-2 h-2 rounded-full " + (loadFailed ? "bg-red-500" : "bg-slate-600 animate-pulse")} />
        <span className={"text-xs " + (loadFailed ? "text-red-400" : "text-slate-500")}>
          {loadFailed ? "Error al cargar el sistema — verifique su sesion y recargue" : "Cargando estado del sistema..."}
        </span>
      </div>
    )
  }
  const dbOk = health.db === 'ok' || health.db === 'connected' || health.db === 'up'
  const beOk = health.backend === 'ok' || health.backend === 'up' || health.backend === 'healthy'
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 mb-6">
      <div className="flex items-center gap-2">
        <div
          className={'w-2 h-2 rounded-full ' + (dbOk ? 'bg-emerald-400' : 'bg-red-500')}
          style={dbOk ? { boxShadow: '0 0 6px #34d399' } : { boxShadow: '0 0 6px #ef4444' }}
        />
        <span className="text-xs font-medium text-slate-300">
          Base de datos:{' '}
          <span className={dbOk ? 'text-emerald-400' : 'text-red-400'}>{dbOk ? 'OK' : health.db}</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div
          className={'w-2 h-2 rounded-full ' + (beOk ? 'bg-emerald-400' : 'bg-red-500')}
          style={beOk ? { boxShadow: '0 0 6px #34d399' } : { boxShadow: '0 0 6px #ef4444' }}
        />
        <span className="text-xs font-medium text-slate-300">
          Backend:{' '}
          <span className={beOk ? 'text-emerald-400' : 'text-red-400'}>{beOk ? 'Operativo' : health.backend}</span>
        </span>
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <span className="text-xs text-slate-500">v{health.version}</span>
        <span className="text-xs text-slate-600">·</span>
        <span className="text-xs text-slate-500">{new Date(health.timestamp).toLocaleTimeString('es-CL')}</span>
      </div>
    </div>
  )
}

function TenantCard({ tenant }: { tenant: NocTenant }) {
  const expired = isExpired(tenant.fecha_vencimiento)
  const semColor = SEMAFORO_COLOR[tenant.semaforo] || '#94a3b8'
  const semBg = SEMAFORO_BG[tenant.semaforo] || 'rgba(148,163,184,0.1)'

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/70 overflow-hidden flex flex-col">
      {tenant.alertas_criticas > 0 && (
        <div className="bg-red-500/10 border-b border-red-500/30 px-4 py-1.5 flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-xs font-bold text-red-400">
            {tenant.alertas_criticas} alerta{tenant.alertas_criticas > 1 ? 's' : ''} critica{tenant.alertas_criticas > 1 ? 's' : ''}
          </span>
        </div>
      )}

      <div className="p-4 flex-1 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div
            className="w-3 h-3 rounded-full mt-1 shrink-0"
            style={{ background: semColor, boxShadow: '0 0 8px ' + semColor }}
            title={SEMAFORO_LABEL[tenant.semaforo]}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white text-sm truncate">{tenant.nombre}</span>
              {expired && (
                <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
                  VENCIDO
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{tenant.subdominio}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span
            className="text-xs px-2 py-0.5 rounded-full border font-medium"
            style={{ background: semBg, color: semColor, borderColor: semColor + '40' }}
          >
            {SEMAFORO_LABEL[tenant.semaforo]}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full border bg-slate-700/60 text-slate-300 border-slate-600 capitalize font-medium">
            {tenant.plan}
          </span>
          <span
            className={
              'text-xs px-2 py-0.5 rounded-full border font-medium capitalize ' +
              (tenant.estado === 'activo'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-700/60 text-slate-400 border-slate-600')
            }
          >
            {tenant.estado}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-1">
          {[
            { label: 'Usuarios', value: tenant.total_usuarios, d: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', color: '#818cf8' },
            { label: 'Condominios', value: tenant.total_condominios, d: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', color: '#22d3ee' },
            { label: 'Eventos hoy', value: tenant.eventos_hoy, d: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', color: '#fbbf24' },
            { label: 'Alertas', value: tenant.alertas_criticas, d: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', color: tenant.alertas_criticas > 0 ? '#ef4444' : '#64748b' },
            { label: 'Paquetes', value: tenant.paquetes_pendientes, d: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4', color: '#a78bfa' },
            { label: 'Disp. TCP', value: tenant.dispositivos_tcp, d: 'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18', color: '#38bdf8' },
          ].map(stat => (
            <div key={stat.label} className="flex flex-col items-center justify-center rounded-lg py-2 px-1 bg-slate-900/50">
              <svg className="w-3.5 h-3.5 mb-1" fill="none" stroke={stat.color} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={stat.d} />
              </svg>
              <span className="text-sm font-bold text-white">{stat.value}</span>
              <span className="text-[10px] text-slate-500 leading-tight text-center">{stat.label}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-700/50">
          <span className="text-[10px] text-slate-600">
            Ultimo login: <span className="text-slate-500">{timeAgo(tenant.ultimo_login)}</span>
          </span>
          {tenant.fecha_vencimiento && (
            <span className={'text-[10px] ' + (expired ? 'text-amber-500' : 'text-slate-600')}>
              {expired ? 'Vencio' : 'Vence'}: {new Date(tenant.fecha_vencimiento).toLocaleDateString('es-CL')}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function NocPage() {
  useSession()
  const [resumen, setResumen] = useState<NocResumen | null>(null)
  const [tenants, setTenants] = useState<NocTenant[]>([])
  const [health, setHealth] = useState<NocHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [filter, setFilter] = useState<SemaforoFilter>('todos')
  const [refreshing, setRefreshing] = useState(false)

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const [resumenRes, tenantsRes, healthRes] = await Promise.all([
        fetch('/api/noc/resumen'),
        fetch('/api/noc/tenants'),
        fetch('/api/noc/health'),
      ])
      if (resumenRes.ok) setResumen(await resumenRes.json())
      if (tenantsRes.ok) {
        const data = await tenantsRes.json()
        setTenants(Array.isArray(data) ? data : (data.tenants || data.data || []))
      }
      if (healthRes.ok) setHealth(await healthRes.json())
      setLastUpdated(new Date())
    } catch (_) {
      // silent fail - NOC shows last known data
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => fetchAll(true), 20000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchAll])

  const filteredTenants = filter === 'todos'
    ? tenants
    : tenants.filter(t => t.semaforo === filter)

  const filterCounts: Record<SemaforoFilter, number> = {
    todos: tenants.length,
    verde: tenants.filter(t => t.semaforo === 'verde').length,
    amarillo: tenants.filter(t => t.semaforo === 'amarillo').length,
    rojo: tenants.filter(t => t.semaforo === 'rojo').length,
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 17a2 2 0 002 2h2a2 2 0 002-2m0 0V7m0 10a2 2 0 012 2h2a2 2 0 012-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
            </div>
            <h1 className="text-2xl font-extrabold text-white">NOC &mdash; Centro de Operaciones</h1>
          </div>
          <p className="text-xs text-slate-500 ml-11">
            {lastUpdated
              ? 'Actualizado: ' + lastUpdated.toLocaleTimeString('es-CL')
              : 'Cargando datos...'}
            {refreshing && <span className="ml-2 text-indigo-400">&#8635;</span>}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(v => !v)}
            className={
              'flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg border transition ' +
              (autoRefresh
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700')
            }
          >
            <span className={'w-1.5 h-1.5 rounded-full ' + (autoRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600')} />
            Auto {autoRefresh ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={() => fetchAll(true)}
            disabled={refreshing}
            className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg border bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 transition disabled:opacity-50"
          >
            <svg className={'w-3.5 h-3.5 ' + (refreshing ? 'animate-spin' : '')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refrescar
          </button>
        </div>
      </div>

      {/* Health bar */}
      <HealthBar health={health} loadFailed={!loading && !health} />

      {/* Stats row */}
      {loading && !resumen ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {[0,1,2,3,4,5].map(i => (
            <div key={i} className="rounded-xl border border-slate-700 bg-slate-800/60 h-20 animate-pulse" />
          ))}
        </div>
      ) : resumen ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <StatCard
            label="Total condominios"
            value={resumen.total_tenants}
            color="#818cf8"
            icon="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
          <StatCard
            label="Activos"
            value={resumen.tenants_activos}
            color="#34d399"
            icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
          <StatCard
            label="Vencidos"
            value={resumen.tenants_vencidos}
            color="#fbbf24"
            icon="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
          <StatCard
            label="Usuarios totales"
            value={resumen.total_usuarios}
            color="#22d3ee"
            icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <StatCard
            label="Eventos hoy"
            value={resumen.total_eventos_hoy}
            color="#a78bfa"
            icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
          <StatCard
            label="Alertas criticas"
            value={resumen.total_alertas_criticas}
            color="#ef4444"
            alert
            icon="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </div>
      ) : null}

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mr-1">Filtrar:</span>
        {(['todos', 'verde', 'amarillo', 'rojo'] as SemaforoFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={
              'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition ' +
              (filter === f
                ? f === 'todos'
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                  : f === 'verde'
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                  : f === 'amarillo'
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/40'
                  : 'bg-red-500/15 text-red-400 border-red-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700')
            }
          >
            {f !== 'todos' && (
              <span className="w-2 h-2 rounded-full" style={{ background: SEMAFORO_COLOR[f] }} />
            )}
            <span className="capitalize">{f === 'todos' ? 'Todos' : SEMAFORO_LABEL[f]}</span>
            <span className="opacity-70">({filterCounts[f]})</span>
          </button>
        ))}
      </div>

      {/* Tenants grid */}
      {loading && tenants.length === 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[0,1,2,3,4,5].map(i => (
            <div key={i} className="rounded-xl border border-slate-700 bg-slate-800/60 h-56 animate-pulse" />
          ))}
        </div>
      ) : filteredTenants.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border border-slate-700 bg-slate-800/40">
          <svg className="w-12 h-12 text-slate-700 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 17a2 2 0 002 2h2a2 2 0 002-2m0 0V7m0 10a2 2 0 012 2h2a2 2 0 012-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
          <p className="text-slate-500 font-medium">No hay tenants en este filtro</p>
          <button
            onClick={() => setFilter('todos')}
            className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 transition"
          >
            Ver todos
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTenants.map(tenant => (
            <TenantCard key={tenant.id} tenant={tenant} />
          ))}
        </div>
      )}
    </div>
  )
}
