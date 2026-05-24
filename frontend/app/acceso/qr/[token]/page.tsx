'use client'
import { useState, useEffect, use } from 'react'

interface Visita {
  id: number
  nombre_visitante: string
  rut_visitante?: string
  departamento_id: number
  motivo?: string
  estado: string
  hora_entrada?: string
  hora_salida?: string
}

export default function AccesoQRPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [visita, setVisita] = useState<Visita | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updating, setUpdating] = useState(false)
  const [done, setDone] = useState('')

  useEffect(() => {
    fetch(`/api/accesos/qr/${token}`)
      .then(r => r.ok ? r.json() : Promise.reject('No encontrado'))
      .then(setVisita)
      .catch(() => setError('Código QR inválido o expirado'))
      .finally(() => setLoading(false))
  }, [token])

  async function registrar(accion: 'ingresar' | 'salir') {
    setUpdating(true)
    try {
      const res = await fetch(`/api/accesos/qr/${token}/${accion}`, { method: 'PATCH' })
      if (res.ok) {
        const data = await res.json()
        setVisita(data)
        setDone(accion === 'ingresar' ? 'Ingreso registrado exitosamente' : 'Salida registrada exitosamente')
      } else {
        const err = await res.json().catch(() => ({}))
        setError(err.detail || 'Error al registrar')
      }
    } finally { setUpdating(false) }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-center text-white">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold">Control de Acceso</h1>
          <p className="text-indigo-100 text-sm">ConectaAI</p>
        </div>

        <div className="p-6">
          {error ? (
            <div className="text-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-red-600 font-medium">{error}</p>
            </div>
          ) : done ? (
            <div className="text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-green-700 font-semibold">{done}</p>
              <p className="text-slate-500 text-sm mt-1">{visita?.nombre_visitante}</p>
            </div>
          ) : visita ? (
            <>
              <div className="space-y-3 mb-6">
                {[
                  { label: 'Visitante', value: visita.nombre_visitante },
                  { label: 'RUT', value: visita.rut_visitante || '—' },
                  { label: 'Departamento', value: String(visita.departamento_id) },
                  { label: 'Motivo', value: visita.motivo || '—' },
                  { label: 'Estado', value: visita.estado },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
                    <span className="text-sm text-slate-800 font-medium">{value}</span>
                  </div>
                ))}
              </div>

              {visita.estado === 'pendiente' && (
                <button
                  onClick={() => registrar('ingresar')}
                  disabled={updating}
                  className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition disabled:opacity-60"
                >
                  {updating ? 'Registrando...' : 'Registrar ingreso'}
                </button>
              )}
              {visita.estado === 'ingresado' && (
                <button
                  onClick={() => registrar('salir')}
                  disabled={updating}
                  className="w-full bg-orange-500 text-white py-3 rounded-xl font-semibold hover:bg-orange-600 transition disabled:opacity-60"
                >
                  {updating ? 'Registrando...' : 'Registrar salida'}
                </button>
              )}
              {(visita.estado === 'salido' || visita.estado === 'cancelado') && (
                <div className="text-center py-3 text-slate-500 text-sm">
                  Visita finalizada ({visita.estado})
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
