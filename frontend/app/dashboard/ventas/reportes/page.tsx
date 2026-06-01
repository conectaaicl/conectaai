'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function ReportesPage() {
  const [reportes, setReportes] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchReportes() }, [])

  async function fetchReportes() {
    try {
      const r = await fetch('/api/ventas/reportes/avanzados')
      if (r.ok) setReportes(await r.json())
    } catch {}
    setLoading(false)
  }

  const fmt = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Reportes y Analytics</h1>
          <p className="text-sm text-slate-400 mt-0.5">Métricas avanzadas del pipeline de ventas</p>
        </div>
        <Link href="/dashboard/ventas" className="px-4 py-2 text-sm text-slate-300 border border-slate-700 rounded-lg hover:border-slate-500 hover:text-white transition-colors">
          ← Pipeline
        </Link>
      </div>

      {!reportes ? (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-12 text-center">
          <p className="text-slate-500 text-sm">No hay datos de reportes disponibles</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Pipeline',    value: fmt(reportes.total_pipeline),    color: 'text-blue-400' },
              { label: 'Tasa Conversión',   value: reportes.tasa_conversion + '%',  color: 'text-emerald-400' },
              { label: 'Deals Estancados',  value: String(reportes.deals_estancados?.length ?? 0), color: 'text-amber-400' },
              { label: 'Top Oportunidad',   value: reportes.top_oportunidades?.length > 0 ? fmt(reportes.top_oportunidades[0].monto) : '$0', color: 'text-white' },
            ].map(k => (
              <div key={k.label} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{k.label}</p>
                <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Deals Estancados */}
          {reportes.deals_estancados?.length > 0 && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-700/50 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <h2 className="text-sm font-semibold text-white">Deals que requieren atención ({reportes.deals_estancados.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700/30">
                      <th className="px-4 py-3 text-left text-xs text-slate-500 uppercase tracking-wide font-semibold">Cliente</th>
                      <th className="px-4 py-3 text-left text-xs text-slate-500 uppercase tracking-wide font-semibold">Etapa</th>
                      <th className="px-4 py-3 text-left text-xs text-slate-500 uppercase tracking-wide font-semibold">Monto</th>
                      <th className="px-4 py-3 text-left text-xs text-slate-500 uppercase tracking-wide font-semibold">Sin actividad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {reportes.deals_estancados.map((deal: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-700/20 transition-colors">
                        <td className="px-4 py-3 text-sm font-semibold text-white">{deal.cliente}</td>
                        <td className="px-4 py-3 text-xs text-slate-400 capitalize">{deal.etapa}</td>
                        <td className="px-4 py-3 text-sm font-bold text-emerald-400">{fmt(deal.monto)}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold text-amber-400">{deal.dias_sin_actividad} días</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top Oportunidades */}
          {reportes.top_oportunidades?.length > 0 && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-700/50 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <h2 className="text-sm font-semibold text-white">Top Oportunidades</h2>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                {reportes.top_oportunidades.map((deal: any, i: number) => (
                  <div key={i} className="bg-slate-800 border border-slate-700/60 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-500 font-bold">#{i + 1}</span>
                      <span className="text-xs text-blue-400 font-semibold">{deal.probabilidad}%</span>
                    </div>
                    <p className="text-sm font-bold text-white mb-0.5 truncate">{deal.cliente}</p>
                    {deal.contacto && <p className="text-xs text-slate-500 mb-2 truncate">{deal.contacto}</p>}
                    <p className="text-lg font-bold text-emerald-400">{fmt(deal.monto)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Embudo de Conversión */}
          {reportes.embudo_conversion?.length > 0 && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-700/50 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <h2 className="text-sm font-semibold text-white">Embudo de Conversión</h2>
              </div>
              <div className="p-5 space-y-4">
                {reportes.embudo_conversion.map((etapa: any, i: number) => {
                  const maxCount = reportes.embudo_conversion[0]?.count || 1
                  const pct = Math.round((etapa.count / maxCount) * 100)
                  return (
                    <div key={i}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-sm text-slate-300 font-semibold capitalize">{etapa.etapa}</span>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span>{etapa.count} deals</span>
                          <span className="text-emerald-400 font-semibold">{fmt(etapa.monto_total)}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
