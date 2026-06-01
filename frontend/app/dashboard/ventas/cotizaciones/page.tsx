'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

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

const ESTADOS: Record<string, { label: string; dot: string; text: string }> = {
  borrador:  { label: 'Borrador',  dot: 'bg-slate-500',  text: 'text-slate-400' },
  enviada:   { label: 'Enviada',   dot: 'bg-blue-500',   text: 'text-blue-400'  },
  vista:     { label: 'Vista',     dot: 'bg-amber-500',  text: 'text-amber-400' },
  aceptada:  { label: 'Aceptada', dot: 'bg-emerald-500', text: 'text-emerald-400' },
  rechazada: { label: 'Rechazada', dot: 'bg-red-500',    text: 'text-red-400'   },
}

export default function CotizacionesPage() {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchCotizaciones() }, [])

  async function fetchCotizaciones() {
    try {
      const r = await fetch('/api/ventas/cotizaciones')
      if (r.ok) setCotizaciones(await r.json())
    } catch {}
    setLoading(false)
  }

  const fmt = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n)
  const fmtDate = (s: string) => new Date(s).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })

  async function descargarPDF(id: number) {
    try {
      const r = await fetch(`/api/ventas/cotizaciones/${id}/pdf`)
      if (!r.ok) return
      const url = window.URL.createObjectURL(await r.blob())
      const a = document.createElement('a')
      a.href = url; a.download = `cotizacion_${id}.pdf`
      document.body.appendChild(a); a.click()
      window.URL.revokeObjectURL(url); document.body.removeChild(a)
    } catch {}
  }

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
          <h1 className="text-2xl font-bold text-white">Cotizaciones</h1>
          <p className="text-sm text-slate-400 mt-0.5">Historial de cotizaciones generadas</p>
        </div>
        <Link href="/dashboard/ventas" className="px-4 py-2 text-sm text-slate-300 border border-slate-700 rounded-lg hover:border-slate-500 hover:text-white transition-colors">
          ← Pipeline
        </Link>
      </div>

      {/* Estado summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Object.entries(ESTADOS).map(([key, cfg]) => {
          const count = cotizaciones.filter(c => c.estado === key).length
          return (
            <div key={key} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 flex items-center gap-3">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
              <div>
                <p className={`text-lg font-bold ${cfg.text}`}>{count}</p>
                <p className="text-xs text-slate-500">{cfg.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Table */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        {cotizaciones.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-600 text-sm">Sin cotizaciones registradas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="px-4 py-3 text-left text-xs text-slate-500 uppercase tracking-wide font-semibold">Número</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 uppercase tracking-wide font-semibold">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 uppercase tracking-wide font-semibold">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 uppercase tracking-wide font-semibold">Total</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 uppercase tracking-wide font-semibold">Estado</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 uppercase tracking-wide font-semibold">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {cotizaciones.map(cot => {
                  const cfg = ESTADOS[cot.estado] ?? ESTADOS.borrador
                  return (
                    <tr key={cot.id} className="hover:bg-slate-700/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-sm font-semibold text-blue-400">{cot.numero}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-white">{cot.cliente || '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{cot.created_at ? fmtDate(cot.created_at) : '—'}</td>
                      <td className="px-4 py-3 text-sm font-bold text-emerald-400">{fmt(cot.total)}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          <span className={`text-xs font-semibold ${cfg.text}`}>{cfg.label}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => descargarPDF(cot.id)}
                          className="text-xs px-3 py-1.5 border border-slate-600 text-slate-300 rounded-lg hover:border-slate-500 hover:text-white transition-colors">
                          Descargar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
