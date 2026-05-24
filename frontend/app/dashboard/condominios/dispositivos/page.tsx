'use client'
import { useState, useEffect } from 'react'

interface Dispositivo {
  id: number
  nombre: string
  tipo: string
  ubicacion: string
  ip_address: string
  token_secreto: string
  activo: boolean
  ultima_conexion: string | null
  device_id?: string
}

const TIPO_ICON: Record<string, string> = {
  rfid: '💳', huella: '👆', facial: '😊', pin: '🔢',
}

export default function DispositivosPage() {
  const [devs, setDevs] = useState<Dispositivo[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nombre: '', tipo: 'rfid', ubicacion: '', ip_address: '' })
  const [saving, setSaving] = useState(false)
  const [visibleTokens, setVisibleTokens] = useState<Set<number>>(new Set())

  const [scanSubnet, setScanSubnet] = useState("192.168.1")
  const [scanning, setScanning] = useState(false)
  const [discovered, setDiscovered] = useState<{ip: string; port: number; latency_ms: number}[]>([])
  const [showScanner, setShowScanner] = useState(false)

  const load = () => {
    setLoading(true)
    fetch('/api/biometrico/dispositivos', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setDevs(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  async function handleScan() {
    setScanning(true); setDiscovered([])
    try {
      const r = await fetch("/api/scanner/network/scan", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ subnet: scanSubnet, ports: [80, 443, 8080, 4000, 9090, 8888], timeout_ms: 3000 })
      })
      if (r.ok) setDiscovered(await r.json())
    } finally { setScanning(false) }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await fetch('/api/biometrico/dispositivos', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      setShowForm(false)
      setForm({ nombre: '', tipo: 'rfid', ubicacion: '', ip_address: '' })
      load()
    } finally { setSaving(false) }
  }

  async function toggleActivo(d: Dispositivo) {
    await fetch(`/api/biometrico/dispositivos/${d.id}`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !d.activo }),
    })
    load()
  }

  async function regenerarToken(id: number) {
    if (!confirm('¿Regenerar token? El dispositivo deberá actualizarse con el nuevo token.')) return
    const res = await fetch(`/api/biometrico/dispositivos/${id}/regenerar-token`, {
      method: 'POST', credentials: 'include',
    })
    const data = await res.json()
    alert(`Nuevo token: ${data.token_secreto}`)
    load()
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar dispositivo? Se borrarán sus configuraciones pero no los registros históricos.')) return
    await fetch(`/api/biometrico/dispositivos/${id}`, { method: 'DELETE', credentials: 'include' })
    load()
  }

  function toggleToken(id: number) {
    setVisibleTokens(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dispositivos Biométricos</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">Lectores RFID, huellas dactilares y reconocimiento facial</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition shadow-md shadow-indigo-500/20">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          Agregar dispositivo
        </button>
      </div>

      {/* Integration guide */}
      <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-2xl p-5">
        <h3 className="font-semibold text-indigo-800 dark:text-indigo-300 mb-2 flex items-center gap-2">
          <span>📡</span> Integración con hardware
        </h3>
        <p className="text-indigo-700 dark:text-indigo-300/80 text-sm mb-3">
          Los dispositivos (Raspberry Pi, Arduino, lectores RFID) envían eventos via HTTP POST:
        </p>
        <code className="block bg-indigo-100 dark:bg-slate-900 text-indigo-900 dark:text-emerald-400 rounded-lg p-3 text-xs font-mono">
          POST https://conectaai.cl/api/biometrico/evento<br/>
          Authorization: Bearer {'<token_secreto>'}<br/>
          {'{'}"identificador": "12345678-9", "metodo": "rfid"{'}'}<br/><br/>
          # La API auto-detecta entrada/salida según el último registro del día
        </code>
      </div>

      {/* Network Scanner Panel */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowScanner(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-semibold text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition"
        >
          <span>🔍 Descubrir dispositivos en red</span>
          <svg className={"w-4 h-4 transition-transform " + (showScanner ? "rotate-180" : "")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
        {showScanner && (
          <div className="border-t border-gray-100 dark:border-slate-800 px-5 py-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Subred a escanear</label>
                <input
                  value={scanSubnet}
                  onChange={e => setScanSubnet(e.target.value)}
                  placeholder="192.168.1"
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-mono text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="pt-5">
                <button
                  onClick={handleScan}
                  disabled={scanning}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition whitespace-nowrap"
                >
                  {scanning && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block"/>}
                  {scanning ? "Escaneando..." : "Escanear"}
                </button>
              </div>
            </div>
            {scanning && (
              <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400 py-2">
                <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin flex-shrink-0"/>
                Escaneando 254 hosts...
              </div>
            )}
            {!scanning && discovered.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">{discovered.length} dispositivo(s) encontrado(s)</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-slate-800">
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 dark:text-slate-400 border border-gray-100 dark:border-slate-700">IP</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 dark:text-slate-400 border border-gray-100 dark:border-slate-700">Puerto</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 dark:text-slate-400 border border-gray-100 dark:border-slate-700">Latencia</th>
                        <th className="px-3 py-2 border border-gray-100 dark:border-slate-700"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {discovered.map((dev, i) => (
                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                          <td className="px-3 py-2 font-mono text-xs text-gray-800 dark:text-slate-200 border border-gray-100 dark:border-slate-700">{dev.ip}</td>
                          <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-slate-400 border border-gray-100 dark:border-slate-700">{dev.port}</td>
                          <td className="px-3 py-2 text-xs text-gray-500 dark:text-slate-500 border border-gray-100 dark:border-slate-700">{dev.latency_ms} ms</td>
                          <td className="px-3 py-2 border border-gray-100 dark:border-slate-700 text-right">
                            <button
                              onClick={() => { setForm(p => ({ ...p, ip_address: dev.ip })); setShowForm(true) }}
                              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-lg transition"
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
              <p className="text-xs text-gray-400 dark:text-slate-500 italic">Ingresa la subred y presiona Escanear para descubrir dispositivos.</p>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : (
        <div className="grid gap-4">
          {devs.map(d => (
            <div key={d.id} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-500/15 flex items-center justify-center text-2xl flex-shrink-0">
                    {TIPO_ICON[d.tipo] || '📡'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900 dark:text-white">{d.nombre}</span>
                      <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${d.activo ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400'}`}>
                        {d.activo ? 'activo' : 'inactivo'}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md text-xs">{d.tipo}</span>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-slate-400 space-y-0.5">
                      {d.ubicacion && <div>📍 {d.ubicacion}</div>}
                      {d.ip_address && <div>🌐 {d.ip_address}</div>}
                      <div className="text-xs">
                        Última conexión: {d.ultima_conexion ? d.ultima_conexion.slice(0, 16).replace('T', ' ') : 'nunca'}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => toggleActivo(d)}
                    className={`px-3 py-1.5 text-xs rounded-lg transition ${
                      d.activo
                        ? 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/25'
                        : 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-500/25'
                    }`}>
                    {d.activo ? 'Desactivar' : 'Activar'}
                  </button>
                  <button onClick={() => handleDelete(d.id)}
                    className="px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-red-100 dark:hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition">
                    Eliminar
                  </button>
                </div>
              </div>

              {/* Token */}
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">Token secreto:</span>
                  <code className="text-xs font-mono text-gray-700 dark:text-slate-300 bg-gray-50 dark:bg-slate-800 px-2 py-1 rounded-lg">
                    {visibleTokens.has(d.id) ? d.device_id || d.token_secreto || "no configurado" : '••••••••••••••••••••••••'}
                  </code>
                  <button onClick={() => toggleToken(d.id)} className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300">
                    {visibleTokens.has(d.id) ? 'Ocultar' : 'Mostrar'}
                  </button>
                  <button onClick={() => { navigator.clipboard.writeText(d.device_id || d.token_secreto || "no configurado") }}
                    className="text-xs text-indigo-500 hover:text-indigo-400">
                    Copiar
                  </button>
                  <button onClick={() => regenerarToken(d.id)}
                    className="text-xs text-amber-500 hover:text-amber-400">
                    Regenerar
                  </button>
                </div>
              </div>
            </div>
          ))}
          {devs.length === 0 && (
            <div className="text-center py-16 text-gray-400 dark:text-slate-500">
              <div className="text-4xl mb-3">📡</div>
              <p>No hay dispositivos configurados</p>
              <p className="text-sm mt-1">Agrega un dispositivo para comenzar a registrar asistencia</p>
            </div>
          )}
        </div>
      )}

      {/* Create modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 w-full max-w-md">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4">Nuevo Dispositivo</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              {[
                { label: 'Nombre', key: 'nombre', placeholder: 'Ej: Lector entrada principal', req: true },
                { label: 'Ubicación', key: 'ubicacion', placeholder: 'Ej: Puerta principal piso 1', req: false },
                { label: 'IP / URL dispositivo', key: 'ip_address', placeholder: 'Ej: 192.168.1.100', req: false },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{f.label}</label>
                  <input
                    value={(form as any)[f.key]}
                    onChange={e => setForm(prev => ({...prev, [f.key]: e.target.value}))}
                    required={f.req} placeholder={f.placeholder}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Tipo</label>
                <select value={form.tipo} onChange={e => setForm(f => ({...f, tipo: e.target.value}))}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="rfid">💳 RFID / Tarjeta</option>
                  <option value="huella">👆 Huella dactilar</option>
                  <option value="facial">😊 Reconocimiento facial</option>
                  <option value="pin">🔢 PIN / Código</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-white text-sm rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 transition">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition">
                  {saving ? 'Creando...' : 'Crear dispositivo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
