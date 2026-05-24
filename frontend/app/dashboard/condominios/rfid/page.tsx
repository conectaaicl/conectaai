'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from '@/hooks/useSession'

interface Tarjeta {
  id: number
  uid: string
  tipo_tarjeta: string
  descripcion?: string
  nombre_titular?: string
  categoria: string
  activa: boolean
  fecha_vencimiento?: string
  persona_nombre?: string
}

const TIPOS = [
  { value: 'mifare_classic', label: 'MIFARE Classic', color: 'bg-blue-100 text-blue-700' },
  { value: 'mifare_desfire', label: 'MIFARE DESFire', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'hid', label: 'HID', color: 'bg-purple-100 text-purple-700' },
  { value: 'em4100', label: 'EM4100', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'iso14443a', label: 'ISO 14443A', color: 'bg-teal-100 text-teal-700' },
  { value: 'bip', label: 'Tarjeta Bip! (Metro)', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'bancaria', label: 'Tarjeta bancaria (NFC)', color: 'bg-orange-100 text-orange-700' },
  { value: 'otro', label: 'Otro', color: 'bg-slate-100 text-slate-600' },
]

const CATEGORIAS = [
  { value: 'residente', label: 'Residente' },
  { value: 'propietario', label: 'Propietario' },
  { value: 'visita', label: 'Visita' },
  { value: 'personal_admin', label: 'Administración' },
  { value: 'personal_aseo', label: 'Aseo' },
  { value: 'personal_seguridad', label: 'Seguridad' },
  { value: 'proveedor', label: 'Proveedor' },
]

const TIPO_COLOR = Object.fromEntries(TIPOS.map(t => [t.value, t.color]))
const TIPO_LABEL = Object.fromEntries(TIPOS.map(t => [t.value, t.label]))
const CAT_LABEL = Object.fromEntries(CATEGORIAS.map(c => [c.value, c.label]))

