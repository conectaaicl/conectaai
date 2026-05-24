'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────
interface Resumen {
  total_tenants: number
  tenants_activos: number
  tenants_vencidos: number
  total_usuarios: number
  total_eventos_hoy: number
  total_alertas_criticas: number
  total_paquetes_pendientes: number
  total_visitas_activas: number
}

interface Tenant {
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

interface Evento {
  id: number
  modulo: string
  accion: string
  descripcion: string
  created_at: string | null
  entidad_id: number | null
}

interface Alerta {
  id: number
  tipo: string
  nivel: string
  titulo: string
  descripcion: string | null
  servicio: string | null
  acknowledged: boolean
  created_at: string | null
}

interface Health {
  db: string
  backend: string
  timestamp: string
  version: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso: string | null): string {
  if (!iso) return 'nunca'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'hace ' + diff + 's'
  if (diff < 3600) return 'hace ' + Math.floor(diff / 60) + 'm'
  if (diff < 86400) return 'hace ' + Math.floor(diff / 3600) + 'h'
  return 'hace ' + Math.floor(diff / 86400) + 'd'
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return iso }
}

function isOverdue(iso: string | null): boolean {
  if (!iso) return false
  return new Date(iso) < new Date()
}

function isExpiringSoon(iso: string | null): boolean {
  if (!iso) return false
  const dt = new Date(iso)
  const now = new Date()
  const days30 = new Date(now.getTime() + 30 * 86400000)
  return dt > now && dt < days30
}

function moduloIcon(modulo: string): string {
  const m = modulo?.toLowerCase() || ''
  if (m.includes('puerta') || m.includes('acceso')) return '🚪'
  if (m.includes('rfid') || m.includes('tarjeta')) return '💳'
  if (m.includes('reserva')) return '📅'
  if (m.includes('visita')) return '👥'
  if (m.includes('paquete') || m.includes('paqueteria')) return '📦'
  if (m.includes('finanza') || m.includes('pago')) return '💰'
  if (m.includes('usuario')) return '👤'
  if (m.includes('alerta')) return '⚠️'
  return '📋'
}

