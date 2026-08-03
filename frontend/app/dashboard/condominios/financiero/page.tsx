'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from '@/hooks/useSession'
import Link from 'next/link'

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')
const fmtPct = (n: number) => `${Math.round(n)}%`

const MESES_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

interface DashData {
  recaudado_mes: number
  pendiente_mes: number
  total_cobros_mes: number
  pct_recaudacion: number
  pct_morosidad: number
  egresos_mes: number
  egresos_mes_anterior: number
  fondo_reserva: number
  medios_pago: { metodo: string; count: number; monto: number }[]
  top_morosos: { depto: string; residente: string; meses: number; deuda: number }[]
  tendencia_6m: { periodo: string; recaudado: number; pendiente: number }[]
  egresos_por_categoria: { categoria: string; monto: number }[]
}

function TrendBadge({ current, prev }: { current: number; prev: number }) {
  if (!prev || prev === 0) return null
  const diff = ((current - prev) / prev) * 100
  const up = diff > 0
  return (
    <span className={`text-xs font-semibold ${up ? 'text-red-400' : 'text-emerald-400'}`}>
      {up ? '↑' : '↓'} {Math.abs(Math.round(diff))}% vs mes ant.
    </span>
  )
}

function MiniBarChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="space-y-2 mt-3">
      {data.map((d, i) => (
        <div key={i}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400 truncate max-w-[160px]">{d.label}</span>
            <span className="text-slate-300 font-medium ml-2">{fmt(d.value)}</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${(d.value / max) * 100}%`, background: d.color }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function MiniPieChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <div className="text-slate-500 text-sm text-center py-6">Sin datos</div>

  let cumulative = 0
  const slices = data.map(d => {
    const pct = d.value / total
    const start = cumulative
    cumulative += pct
    return { ...d, start, pct }
  })

  const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
    const rad = (angle - 90) * (Math.PI / 180)
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }

  const describeArc = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(cx, cy, r, endAngle)
    const end = polarToCartesian(cx, cy, r, startAngle)
    const largeArc = endAngle - startAngle <= 180 ? '0' : '1'
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`
  }

  return (
    <div className="flex items-center gap-4 mt-3">
      <svg width="100" height="100" viewBox="0 0 100 100">
        {slices.map((s, i) => (
          <path
            key={i}
            d={describeArc(50, 50, 46, s.start * 360, (s.start + s.pct) * 360)}
            fill={s.color}
            stroke="#0f172a"
            strokeWidth="1"
          />
        ))}
      </svg>
      <div className="space-y-1.5 flex-1 min-w-0">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }} />
            <span className="text-xs text-slate-400 truncate">{s.label}</span>
            <span className="text-xs font-semibold text-slate-300 ml-auto">{Math.round(s.pct * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TendenciaChart({ data }: { data: { periodo: string; recaudado: number; pendiente: number }[] }) {
  if (!data.length) return <div className="text-slate-500 text-sm text-center py-6">Sin datos</div>
  const max = Math.max(...data.flatMap(d => [d.recaudado, d.pendiente]), 1)
  return (
    <div className="flex items-end gap-2 mt-4" style={{ height: 100 }}>
      {data.map((d, i) => {
        const label = d.periodo.slice(5)
        const mesIdx = parseInt(label) - 1
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex gap-0.5 items-end" style={{ height: 80 }}>
              <div
                className="flex-1 bg-emerald-500 rounded-t opacity-80"
                style={{ height: `${(d.recaudado / max) * 100}%` }}
                title={`Recaudado: ${fmt(d.recaudado)}`}
              />
              <div
                className="flex-1 bg-red-400 rounded-t opacity-70"
                style={{ height: `${(d.pendiente / max) * 100}%` }}
                title={`Pendiente: ${fmt(d.pendiente)}`}
              />
            </div>
            <span className="text-xs text-slate-500">{MESES_SHORT[mesIdx] || label}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function FinancieroDashboardPage() {
  const { tenantId } = useSession()
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)

  const mes = new Date().toLocaleString('es-CL', { month: 'long', year: 'numeric' })

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const r = await fetch('/api/egresos/dashboard')
      if (r.ok) setData(await r.json())
    } catch {}
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  const PIE_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#84cc16']
  const CAT_COLORS: Record<string, string> = {
    'Electricidad': '#f59e0b', 'Gas': '#f97316', 'Agua / Alcantarillado': '#06b6d4',
    'Personal / Remuneraciones': '#8b5cf6', 'Mantencion y Reparaciones': '#ef4444',
    'Limpieza': '#10b981', 'Administracion': '#3b82f6', 'Otros': '#94a3b8',
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Cargando dashboard financiero…</div>
      </div>
    )
  }

  const d = data ?? {
    recaudado_mes: 0, pendiente_mes: 0, total_cobros_mes: 0,
    pct_recaudacion: 0, pct_morosidad: 0,
    egresos_mes: 0, egresos_mes_anterior: 0, fondo_reserva: 0,
    medios_pago: [], top_morosos: [], tendencia_6m: [], egresos_por_categoria: [],
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard Financiero</h1>
          <p className="text-slate-400 text-sm mt-0.5 capitalize">{mes}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/condominios/egresos"
            className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-300 hover:bg-slate-700 transition-colors">
            📊 Registrar egreso
          </Link>
          <Link href="/dashboard/condominios/gastos-comunes"
            className="px-4 py-2 rounded-lg bg-indigo-600 text-sm text-white hover:bg-indigo-700 transition-colors font-medium">
            💳 Gestionar cobros
          </Link>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Recaudado */}
        <div className="bg-slate-900 border border-emerald-500/20 rounded-2xl p-5">
          <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">Total Recaudado</p>
          <p className="text-2xl lg:text-3xl font-black text-white">{fmt(d.recaudado_mes)}</p>
          <p className="text-xs text-slate-400 mt-1">
            De {fmt(d.total_cobros_mes)} facturado
          </p>
          <div className="mt-3 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${d.pct_recaudacion}%` }} />
          </div>
          <p className="text-xs text-emerald-400 font-semibold mt-1">{fmtPct(d.pct_recaudacion)} cobrado</p>
        </div>

        {/* Morosidad */}
        <div className="bg-slate-900 border border-red-500/20 rounded-2xl p-5">
          <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1">Morosidad</p>
          <p className={`text-2xl lg:text-3xl font-black ${d.pct_morosidad > 30 ? 'text-red-400' : d.pct_morosidad > 15 ? 'text-amber-400' : 'text-white'}`}>
            {fmtPct(d.pct_morosidad)}
          </p>
          <p className="text-xs text-slate-400 mt-1">{fmt(d.pendiente_mes)} pendiente</p>
          <div className="mt-3 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${d.pct_morosidad > 30 ? 'bg-red-500' : d.pct_morosidad > 15 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${d.pct_morosidad}%` }}
            />
          </div>
          <p className="text-xs text-red-400 font-semibold mt-1">{d.top_morosos.length} unidades con deuda</p>
        </div>

        {/* Egresos */}
        <div className="bg-slate-900 border border-orange-500/20 rounded-2xl p-5">
          <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider mb-1">Egresos del Mes</p>
          <p className="text-2xl lg:text-3xl font-black text-white">{fmt(d.egresos_mes)}</p>
          <p className="text-xs text-slate-400 mt-1">Mes anterior: {fmt(d.egresos_mes_anterior)}</p>
          <div className="mt-2">
            <TrendBadge current={d.egresos_mes} prev={d.egresos_mes_anterior} />
          </div>
          <Link href="/dashboard/condominios/egresos"
            className="text-xs text-orange-400 hover:text-orange-300 mt-1 block">
            Ver detalle →
          </Link>
        </div>

        {/* Fondo de reserva */}
        <div className="bg-slate-900 border border-blue-500/20 rounded-2xl p-5">
          <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">Fondo de Reserva</p>
          <p className="text-2xl lg:text-3xl font-black text-white">{fmt(d.fondo_reserva)}</p>
          <p className="text-xs text-slate-400 mt-1">Disponible</p>
          <Link href="/dashboard/condominios/gastos-comunes"
            className="text-xs text-blue-400 hover:text-blue-300 mt-3 block">
            Administrar fondo →
          </Link>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Medios de pago */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-slate-200 mb-1">Medios de Pago</h3>
          <p className="text-xs text-slate-500">Cobros recaudados este mes</p>
          {d.medios_pago.length > 0 ? (
            <MiniPieChart
              data={d.medios_pago.map((m, i) => ({
                label: m.metodo,
                value: m.monto,
                color: PIE_COLORS[i % PIE_COLORS.length],
              }))}
            />
          ) : (
            <div className="text-slate-500 text-sm text-center py-8">Sin pagos registrados</div>
          )}
        </div>

        {/* Tendencia 6 meses */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-slate-200 mb-1">Tendencia 6 meses</h3>
          <div className="flex gap-4 text-xs text-slate-400 mt-0.5">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block"/>Recaudado</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400 inline-block"/>Pendiente</span>
          </div>
          <TendenciaChart data={d.tendencia_6m} />
        </div>

        {/* Composición egresos */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-slate-200 mb-1">Composición Egresos</h3>
          <p className="text-xs text-slate-500">Por categoría este mes</p>
          {d.egresos_por_categoria.length > 0 ? (
            <MiniBarChart
              data={d.egresos_por_categoria.slice(0, 6).map(c => ({
                label: c.categoria,
                value: c.monto,
                color: CAT_COLORS[c.categoria] || '#94a3b8',
              }))}
            />
          ) : (
            <div className="text-slate-500 text-sm text-center py-6">
              Sin egresos registrados
              <Link href="/dashboard/condominios/egresos" className="block text-xs text-orange-400 hover:text-orange-300 mt-1">
                Registrar primer egreso →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Ranking morosos */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-200">Ranking de Morosidad</h3>
            <p className="text-xs text-slate-500 mt-0.5">Unidades con cuotas pendientes</p>
          </div>
          <Link href="/dashboard/condominios/cuenta-residente"
            className="text-xs text-indigo-400 hover:text-indigo-300">
            Ver cuentas →
          </Link>
        </div>
        {d.top_morosos.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-2xl mb-2">✅</div>
            <p className="text-slate-400 text-sm">Sin morosos este mes</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800">
                  <th className="text-left pb-2">#</th>
                  <th className="text-left pb-2">Unidad</th>
                  <th className="text-left pb-2">Residente</th>
                  <th className="text-right pb-2">Cuotas</th>
                  <th className="text-right pb-2">Deuda Total</th>
                  <th className="text-right pb-2">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {d.top_morosos.map((m, i) => (
                  <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 text-slate-500 font-mono text-xs">{i + 1}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono text-xs font-bold">
                        {m.depto}
                      </span>
                    </td>
                    <td className="py-3 text-slate-300">{m.residente}</td>
                    <td className="py-3 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        m.meses >= 3 ? 'bg-red-900/50 text-red-300' :
                        m.meses >= 2 ? 'bg-amber-900/50 text-amber-300' :
                        'bg-slate-800 text-slate-400'
                      }`}>
                        {m.meses} mes{m.meses !== 1 ? 'es' : ''}
                      </span>
                    </td>
                    <td className="py-3 text-right font-bold text-red-400">{fmt(m.deuda)}</td>
                    <td className="py-3 text-right">
                      <Link
                        href={`/dashboard/condominios/cuenta-residente?depto=${encodeURIComponent(m.depto)}`}
                        className="text-xs text-indigo-400 hover:text-indigo-300">
                        Ver cuenta
                      </Link>
                    </td>
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