export default function RFIDPage() {
  const { tenantId } = useSession()
  const [tarjetas, setTarjetas] = useState<Tarjeta[]>([])
  const [puertas, setPuertas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [showPermisos, setShowPermisos] = useState<number | null>(null)
  const [permisos, setPermisos] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [form, setForm] = useState({
    uid: '', tipo_tarjeta: 'mifare_classic', nombre_titular: '',
    descripcion: '', categoria: 'residente', fecha_vencimiento: ''
  })

  // Scanner state
  const [showScanner, setShowScanner] = useState(false)
  const [scanCountdown, setScanCountdown] = useState(30)
  const [toast, setToast] = useState<{type: string; text: string} | null>(null)
  const sseRef = useRef<EventSource | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const showToast = (t: {type: string; text: string}) => {
    setToast(t)
    setTimeout(() => setToast(null), 4000)
  }

  const stopScan = () => {
    if (sseRef.current) { sseRef.current.close(); sseRef.current = null }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setShowScanner(false)
  }

  const startScan = () => {
    setScanCountdown(30)
    setShowScanner(true)
    const es = new EventSource(`/api/scanner/rfid/listen?tenant_id=${tenantId}&timeout=30`)
    sseRef.current = es
    let cd = 30
    timerRef.current = setInterval(() => {
      cd -= 1
      setScanCountdown(cd)
      if (cd <= 0) { clearInterval(timerRef.current!); timerRef.current = null }
    }, 1000)
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.status === "detected") {
          stopScan()
          setForm(p => ({ ...p, uid: data.uid || "" }))
          showToast({ type: "success", text: "Tarjeta detectada: " + data.uid })
        } else if (data.status === "timeout") {
          stopScan()
          showToast({ type: "warning", text: "Sin lectura — ingresa el UID manualmente" })
        }
      } catch { /* ignore */ }
    }
    es.onerror = () => { stopScan(); showToast({ type: "error", text: "Error de conexion con el scanner" }) }
  }

  useEffect(() => () => { stopScan() }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tRes, pRes] = await Promise.all([
        fetch(`/api/condominios/rfid?tenant_id=${tenantId}`),
        fetch(`/api/condominios/puertas?tenant_id=${tenantId}`),
      ])
      if (tRes.ok) setTarjetas(await tRes.json())
      if (pRes.ok) setPuertas(await pRes.json())
    } finally { setLoading(false) }
  }, [tenantId])

  useEffect(() => { load() }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await fetch('/api/condominios/rfid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, tenant_id: tenantId }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) { setShowForm(false); load() }
      else alert(data.detail || 'Error al registrar tarjeta')
    } finally { setCreating(false) }
  }

  async function toggleActiva(t: Tarjeta) {
    await fetch(`/api/condominios/rfid/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activa: !t.activa }),
    })
    load()
  }

  async function loadPermisos(tid: number) {
    setShowPermisos(tid)
    const res = await fetch(`/api/condominios/rfid/${tid}/permisos`)
    if (res.ok) setPermisos(await res.json())
  }

  async function togglePermiso(tarjetaId: number, puertaId: number, enabled: boolean) {
    await fetch(`/api/condominios/rfid/${tarjetaId}/permisos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ puerta_id: puertaId, habilitado: enabled }),
    })
    loadPermisos(tarjetaId)
  }

  const filtered = tarjetas.filter(t => {
    if (filterCat && t.categoria !== filterCat) return false
    if (search) {
      const s = search.toLowerCase()
      return (t.uid.toLowerCase().includes(s) ||
        t.nombre_titular?.toLowerCase().includes(s) ||
        t.descripcion?.toLowerCase().includes(s))
    }
    return true
  })

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {toast && (
        <div className={"fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all " + (toast.type === "success" ? "bg-green-600 text-white" : toast.type === "warning" ? "bg-amber-500 text-white" : "bg-red-600 text-white")}>
          {toast.text}
        </div>
      )}

      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Tarjetas y Llaveros RFID</h1>
          <p className="text-slate-500 text-sm mt-0.5">Gestión de credenciales de acceso físico</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          <span className="hidden sm:inline">Nueva tarjeta</span>
          <span className="sm:hidden">Agregar</span>
        </button>
      </div>

      {/* Info banner about card types */}
      <div className="mb-5 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <p className="font-semibold mb-1">Tipos de tarjetas soportadas</p>
        <p className="text-blue-600 text-xs leading-relaxed">
          Soporta cualquier tarjeta/llavero con UID legible: MIFARE, HID, EM4100, y también{' '}
          <strong>tarjetas bancarias</strong> y <strong>Bip! del Metro</strong> (se usa el UID como credencial &mdash; no se leen datos bancarios ni saldo).{' '}
          Requiere lector RFID/NFC en cada acceso (ACR122U, Wiegand, etc.).
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </span>
          <input type="text" placeholder="Buscar por UID, nombre..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total', value: tarjetas.length, color: 'text-slate-700', bg: 'bg-slate-50' },
          { label: 'Activas', value: tarjetas.filter(t => t.activa).length, color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Inactivas', value: tarjetas.filter(t => !t.activa).length, color: 'text-slate-500', bg: 'bg-slate-50' },
          { label: 'Residentes', value: tarjetas.filter(t => t.categoria === 'residente' || t.categoria === 'propietario').length, color: 'text-indigo-700', bg: 'bg-indigo-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-3`}>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Create form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Registrar tarjeta / llavero</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">UID de la tarjeta *</label>
                <button
                  type="button"
                  onClick={startScan}
                  className="w-full mb-2 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-xl text-sm font-semibold transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                  </svg>
                  Escanear Tarjeta RFID
                </button>
                <input required value={form.uid} onChange={e => setForm(p => ({ ...p, uid: e.target.value.toUpperCase() }))} placeholder="A3:F2:01:CC o A3F201CC" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <p className="text-xs text-slate-400 mt-1">El UID se obtiene del lector RFID o app NFC del teléfono</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
                  <select value={form.tipo_tarjeta} onChange={e => setForm(p => ({ ...p, tipo_tarjeta: e.target.value }))} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Categoría</label>
                  <select value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nombre del titular</label>
                <input value={form.nombre_titular} onChange={e => setForm(p => ({ ...p, nombre_titular: e.target.value }))} placeholder="Ana García Pérez" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Descripción / Depto</label>
                <input value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} placeholder="Depto 302, Torre B" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Vencimiento (opcional)</label>
                <input type="date" value={form.fecha_vencimiento} onChange={e => setForm(p => ({ ...p, fecha_vencimiento: e.target.value }))} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-xl text-sm font-semibold">Cancelar</button>
                <button type="submit" disabled={creating} className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-60">{creating ? 'Registrando...' : 'Registrar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RFID Scanner modal */}
      {showScanner && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 flex flex-col items-center text-center">
            <div className="relative flex items-center justify-center mb-6">
              <span className="absolute w-24 h-24 rounded-full bg-indigo-100 animate-ping opacity-50" />
              <span className="absolute w-16 h-16 rounded-full bg-indigo-200 animate-ping opacity-60" style={{ animationDelay: "0.2s" }} />
              <div className="relative w-14 h-14 rounded-full bg-indigo-600 flex items-center justify-center shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                </svg>
              </div>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">Escaneando...</h3>
            <p className="text-slate-500 text-sm mb-4">Acerca la tarjeta al lector</p>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center">
                <span className="text-indigo-700 font-bold text-sm">{scanCountdown}</span>
              </div>
              <p className="text-xs text-slate-400">segundos restantes</p>
            </div>
            <button onClick={stopScan} className="w-full border border-slate-200 text-slate-600 py-2 rounded-xl text-sm font-semibold hover:bg-slate-50 transition">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Permisos modal */}
      {showPermisos !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-slate-800">Permisos de acceso</h3>
              <button onClick={() => setShowPermisos(null)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {puertas.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">No hay puertas configuradas</p>
            ) : (
              <div className="overflow-y-auto flex-1 space-y-2">
                {puertas.map(p => {
                  const perm = permisos.find(pr => pr.puerta_id === p.id)
                  const enabled = perm?.habilitado || false
                  return (
                    <div key={p.id} className="flex items-center justify-between py-3 border-b border-slate-50">
                      <div>
                        <p className="text-sm font-medium text-slate-700">{p.nombre}</p>
                        {p.ubicacion && <p className="text-xs text-slate-400">{p.ubicacion}</p>}
                      </div>
                      <button
                        onClick={() => togglePermiso(showPermisos, p.id, !enabled)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Card list */}
      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-slate-100">
          {tarjetas.length === 0 ? 'No hay tarjetas registradas. Agrega la primera.' : 'Sin resultados para la búsqueda'}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['UID', 'Tipo', 'Titular', 'Categoría', 'Estado', 'Acciones'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{t.uid}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${TIPO_COLOR[t.tipo_tarjeta] || 'bg-slate-100 text-slate-600'}`}>
                        {TIPO_LABEL[t.tipo_tarjeta] || t.tipo_tarjeta}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{t.nombre_titular || '—'}</p>
                      {t.descripcion && <p className="text-xs text-slate-400 truncate max-w-[120px]">{t.descripcion}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{CAT_LABEL[t.categoria] || t.categoria}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.activa ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {t.activa ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => loadPermisos(t.id)} className="text-xs border border-indigo-200 text-indigo-600 px-2 py-1 rounded-lg hover:bg-indigo-50 transition whitespace-nowrap">Permisos</button>
                        <button onClick={() => toggleActiva(t)} className={`text-xs border px-2 py-1 rounded-lg transition whitespace-nowrap ${t.activa ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}>
                          {t.activa ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
