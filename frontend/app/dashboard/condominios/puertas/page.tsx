'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from '@/hooks/useSession'

interface Puerta {
  id: number
  nombre: string
  descripcion?: string
  tipo: string
  ubicacion?: string
  activa: boolean
  estado: string
  modo: string
  tiempo_apertura_seg: number
  webhook_url?: string
}

const TIPO_ICON: Record<string, string> = {
  puerta: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  porton: 'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18',
  barrera: 'M20 12H4',
  ascensor: 'M5 15l7-7 7 7',
}

export default function PuertasPage() {
  const { tenantId } = useSession()
  const [puertas, setPuertas] = useState<Puerta[]>([])
  const [loading, setLoading] = useState(true)
  const [comandando, setComandando] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [showLog, setShowLog] = useState<number | null>(null)
  const [log, setLog] = useState<any[]>([])
  // Network discovery state
  const [showDiscover, setShowDiscover] = useState(false)
  const [discSubnet, setDiscSubnet] = useState('192.168.1')
  const [discPorts, setDiscPorts] = useState<number[]>([4370, 80, 8080, 23])
  const [discScanning, setDiscScanning] = useState(false)
  const [discResults, setDiscResults] = useState<any[]>([])

  async function scanNetwork() {
    setDiscScanning(true)
    setDiscResults([])
    try {
      const res = await fetch('/api/scanner/network/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subnet: discSubnet, ports: discPorts, timeout_ms: 500 }),
      })
      if (res.ok) setDiscResults(await res.json())
    } finally { setDiscScanning(false) }
  }

  function useDiscoveredIp(ip: string) {
    setForm(p => ({ ...p, webhook_url: 'http://' + ip + '/relay' }))
    setShowDiscover(false)
  }

  const [form, setForm] = useState({
    nombre: '', descripcion: '', tipo: 'puerta', ubicacion: '',
    webhook_url: '', tiempo_apertura_seg: 5
  })

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true)
    try {
      const res = await fetch(`/api/condominios/puertas?tenant_id=${tenantId}`)
      if (res.ok) setPuertas(await res.json())
    } finally { if (showSpinner) setLoading(false) }
  }, [tenantId])

  useEffect(() => { load(true) }, [load])

  // Auto-refresh every 30 seconds to sync door state (silent, no spinner)
  useEffect(() => {
    const interval = setInterval(() => load(false), 30000)
    return () => clearInterval(interval)
  }, [load])

  async function comando(puerta: Puerta, accion: string) {
    setComandando(puerta.id)
    try {
      const res = await fetch(`/api/condominios/puertas/${puerta.id}/comando`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion }),
      })
      if (res.ok) {
        const data = await res.json()
        setPuertas(prev => prev.map(p => p.id === puerta.id ? { ...p, estado: data.estado, modo: data.modo } : p))
      }
    } finally { setComandando(null) }
  }

  async function loadLog(puertaId: number) {
    setShowLog(puertaId)
    const res = await fetch(`/api/condominios/puertas/${puertaId}/registro`)
    if (res.ok) setLog(await res.json())
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await fetch('/api/condominios/puertas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, tiempo_apertura_seg: Number(form.tiempo_apertura_seg), tenant_id: tenantId }),
      })
      if (res.ok) { setShowForm(false); load() }
    } finally { setCreating(false) }
  }

  const estadoColor = (p: Puerta) => {
    if (!p.activa) return 'bg-slate-100 text-slate-400'
    if (p.modo === 'bloqueada') return 'bg-red-100 text-red-700'
    if (p.modo === 'libre_paso') return 'bg-blue-100 text-blue-700'
    if (p.estado === 'abierta') return 'bg-green-100 text-green-700'
    return 'bg-slate-100 text-slate-600'
  }

  const estadoLabel = (p: Puerta) => {
    if (!p.activa) return 'Inactiva'
    if (p.modo === 'bloqueada') return 'Bloqueada'
    if (p.modo === 'libre_paso') return 'Libre paso'
    return p.estado === 'abierta' ? 'Abierta' : 'Cerrada'
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Control de Puertas</h1>
          <p className="text-slate-500 text-sm mt-0.5">Gestión de accesos y electroimanes</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => load(true)} className="p-2 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 transition" title="Actualizar">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            <span className="hidden sm:inline">Nueva puerta</span>
            <span className="sm:hidden">Agregar</span>
          </button>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Nueva puerta / portón</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
                  <input required value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Puerta Principal" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
                  <select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {['puerta','porton','barrera','ascensor'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Seg. apertura</label>
                  <input type="number" min={1} max={60} value={form.tiempo_apertura_seg} onChange={e => setForm(p => ({ ...p, tiempo_apertura_seg: Number(e.target.value) }))} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Ubicación</label>
                  <input value={form.ubicacion} onChange={e => setForm(p => ({ ...p, ubicacion: e.target.value }))} placeholder="Entrada Norte, Subterráneo..." className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-600">Webhook URL del controlador (opcional)</label>
                    <button type="button" onClick={() => setShowDiscover(true)} className="text-xs text-indigo-600 border border-indigo-200 px-2 py-0.5 rounded-lg hover:bg-indigo-50 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3a9 9 0 100 18A9 9 0 009 3zM9 3v18M3 9h18M3 15h18" /></svg>
                      Descubrir en red
                    </button>
                  </div>
                  <input value={form.webhook_url} onChange={e => setForm(p => ({ ...p, webhook_url: e.target.value }))} placeholder="http://192.168.1.100/relay" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <p className="text-xs text-slate-400 mt-1">URL de tu controlador hardware (Raspberry Pi, Arduino, etc.)</p>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-xl text-sm font-semibold">Cancelar</button>
                <button type="submit" disabled={creating} className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-60">{creating ? 'Creando...' : 'Crear'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Network Discovery modal */}
      {showDiscover && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-slate-800">Descubrir dispositivos en red</h3>
                <p className="text-xs text-slate-400 mt-0.5">Escanea la red local en busca de controladores TCP/IP</p>
              </div>
              <button onClick={() => setShowDiscover(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Subred</label>
                <input value={discSubnet} onChange={e => setDiscSubnet(e.target.value)} placeholder="192.168.1" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Puertos a escanear</label>
                <div className="flex flex-wrap gap-2">
                  {[{p:4370, l:'4370 ZKTeco'},{p:80, l:'80 HTTP'},{p:8080, l:'8080 HTTP Alt'},{p:23, l:'23 Telnet'},{p:26, l:'26 Telnet Alt'},{p:8000, l:'8000 API'}].map(({p, l}) => (
                    <label key={p} className="flex items-center gap-1 text-xs cursor-pointer">
                      <input type="checkbox" checked={discPorts.includes(p)}
                        onChange={e => setDiscPorts(prev => e.target.checked ? [...prev, p] : prev.filter(x => x !== p))}
                        className="rounded" />
                      {l}
                    </label>
                  ))}
                </div>
              </div>
              <button onClick={scanNetwork} disabled={discScanning} className="w-full bg-indigo-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-60">
                {discScanning ? 'Escaneando red...' : 'Escanear'}
              </button>
            </div>
            {discScanning && (
              <div className="flex items-center gap-2 text-slate-500 text-sm py-4 justify-center">
                <div className="animate-spin w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full" />
                Escaneando {discSubnet}.1 — .254...
              </div>
            )}
            {!discScanning && discResults.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{discResults.length} dispositivo{discResults.length !== 1 ? 's' : ''} encontrado{discResults.length !== 1 ? 's' : ''}</p>
                {discResults.map((r, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl bg-slate-50">
                    <div>
                      <p className="font-mono text-sm font-medium text-slate-800">{r.ip}:{r.port}</p>
                      <p className="text-xs text-slate-500">{r.device_type} — {r.latency_ms}ms</p>
                    </div>
                    <button onClick={() => useDiscoveredIp(r.ip)} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition">
                      Usar esta IP
                    </button>
                  </div>
                ))}
              </div>
            )}
            {!discScanning && discResults.length === 0 && discSubnet && (
              <p className="text-center text-sm text-slate-400 py-4">Sin resultados. Prueba otro rango de subred o puertos.</p>
            )}
          </div>
        </div>
      )}

      {showLog !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-slate-800">Registro de accesos</h3>
              <button onClick={() => setShowLog(null)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-2">
              {log.length === 0 ? <p className="text-slate-400 text-sm text-center py-4">Sin registros</p> : log.map(r => (
                <div key={r.id} className="flex items-center gap-3 py-2 border-b border-slate-50">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${r.exitoso ? 'bg-green-400' : 'bg-red-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700">{r.tipo_evento} <span className="text-slate-400 font-normal">via {r.metodo}</span></p>
                    {r.descripcion && <p className="text-xs text-slate-400 truncate">{r.descripcion}</p>}
                    {r.uid_tarjeta && <p className="text-xs text-slate-400 font-mono">{r.uid_tarjeta}</p>}
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">{new Date(r.created_at).toLocaleString('es-CL', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
      ) : puertas.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-100">
          <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          <p className="font-medium">No hay puertas configuradas</p>
          <p className="text-sm mt-1">Agrega la primera puerta o portón</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {puertas.map(puerta => (
            <div key={puerta.id} className={`bg-white rounded-2xl border p-5 shadow-sm transition hover:shadow-md ${!puerta.activa ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${puerta.estado === 'abierta' ? 'bg-green-100' : 'bg-slate-100'}`}>
                    <svg className={`w-5 h-5 ${puerta.estado === 'abierta' ? 'text-green-600' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={TIPO_ICON[puerta.tipo] || TIPO_ICON.puerta} />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 leading-tight">{puerta.nombre}</h3>
                    {puerta.ubicacion && <p className="text-xs text-slate-400">{puerta.ubicacion}</p>}
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${estadoColor(puerta)}`}>
                  {estadoLabel(puerta)}
                </span>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  onClick={() => comando(puerta, 'abrir')}
                  disabled={comandando === puerta.id || !puerta.activa || puerta.modo === 'bloqueada'}
                  className="flex items-center justify-center gap-1.5 py-2.5 bg-green-50 text-green-700 border border-green-200 rounded-xl text-sm font-semibold hover:bg-green-100 transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                >
                  {comandando === puerta.id ? <span className="animate-spin text-xs">&#x27F3;</span> : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                  )}
                  Abrir
                </button>
                <button
                  onClick={() => comando(puerta, 'cerrar')}
                  disabled={comandando === puerta.id || !puerta.activa}
                  className="flex items-center justify-center gap-1.5 py-2.5 bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-100 transition disabled:opacity-40 active:scale-95"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  Cerrar
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => comando(puerta, 'libre_paso')}
                  disabled={comandando === puerta.id || !puerta.activa}
                  className="py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold hover:bg-blue-100 transition disabled:opacity-40 active:scale-95"
                  title="Mantener abierta sin restricción"
                >
                  Libre paso
                </button>
                <button
                  onClick={() => comando(puerta, 'bloquear')}
                  disabled={comandando === puerta.id || !puerta.activa}
                  className="py-2 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-semibold hover:bg-red-100 transition disabled:opacity-40 active:scale-95"
                  title="Bloquear — nadie puede abrir"
                >
                  Bloquear
                </button>
              </div>

              <button
                onClick={() => loadLog(puerta.id)}
                className="mt-3 w-full text-xs text-slate-400 hover:text-slate-600 py-1 transition"
              >
                Ver historial
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