function nivelColor(nivel: string): string {
  switch (nivel) {
    case 'critico': return 'text-red-400 bg-red-500/10 border-red-500/30'
    case 'alto': return 'text-orange-400 bg-orange-500/10 border-orange-500/30'
    case 'medio': return 'text-amber-400 bg-amber-500/10 border-amber-500/30'
    default: return 'text-slate-400 bg-slate-500/10 border-slate-500/30'
  }
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function NOCPage() {
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [filteredTenants, setFilteredTenants] = useState<Tenant[]>([])
  const [health, setHealth] = useState<Health | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [clock, setClock] = useState<string>('')
  const [expandedTenant, setExpandedTenant] = useState<number | null>(null)

  // Side panel
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelTenant, setPanelTenant] = useState<Tenant | null>(null)
  const [panelMode, setPanelMode] = useState<'actividad' | 'alertas'>('actividad')
  const [panelData, setPanelData] = useState<(Evento | Alerta)[]>([])
  const [panelLoading, setPanelLoading] = useState(false)
  const panelRefInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  // Clock
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setClock(now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // Fetch all data
  const fetchAll = useCallback(async () => {
    try {
      const [resumenRes, tenantsRes, healthRes] = await Promise.all([
        fetch('/api/noc/resumen', { credentials: 'include' }),
        fetch('/api/noc/tenants', { credentials: 'include' }),
        fetch('/api/noc/health', { credentials: 'include' }),
      ])
      if (resumenRes.ok) setResumen(await resumenRes.json())
      if (tenantsRes.ok) {
        const data = await tenantsRes.json()
        setTenants(data)
        setFilteredTenants(data)
      }
      if (healthRes.ok) setHealth(await healthRes.json())
      setLastRefresh(new Date())
    } catch (e) {
      console.error('NOC fetch error', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(fetchAll, 30000)
    return () => clearInterval(id)
  }, [fetchAll])

  // Search filter
  useEffect(() => {
    const q = search.toLowerCase()
    if (!q) {
      setFilteredTenants(tenants)
    } else {
      setFilteredTenants(tenants.filter(t =>
        t.nombre.toLowerCase().includes(q) ||
        (t.subdominio || '').toLowerCase().includes(q)
      ))
    }
  }, [search, tenants])

  // Panel fetch
  const openPanel = useCallback(async (tenant: Tenant, mode: 'actividad' | 'alertas') => {
    setPanelTenant(tenant)
    setPanelMode(mode)
    setPanelOpen(true)
    setPanelData([])
    setPanelLoading(true)
    if (panelRefInterval.current) clearInterval(panelRefInterval.current)

    const fetchPanel = async () => {
      try {
        const url = mode === 'actividad'
          ? `/api/noc/tenants/${tenant.id}/actividad`
          : `/api/noc/tenants/${tenant.id}/alertas`
        const res = await fetch(url, { credentials: 'include' })
        if (res.ok) setPanelData(await res.json())
      } catch { } finally {
        setPanelLoading(false)
      }
    }

    await fetchPanel()
    panelRefInterval.current = setInterval(fetchPanel, 15000)
  }, [])

  const closePanel = () => {
    setPanelOpen(false)
    setPanelTenant(null)
    setPanelData([])
    if (panelRefInterval.current) clearInterval(panelRefInterval.current)
  }

  // Semaforo dot
  const SemaforoDot = ({ semaforo }: { semaforo: string }) => {
    const cls = semaforo === 'rojo'
      ? 'bg-red-500 animate-pulse shadow-red-500/50'
      : semaforo === 'amarillo'
      ? 'bg-amber-400 animate-pulse shadow-amber-400/50'
      : 'bg-emerald-400 animate-pulse shadow-emerald-400/50'
    return <span className={`inline-block w-3 h-3 rounded-full shadow-md ${cls}`} />
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <div className="text-slate-400 text-sm">Cargando NOC...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">

      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {/* Radar icon */}
          <div className="w-9 h-9 bg-emerald-600/20 border border-emerald-500/30 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" strokeWidth="1.5"/>
              <circle cx="12" cy="12" r="6" strokeWidth="1.5"/>
              <circle cx="12" cy="12" r="2" strokeWidth="1.5"/>
              <path strokeLinecap="round" strokeWidth="1.5" d="M12 12 L18 6"/>
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-white text-base leading-tight">NOC — Centro de Control</h1>
            <div className="text-xs text-slate-500">Multi-tenant monitoring</div>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400 font-medium">Sistema operativo</span>
          </div>
          <div className="font-mono text-slate-300 text-sm tabular-nums">{clock}</div>
          <div className="text-xs text-slate-500">
            Actualizado: {lastRefresh.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <button
            onClick={() => { setLoading(true); fetchAll() }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0115.3-4.3M20 15a9 9 0 01-15.3 4.3"/>
            </svg>
            Refrescar
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* ── Main Content ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ── Stats Bar ──────────────────────────────────────────────── */}
          {resumen && (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              <StatCard
                label="Tenants Activos"
                value={resumen.tenants_activos}
                total={resumen.total_tenants}
                color="indigo"
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>}
              />
              <StatCard
                label="Alertas Críticas"
                value={resumen.total_alertas_criticas}
                color={resumen.total_alertas_criticas > 0 ? 'red' : 'slate'}
                alert={resumen.total_alertas_criticas > 0}
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>}
              />
              <StatCard
                label="Eventos Hoy"
                value={resumen.total_eventos_hoy}
                color="cyan"
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>}
              />
              <StatCard
                label="Paquetes Pendientes"
                value={resumen.total_paquetes_pendientes}
                color="amber"
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>}
              />
              <StatCard
                label="Visitas Activas"
                value={resumen.total_visitas_activas}
                color="emerald"
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"/></svg>}
              />
              <StatCard
                label="Usuarios Total"
                value={resumen.total_usuarios}
                color="violet"
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>}
              />
            </div>
          )}

          {/* ── Search ─────────────────────────────────────────────────── */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input
                type="text"
                placeholder="Buscar tenant..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="text-xs text-slate-500">{filteredTenants.length} tenants</div>
            <div className="flex items-center gap-3 ml-auto">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> Verde: activo
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="w-2 h-2 rounded-full bg-amber-400" /> Amarillo: sin actividad
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="w-2 h-2 rounded-full bg-red-500" /> Rojo: alerta/vencido
              </div>
            </div>
          </div>

          {/* ── Tenants Grid ───────────────────────────────────────────── */}
          {filteredTenants.length === 0 && !loading ? (
            <div className="text-center py-20 text-slate-600">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16"/>
              </svg>
              <div>No hay tenants que coincidan</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredTenants.map(tenant => (
                <TenantCard
                  key={tenant.id}
                  tenant={tenant}
                  expanded={expandedTenant === tenant.id}
                  onToggleExpand={() => setExpandedTenant(prev => prev === tenant.id ? null : tenant.id)}
                  onActividad={() => openPanel(tenant, 'actividad')}
                  onAlertas={() => openPanel(tenant, 'alertas')}
                  SemaforoDot={SemaforoDot}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Side Panel ───────────────────────────────────────────────── */}
        {panelOpen && panelTenant && (
          <>
            <div className="fixed inset-0 bg-black/40 z-30" onClick={closePanel} />
            <aside className="fixed right-0 top-0 h-full w-96 bg-slate-900 border-l border-slate-700 z-40 flex flex-col shadow-2xl">
              {/* Panel header */}
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white text-sm">{panelTenant.nombre}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {panelMode === 'actividad' ? 'Últimos 50 eventos' : 'Alertas activas'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openPanel(panelTenant, 'actividad')}
                    className={`px-2.5 py-1 rounded text-xs ${panelMode === 'actividad' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >Actividad</button>
                  <button
                    onClick={() => openPanel(panelTenant, 'alertas')}
                    className={`px-2.5 py-1 rounded text-xs ${panelMode === 'alertas' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >Alertas</button>
                  <button onClick={closePanel} className="p-1.5 text-slate-400 hover:text-white rounded">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Panel content */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {panelLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : panelData.length === 0 ? (
                  <div className="text-center py-10 text-slate-600 text-sm">Sin datos</div>
                ) : panelMode === 'actividad' ? (
                  (panelData as Evento[]).map(ev => (
                    <div key={ev.id} className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/50">
                      <div className="flex items-start gap-2">
                        <span className="text-base leading-none mt-0.5">{moduloIcon(ev.modulo)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-indigo-300 truncate">{ev.modulo} / {ev.accion}</span>
                            <span className="text-xs text-slate-500 whitespace-nowrap">{timeAgo(ev.created_at)}</span>
                          </div>
                          <div className="text-xs text-slate-400 mt-1 line-clamp-2">{ev.descripcion}</div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  (panelData as Alerta[]).map(al => (
                    <div key={al.id} className={`rounded-lg p-3 border ${nivelColor(al.nivel)}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold uppercase tracking-wide`}>{al.nivel}</span>
                            {al.acknowledged && <span className="text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">ACK</span>}
                          </div>
                          <div className="text-sm font-medium text-white mt-1">{al.titulo}</div>
                          {al.descripcion && <div className="text-xs text-slate-400 mt-1">{al.descripcion}</div>}
                          {al.servicio && <div className="text-xs text-slate-500 mt-1">Servicio: {al.servicio}</div>}
                        </div>
                        <span className="text-xs text-slate-500 whitespace-nowrap">{timeAgo(al.created_at)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Panel footer */}
              <div className="p-3 border-t border-slate-800">
                <div className="text-xs text-slate-600 text-center">Actualización automática cada 15s</div>
              </div>
            </aside>
          </>
        )}
      </div>

      {/* ── Health Footer ────────────────────────────────────────────────── */}
      <div className="bg-slate-900/80 border-t border-slate-800 px-6 py-2 flex items-center gap-5 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs">
          <span className={`w-2 h-2 rounded-full ${health?.db === 'ok' ? 'bg-emerald-400' : 'bg-red-500'}`} />
          <span className="text-slate-400">DB</span>
          <span className={health?.db === 'ok' ? 'text-emerald-400' : 'text-red-400'}>{health?.db || '...'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className={`w-2 h-2 rounded-full ${health?.backend === 'ok' ? 'bg-emerald-400' : 'bg-red-500'}`} />
          <span className="text-slate-400">Backend</span>
          <span className={health?.backend === 'ok' ? 'text-emerald-400' : 'text-red-400'}>{health?.backend || '...'}</span>
        </div>
        <div className="text-xs text-slate-600">Version {health?.version || '2.0.0'}</div>
        <div className="text-xs text-slate-600 ml-auto">
          Auto-refresh: 30s | Panel: 15s
        </div>
      </div>
    </div>
  )
}

// ── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({
  label, value, total, color, alert, icon
}: {
  label: string
  value: number
  total?: number
  color: string
  alert?: boolean
  icon: React.ReactNode
}) {
  const colors: Record<string, string> = {
    indigo: 'text-indigo-400',
    red: 'text-red-400',
    cyan: 'text-cyan-400',
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
    violet: 'text-violet-400',
    slate: 'text-slate-400',
  }
  const bgs: Record<string, string> = {
    indigo: 'bg-indigo-500/10 border-indigo-500/20',
    red: 'bg-red-500/10 border-red-500/20',
    cyan: 'bg-cyan-500/10 border-cyan-500/20',
    amber: 'bg-amber-500/10 border-amber-500/20',
    emerald: 'bg-emerald-500/10 border-emerald-500/20',
    violet: 'bg-violet-500/10 border-violet-500/20',
    slate: 'bg-slate-800 border-slate-700',
  }
  return (
    <div className={`rounded-xl border p-4 ${alert ? 'bg-red-950/40 border-red-500/40 animate-pulse' : bgs[color] || bgs.slate}`}>
      <div className={`${colors[color] || colors.slate} mb-2`}>{icon}</div>
      <div className={`text-2xl font-bold ${colors[color] || colors.slate} tabular-nums`}>
        {value.toLocaleString()}
        {total !== undefined && <span className="text-sm font-normal text-slate-600">/{total}</span>}
      </div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  )
}

// ── TenantCard ────────────────────────────────────────────────────────────────
function TenantCard({
  tenant, expanded, onToggleExpand, onActividad, onAlertas, SemaforoDot
}: {
  tenant: Tenant
  expanded: boolean
  onToggleExpand: () => void
  onActividad: () => void
  onAlertas: () => void
  SemaforoDot: React.ComponentType<{ semaforo: string }>
}) {
  const overdue = isOverdue(tenant.fecha_vencimiento)
  const expiring = isExpiringSoon(tenant.fecha_vencimiento)

  const estadoBadge = (estado: string) => {
    if (estado === 'activo') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    if (estado === 'suspendido') return 'bg-red-500/20 text-red-400 border-red-500/30'
    return 'bg-slate-700 text-slate-400 border-slate-600'
  }

  const planBadge = (plan: string) => {
    if (!plan) return 'bg-slate-700 text-slate-400'
    if (plan.toLowerCase().includes('pro')) return 'bg-violet-500/20 text-violet-300'
    if (plan.toLowerCase().includes('basic')) return 'bg-slate-700 text-slate-300'
    return 'bg-indigo-500/20 text-indigo-300'
  }

  return (
    <div className={`bg-slate-900 border rounded-xl overflow-hidden transition-all ${
      tenant.semaforo === 'rojo' ? 'border-red-500/30' :
      tenant.semaforo === 'amarillo' ? 'border-amber-400/20' :
      'border-slate-800 hover:border-slate-700'
    }`}>
      {/* Card header */}
      <div className="p-4 cursor-pointer" onClick={onToggleExpand}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <SemaforoDot semaforo={tenant.semaforo} />
            <div className="min-w-0">
              <div className="font-semibold text-white text-sm truncate">{tenant.nombre}</div>
              <div className="text-xs text-slate-500 truncate">{tenant.subdominio}.conectaai.cl</div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {tenant.plan && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${planBadge(tenant.plan)}`}>
                {tenant.plan}
              </span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${estadoBadge(tenant.estado)}`}>
              {tenant.estado || 'activo'}
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-3 flex items-center gap-4 text-xs">
          <div className="text-slate-400">
            <span className="text-slate-300 font-medium">{tenant.total_usuarios}</span> usuarios
          </div>
          <div className="text-slate-400">
            <span className={tenant.eventos_hoy > 0 ? 'text-cyan-400 font-medium' : 'text-slate-500'}>
              {tenant.eventos_hoy}
            </span> eventos hoy
          </div>
          {tenant.alertas_criticas > 0 && (
            <div className="text-red-400 font-medium flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L1 21h22L12 2zm0 3.5L20.5 19h-17L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/></svg>
              {tenant.alertas_criticas} críticas
            </div>
          )}
        </div>

        {/* Last login + vencimiento */}
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
          <span>Último login: {timeAgo(tenant.ultimo_login)}</span>
          <span className={overdue ? 'text-red-400 font-medium' : expiring ? 'text-amber-400' : ''}>
            Vence: {fmtDate(tenant.fecha_vencimiento)}
            {overdue && ' ⚠ vencido'}
            {expiring && !overdue && ' (pronto)'}
          </span>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-3 border-t border-slate-800/50 pt-3">
          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <div className="bg-slate-800/60 rounded-lg p-2.5">
              <div className="text-slate-500">Condominios</div>
              <div className="text-white font-medium mt-0.5">{tenant.total_condominios}</div>
            </div>
            <div className="bg-slate-800/60 rounded-lg p-2.5">
              <div className="text-slate-500">Dispositivos TCP</div>
              <div className="text-white font-medium mt-0.5">{tenant.dispositivos_tcp}</div>
            </div>
            <div className="bg-slate-800/60 rounded-lg p-2.5">
              <div className="text-slate-500">Paquetes pendientes</div>
              <div className="text-white font-medium mt-0.5">{tenant.paquetes_pendientes}</div>
            </div>
            <div className="bg-slate-800/60 rounded-lg p-2.5">
              <div className="text-slate-500">Visitas activas</div>
              <div className="text-white font-medium mt-0.5">{tenant.visitas_activas}</div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 pb-4 flex gap-2">
        <button
          onClick={onActividad}
          className="flex-1 py-1.5 text-xs bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-500/20 rounded-lg transition"
        >
          Ver Actividad
        </button>
        <button
          onClick={onAlertas}
          className={`flex-1 py-1.5 text-xs border rounded-lg transition ${
            tenant.alertas_criticas > 0
              ? 'bg-red-600/20 hover:bg-red-600/40 text-red-400 border-red-500/20'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
          }`}
        >
          Ver Alertas {tenant.alertas_criticas > 0 && `(${tenant.alertas_criticas})`}
        </button>
        <a
          href={`/dashboard?tenant_id=${tenant.id}`}
          className="flex-1 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 rounded-lg transition text-center"
          target="_blank"
          rel="noopener noreferrer"
        >
          Ir al panel
        </a>
      </div>
    </div>
  )
}