'use client'
import { useState, useEffect } from 'react'
import { useSession } from '@/hooks/useSession'

const API = '/api/reportes'

interface Stats {
  totales: {
    departamentos: number
    residentes_activos: number
    deuda_total: number
    recaudado_mes: number
    incidencias_abiertas: number
    visitas_hoy: number
    personal_activo: number
    reservas_mes: number
  }
  trend_6_meses: { periodo: string; morosidad: number; recaudado: number }[]
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

function StatCard({ label, value, sub, color = 'blue' }: { label: string; value: string; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'from-blue-600 to-blue-700',
    green: 'from-emerald-600 to-emerald-700',
    red: 'from-red-600 to-red-700',
    purple: 'from-purple-600 to-purple-700',
    orange: 'from-orange-500 to-orange-600',
    slate: 'from-slate-600 to-slate-700',
  }
  return (
    <div className={`bg-gradient-to-br ${colors[color] || colors.blue} rounded-xl p-5 text-white shadow-lg`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs opacity-70 mt-1">{sub}</p>}
    </div>
  )
}

function BarChart({ data }: { data: { periodo: string; morosidad: number; recaudado: number }[] }) {
  const max = Math.max(...data.flatMap(d => [d.morosidad, d.recaudado]), 1)
  return (
    <div className="flex items-end gap-2 h-40 mt-4">
      {data.map(d => (
        <div key={d.periodo} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex gap-0.5 items-end" style={{ height: '120px' }}>
            <div
              className="flex-1 bg-emerald-500 rounded-t"
              style={{ height: `${(d.recaudado / max) * 100}%` }}
              title={`Recaudado: ${fmt(d.recaudado)}`}
            />
            <div
              className="flex-1 bg-red-400 rounded-t"
              style={{ height: `${(d.morosidad / max) * 100}%` }}
              title={`Morosidad: ${fmt(d.morosidad)}`}
            />
          </div>
          <span className="text-xs text-slate-400">{d.periodo.slice(5)}</span>
        </div>
      ))}
    </div>
  )
}

interface ReporteConfig {
  id: string
  label: string
  desc: string
  icon: string
  color: string
  params?: React.ReactNode
  buildUrl: (tenant: number, extra: Record<string, string>) => string
}

export default function ReportesPage() {
  const { tenantId } = useSession()
  const tenant_id = tenantId
  const [stats, setStats] = useState<Stats | null>(null)
  const [periodo, setPeriodo] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [desde, setDesde] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().slice(0, 10)
  })
  const [hasta, setHasta] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState<string | null>(null)

  useEffect(() => {
    if (!tenant_id) return
    fetch(`${API}/stats/general?tenant_id=${tenant_id}`)
      .then(r => r.json())
      .then(setStats)
      .catch(() => null)
  }, [tenant_id])

