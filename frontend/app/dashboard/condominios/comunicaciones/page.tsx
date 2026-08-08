'use client'
import { useState, useEffect, useCallback } from 'react'

interface Dashboard {
  hoy_por_canal: Record<string, number>
  fallidos_hoy: number
  residentes_alcanzados_hoy: number
  canales: Record<string, { conectado: boolean }>
  ultimos_envios: { canal: string; destinatario_nombre: string; asunto: string; estado: string; creado_en: string }[]
}

interface Destinatario {
  id: number
  nombre_completo: string
  email: string | null
  telefono: string | null
}

interface HistorialItem {
  id: number
  canal: string
  destinatario_nombre: string
  destinatario_valor: string
  asunto: string
  estado: string
  proveedor: string | null
  error: string | null
  enviado_por: string
  creado_en: string
}

const ROLES = ['residente', 'propietario', 'arrendatario', 'administrador']
const CANAL_LABEL: Record<string, string> = { email: 'Correo', push: 'Push', whatsapp: 'WhatsApp', sms: 'SMS' }
const CANAL_ICON: Record<string, string> = { email: '✉️', push: '🔔', whatsapp: '💬', sms: '📱' }

function CanalBadge({ canal, conectado }: { canal: string; conectado: boolean }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <span>{CANAL_ICON[canal]}</span>
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{CANAL_LABEL[canal]}</span>
      <span className={`ml-auto w-2 h-2 rounded-full ${conectado ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
    </div>
  )
}

export default function ComunicacionesPage() {
  const [dash, setDash] = useState<Dashboard | null>(null)
  const [roles, setRoles] = useState<string[]>([])
  const [canal, setCanal] = useState('email')
  const [asunto, setAsunto] = useState('')
  const [contenido, setContenido] = useState('')
  const [preview, setPreview] = useState<{ total: number; destinatarios: Destinatario[] } | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [historial, setHistorial] = useState<HistorialItem[]>([])
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const cargarDashboard = useCallback(() => {
    fetch('/api/comunicaciones/dashboard', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null).then(d => { if (d) setDash(d) }).catch(() => {})
  }, [])

  const cargarHistorial = useCallback(() => {
    fetch('/api/comunicaciones/historial?limit=20', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null).then(d => { if (d) setHistorial(d.items) }).catch(() => {})
  }, [])

  useEffect(() => { cargarDashboard(); cargarHistorial() }, [cargarDashboard, cargarHistorial])

  function toggleRol(r: string) {
    setRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])
    setPreview(null)
  }

  async function verDestinatarios() {
    setPreviewing(true)
    try {
      const res = await fetch('/api/comunicaciones/preview-destinatarios', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: roles.length ? roles : null }),
      })
      const d = await res.json()
      if (res.ok) setPreview(d)
      else setMsg({ ok: false, text: d.detail || 'Error al calcular destinatarios' })
    } catch { setMsg({ ok: false, text: 'Error de conexion' }) }
    setPreviewing(false)
  }

  async function enviar() {
    if (!asunto.trim() || !contenido.trim()) { setMsg({ ok: false, text: 'Completa asunto y contenido' }); return }
    if (!preview || preview.total === 0) { setMsg({ ok: false, text: 'Primero revisa los destinatarios' }); return }
    if (!confirm(`Vas a enviar por ${CANAL_LABEL[canal]} a ${preview.total} destinatarios. ¿Confirmas?`)) return
    setEnviando(true)
    try {
      const res = await fetch('/api/comunicaciones/enviar', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filtros: { roles: roles.length ? roles : null }, canal, asunto, contenido }),
      })
      const d = await res.json()
      if (res.ok) {
        setMsg({ ok: true, text: `Enviado: ${d.enviados} ok, ${d.fallidos} fallidos de ${d.total}` })
        setAsunto(''); setContenido(''); setPreview(null)
        cargarDashboard(); cargarHistorial()
      } else {
        setMsg({ ok: false, text: d.detail || 'Error al enviar' })
      }
    } catch { setMsg({ ok: false, text: 'Error de conexion' }) }
    setEnviando(false)
    setTimeout(() => setMsg(null), 6000)
  }

  const inp = "w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500"

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Centro de Comunicación</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Envía a residentes, propietarios o socios por correo, push o WhatsApp — funciona igual sin importar el tipo de condominio.
        </p>
      </div>

      {/* Estado de canales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {dash && Object.entries(dash.canales).map(([c, info]) => (
          <CanalBadge key={c} canal={c} conectado={info.conectado} />
        ))}
      </div>

      {/* Resumen de hoy */}
      {dash && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(CANAL_LABEL).map(([c, label]) => (
            <div key={c} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <p className="text-xs text-slate-400 dark:text-slate-500">{label} hoy</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{dash.hoy_por_canal[c] || 0}</p>
            </div>
          ))}
        </div>
      )}

      {/* Nueva comunicacion */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-4">
        <h2 className="font-semibold text-slate-800 dark:text-slate-200">Nueva comunicación</h2>

        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Destinatarios (rol)</label>
          <div className="flex flex-wrap gap-2">
            {ROLES.map(r => (
              <button key={r} onClick={() => toggleRol(r)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  roles.includes(r)
                    ? 'bg-brand-50 dark:bg-brand-500/15 border-brand-300 dark:border-brand-500/40 text-brand-700 dark:text-brand-300'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                }`}
              >{r}</button>
            ))}
            {roles.length === 0 && <span className="text-xs text-slate-400 self-center">(vacío = todos)</span>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={verDestinatarios} disabled={previewing}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50">
            {previewing ? 'Calculando...' : 'Ver destinatarios'}
          </button>
          {preview && (
            <span className="text-sm text-slate-600 dark:text-slate-400">
              <strong className="text-slate-900 dark:text-white">{preview.total}</strong> destinatarios encontrados
            </span>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Canal</label>
          <select value={canal} onChange={e => setCanal(e.target.value)} className={inp}>
            {Object.entries(CANAL_LABEL).map(([c, label]) => <option key={c} value={c}>{label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Asunto</label>
          <input value={asunto} onChange={e => setAsunto(e.target.value)} placeholder="Ej: Mantención de ascensores" className={inp} />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Contenido</label>
          <textarea value={contenido} onChange={e => setContenido(e.target.value)} rows={4} placeholder="Escribe el mensaje..." className={inp} />
        </div>

        {msg && (
          <div className={`text-sm rounded-xl px-4 py-2.5 ${msg.ok ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'}`}>
            {msg.text}
          </div>
        )}

        <button onClick={enviar} disabled={enviando}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors">
          {enviando ? 'Enviando...' : 'Enviar comunicación'}
        </button>
      </div>

      {/* Historial */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
        <h2 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">Historial reciente</h2>
        {historial.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Sin envíos todavía.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 dark:text-slate-500 uppercase">
                  <th className="pb-2 pr-3">Canal</th>
                  <th className="pb-2 pr-3">Destinatario</th>
                  <th className="pb-2 pr-3">Asunto</th>
                  <th className="pb-2 pr-3">Estado</th>
                  <th className="pb-2 pr-3">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {historial.map(h => (
                  <tr key={h.id}>
                    <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{CANAL_ICON[h.canal]} {CANAL_LABEL[h.canal] || h.canal}</td>
                    <td className="py-2 pr-3 text-slate-700 dark:text-slate-200">{h.destinatario_nombre}</td>
                    <td className="py-2 pr-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">{h.asunto}</td>
                    <td className="py-2 pr-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${h.estado === 'enviado' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'}`}
                        title={h.error || ''}>
                        {h.estado}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-slate-400 dark:text-slate-500 text-xs">{new Date(h.creado_en).toLocaleString('es-CL')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
