'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePortalSession } from '../usePortalSession'

interface Amenidad {
  id: number
  nombre: string
  descripcion: string | null
  capacidad: number | null
}

interface Reserva {
  id: number
  amenidad_nombre: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  estado: string
}

function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex">
      {[
        { href: '/portal/dashboard', icon: '🏠', label: 'Inicio' },
        { href: '/portal/cuenta', icon: '💰', label: 'Cuenta' },
        { href: '/portal/avisos', icon: '📢', label: 'Avisos' },
        { href: '/portal/qr', icon: '🔑', label: 'QR' },
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

export default function PortalReservas() {
  const router = useRouter()
  const { token, loading, authFetch, residente } = usePortalSession()
  const [amenidades, setAmenidades] = useState<Amenidad[]>([])
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [selected, setSelected] = useState<number | null>(null)
  const [fecha, setFecha] = useState('')
  const [horaInicio, setHoraInicio] = useState('09:00')
  const [horaFin, setHoraFin] = useState('11:00')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!loading && !token) router.push('/portal/login')
  }, [loading, token, router])

  useEffect(() => {
    if (!token) return
    const tenantId = residente?.tenant_id ?? 1
    authFetch(`/api/reservas/amenidades?tenant_id=${tenantId}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setAmenidades(Array.isArray(data) ? data : []))
      .catch(() => {})

    authFetch(`/api/reservas/mis-reservas?tenant_id=${tenantId}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setReservas(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoadingData(false))
  }, [token, residente])

  const handleReservar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected || !fecha) { setError('Seleccione amenidad y fecha'); return }
    setSubmitting(true); setError(''); setSuccess('')
    try {
      const res = await authFetch('/api/reservas', {
        method: 'POST',
        body: JSON.stringify({
          amenidad_id: selected,
          fecha,
          hora_inicio: horaInicio,
          hora_fin: horaFin,
          tenant_id: residente?.tenant_id ?? 1,
          departamento_id: residente?.departamento_id,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.detail || 'Error al realizar reserva'); return }
      setSuccess('Reserva realizada correctamente')
      setReservas(prev => [data, ...prev])
      setSelected(null); setFecha('')
    } catch { setError('Error de conexion') }
    finally { setSubmitting(false) }
  }

  const estadoBadge: Record<string, string> = {
    pendiente: 'bg-amber-100 text-amber-700',
    confirmada: 'bg-emerald-100 text-emerald-700',
    cancelada: 'bg-red-100 text-red-700',
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-white border-b border-slate-100 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <a href="/portal/dashboard" className="text-slate-400 hover:text-slate-700 text-lg">&#8592;</a>
          <h1 className="text-lg font-bold text-slate-800">Reservas</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-6">
        {amenidades.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <h2 className="font-semibold text-slate-800 mb-4">Nueva reserva</h2>
            {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 mb-3">{error}</div>}
            {success && <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-700 mb-3">{success}</div>}
            <form onSubmit={handleReservar} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Amenidad *</label>
                <select
                  value={selected ?? ''}
                  onChange={e => setSelected(Number(e.target.value) || null)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Seleccionar...</option>
                  {amenidades.map(a => (
                    <option key={a.id} value={a.id}>{a.nombre}{a.capacidad ? ` (cap. ${a.capacidad})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fecha *</label>
                <input
                  type="date"
                  value={fecha}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setFecha(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Hora inicio</label>
                  <input type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Hora fin</label>
                  <input type="time" value={horaFin} onChange={e => setHoraFin(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Reservando...' : 'Confirmar reserva'}
              </button>
            </form>
          </div>
        )}

        {amenidades.length === 0 && !loadingData && (
          <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
            <span className="text-4xl mb-3 block">📅</span>
            <p className="text-slate-600 font-medium">Reservas de amenidades</p>
            <p className="text-slate-400 text-sm mt-1">No hay amenidades disponibles en este momento.</p>
          </div>
        )}

        {reservas.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <h2 className="font-semibold text-slate-800 mb-3">Mis reservas</h2>
            <div className="space-y-2">
              {reservas.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{r.amenidad_nombre}</p>
                    <p className="text-xs text-slate-400">{r.fecha} {r.hora_inicio} - {r.hora_fin}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoBadge[r.estado] || 'bg-slate-100 text-slate-600'}`}>
                    {r.estado}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
