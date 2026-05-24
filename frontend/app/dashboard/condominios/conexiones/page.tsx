'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from '@/hooks/useSession'

interface Check {
  id?: number
  nombre: string
  tipo: string
  ip?: string
  puerto?: number
  protocolo?: string
  ubicacion?: string
  modelo?: string
  estado: 'verde' | 'amarillo' | 'rojo'
  latency_ms: number
  detalle?: string
}

interface Resumen {
  estado_general: 'verde' | 'amarillo' | 'rojo'
  verde: number
  amarillo: number
  rojo: number
  total: number
}

interface EstadoResponse { resumen: Resumen; checks: Check[] }

interface Dispositivo {
  id: number; nombre: string; tipo: string; ip: string; puerto: number
  protocolo: string; modelo: string | null; ubicacion: string | null
  activo: boolean; ultimo_estado: string; ultima_comprobacion: string | null
}

interface Evento {
  id: number
  tipo: string
  card_uid?: string
  persona_nombre?: string
  persona_id?: number
  resultado: string
  dispositivo_id?: number
  puerta_id?: number
  detalle?: string
  created_at: string
}

const TIPOS_DISPOSITIVO = [
  { value: 'controlador_puerta', label: 'Controlador de Puerta' },
  { value: 'lector_rfid', label: 'Lector RFID' },
  { value: 'lector_huella', label: 'Lector Biométrico' },
  { value: 'panel_alarma', label: 'Panel de Alarma' },
  { value: 'camara', label: 'Cámara IP' },
]

const TIPO_ICON: Record<string, string> = {
  controlador_puerta: '🚪', lector_rfid: '💳', lector_huella: '👆',
  panel_alarma: '🔔', camara: '📷', servicio: '⚡', Controlador: '🚪',
  'Lector RFID': '💳', Biométrico: '👆', 'Panel Alarma': '🔔', 'Cámara': '📷'
}

const RESULTADO_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  permitido:            { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Permitido' },
  denegado_desconocido: { bg: 'bg-red-100',     text: 'text-red-700',     label: 'Desconocido' },
  denegado_inactiva:    { bg: 'bg-orange-100',  text: 'text-orange-700',  label: 'Tarjeta inactiva' },
  ok:                   { bg: 'bg-blue-100',    text: 'text-blue-700',    label: 'OK' },
  desconocido:          { bg: 'bg-slate-100',   text: 'text-slate-600',   label: 'Sin resultado' },
  error:                { bg: 'bg-red-100',     text: 'text-red-600',     label: 'Error' },
}

function Semaforo({ estado }: { estado: string }) {
  const color = estado === 'verde' ? 'bg-emerald-500' : estado === 'amarillo' ? 'bg-amber-400' : 'bg-red-500'
  const glow = estado === 'verde' ? 'shadow-emerald-300' : estado === 'amarillo' ? 'shadow-amber-300' : 'shadow-red-300'
  return <span className={`inline-block w-3 h-3 rounded-full ${color} shadow-lg ${glow} animate-pulse`} />
}

