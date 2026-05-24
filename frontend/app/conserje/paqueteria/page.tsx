'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

interface Paquete {
  id: number
  carrier: string
  tracking_number?: string
  depto_destino: string
  nombre_destinatario?: string
  estado: 'pendiente' | 'entregado'
  recibido_at: string
  entregado_at?: string
  registrado_por_nombre?: string
}

const CARRIERS: Record<string, { label: string; color: string }> = {
  chilexpress:   { label: 'Chilexpress',      color: 'bg-red-100 text-red-700 border-red-200' },
  bluexpress:    { label: 'Bluexpress',        color: 'bg-blue-100 text-blue-700 border-blue-200' },
  mercadolibre:  { label: 'MercadoLibre',     color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  correos_chile: { label: 'Correos Chile',    color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  starken:       { label: 'Starken',          color: 'bg-orange-100 text-orange-700 border-orange-200' },
  dhl:           { label: 'DHL',              color: 'bg-red-100 text-red-900 border-red-300' },
  fedex:         { label: 'FedEx',            color: 'bg-purple-100 text-purple-700 border-purple-200' },
  shein:         { label: 'Shein',            color: 'bg-pink-100 text-pink-700 border-pink-200' },
  amazon:        { label: 'Amazon',           color: 'bg-amber-100 text-amber-800 border-amber-200' },
  temu:          { label: 'Temu',             color: 'bg-orange-100 text-orange-800 border-orange-200' },
  aliexpress:    { label: 'AliExpress',       color: 'bg-rose-100 text-rose-700 border-rose-200' },
  otro:          { label: 'Otro',             color: 'bg-slate-100 text-slate-700 border-slate-200' },
}

// Detect carrier from tracking number format
function detectCarrier(tracking: string): string {
  const t = tracking.trim().toUpperCase()
  if (/^(RC|RR|CP|EE|EM|LM|LA|LC)\d{9}CL$/.test(t)) return 'correos_chile'
  if (/^CHX\d+/i.test(t) || /^\d{12,15}$/.test(t) && t.startsWith('9')) return 'chilexpress'
  if (/^BLX/i.test(t) || /^B[A-Z]\d{10,}/.test(t)) return 'bluexpress'
  if (/^TBA\d{12,}/.test(t) || /^1Z/.test(t)) return 'amazon'
  if (/^JD\d{20}/.test(t) || /^MLE\d+/i.test(t)) return 'mercadolibre'
  if (/^\d{10,12}$/.test(t)) return 'starken'
  if (/^[0-9]{10}$/.test(t)) return 'chilexpress'
  if (/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(t)) return 'correos_chile'
  if (/^DHL/i.test(t) || /^\d{10}$/.test(t)) return 'dhl'
  if (/^SHEIN/i.test(t) || /^SE\d+/i.test(t)) return 'shein'
  if (/^TEMU/i.test(t)) return 'temu'
  return 'otro'
}

function fmt(ts?: string) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function ConserjePaqueteriaPage() {
  const tid = () => typeof window !== 'undefined' ? (localStorage.getItem('current_condominio_id') || '1') : '1'

  const [paquetes, setPaquetes] = useState<Paquete[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'pendiente' | 'entregado' | 'todos'>('pendiente')
  const [acting, setActing] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanFeedback, setScanFeedback] = useState<'ok' | 'err' | null>(null)

  const [form, setForm] = useState({
    carrier: 'otro',
    tracking_number: '',
    depto_destino: '',
    nombre_destinatario: '',
    descripcion: '',
  })

  const trackingRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ tenant_id: tid(), limit: '60' })
      if (filtro !== 'todos') params.append('estado', filtro)
      const r = await fetch('/api/paqueteria?' + params, { credentials: 'include' })
      if (r.ok) setPaquetes(await r.json())
    } finally { setLoading(false) }
  }, [filtro])

  useEffect(() => { load() }, [load])

  // When form opens in scan mode, auto-focus tracking field
  useEffect(() => {
    if (showForm && scanning) {
      setTimeout(() => trackingRef.current?.focus(), 100)
    }
  }, [showForm, scanning])

  function openScan() {
    setForm({ carrier: 'otro', tracking_number: '', depto_destino: '', nombre_destinatario: '', descripcion: '' })
    setScanning(true)
    setShowForm(true)
    setScanFeedback(null)
  }

  function openManual() {
    setForm({ carrier: 'otro', tracking_number: '', depto_destino: '', nombre_destinatario: '', descripcion: '' })
    setScanning(false)
    setShowForm(true)
  }

  function handleTrackingInput(val: string) {
    const carrier = detectCarrier(val)
    setForm(f => ({ ...f, tracking_number: val, carrier }))
  }

  // Scanner fires Enter after barcode — auto-move to depto field
  function handleTrackingKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && form.tracking_number.trim().length > 4) {
      e.preventDefault()
      const depto = document.getElementById('depto-input') as HTMLInputElement
      depto?.focus()
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.depto_destino.trim()) return
    setSaving(true)
    try {
      const r = await fetch('/api/paqueteria', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: parseInt(tid()),
          carrier: form.carrier,
          tracking_number: form.tracking_number || null,
          depto_destino: form.depto_destino.trim(),
          nombre_destinatario: form.nombre_destinatario || null,
          descripcion: form.descripcion || null,
        }),
      })
      if (r.ok) {
        setScanFeedback('ok')
        load()
        // Reset for next scan
        setTimeout(() => {
          setForm(f => ({ ...f, tracking_number: '', depto_destino: '', nombre_destinatario: '', carrier: 'otro' }))
          setScanFeedback(null)
          if (scanning) trackingRef.current?.focus()
          else setShowForm(false)
        }, 1200)
      } else {
        setScanFeedback('err')
        setTimeout(() => setScanFeedback(null), 2000)
      }
    } finally { setSaving(false) }
  }

  async function marcarEntregado(id: number) {
    setActing(id)
    try {
      const r = await fetch(`/api/paqueteria/${id}/entregar`, { method: 'PATCH', credentials: 'include' })
      if (r.ok) load()
    } finally { setActing(null) }
  }

  const pendientes = paquetes.filter(p => p.estado === 'pendiente').length

  return (
    <div className="p-4 space-y-4 pb-20">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-bold text-lg">Paquetería</h1>
          {pendientes > 0 && (
            <p className="text-amber-400 text-xs font-medium mt-0.5">{pendientes} paquete{pendientes !== 1 ? 's' : ''} pendiente{pendientes !== 1 ? 's' : ''}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={openScan}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-xl text-sm font-semibold transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8H4a1 1 0 00-1 1v10a1 1 0 001 1h3M9 4H5a1 1 0 00-1 1v3" />
            </svg>
            Escanear
          </button>
          <button onClick={openManual}
            className="w-9 h-9 bg-slate-700 hover:bg-slate-600 text-white rounded-xl flex items-center justify-center text-xl transition">+</button>
        </div>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-3 gap-2">
        {(['pendiente', 'entregado', 'todos'] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`py-2 rounded-xl text-sm font-semibold capitalize transition ${filtro === f ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            {f === 'pendiente' ? 'Pendientes' : f === 'entregado' ? 'Entregados' : 'Todos'}
          </button>
        ))}
      </div>

      {/* Formulario registro (manual o escáner) */}
      {showForm && (
        <div className={`border rounded-2xl p-4 space-y-3 transition-all ${scanning ? 'bg-indigo-900/30 border-indigo-500/50' : 'bg-slate-800 border-slate-700'}`}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white flex items-center gap-2">
              {scanning ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                  Listo para escanear
                </>
              ) : 'Registrar paquete'}
            </h3>
            <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Feedback */}
          {scanFeedback === 'ok' && (
            <div className="bg-emerald-500/20 border border-emerald-500/40 rounded-xl p-3 text-emerald-300 text-sm font-semibold text-center">
              ✓ Paquete registrado — notificación enviada
            </div>
          )}
          {scanFeedback === 'err' && (
            <div className="bg-red-500/20 border border-red-500/40 rounded-xl p-3 text-red-300 text-sm font-semibold text-center">
              Error al registrar
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Tracking / barcode */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                {scanning ? '① Escanea el código de barras del paquete' : 'N° seguimiento / código de barras'}
              </label>
              <input
                ref={trackingRef}
                value={form.tracking_number}
                onChange={e => handleTrackingInput(e.target.value)}
                onKeyDown={handleTrackingKeyDown}
                placeholder={scanning ? 'Apunta y dispara el lector...' : 'Opcional'}
                className={`w-full rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder-slate-500 border focus:outline-none focus:ring-2 focus:ring-indigo-500 ${scanning ? 'bg-indigo-950 border-indigo-500/50' : 'bg-slate-700 border-slate-600'}`}
                autoComplete="off"
              />
            </div>

            {/* Carrier auto-detected */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Transportista {form.tracking_number && <span className="text-indigo-400 ml-1">(detectado automáticamente)</span>}
              </label>
              <select
                value={form.carrier}
                onChange={e => setForm(f => ({ ...f, carrier: e.target.value }))}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {Object.entries(CARRIERS).map(([val, { label }]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            {/* Depto — manual always */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                {scanning ? '② Departamento de destino *' : 'Departamento destino *'}
              </label>
              <input
                id="depto-input"
                required
                value={form.depto_destino}
                onChange={e => setForm(f => ({ ...f, depto_destino: e.target.value }))}
                placeholder="Ej: 304, 12A, Casa 5"
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {!scanning && (
              <input
                value={form.nombre_destinatario}
                onChange={e => setForm(f => ({ ...f, nombre_destinatario: e.target.value }))}
                placeholder="Nombre destinatario (opcional)"
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            )}

            <button
              type="submit"
              disabled={saving || !form.depto_destino.trim()}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition"
            >
              {saving ? 'Registrando...' : scanning ? '③ Registrar y notificar residente' : 'Registrar paquete'}
            </button>

            {scanning && (
              <p className="text-center text-xs text-slate-500">Después de registrar, el lector queda listo para el siguiente paquete</p>
            )}
          </form>
        </div>
      )}

      {/* Lista */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && paquetes.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-sm">Sin paquetes en este filtro</p>
        </div>
      )}

      <div className="space-y-3">
        {paquetes.map(p => {
          const carrier = CARRIERS[p.carrier] ?? CARRIERS.otro
          return (
            <div key={p.id} className={`border rounded-2xl p-4 transition ${p.estado === 'pendiente' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-800/60 border-slate-700/40'}`}>
              <div className="flex items-start gap-3">
                <div className="text-2xl flex-shrink-0">📦</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${carrier.color}`}>{carrier.label}</span>
                    <span className="font-bold text-white text-sm">Depto {p.depto_destino}</span>
                  </div>
                  {p.nombre_destinatario && <p className="text-xs text-slate-300 mt-1">{p.nombre_destinatario}</p>}
                  {p.tracking_number && (
                    <p className="text-xs text-slate-500 font-mono mt-1 truncate">#{p.tracking_number}</p>
                  )}
                  <div className="flex gap-3 mt-1">
                    <p className="text-xs text-slate-500">Llegó: {fmt(p.recibido_at)}</p>
                    {p.entregado_at && <p className="text-xs text-emerald-400">Entregado: {fmt(p.entregado_at)}</p>}
                  </div>
                </div>
                {p.estado === 'pendiente' ? (
                  <button
                    onClick={() => marcarEntregado(p.id)}
                    disabled={acting === p.id}
                    className="flex-shrink-0 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition"
                  >
                    Entregado
                  </button>
                ) : (
                  <span className="flex-shrink-0 px-2 py-1 bg-emerald-500/20 text-emerald-300 text-xs rounded-lg">✓</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
