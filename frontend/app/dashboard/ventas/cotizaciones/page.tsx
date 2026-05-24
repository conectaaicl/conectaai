'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Cotizacion {
  id: number
  deal_id: number
  numero: string
  fecha: string
  valida_hasta: string
  estado: 'borrador' | 'enviada' | 'vista' | 'aceptada' | 'rechazada'
  total: number
  created_at: string
  cliente?: string
  contacto?: string
}

const ESTADO_CONFIG: Record<string, { label: string, color: string, icon: string }> = {
  'borrador': { label: 'Borrador', color: 'bg-gray-500', icon: '📝' },
  'enviada': { label: 'Enviada', color: 'bg-blue-500', icon: '📤' },
  'vista': { label: 'Vista', color: 'bg-yellow-500', icon: '👁️' },
  'aceptada': { label: 'Aceptada', color: 'bg-green-500', icon: '✅' },
  'rechazada': { label: 'Rechazada', color: 'bg-red-500', icon: '❌' }
}

export default function CotizacionesPage() {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchCotizaciones()
  }, [])

  async function fetchCotizaciones() {
    try {
      setLoading(true)
      const response = await fetch('/api/ventas/cotizaciones')
      if (response.ok) {
        const data = await response.json()
        setCotizaciones(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatMonto = (monto: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(monto)
  }

  const formatFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  async function descargarPDF(cotizacionId: number) {
    try {
      const response = await fetch(`/api/ventas/cotizaciones/${cotizacionId}/pdf`)
      if (!response.ok) throw new Error('Error al descargar PDF')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cotizacion_${cotizacionId}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      alert('Error al descargar PDF')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-700 font-medium">Cargando cotizaciones...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 shadow-xl px-8 py-6">
        <div className="flex justify-between items-center">
          <div className="text-white">
            <h1 className="text-3xl font-bold mb-1 flex items-center gap-3">
              💰 Cotizaciones
              <span className="text-sm font-normal bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                {cotizaciones.length} total
              </span>
            </h1>
            <p className="text-purple-100 text-sm font-medium">
              Gestiona y envía cotizaciones profesionales
            </p>
          </div>
          <Link 
            href="/dashboard/ventas"
            className="px-5 py-3 bg-white/20 backdrop-blur-sm text-white rounded-xl font-semibold hover:bg-white/30 transition-all"
          >
            ← Volver
          </Link>
        </div>
      </div>

      <div className="px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          {Object.entries(ESTADO_CONFIG).map(([estado, config]) => {
            const count = cotizaciones.filter(c => c.estado === estado).length
            return (
              <div key={estado} className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg">
                <div className="flex items-center gap-3">
                  <span className={`${config.color} text-white text-2xl w-12 h-12 rounded-xl flex items-center justify-center`}>
                    {config.icon}
                  </span>
                  <div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-sm text-gray-600">{config.label}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                <tr>
                  <th className="px-6 py-4 text-left">Número</th>
                  <th className="px-6 py-4 text-left">Cliente</th>
                  <th className="px-6 py-4 text-left">Fecha</th>
                  <th className="px-6 py-4 text-left">Total</th>
                  <th className="px-6 py-4 text-left">Estado</th>
                  <th className="px-6 py-4 text-left">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cotizaciones.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <p className="text-6xl mb-4">📋</p>
                      <p className="text-xl font-semibold">No hay cotizaciones</p>
                    </td>
                  </tr>
                ) : (
                  cotizaciones.map((cot) => {
                    const config = ESTADO_CONFIG[cot.estado]
                    return (
                      <tr key={cot.id} className="border-b hover:bg-purple-50">
                        <td className="px-6 py-4">
                          <span className="font-mono font-bold text-purple-600">{cot.numero}</span>
                        </td>
                        <td className="px-6 py-4 font-semibold">{cot.cliente}</td>
                        <td className="px-6 py-4 text-sm">{formatFecha(cot.fecha)}</td>
                        <td className="px-6 py-4 font-bold text-lg text-green-600">{formatMonto(cot.total)}</td>
                        <td className="px-6 py-4">
                          <span className={`${config.color} text-white px-3 py-1 rounded-full text-sm font-semibold`}>
                            {config.icon} {config.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => descargarPDF(cot.id)}
                            className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 text-sm font-semibold"
                          >
                            📥 PDF
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
