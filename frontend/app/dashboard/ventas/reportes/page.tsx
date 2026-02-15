'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function ReportesPage() {
  const [reportes, setReportes] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReportes()
  }, [])

  async function fetchReportes() {
    try {
      const response = await fetch('/api/ventas/reportes/avanzados')
      if (response.ok) {
        const data = await response.json()
        setReportes(data)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-700 font-medium">Cargando reportes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header Odoo Style */}
      <div className="bg-gradient-to-r from-purple-700 to-purple-900 shadow-xl px-8 py-6 mb-8">
        <div className="flex justify-between items-center">
          <div className="text-white">
            <h1 className="text-3xl font-bold mb-1 flex items-center gap-3">
              📊 Reportes y Analytics
            </h1>
            <p className="text-purple-200 text-sm font-medium">
              Métricas avanzadas y KPIs del pipeline de ventas
            </p>
          </div>
          <Link 
            href="/dashboard/ventas"
            className="px-5 py-3 bg-white/20 backdrop-blur-sm text-white rounded-xl font-semibold hover:bg-white/30 transition-all"
          >
            ← Volver al Embudo
          </Link>
        </div>
      </div>

      <div className="px-8 pb-8">
        {reportes && (
          <>
            {/* KPIs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all border-l-4 border-blue-600">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">💰</span>
                  <p className="text-sm text-gray-600 font-semibold">Total Pipeline</p>
                </div>
                <p className="text-3xl font-bold text-blue-600">{formatMonto(reportes.total_pipeline)}</p>
              </div>

              <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all border-l-4 border-green-600">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">🎯</span>
                  <p className="text-sm text-gray-600 font-semibold">Tasa Conversión</p>
                </div>
                <p className="text-3xl font-bold text-green-600">{reportes.tasa_conversion}%</p>
              </div>

              <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all border-l-4 border-orange-600">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">⚠️</span>
                  <p className="text-sm text-gray-600 font-semibold">Deals Estancados</p>
                </div>
                <p className="text-3xl font-bold text-orange-600">{reportes.deals_estancados.length}</p>
              </div>

              <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all border-l-4 border-purple-600">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">📈</span>
                  <p className="text-sm text-gray-600 font-semibold">Top Oportunidad</p>
                </div>
                <p className="text-3xl font-bold text-purple-600">
                  {reportes.top_oportunidades.length > 0 ? formatMonto(reportes.top_oportunidades[0].monto) : '$0'}
                </p>
              </div>
            </div>

            {/* Deals Estancados */}
            {reportes.deals_estancados.length > 0 && (
              <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg mb-8 overflow-hidden">
                <div className="bg-gradient-to-r from-orange-600 to-red-600 px-6 py-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    ⚠️ Deals que Requieren Atención ({reportes.deals_estancados.length})
                  </h2>
                </div>
                <div className="p-6">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b-2">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Cliente</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Contacto</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Etapa</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Monto</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Días sin actividad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportes.deals_estancados.map((deal: any, idx: number) => (
                          <tr key={idx} className="border-b hover:bg-orange-50">
                            <td className="px-4 py-3 font-semibold">{deal.cliente}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{deal.contacto}</td>
                            <td className="px-4 py-3">
                              <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-semibold">
                                {deal.etapa}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-bold text-green-600">{formatMonto(deal.monto)}</td>
                            <td className="px-4 py-3">
                              <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-bold">
                                {deal.dias_sin_actividad} días
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Top Oportunidades */}
            {reportes.top_oportunidades.length > 0 && (
              <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg mb-8 overflow-hidden">
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    🏆 Top Oportunidades ({reportes.top_oportunidades.length})
                  </h2>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {reportes.top_oportunidades.map((deal: any, idx: number) => (
                      <div key={idx} className="border-2 border-purple-200 rounded-xl p-4 hover:border-purple-400 hover:shadow-lg transition-all">
                        <div className="flex items-start justify-between mb-3">
                          <span className="text-3xl font-bold text-purple-600">#{idx + 1}</span>
                          <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold">
                            {deal.probabilidad}%
                          </span>
                        </div>
                        <h3 className="font-bold text-lg mb-1">{deal.cliente}</h3>
                        <p className="text-sm text-gray-600 mb-3">{deal.contacto}</p>
                        <p className="text-2xl font-bold text-green-600">{formatMonto(deal.monto)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Embudo de Conversión */}
            <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  📊 Embudo de Conversión
                </h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {reportes.embudo_conversion.map((etapa: any, idx: number) => {
                    const width = (etapa.count / reportes.embudo_conversion[0].count) * 100
                    return (
                      <div key={idx}>
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-semibold text-gray-800">{etapa.etapa}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-600">{etapa.count} deals</span>
                            <span className="font-bold text-green-600">{formatMonto(etapa.monto_total)}</span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-8">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-purple-600 h-8 rounded-full flex items-center justify-end px-3"
                            style={{ width: `${width}%` }}
                          >
                            <span className="text-white text-sm font-bold">{width.toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
