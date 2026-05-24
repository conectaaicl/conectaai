'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from '@/hooks/useSession'

interface Camara {
  id: number
  nombre: string
  ubicacion?: string
  ip: string
  puerto: number
  rtsp_url?: string
  snapshot_url?: string
  onvif_puerto: number
  modelo?: string
  activa: boolean
  ultimo_estado: string
  ultima_comprobacion?: string
}

const ESTADO_COLORS: Record<string, string> = {
  verde: 'bg-emerald-500',
  amarillo: 'bg-yellow-400',
  rojo: 'bg-red-500',
  desconocido: 'bg-slate-400',
}

const TIPO_OPTIONS = [
  { value: 'exterior', label: 'Exterior' },
  { value: 'interior', label: 'Interior' },
  { value: 'entrada', label: 'Entrada' },
  { value: 'estacionamiento', label: 'Estacionamiento' },
  { value: 'pasillo', label: 'Pasillo' },
]

export default function CamarasPage() {
  const { tenantId } = useSession()
  const [camaras, setCamaras] = useState<Camara[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [testingId, setTestingId] = useState<number | null>(null)
  const [snapshotId, setSnapshotId] = useState<number | null>(null)
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null)
  const [form, setForm] = useState({
    nombre: '', ubicacion: '', ip: '', puerto: 80,
    rtsp_url: '', snapshot_url: '', onvif_puerto: 8000,
    usuario: '', password: '', modelo: '',
  })

  const [scanSubnet, setScanSubnet] = useState("192.168.1")
  const [scanning, setScanning] = useState(false)
  const [discovered, setDiscovered] = useState<{ip: string; port: number; latency_ms: number}[]>([])
  const [showScanner, setShowScanner] = useState(false)

  const fetchCamaras = useCallback(async () => {
    if (!tenantId) return
    try {
      const r = await fetch('/api/camaras?tenant_id=' + tenantId)
      if (r.ok) setCamaras(await r.json())
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [tenantId])

  useEffect(() => { fetchCamaras() }, [fetchCamaras])

  function showMsg(type: 'ok' | 'err', text: string) {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 4000)
  }

  async function handleScan() {
    setScanning(true); setDiscovered([])
    try {
      const r = await fetch("/api/scanner/network/scan", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ subnet: scanSubnet, ports: [80, 443, 554, 8080, 8000, 8899], timeout_ms: 3000 })
      })
      if (r.ok) setDiscovered(await r.json())
    } finally { setScanning(false) }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!tenantId) return
    const r = await fetch('/api/camaras', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, tenant_id: tenantId }),
    })
    if (r.ok) {
      showMsg('ok', 'Cámara registrada')
      setShowForm(false)
      setForm({ nombre: '', ubicacion: '', ip: '', puerto: 80, rtsp_url: '', snapshot_url: '', onvif_puerto: 8000, usuario: '', password: '', modelo: '' })
      fetchCamaras()
    } else {
      const d = await r.json()
      showMsg('err', d.detail || 'Error al crear')
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar esta cámara?')) return
    await fetch('/api/camaras/' + id, { method: 'DELETE' })
    fetchCamaras()
  }

  async function handleTest(id: number) {
    setTestingId(id)
    try {
      const r = await fetch('/api/camaras/' + id + '/test', { method: 'POST' })
      const d = await r.json()
      showMsg(d.ok ? 'ok' : 'err', d.ok ? 'Conectado (' + d.latency_ms + 'ms)' : 'Sin conexión: ' + (d.error || ''))
      fetchCamaras()
    } finally { setTestingId(null) }
  }

  async function handleSnapshot(id: number) {
    setSnapshotId(id)
    setSnapshotUrl(null)
    try {
      const r = await fetch('/api/camaras/' + id + '/snapshot')
      if (r.ok) {
        const blob = await r.blob()
        setSnapshotUrl(URL.createObjectURL(blob))
      } else {
        showMsg('err', 'No se pudo obtener snapshot')
        setSnapshotId(null)
      }
    } catch {
      showMsg('err', 'Error de conexión con la cámara')
      setSnapshotId(null)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Cámaras IP</h1>
          <p className="text-sm text-slate-500 mt-0.5">Registro y monitoreo de cámaras de seguridad</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchCamaras} className="border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm hover:bg-slate-50">
            ↻ Actualizar
          </button>
          <a href="/dashboard/condominios/camaras/monitor" target="_blank" className="flex items-center gap-1.5 bg-slate-800 text-slate-100 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 border border-slate-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" /></svg>
            Monitor en Vivo
          </a>
          <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            + Nueva Cámara
          </button>
        </div>
      </div>

      {msg && (
        <div className={'px-4 py-3 rounded-lg text-sm font-medium ' + (msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200')}>
          {msg.text}
        </div>
      )}

      {/* Snapshot Modal */}
      {snapshotUrl && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => { setSnapshotUrl(null); setSnapshotId(null) }}>
          <div className="bg-white rounded-xl overflow-hidden max-w-4xl w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="font-semibold text-slate-800">Snapshot en vivo</span>
              <button onClick={() => { setSnapshotUrl(null); setSnapshotId(null) }} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>
            <img src={snapshotUrl} alt="Snapshot" className="w-full object-contain max-h-[70vh]" />
            <div className="flex justify-end gap-2 p-3 border-t">
              <button onClick={() => { if (snapshotId) handleSnapshot(snapshotId) }} className="text-sm text-blue-600 hover:text-blue-800 border border-blue-200 px-3 py-1.5 rounded-lg">
                ↻ Refrescar
              </button>
              <button onClick={() => { setSnapshotUrl(null); setSnapshotId(null) }} className="text-sm text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Form */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold text-slate-800 mb-4">Registrar Cámara</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
              <input required value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                placeholder="Ej: Entrada Principal" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Ubicación</label>
              <input value={form.ubicacion} onChange={e => setForm(p => ({ ...p, ubicacion: e.target.value }))}
                placeholder="Ej: Lobby Torre A" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Modelo</label>
              <input value={form.modelo} onChange={e => setForm(p => ({ ...p, modelo: e.target.value }))}
                placeholder="Ej: Hikvision DS-2CD2143G2-I" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">IP *</label>
              <input required value={form.ip} onChange={e => setForm(p => ({ ...p, ip: e.target.value }))}
                placeholder="192.168.1.100" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Puerto HTTP</label>
              <input type="number" value={form.puerto} onChange={e => setForm(p => ({ ...p, puerto: +e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Puerto ONVIF</label>
              <input type="number" value={form.onvif_puerto} onChange={e => setForm(p => ({ ...p, onvif_puerto: +e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">URL RTSP</label>
              <input value={form.rtsp_url} onChange={e => setForm(p => ({ ...p, rtsp_url: e.target.value }))}
                placeholder="rtsp://user:pass@ip:554/stream" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">URL Snapshot</label>
              <input value={form.snapshot_url} onChange={e => setForm(p => ({ ...p, snapshot_url: e.target.value }))}
                placeholder="/snapshot.jpg (dejar vacío = automático)" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Usuario</label>
              <input value={form.usuario} onChange={e => setForm(p => ({ ...p, usuario: e.target.value }))}
                placeholder="admin" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Contraseña</label>
              <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="md:col-span-2 lg:col-span-3 flex gap-2 pt-2">
              <button type="submit" className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                Registrar
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="border border-slate-200 text-slate-600 px-5 py-2 rounded-lg text-sm hover:bg-slate-50">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Network Scanner Panel */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <button
          onClick={() => setShowScanner(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 transition"
        >
          <span>🔍 Descubrir cámaras en red</span>
          <svg className={"w-4 h-4 transition-transform " + (showScanner ? "rotate-180" : "")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
        {showScanner && (
          <div className="border-t border-slate-100 px-5 py-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">Subred a escanear</label>
                <input
                  value={scanSubnet}
                  onChange={e => setScanSubnet(e.target.value)}
                  placeholder="192.168.1"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="pt-5">
                <button
                  onClick={handleScan}
                  disabled={scanning}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap"
                >
                  {scanning ? "Escaneando..." : "Escanear"}
                </button>
              </div>
            </div>
            {scanning && (
              <div className="flex items-center gap-3 text-sm text-slate-500 py-2">
                <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin flex-shrink-0"/>
                Escaneando 254 hosts...
              </div>
            )}
            {!scanning && discovered.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-2">{discovered.length} dispositivo(s) encontrado(s)</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-100">IP</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-100">Puerto</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-100">Latencia</th>
                        <th className="px-3 py-2 border border-slate-100"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {discovered.map((d, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-mono text-xs text-slate-800 border border-slate-100">{d.ip}</td>
                          <td className="px-3 py-2 font-mono text-xs text-slate-600 border border-slate-100">{d.port}</td>
                          <td className="px-3 py-2 text-xs text-slate-500 border border-slate-100">{d.latency_ms} ms</td>
                          <td className="px-3 py-2 border border-slate-100 text-right">
                            <button
                              onClick={() => { setForm(p => ({ ...p, ip: d.ip, puerto: d.port })); setShowForm(true) }}
                              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-lg transition"
                            >
                              Agregar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {!scanning && discovered.length === 0 && (
              <p className="text-xs text-slate-400 italic">Ingresa la subred y presiona Escanear para descubrir dispositivos.</p>
            )}
          </div>
        )}
      </div>

      {/* Cameras Grid */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Cargando cámaras...</div>
      ) : camaras.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-xl">
          <div className="text-4xl mb-2">📷</div>
          <p className="text-slate-500 font-medium">No hay cámaras registradas</p>
          <p className="text-sm text-slate-400 mt-1">Registra tu primera cámara IP para comenzar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {camaras.map(cam => (
            <div key={cam.id} className={'bg-white border rounded-xl overflow-hidden shadow-sm ' + (cam.activa ? 'border-slate-200' : 'border-slate-100 opacity-60')}>
              {/* Thumbnail / status banner */}
              <div className="h-28 bg-slate-900 flex items-center justify-center relative overflow-hidden">
                <div className="text-slate-600 text-4xl">📷</div>
                <div className={'absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ' + (cam.ultimo_estado === 'verde' ? 'bg-emerald-900/80 text-emerald-300' : cam.ultimo_estado === 'rojo' ? 'bg-red-900/80 text-red-300' : 'bg-slate-700/80 text-slate-300')}>
                  <span className={'w-1.5 h-1.5 rounded-full ' + ESTADO_COLORS[cam.ultimo_estado || 'desconocido']}></span>
                  {cam.ultimo_estado || 'Sin verificar'}
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between mb-1">
                  <h3 className="font-semibold text-slate-800 text-sm">{cam.nombre}</h3>
                </div>
                {cam.ubicacion && <p className="text-xs text-slate-500 mb-2">{cam.ubicacion}</p>}
                <div className="space-y-1 mb-3">
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <span className="font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{cam.ip}:{cam.puerto}</span>
                    {cam.modelo && <span className="text-slate-400">· {cam.modelo}</span>}
                  </div>
                  {cam.rtsp_url && (
                    <div className="text-xs text-slate-400 truncate font-mono">{cam.rtsp_url}</div>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => handleTest(cam.id)} disabled={testingId === cam.id}
                    className="flex-1 text-xs border border-slate-200 text-slate-600 px-2 py-1.5 rounded-lg hover:bg-slate-50 disabled:opacity-50">
                    {testingId === cam.id ? '...' : '⚡ Test'}
                  </button>
                  <button onClick={() => handleSnapshot(cam.id)} disabled={snapshotId === cam.id && !snapshotUrl}
                    className="flex-1 text-xs border border-blue-200 text-blue-600 px-2 py-1.5 rounded-lg hover:bg-blue-50 disabled:opacity-50">
                    {snapshotId === cam.id && !snapshotUrl ? '...' : '🖼 Snap'}
                  </button>
                  <button onClick={() => handleDelete(cam.id)}
                    className="text-xs border border-red-100 text-red-400 px-2 py-1.5 rounded-lg hover:bg-red-50">
                    🗑
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
        <p className="font-medium mb-1">Protocolos soportados</p>
        <ul className="list-disc list-inside space-y-0.5 text-blue-600 text-xs">
          <li>HTTP snapshot: automático en <code>/snapshot.jpg</code>, <code>/image.jpg</code> o URL personalizada</li>
          <li>RTSP: URL para reproductores externos (VLC, apps móviles)</li>
          <li>ONVIF: puerto configurable (típico 8000 Hikvision, 8080 Dahua)</li>
          <li>Test de conectividad: ping TCP al puerto HTTP configurado</li>
        </ul>
      </div>
    </div>
  )
}