  const download = async (url: string, reportId: string) => {
    setLoading(reportId)
    try {
      const r = await fetch(url)
      if (!r.ok) throw new Error('Error generando reporte')
      const blob = await r.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      const cd = r.headers.get('content-disposition') || ''
      const match = cd.match(/filename="([^"]+)"/)
      a.download = match ? match[1] : 'reporte.xlsx'
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) {
      alert('Error al descargar el reporte')
    } finally {
      setLoading(null)
    }
  }

  const tid = tenant_id || 1

  const reportes: ReporteConfig[] = [
    {
      id: 'morosidad',
      label: 'Morosidad',
      desc: 'Deudores por departamento con meses de deuda y monto total adeudado.',
      icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
      color: 'red',
      buildUrl: (t) => `${API}/excel/morosidad?tenant_id=${t}`,
    },
    {
      id: 'gastos-periodo',
      label: 'Gastos Comunes',
      desc: 'Cobros por departamento + presupuesto de ítems del período seleccionado.',
      icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
      color: 'blue',
      buildUrl: (t, e) => `${API}/excel/gastos-periodo?tenant_id=${t}&periodo=${e.periodo || periodo}`,
    },
    {
      id: 'finanzas',
      label: 'Finanzas Anual',
      desc: 'Ingresos vs egresos mes a mes para el año seleccionado.',
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      color: 'green',
      buildUrl: (t, e) => `${API}/excel/finanzas?tenant_id=${t}&anio=${e.anio || anio}`,
    },
    {
      id: 'nomina',
      label: 'Nómina Personal',
      desc: 'Listado de personal con sueldos, cargos y datos bancarios para pago.',
      icon: 'M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2',
      color: 'purple',
      buildUrl: (t) => `${API}/excel/nomina?tenant_id=${t}`,
    },
    {
      id: 'incidencias',
      label: 'Incidencias',
      desc: 'Reporte de incidencias y fallas en el rango de fechas seleccionado.',
      icon: 'M12 9v2m0 4h.01M3 12a9 9 0 1018 0A9 9 0 013 12z',
      color: 'orange',
      buildUrl: (t, e) => `${API}/excel/incidencias?tenant_id=${t}&desde=${e.desde || desde}&hasta=${e.hasta || hasta}`,
    },
    {
      id: 'reservas',
      label: 'Reservas Espacios',
      desc: 'Uso de espacios comunes con cobros en el rango de fechas.',
      icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      color: 'slate',
      buildUrl: (t, e) => `${API}/excel/reservas?tenant_id=${t}&desde=${e.desde || desde}&hasta=${e.hasta || hasta}`,
    },
    {
      id: 'residentes',
      label: 'Padrón Residentes',
      desc: 'Listado completo de residentes y propietarios con datos de contacto.',
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
      color: 'blue',
      buildUrl: (t) => `${API}/excel/residentes?tenant_id=${t}`,
    },
  ]

  const colorBtn: Record<string, string> = {
    red: 'bg-red-600 hover:bg-red-700',
    blue: 'bg-blue-600 hover:bg-blue-700',
    green: 'bg-emerald-600 hover:bg-emerald-700',
    purple: 'bg-purple-600 hover:bg-purple-700',
    orange: 'bg-orange-500 hover:bg-orange-600',
    slate: 'bg-slate-600 hover:bg-slate-700',
  }

  return (
    <div className="p-4 sm:p-6 space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Reportes y Exportaciones</h1>
        <p className="text-slate-400 text-sm mt-1">Descarga reportes en formato Excel (.xlsx) listos para imprimir o compartir.</p>
      </div>

      {/* KPI Stats */}
      {stats && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-200">Resumen General</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Departamentos" value={String(stats.totales.departamentos)} color="blue" />
            <StatCard label="Residentes activos" value={String(stats.totales.residentes_activos)} color="green" />
            <StatCard label="Deuda total" value={fmt(stats.totales.deuda_total)} color="red" sub="Gastos impagos" />
            <StatCard label="Recaudado este mes" value={fmt(stats.totales.recaudado_mes)} color="green" />
            <StatCard label="Incidencias abiertas" value={String(stats.totales.incidencias_abiertas)} color="orange" />
            <StatCard label="Visitas hoy" value={String(stats.totales.visitas_hoy)} color="purple" />
            <StatCard label="Personal activo" value={String(stats.totales.personal_activo)} color="slate" />
            <StatCard label="Reservas este mes" value={String(stats.totales.reservas_mes)} color="blue" />
          </div>

          {/* Mini chart */}
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-200">Recaudado vs Morosidad — últimos 6 meses</h3>
              <div className="flex gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Recaudado</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400 inline-block" /> Morosidad</span>
              </div>
            </div>
            <BarChart data={stats.trend_6_meses} />
          </div>
        </div>
      )}

      {/* Filtros globales */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h2 className="text-base font-semibold text-slate-200 mb-4">Parámetros de Reportes</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Período (YYYY-MM)</label>
            <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Año</label>
            <input type="number" value={anio} onChange={e => setAnio(Number(e.target.value))} min={2020} max={2030}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Desde</label>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Hasta</label>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200" />
          </div>
        </div>
      </div>

      {/* Tarjetas de reportes */}
      <div>
        <h2 className="text-lg font-semibold text-slate-200 mb-4">Exportar Excel</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reportes.map(rep => (
            <div key={rep.id} className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex flex-col gap-3 hover:border-slate-500 transition-colors">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-slate-700 rounded-lg flex-shrink-0">
                  <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={rep.icon} />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-100">{rep.label}</h3>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{rep.desc}</p>
                </div>
              </div>
              <button
                onClick={() => download(rep.buildUrl(tid, { periodo, anio: String(anio), desde, hasta }), rep.id)}
                disabled={loading === rep.id}
                className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium text-white transition-colors ${colorBtn[rep.color]} disabled:opacity-50`}
              >
                {loading === rep.id ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Descargar .xlsx
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
