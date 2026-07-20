'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePortalSession } from '../usePortalSession'

interface Visita {
  id: number; estado: string; token: string
  nombre_visitante: string | null; motivo: string | null; creado_en: string | null
}

function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex z-40">
      {[
        {href:'/portal/dashboard',icon:'🏠',label:'Inicio'},
        {href:'/portal/cuenta',   icon:'💰',label:'Cuenta'},
        {href:'/portal/avisos',   icon:'📢',label:'Avisos'},
        {href:'/portal/qr',       icon:'🔑',label:'QR Acceso'},
      ].map(n => (
        <a key={n.href} href={n.href}
          className="flex-1 flex flex-col items-center py-3 text-slate-500 hover:text-indigo-600 transition-colors">
          <span className="text-xl">{n.icon}</span>
          <span className="text-xs mt-0.5">{n.label}</span>
        </a>
      ))}
    </nav>
  )
}

function QRDisplay({ value, size = 220 }: { value: string; size?: number }) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&color=1e293b&bgcolor=f8fafc&margin=12`
  return (
    <div className="bg-slate-50 border-4 border-white rounded-2xl shadow-lg p-2 inline-block">
      <img src={url} alt="Código QR" width={size} height={size} className="rounded-xl block" />
    </div>
  )
}

function DeleteModal({
  visita, onClose, onDeleted, authFetch
}: {
  visita: Visita
  onClose: () => void
  onDeleted: (id: number) => void
  authFetch: (url: string, opts?: RequestInit) => Promise<Response>
}) {
  const [clave,    setClave]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function confirmar() {
    if (!clave.trim()) { setError('Ingresa la clave de borrado'); return }
    setLoading(true); setError('')
    try {
      const r = await authFetch(
        `/api/portal/qr/visita/${visita.id}?clave=${encodeURIComponent(clave)}`,
        { method: 'DELETE' }
      )
      const data = await r.json()
      if (!r.ok) { setError(data.detail || 'Clave incorrecta'); return }
      onDeleted(visita.id)
      onClose()
    } catch { setError('Error de conexión') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="font-bold text-slate-800 text-lg mb-1">Eliminar visita</h3>
        <p className="text-slate-500 text-sm mb-4">
          <span className="font-semibold text-slate-700">{visita.nombre_visitante}</span>
          {visita.motivo && <span> · {visita.motivo}</span>}
        </p>
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Clave de borrado
          </label>
          <input
            type="password"
            value={clave}
            onChange={e => { setClave(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && confirmar()}
            placeholder="••••••••"
            autoFocus
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-red-400"
          />
          {error && <p className="text-red-600 text-xs mt-1.5">{error}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition">
            Cancelar
          </button>
          <button onClick={confirmar} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-500 disabled:opacity-50 transition">
            {loading ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PortalQR() {
  const router = useRouter()
  const { residente, token, loading, authFetch } = usePortalSession()
  const [nombreVisita, setNombreVisita] = useState('')
  const [rutVisita,    setRutVisita]    = useState('')
  const [motivo,       setMotivo]       = useState('')
  const [validez,      setValidez]      = useState('24')
  const [generating,   setGenerating]   = useState(false)
  const [resultado,    setResultado]    = useState<{ url: string; token: string; expira: string } | null>(null)
  const [copiado,      setCopiado]      = useState(false)
  const [error,        setError]        = useState('')
  const [visitas,      setVisitas]      = useState<Visita[]>([])
  const [miQR,         setMiQR]         = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Visita | null>(null)

  useEffect(() => {
    if (!loading && !token) router.push('/portal/login')
  }, [loading, token, router])

  useEffect(() => {
    if (!token || !residente) return
    authFetch('/api/portal/qr/mis-visitas')
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setVisitas(d) }).catch(() => {})
    const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://conectaai.cl'
    if (residente.rut) setMiQR(`${appUrl}/acceso/residente/${encodeURIComponent(residente.rut)}`)
  }, [token, residente])

  const handleGenerar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombreVisita.trim()) { setError('Nombre requerido'); return }
    setGenerating(true); setError(''); setResultado(null)
    try {
      const res = await authFetch('/api/portal/qr/visita', {
        method: 'POST',
        body: JSON.stringify({ nombre_visita: nombreVisita, rut_visita: rutVisita || undefined, motivo: motivo || 'Visita', horas_validez: parseInt(validez) }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.detail || 'Error generando QR'); return }
      setResultado(data)
      setVisitas(prev => [{ id: Date.now(), estado: 'pendiente', token: data.token, nombre_visitante: nombreVisita, motivo: motivo || 'Visita', creado_en: new Date().toISOString() }, ...prev])
    } catch { setError('Error de conexión') }
    finally { setGenerating(false) }
  }

  const copiar = async () => {
    if (!resultado) return
    try { await navigator.clipboard.writeText(resultado.url); setCopiado(true); setTimeout(() => setCopiado(false), 2500) } catch {}
  }

  const compartirWA = () => {
    if (!resultado) return
    const msg = encodeURIComponent(
      `Hola! Aquí está tu código de acceso al edificio.\n\nVisitante: ${nombreVisita}\nVálido hasta: ${new Date(resultado.expira).toLocaleString('es-CL')}\n\nPresenta este QR en la recepción:\n${resultado.url}`
    )
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  const badge: Record<string, string> = {
    pendiente: 'bg-amber-100 text-amber-700',
    aprobado:  'bg-emerald-100 text-emerald-700',
    ingresado: 'bg-blue-100 text-blue-700',
    rechazado: 'bg-red-100 text-red-700',
    expirado:  'bg-slate-100 text-slate-500',
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-white border-b border-slate-100 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <a href="/portal/dashboard" className="text-slate-400 hover:text-slate-700 text-lg">←</a>
          <h1 className="text-lg font-bold text-slate-800">Acceso y Visitas</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-6">

        {/* QR personal del residente */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <span className="text-indigo-500">🔑</span> Mi QR de Acceso
          </h2>
          {residente ? (
            <div className="flex flex-col items-center gap-4">
              {miQR && <QRDisplay value={miQR} size={200} />}
              <div className="bg-indigo-50 rounded-xl px-5 py-3 text-center w-full">
                <p className="text-indigo-700 font-bold text-base">{residente.nombre}</p>
                <p className="text-indigo-400 text-sm mt-0.5">RUT: {residente.rut}</p>
                {residente.departamento_id && (
                  <p className="text-indigo-400 text-xs mt-0.5">Departamento {residente.departamento_id}</p>
                )}
              </div>
              <p className="text-xs text-slate-400 text-center">
                Muestra este QR al lector de acceso del edificio
              </p>
            </div>
          ) : <p className="text-slate-400 text-sm">Cargando...</p>}
        </div>

        {/* Generar QR para visita */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <span className="text-amber-500">👤</span> Invitar una Visita
          </h2>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 mb-3">{error}</div>
          )}
          {!resultado ? (
            <form onSubmit={handleGenerar} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nombre del visitante *</label>
                <input value={nombreVisita} onChange={e => setNombreVisita(e.target.value)} placeholder="Nombre completo"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">RUT (opcional)</label>
                <input value={rutVisita} onChange={e => setRutVisita(e.target.value)} placeholder="12.345.678-9"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Motivo</label>
                <input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Familiar, delivery, técnico..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Válido por</label>
                <select value={validez} onChange={e => setValidez(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="4">4 horas</option>
                  <option value="8">8 horas</option>
                  <option value="24">24 horas</option>
                  <option value="48">48 horas</option>
                </select>
              </div>
              <button type="submit" disabled={generating}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {generating
                  ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> Generando...</>
                  : <><span>📲</span> Generar QR de Acceso</>}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                <p className="text-emerald-700 font-semibold text-sm mb-1">✓ QR generado para {nombreVisita}</p>
                <p className="text-emerald-600 text-xs">Válido hasta: {new Date(resultado.expira).toLocaleString('es-CL')}</p>
              </div>
              <div className="flex justify-center">
                <QRDisplay value={resultado.url} size={240} />
              </div>
              <p className="text-xs text-slate-500 text-center">El visitante debe mostrar este QR en recepción</p>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <p className="text-xs text-slate-500 mb-1 font-medium">Enlace de acceso</p>
                <p className="text-xs text-slate-600 break-all font-mono">{resultado.url}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={copiar}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-700 text-white text-sm font-semibold hover:bg-slate-600 transition">
                  {copiado ? '✓ Copiado' : '📋 Copiar'}
                </button>
                <button onClick={compartirWA}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  WhatsApp
                </button>
              </div>
              <button onClick={() => { setResultado(null); setNombreVisita(''); setRutVisita(''); setMotivo('') }}
                className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition">
                Generar otro QR
              </button>
            </div>
          )}
        </div>

        {/* Historial visitas con botón eliminar */}
        {visitas.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <h2 className="font-semibold text-slate-800 mb-3 flex items-center justify-between">
              <span>Visitas recientes</span>
              <span className="text-xs text-slate-400 font-normal">{visitas.length} registros</span>
            </h2>
            <div className="space-y-2">
              {visitas.map(v => (
                <div key={v.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{v.nombre_visitante || 'Visita'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {v.motivo && <p className="text-xs text-slate-400 truncate">{v.motivo}</p>}
                      {v.creado_en && (
                        <p className="text-xs text-slate-400 flex-shrink-0">
                          · {new Date(v.creado_en).toLocaleDateString('es-CL')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${badge[v.estado] || 'bg-slate-100 text-slate-600'}`}>
                      {v.estado}
                    </span>
                    <button
                      onClick={() => setDeleteTarget(v)}
                      title="Eliminar visita"
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-700 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-3 text-center">
              🔐 La eliminación requiere clave de borrado
            </p>
          </div>
        )}
      </div>

      {/* Modal de eliminación con clave */}
      {deleteTarget && (
        <DeleteModal
          visita={deleteTarget}
          authFetch={authFetch}
          onClose={() => setDeleteTarget(null)}
          onDeleted={(id) => setVisitas(prev => prev.filter(v => v.id !== id))}
        />
      )}

      <BottomNav/>
    </div>
  )
}
