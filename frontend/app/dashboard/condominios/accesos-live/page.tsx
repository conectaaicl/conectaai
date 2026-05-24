'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

const useSession = () => {
  const [user, setUser] = useState<any>(null)
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => d && setUser(d))
  }, [])
  return { user }
}

type Evento = {
  fuente: 'puerta' | 'biometrico' | 'qr'
  tipo: string
  persona: string
  ubicacion: string
  zona: string
  metodo: string
  exitoso: boolean
  descripcion: string
  ts: string
}

type Resumen = {
  ingresos: number
  egresos: number
  visitas_activas: number
  fallidos: number
  total: number
}

const FUENTE_LABEL: Record<string, string> = {
  puerta: 'Puerta', biometrico: 'Biométrico', qr: 'QR Visita'
}
const FUENTE_COLOR: Record<string, string> = {
  puerta: 'bg-blue-100 text-blue-700',
  biometrico: 'bg-purple-100 text-purple-700',
  qr: 'bg-amber-100 text-amber-700',
}
const TIPO_ICON: Record<string, string> = {
  entrada: '↓', abrir: '↓', salida: '↑', cerrar: '↑',
  libre_paso: '⇅', bloquear: '🔒', acceso: '↔',
}

function timeAgo(ts: string): string {
  if (!ts) return ''
  const diff = (Date.now() - new Date(ts).getTime()) / 1000
  if (diff < 60) return `hace ${Math.round(diff)}s`
  if (diff < 3600) return `hace ${Math.round(diff / 60)}m`
  return new Date(ts).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

export default function AccesosLivePage() {
  const { user } = useSession()
  const [eventos, setEventos] = useState<Evento[]>([])
  const [resumen, setResumen] = useState<Resumen>({ ingresos: 0, egresos: 0, visitas_activas: 0, fallidos: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [filtroFuente, setFiltroFuente] = useState<string>('todos')
  const [filtroExito, setFiltroExito] = useState<string>('todos')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [pulso, setPulso] = useState(false)
  const tid = useRef<string | null>(null)

  useEffect(() => {
    tid.current = typeof window !== 'undefined' ? localStorage.getItem('current_condominio_id') : null
  }, [])

  const fetchData = useCallback(async () => {
    const t = tid.current
    if (!t) return
    try {
      const [evRes, rsRes] = await Promise.all([
        fetch(`/api/accesos/live?tenant_id=${t}&limit=80`),
        fetch(`/api/accesos/resumen-hoy?tenant_id=${t}`),
      ])
      if (evRes.ok) setEventos(await evRes.json())
      if (rsRes.ok) setResumen(await rsRes.json())
      setLastUpdate(new Date())
      setPulso(p => !p)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    tid.current = typeof window !== 'undefined' ? localStorage.getItem('current_condominio_id') : null
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!autoRefresh) return
    const iv = setInterval(fetchData, 12000)
    return () => clearInterval(iv)
  }, [autoRefresh, fetchData])

  const filtered = eventos.filter(e => {
    if (filtroFuente !== 'todos' && e.fuente !== filtroFuente) return false
    if (filtroExito === 'ok' && !e.exitoso) return false
    if (filtroExito === 'fallido' && e.exitoso) return false
    return true
  })

  const entradaHoy = resumen.ingresos
  const salidaHoy = resumen.egresos
  const activosAhora = resumen.visitas_activas
  const fallidos = resumen.fallidos

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accesos en Tiempo Real</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {lastUpdate ? `Actualizado ${lastUpdate.toLocaleTimeString('es-CL')}` : 'Cargando...'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refrescar
          </button>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <div
              onClick={() => setAutoRefresh(a => !a)}
              className={`w-9 h-5 rounded-full transition-colors ${autoRefresh ? 'bg-green-500' : 'bg-gray-300'} relative`}
            >
              <div className={`w-4 h-4 bg-white rounded-full shadow absolute top-0.5 transition-transform ${autoRefresh ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            Auto {autoRefresh ? 'ON' : 'OFF'}
          </label>
          {autoRefresh && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <span className={`w-2 h-2 rounded-full bg-green-500 ${pulso ? 'opacity-100' : 'opacity-40'} transition-opacity`} />
              En vivo
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Ingresos hoy', value: entradaHoy, icon: '↓', color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Egresos hoy', value: salidaHoy, icon: '↑', color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Visitas activas', value: activosAhora, icon: '●', color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Accesos fallidos', value: fallidos, icon: '✕', color: 'text-red-600', bg: 'bg-red-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4`}>
            <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-sm text-gray-600 mt-0.5 flex items-center gap-1">
              <span className={s.color}>{s.icon}</span> {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Filters + Feed */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Filter bar */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap bg-gray-50">
          <span className="text-sm font-medium text-gray-700">Fuente:</span>
          {['todos', 'puerta', 'biometrico', 'qr'].map(f => (
            <button
              key={f}
              onClick={() => setFiltroFuente(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filtroFuente === f ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'}`}
            >
              {f === 'todos' ? 'Todos' : FUENTE_LABEL[f]}
            </button>
          ))}
          <div className="h-4 w-px bg-gray-300" />
          <span className="text-sm font-medium text-gray-700">Estado:</span>
          {[['todos', 'Todos'], ['ok', '✓ OK'], ['fallido', '✕ Fallido']].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFiltroExito(v)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filtroExito === v ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'}`}
            >
              {l}
            </button>
          ))}
          <div className="ml-auto text-xs text-gray-400">{filtered.length} eventos</div>
        </div>

        {/* Event list */}
        {loading ? (
          <div className="p-12 text-center text-gray-400">Cargando eventos...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">🚪</div>
            <p className="text-gray-500">Sin eventos registrados aún</p>
            <p className="text-sm text-gray-400 mt-1">Los accesos por puertas, biometría y QR aparecerán aquí</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map((ev, i) => (
              <div
                key={i}
                className={`flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors ${!ev.exitoso ? 'bg-red-50/40' : ''}`}
              >
                {/* Icon */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0 ${ev.exitoso ? 'bg-green-100' : 'bg-red-100'}`}>
                  {ev.exitoso
                    ? (TIPO_ICON[ev.tipo] || '↔')
                    : '✕'}
                </div>
                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900 text-sm">{ev.persona}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${FUENTE_COLOR[ev.fuente]}`}>
                      {FUENTE_LABEL[ev.fuente]}
                    </span>
                    {!ev.exitoso && (
                      <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Fallido</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                    <span>{ev.ubicacion}{ev.zona ? ` · ${ev.zona}` : ''}</span>
                    {ev.metodo && <span className="text-gray-400">• {ev.metodo}</span>}
                    {ev.descripcion && <span className="text-gray-400">• {ev.descripcion}</span>}
                  </div>
                </div>
                {/* Type badge */}
                <div className="text-xs font-medium text-gray-500 capitalize shrink-0 hidden sm:block">
                  {ev.tipo}
                </div>
                {/* Time */}
                <div className="text-xs text-gray-400 shrink-0 text-right">
                  <div>{timeAgo(ev.ts)}</div>
                  <div className="text-gray-300">
                    {ev.ts ? new Date(ev.ts).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' }) : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