function EstadoBadge({ estado }: { estado: string }) {
  const styles: Record<string, string> = {
    verde:    'bg-emerald-100 text-emerald-700 border-emerald-200',
    amarillo: 'bg-amber-100 text-amber-700 border-amber-200',
    rojo:     'bg-red-100 text-red-700 border-red-200',
  }
  const labels: Record<string, string> = { verde: 'Online', amarillo: 'Degradado', rojo: 'Offline' }
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[estado] || styles.rojo}`}>
      {labels[estado] || estado}
    </span>
  )
}

export default function ConexionesPage() {
  const { tenantId } = useSession()
  const [data, setData] = useState<EstadoResponse | null>(null)
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([])
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState<number | null>(null)
  const [commanding, setCommanding] = useState<number | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [eventos, setEventos] = useState<Evento[]>([])
  const [sseConnected, setSseConnected] = useState(false)
  const [liveCount, setLiveCount] = useState(0)
  const sseRef = useRef<EventSource | null>(null)
  const eventosRef = useRef<Evento[]>([])

  // Network scanner state
  const [scanSubnet, setScanSubnet] = useState('192.168.1')
  const [scanPorts, setScanPorts] = useState<number[]>([4370, 80, 8080, 23])
  const [scanning, setScanning] = useState(false)
  const [scanResults, setScanResults] = useState<any[]>([])
  const [deviceTests, setDeviceTests] = useState<Record<string, any>>({})

  async function runNetworkScan() {
    setScanning(true)
    setScanResults([])
    try {
      const res = await fetch('/api/scanner/network/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subnet: scanSubnet, ports: scanPorts, timeout_ms: 500 }),
      })
      if (res.ok) setScanResults(await res.json())
    } finally { setScanning(false) }
  }

  async function testDevice(id: number, ip: string, port: number) {
    setDeviceTests(prev => ({ ...prev, [id]: { testing: true } }))
    try {
      const res = await fetch(`/api/scanner/device/test?host=${ip}&port=${port}&timeout_ms=3000`)
      if (res.ok) {
        const data = await res.json()
        setDeviceTests(prev => ({ ...prev, [id]: { testing: false, ...data } }))
      }
    } catch {
      setDeviceTests(prev => ({ ...prev, [id]: { testing: false, reachable: false } }))
    }
  }

  function addScanResultAsDevice(r: any) {
    setForm(prev => ({ ...prev, ip: r.ip, puerto: r.port }))
    setShowModal(true)
  }

  const [form, setForm] = useState({
    nombre: '', tipo: 'controlador_puerta', ip: '', puerto: 4370,
    protocolo: 'tcp', modelo: '', ubicacion: ''
  })

  const fetchEstado = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const [estRes, dispRes] = await Promise.all([
        fetch(`/api/sistema/estado?tenant_id=${tenantId}`),
        fetch(`/api/sistema/dispositivos?tenant_id=${tenantId}`)
      ])
      if (estRes.ok) setData(await estRes.json())
      if (dispRes.ok) setDispositivos(await dispRes.json())
      setLastRefresh(new Date())
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [tenantId])

  // Load initial events
  const fetchEventos = useCallback(async () => {
    if (!tenantId) return
    try {
      const r = await fetch(`/api/sistema/eventos?tenant_id=${tenantId}&limit=50`)
      if (r.ok) {
        const data = await r.json()
        setEventos(data)
        eventosRef.current = data
      }
    } catch { /* ignore */ }
  }, [tenantId])

  useEffect(() => { fetchEstado(); fetchEventos() }, [fetchEstado, fetchEventos])

  // Auto-refresh every 30s
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchEstado, 30000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchEstado])

  // SSE live events connection
  useEffect(() => {
    if (!tenantId) return
    let es: EventSource | null = null
    let retryTimeout: ReturnType<typeof setTimeout> | null = null

    function connect() {
      es = new EventSource(`/api/sistema/eventos/stream?tenant_id=${tenantId}`)
      sseRef.current = es
      es.onopen = () => setSseConnected(true)
      es.onerror = () => {
        setSseConnected(false)
        es?.close()
        retryTimeout = setTimeout(connect, 5000)
      }
      es.onmessage = (e) => {
        try {
          const ev: Evento = JSON.parse(e.data)
          setLiveCount(n => n + 1)
          setEventos(prev => {
            const next = [ev, ...prev].slice(0, 100)
            eventosRef.current = next
            return next
          })
        } catch { /* ignore malformed */ }
      }
    }

    connect()
    return () => {
      es?.close()
      sseRef.current = null
      if (retryTimeout) clearTimeout(retryTimeout)
      setSseConnected(false)
    }
  }, [tenantId])

  async function handleTest(id: number) {
    setTesting(id)
    try {
      const r = await fetch(`/api/sistema/dispositivos/${id}/test`, { method: 'POST' })
      const d = await r.json()
      setMsg({ type: d.estado !== 'rojo' ? 'ok' : 'err', text: `${d.nombre}: ${d.estado} — ${d.latency_ms}ms${d.error ? ` (${d.error})` : ''}` })
      fetchEstado()
    } catch { setMsg({ type: 'err', text: 'Error al probar' }) } finally { setTesting(null) }
  }

  async function handleComando(id: number, comando: string) {
    if (!confirm(`¿Enviar comando "${comando}" al dispositivo?`)) return
    setCommanding(id)
    try {
      const r = await fetch(`/api/sistema/dispositivos/${id}/comando`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comando, duracion_segundos: 5 })
      })
      const d = await r.json()
      if (r.ok) setMsg({ type: 'ok', text: `Comando "${comando}" enviado a ${d.dispositivo}` })
      else setMsg({ type: 'err', text: d.detail || 'Error al enviar comando' })
    } catch { setMsg({ type: 'err', text: 'Error de conexión' }) } finally { setCommanding(null) }
  }

  async function handleEliminar(id: number) {
    if (!confirm('¿Eliminar este dispositivo?')) return
    await fetch(`/api/sistema/dispositivos/${id}`, { method: 'DELETE' })
    fetchEstado()
  }

  async function handleCrear(ev: React.FormEvent) {
    ev.preventDefault()
    if (!tenantId) return
    setSaving(true)
    try {
      const r = await fetch('/api/sistema/dispositivos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, tenant_id: tenantId, puerto: parseInt(String(form.puerto)) })
      })
      if (r.ok) {
        setShowModal(false)
        setForm({ nombre: '', tipo: 'controlador_puerta', ip: '', puerto: 4370, protocolo: 'tcp', modelo: '', ubicacion: '' })
        fetchEstado()
        setMsg({ type: 'ok', text: 'Dispositivo registrado' })
      } else {
        const e = await r.json(); setMsg({ type: 'err', text: e.detail || 'Error al crear' })
      }
    } catch { setMsg({ type: 'err', text: 'Error de conexión' }) } finally { setSaving(false) }
  }

  const resumen = data?.resumen
  const checks = data?.checks || []
  const servicios = checks.filter(c => !c.id)
  const dispositivoChecks = checks.filter(c => c.id)

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Conexiones y Comunicaciones</h1>
          <p className="text-sm text-slate-500">Estado TCP/IP de controladores, lectores y servicios</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`w-2 h-2 rounded-full ${sseConnected ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
            {sseConnected ? 'Live' : 'Reconectando...'}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="w-4 h-4 rounded" />
            Auto 30s
          </label>
          <button onClick={fetchEstado} disabled={loading}
            className="border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-50">
            {loading ? '⏳' : '🔄'} Verificar
          </button>
          <button onClick={() => setShowModal(true)}
            className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
            + Dispositivo
          </button>
        </div>
      </div>

      {msg && (
        <div className={`rounded-lg p-3 text-sm flex items-center justify-between ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="ml-2 opacity-60 hover:opacity-100 text-lg leading-none">×</button>
        </div>
      )}

      {/* Network Scanner Section */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Escaner de Red</h2>
            <p className="text-xs text-slate-400 mt-0.5">Descubre controladores y lectores RFID en la red local</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-end mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Subred</label>
            <input value={scanSubnet} onChange={e => setScanSubnet(e.target.value)} placeholder="192.168.1" className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 w-36" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Puertos</label>
            <div className="flex flex-wrap gap-2">
              {[{p:4370,l:'4370 ZKTeco'},{p:80,l:'80 HTTP'},{p:8080,l:'8080 Alt'},{p:23,l:'23 Telnet'},{p:26,l:'26 Alt'},{p:8000,l:'8000 API'}].map(({p,l}) => (
                <label key={p} className="flex items-center gap-1 text-xs cursor-pointer border border-slate-200 rounded-lg px-2 py-1 hover:bg-slate-50">
                  <input type="checkbox" checked={scanPorts.includes(p)} onChange={e => setScanPorts(prev => e.target.checked ? [...prev, p] : prev.filter(x => x !== p))} className="rounded" />
                  {l}
                </label>
              ))}
            </div>
          </div>
          <button onClick={runNetworkScan} disabled={scanning} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2">
            {scanning ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            )}
            {scanning ? 'Escaneando...' : 'Escanear'}
          </button>
        </div>
        {scanning && <p className="text-sm text-slate-500 text-center py-4 animate-pulse">Escaneando {scanSubnet}.1 hasta .254...</p>}
        {!scanning && scanResults.length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-500 mb-3">{scanResults.length} dispositivo(s) encontrado(s)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {scanResults.map((r, i) => {
                const isZk = r.device_type && (r.device_type.includes('ZKTeco') || r.device_type.includes('RFID'))
                const isHttp = r.device_type && r.device_type.includes('HTTP')
                const cls = isZk ? 'border-green-300 bg-green-50' : isHttp ? 'border-blue-300 bg-blue-50' : 'border-purple-300 bg-purple-50'
                const tc = isZk ? 'text-green-700' : isHttp ? 'text-blue-700' : 'text-purple-700'
                return (
                  <div key={i} className={'border-2 rounded-xl p-4 ' + cls}>
                    <p className="font-mono text-sm font-semibold text-slate-800">{r.ip}:{r.port}</p>
                    <p className={'text-xs font-medium mt-0.5 ' + tc}>{r.device_type}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{r.latency_ms}ms</p>
                    <button onClick={() => addScanResultAsDevice(r)} className="mt-3 w-full text-xs bg-slate-700 text-white py-1.5 rounded-lg hover:bg-slate-800 transition">
                      + Agregar como conexion
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {!scanning && scanResults.length === 0 && (
          <p className="text-center text-slate-400 text-sm py-2">Configura la subred y presiona Escanear</p>
        )}
      </div>

      {/* Resumen general */}
      {resumen && (
        <div className={`rounded-xl border-2 p-5 ${resumen.estado_general === 'verde' ? 'bg-emerald-50 border-emerald-200' : resumen.estado_general === 'amarillo' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold shadow-lg ${resumen.estado_general === 'verde' ? 'bg-emerald-500 text-white' : resumen.estado_general === 'amarillo' ? 'bg-amber-400 text-white' : 'bg-red-500 text-white'}`}>
              {resumen.estado_general === 'verde' ? '✓' : resumen.estado_general === 'amarillo' ? '!' : '✕'}
            </div>
            <div className="flex-1">
              <p className="font-bold text-lg text-slate-800">
                {resumen.estado_general === 'verde' ? 'Todos los sistemas operativos' : resumen.estado_general === 'amarillo' ? 'Algunos sistemas degradados' : `${resumen.rojo} sistema${resumen.rojo !== 1 ? 's' : ''} fuera de línea`}
              </p>
              <p className="text-sm text-slate-600 mt-0.5">
                {lastRefresh ? `Actualizado: ${lastRefresh.toLocaleTimeString('es-CL')}` : 'Verificando...'}
              </p>
            </div>
            <div className="flex gap-4 text-center">
              <div><p className="text-2xl font-bold text-emerald-600">{resumen.verde}</p><p className="text-xs text-slate-500">Online</p></div>
              <div><p className="text-2xl font-bold text-amber-500">{resumen.amarillo}</p><p className="text-xs text-slate-500">Degradado</p></div>
              <div><p className="text-2xl font-bold text-red-500">{resumen.rojo}</p><p className="text-xs text-slate-500">Offline</p></div>
            </div>
          </div>
        </div>
      )}

      {/* Servicios internos */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <h2 className="font-semibold text-slate-700 mb-3 text-sm uppercase tracking-wide">Servicios del Sistema</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {servicios.map((c, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50">
              <Semaforo estado={c.estado} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800 text-sm">{c.nombre}</p>
                <p className="text-xs text-slate-500 truncate">{c.detalle}</p>
              </div>
              <div className="text-right">
                <EstadoBadge estado={c.estado} />
                {c.latency_ms > 0 && <p className="text-xs text-slate-400 mt-0.5">{c.latency_ms}ms</p>}
              </div>
            </div>
          ))}
          {servicios.length === 0 && loading && (
            <div className="col-span-3 text-center py-6"><div className="w-6 h-6 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
          )}
        </div>
      </div>

      {/* Dispositivos TCP/IP */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Dispositivos TCP/IP ({dispositivoChecks.length})</h2>
        </div>
        {dispositivoChecks.length === 0 && dispositivos.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-3xl mb-2">🔌</p>
            <p className="text-slate-500 text-sm">No hay dispositivos registrados</p>
            <p className="text-slate-400 text-xs mt-1">Agrega controladores de puertas, lectores RFID o biométricos</p>
            <button onClick={() => setShowModal(true)} className="mt-3 text-indigo-600 text-sm hover:underline">+ Agregar primer dispositivo</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>{['Estado', 'Nombre', 'Tipo', 'IP:Puerto', 'Ubicación', 'Latencia', 'Acciones'].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-xs font-medium text-slate-500">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {dispositivoChecks.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3"><Semaforo estado={c.estado} /></td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-800">{TIPO_ICON[c.tipo] || '🔌'} {c.nombre}</p>
                      {c.modelo && <p className="text-xs text-slate-400">{c.modelo}</p>}
                    </td>
                    <td className="px-3 py-3 text-slate-600 text-xs">{c.tipo}</td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-600">{c.ip}:{c.puerto}</td>
                    <td className="px-3 py-3 text-slate-500 text-xs">{c.ubicacion || '—'}</td>
                    <td className="px-3 py-3">
                      <span className={`text-xs font-mono ${c.estado === 'rojo' ? 'text-red-500' : c.estado === 'amarillo' ? 'text-amber-500' : 'text-emerald-600'}`}>
                        {c.estado === 'rojo' ? '—' : `${c.latency_ms}ms`}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1 flex-wrap">
                        <button onClick={() => handleTest(c.id!)} disabled={testing === c.id}
                          className="text-xs px-2 py-1 rounded bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 disabled:opacity-50"
                          title="Probar conexión">
                          {testing === c.id ? '⏳' : '📡 Test'}
                        </button>
                        {(c.tipo === 'Controlador' || c.tipo === 'controlador_puerta') ? (
                          <button onClick={() => handleComando(c.id!, 'abrir')} disabled={commanding === c.id || c.estado === 'rojo'}
                            className="text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 disabled:opacity-50"
                            title="Abrir puerta">
                            🚪 Abrir
                          </button>
                        ) : null}
                        <button onClick={() => handleEliminar(c.id!)}
                          className="text-xs px-2 py-1 rounded bg-red-50 text-red-500 hover:bg-red-100 border border-red-200"
                          title="Eliminar">
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Live Events Feed ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Eventos en Tiempo Real</h2>
            {liveCount > 0 && (
              <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                +{liveCount} nuevos
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs">
              <span className={`w-2 h-2 rounded-full ${sseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
              <span className={sseConnected ? 'text-emerald-600 font-medium' : 'text-slate-400'}>
                {sseConnected ? 'Escuchando dispositivos...' : 'Reconectando...'}
              </span>
            </div>
            <button onClick={() => { fetchEventos(); setLiveCount(0) }}
              className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 px-2 py-1 rounded-lg">
              ↻ Recargar
            </button>
          </div>
        </div>

        {eventos.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-slate-200 rounded-lg">
            <p className="text-3xl mb-2">📡</p>
            <p className="text-slate-500 text-sm font-medium">Esperando eventos de dispositivos</p>
            <p className="text-slate-400 text-xs mt-1">
              Los eventos de lectores RFID, biométricos y controladores aparecerán aquí en tiempo real
            </p>
            <div className="mt-3 text-xs text-slate-400 bg-slate-50 rounded-lg p-3 max-w-sm mx-auto text-left">
              <p className="font-medium text-slate-500 mb-1">Endpoint para dispositivos:</p>
              <code className="block font-mono text-blue-600">POST /api/sistema/eventos</code>
              <code className="block font-mono text-slate-400 text-xs mt-0.5">{'{ "tenant_id": X, "tipo": "rfid_swipe", "card_uid": "ABC123" }'}</code>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-100">
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                  <tr>
                    {['Hora', 'Tipo', 'Persona / Tarjeta', 'Resultado', 'Detalle'].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 text-xs font-medium text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {eventos.map((ev, idx) => {
                    const res = RESULTADO_CONFIG[ev.resultado] || RESULTADO_CONFIG.desconocido
                    const isNew = idx < liveCount
                    return (
                      <tr key={ev.id} className={`transition-colors ${isNew ? 'bg-emerald-50/60' : 'hover:bg-slate-50'}`}>
                        <td className="px-3 py-2.5 text-xs text-slate-400 font-mono whitespace-nowrap">
                          {new Date(ev.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-xs font-medium text-slate-700">
                            {ev.tipo === 'rfid_swipe' ? '💳' : ev.tipo === 'huella' ? '👆' : ev.tipo === 'panico' ? '🚨' : ev.tipo === 'puerta_abierta' ? '🚪' : '📡'}
                            {' '}{ev.tipo.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="text-xs font-medium text-slate-800">{ev.persona_nombre || '—'}</p>
                          {ev.card_uid && <p className="text-xs text-slate-400 font-mono">{ev.card_uid}</p>}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${res.bg} ${res.text}`}>
                            {res.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-500 max-w-xs truncate">
                          {ev.detalle || (ev.dispositivo_id ? `Dispositivo #${ev.dispositivo_id}` : '—')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Nuevo Dispositivo */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Registrar Dispositivo TCP/IP</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
            </div>
            <form onSubmit={handleCrear} className="p-5 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
                <input required type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Controlador Entrada Principal"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo *</label>
                <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                  {TIPOS_DISPOSITIVO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dirección IP *</label>
                  <input required type="text" value={form.ip} onChange={e => setForm({ ...form, ip: e.target.value })}
                    placeholder="192.168.1.100"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Puerto *</label>
                  <input required type="number" value={form.puerto} onChange={e => setForm({ ...form, puerto: parseInt(e.target.value) })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Protocolo</label>
                <select value={form.protocolo} onChange={e => setForm({ ...form, protocolo: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                  <option value="tcp">TCP</option>
                  <option value="onvif">ONVIF</option>
                  <option value="rtsp">RTSP</option>
                  <option value="sdk">SDK Propietario</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Modelo</label>
                <input type="text" value={form.modelo} onChange={e => setForm({ ...form, modelo: e.target.value })}
                  placeholder="ZKTeco K40, HID iCLASS..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ubicación</label>
                <input type="text" value={form.ubicacion} onChange={e => setForm({ ...form, ubicacion: e.target.value })}
                  placeholder="Entrada principal, Estacionamiento..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                💡 Puertos típicos: ZKTeco 4370, HID TCP 8000, Hikvision 8000, Dahua 37777
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Registrar Dispositivo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
