'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from '@/hooks/useSession'

interface Visita {
  id: number
  nombre_visitante: string
  rut_visitante?: string
  departamento_id: number
  motivo?: string
  qr_token: string
  estado: string
  hora_entrada?: string
  hora_salida?: string
  fecha_visita: string
  created_at: string
}

// Inline QR code renderer using SVG — no external dependencies
function QRImage({ url, size = 200 }: { url: string; size?: number }) {
  const [qrSrc, setQrSrc] = useState<string>('')
  const [err, setErr] = useState(false)

  useEffect(() => {
    // Use a reliable public QR API — img tag, no CORS issue
    setQrSrc(`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(url)}&size=${size}x${size}&margin=2&format=png`)
  }, [url, size])

  if (err) {
    return (
      <div className="flex flex-col items-center gap-2 p-4 bg-gray-50 border border-gray-200 rounded-xl">
        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
        </svg>
        <p className="text-xs text-gray-500 text-center">QR no disponible.<br/>Usa el enlace de abajo.</p>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center bg-white p-3 rounded-xl border-2 border-indigo-200 shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={qrSrc}
        alt="Código QR de visita"
        width={size}
        height={size}
        onError={() => setErr(true)}
        className="rounded"
      />
    </div>
  )
}

const ESTADO_COLOR: Record<string, string> = {
  pendiente: 'bg-yellow-100 text-yellow-700',
  ingresado: 'bg-green-100 text-green-700',
  salido:    'bg-slate-100 text-slate-600',
  cancelado: 'bg-red-100 text-red-600',
  expirado:  'bg-gray-100 text-gray-500',
}

export default function AccesosPage() {
  const { tenantId } = useSession()
  const [visitas, setVisitas] = useState<Visita[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [condominioId, setCondominioId] = useState(1)
  const [form, setForm] = useState({
    nombre_visitante: '', rut_visitante: '', departamento_id: '', motivo: '', horas_validez: '24'
  })
  const [qrResult, setQrResult] = useState<Visita | null>(null)
  const [copiado, setCopiado] = useState(false)

  const APP_URL = 'https://conectaai.cl'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/accesos/visitas?tenant_id=${tenantId}&condominio_id=${condominioId}`,
        { credentials: 'include' }
      )
      if (res.ok) setVisitas(await res.json())
    } finally { setLoading(false) }
  }, [tenantId, condominioId])

  useEffect(() => { load() }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      // fecha_visita = ahora + horas seleccionadas
      const horas = parseInt(form.horas_validez || '24')
      const fechaVisita = new Date(Date.now() + horas * 3600 * 1000).toISOString()

      const body: any = {
        nombre_visitante: form.nombre_visitante,
        rut_visitante: form.rut_visitante || null,
        motivo: form.motivo || 'Visita',
        condominio_id: condominioId,
        tenant_id: tenantId,
        fecha_visita: fechaVisita,
      }
      if (form.departamento_id) {
        body.departamento_id = Number(form.departamento_id)
      }

      const res = await fetch('/api/accesos/visitas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      })

      if (res.ok) {
        const data: Visita = await res.json()
        setShowForm(false)
        setForm({ nombre_visitante: '', rut_visitante: '', departamento_id: '', motivo: '', horas_validez: '24' })
        setQrResult(data)
        load()
      } else {
        const err = await res.json()
        alert(err.detail || 'Error al crear la visita')
      }
    } finally { setCreating(false) }
  }

  function copiarEnlace(token: string) {
    navigator.clipboard.writeText(`${APP_URL}/acceso/qr/${token}`)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">Control de Accesos</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Gestión de visitas con código QR</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition min-h-[44px]"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          Nueva visita
        </button>
      </div>

      {/* QR Result Modal */}
      {qrResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">
              QR generado para {qrResult.nombre_visitante}
            </h3>
            <p className="text-slate-500 text-sm mb-4">
              Válido hasta: {new Date(qrResult.fecha_visita).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>

            {/* QR Code image */}
            <div className="flex justify-center mb-4">
              <QRImage url={`${APP_URL}/acceso/qr/${qrResult.qr_token}`} size={200} />
            </div>

            <p className="text-xs text-slate-400 mb-2 font-mono break-all bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">
              {APP_URL}/acceso/qr/{qrResult.qr_token.slice(0, 18)}...
            </p>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => copiarEnlace(qrResult.qr_token)}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-sm py-2.5 rounded-xl font-semibold transition"
              >
                {copiado ? '✓ Copiado' : 'Copiar enlace'}
              </button>
              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: `Acceso para ${qrResult.nombre_visitante}`, url: `${APP_URL}/acceso/qr/${qrResult.qr_token}` })
                  } else {
                    copiarEnlace(qrResult.qr_token)
                  }
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-sm py-2.5 rounded-xl font-semibold transition"
              >
                Compartir
              </button>
            </div>
            <button
              onClick={() => setQrResult(null)}
              className="mt-3 w-full text-slate-400 hover:text-slate-600 text-sm py-2 transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[95vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Registrar visita</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nombre visitante <span className="text-red-500">*</span>
                </label>
                <input
                  required value={form.nombre_visitante}
                  onChange={e => setForm(p => ({...p, nombre_visitante: e.target.value}))}
                  placeholder="Nombre completo del visitante"
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">RUT (opcional)</label>
                <input
                  value={form.rut_visitante}
                  onChange={e => setForm(p => ({...p, rut_visitante: e.target.value}))}
                  placeholder="12.345.678-9"
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Departamento (número, opcional)</label>
                <input
                  value={form.departamento_id}
                  onChange={e => setForm(p => ({...p, departamento_id: e.target.value}))}
                  placeholder="Ej: 801, 1804..."
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Motivo</label>
                <input
                  value={form.motivo}
                  onChange={e => setForm(p => ({...p, motivo: e.target.value}))}
                  placeholder="Visita familiar, delivery, técnico..."
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Validez del QR</label>
                <select
                  value={form.horas_validez}
                  onChange={e => setForm(p => ({...p, horas_validez: e.target.value}))}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
                >
                  <option value="4">4 horas</option>
                  <option value="8">8 horas</option>
                  <option value="24">24 horas</option>
                  <option value="48">48 horas</option>
                  <option value="72">72 horas</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 border border-slate-200 text-slate-600 dark:text-slate-300 py-2 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[44px]">
                  Cancelar
                </button>
                <button type="submit" disabled={creating}
                  className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 min-h-[44px] flex items-center justify-center gap-2">
                  {creating ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> Creando...</>
                  ) : (
                    <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/></svg> Crear QR</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"/>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                <tr>
                  {['Visitante', 'RUT', 'Depto', 'Motivo', 'Estado', 'Válido hasta', 'QR'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {visitas.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-400">No hay visitas registradas</td></tr>
                ) : visitas.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">{v.nombre_visitante}</td>
                    <td className="px-4 py-3 text-slate-500">{v.rut_visitante || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{v.departamento_id || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 max-w-[100px] truncate">{v.motivo || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLOR[v.estado] || 'bg-slate-100 text-slate-600'}`}>
                        {v.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {v.fecha_visita ? new Date(v.fecha_visita).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setQrResult(v)}
                        className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-xs font-medium transition"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/></svg>
                        Ver QR
                      </button>
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
