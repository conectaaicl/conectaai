'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL || ''
const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')

interface Cobro {
  id: number
  depto_numero: string
  residente: string | null
  periodo: string | null
  concepto: string | null
  monto: number
  estado: string
  fecha_vencimiento: string | null
  fecha_pago: string | null
  metodo_pago: string | null
}

interface DeptoGroup {
  depto_numero: string
  residente: string | null
  cobros: Cobro[]
  total_pendiente: number
  meses_mora: number
}

const ESTADO_COLORS: Record<string, string> = {
  pagado:    'bg-emerald-100 text-emerald-700',
  pendiente: 'bg-amber-100 text-amber-700',
  vencido:   'bg-red-100 text-red-700',
  atrasado:  'bg-red-100 text-red-700',
  exento:    'bg-slate-100 text-slate-500',
}

function getConserjeToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('conserje_token')
}

export default function ConserjeCuentas() {
  const router = useRouter()
  const [deptos, setDeptos] = useState<DeptoGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'morosos' | 'al_dia'>('todos')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [condominioId, setCondominioId] = useState<number | null>(null)

  useEffect(() => {
    const token = getConserjeToken()
    if (!token) { router.push('/conserje/login'); return }

    // Get condominio from token payload
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      setCondominioId(payload.condominio_id || null)
    } catch {}

    fetch(`${API}/api/gastos-comunes/cobros?limit=500`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) { setError('Error al cargar datos'); return }
        // Group by depto
        const grouped: Record<string, DeptoGroup> = {}
        for (const c of data) {
          const depto = c.depto_numero || c.departamento_numero || 'S/N'
          if (!grouped[depto]) {
            grouped[depto] = { depto_numero: depto, residente: c.residente || c.nombre_residente || null, cobros: [], total_pendiente: 0, meses_mora: 0 }
          }
          grouped[depto].cobros.push(c)
          if (!['pagado', 'exento'].includes(c.estado)) {
            grouped[depto].total_pendiente += Number(c.monto || 0)
            grouped[depto].meses_mora++
          }
        }
        setDeptos(Object.values(grouped).sort((a, b) => b.total_pendiente - a.total_pendiente))
      })
      .catch(() => setError('Error de conexión'))
      .finally(() => setLoading(false))
  }, [router])

  const visible = deptos
    .filter(d => {
      if (filtro === 'morosos') return d.total_pendiente > 0
      if (filtro === 'al_dia') return d.total_pendiente === 0
      return true
    })
    .filter(d => {
      if (!search) return true
      const q = search.toLowerCase()
      return d.depto_numero.toLowerCase().includes(q) || (d.residente || '').toLowerCase().includes(q)
    })

  const totalMorosos = deptos.filter(d => d.total_pendiente > 0).length
  const totalDeuda = deptos.reduce((s, d) => s + d.total_pendiente, 0)

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-red-400 text-center">
        <p className="text-2xl mb-2">⚠</p>
        <p>{error}</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.push('/conserje/central')}
          className="text-slate-400 hover:text-white text-lg">←</button>
        <div>
          <h1 className="font-bold text-lg leading-none">Cuentas Residentes</h1>
          <p className="text-slate-400 text-xs mt-0.5">Estado de pago por departamento</p>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-3 gap-2 p-4">
        <div className="bg-slate-800 rounded-xl p-3 text-center">
          <p className="text-2xl font-black text-red-400">{totalMorosos}</p>
          <p className="text-xs text-slate-400 mt-0.5">Con deuda</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-3 text-center">
          <p className="text-2xl font-black text-emerald-400">{deptos.length - totalMorosos}</p>
          <p className="text-xs text-slate-400 mt-0.5">Al día</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-3 text-center">
          <p className="text-lg font-black text-amber-400">{fmt(totalDeuda)}</p>
          <p className="text-xs text-slate-400 mt-0.5">Deuda total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 space-y-2 mb-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar depto o residente..."
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
        <div className="flex gap-2">
          {(['todos', 'morosos', 'al_dia'] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-colors ${filtro === f ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
              {f === 'todos' ? `Todos (${deptos.length})` : f === 'morosos' ? `Morosos (${totalMorosos})` : `Al día (${deptos.length - totalMorosos})`}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="px-4 pb-6 space-y-2">
        {visible.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <p className="text-3xl mb-2">🔍</p>
            <p className="text-sm">Sin resultados</p>
          </div>
        )}
        {visible.map(d => {
          const isExpanded = expanded === d.depto_numero
          const moraBadgeColor = d.meses_mora === 0 ? 'bg-emerald-900 text-emerald-300' : d.meses_mora === 1 ? 'bg-amber-900 text-amber-300' : d.meses_mora <= 3 ? 'bg-orange-900 text-orange-300' : 'bg-red-900 text-red-300'
          const borderColor = d.total_pendiente === 0 ? 'border-emerald-800' : d.meses_mora <= 1 ? 'border-amber-700' : 'border-red-700'

          return (
            <div key={d.depto_numero} className={`bg-slate-800 rounded-xl border ${borderColor} overflow-hidden`}>
              <button
                onClick={() => setExpanded(isExpanded ? null : d.depto_numero)}
                className="w-full p-3 flex items-center gap-3 text-left hover:bg-slate-750 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-black text-slate-300">{d.depto_numero}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{d.residente || 'Sin residente'}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {d.meses_mora > 0 && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${moraBadgeColor}`}>
                        {d.meses_mora} mes{d.meses_mora !== 1 ? 'es' : ''} mora
                      </span>
                    )}
                    {d.total_pendiente === 0 && (
                      <span className="text-xs text-emerald-400 font-medium">✓ Al día</span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {d.total_pendiente > 0 ? (
                    <p className="text-base font-black text-red-400">{fmt(d.total_pendiente)}</p>
                  ) : (
                    <p className="text-base font-black text-emerald-400">$0</p>
                  )}
                  <p className="text-xs text-slate-500">{isExpanded ? '▲' : '▼'}</p>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-slate-700 p-3 space-y-2">
                  <div className="flex gap-2 flex-wrap">
                    <a
                      href={`/dashboard/condominios/cuenta-residente?depto=${d.depto_numero}`}
                      target="_blank"
                      className="text-xs bg-indigo-700 text-indigo-100 px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-600 transition-colors"
                    >
                      Ver cuenta completa →
                    </a>
                    {d.residente && (
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(`Estimado/a ${d.residente}, le recordamos que tiene una deuda pendiente de ${fmt(d.total_pendiente)} en gastos comunes del Depto. ${d.depto_numero}.`)}`}
                        target="_blank"
                        className="text-xs bg-green-800 text-green-200 px-3 py-1.5 rounded-lg font-medium hover:bg-green-700 transition-colors"
                      >
                        WhatsApp 💬
                      </a>
                    )}
                  </div>

                  {d.cobros.slice(0, 6).map(c => (
                    <div key={c.id} className="flex items-center justify-between text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-300 truncate text-xs">{c.concepto || c.periodo || 'Gasto común'}</p>
                        {c.fecha_vencimiento && (
                          <p className="text-slate-500 text-xs">Vence: {new Date(c.fecha_vencimiento).toLocaleDateString('es-CL')}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_COLORS[c.estado] || 'bg-slate-700 text-slate-300'}`}>
                          {c.estado}
                        </span>
                        <span className={`text-xs font-bold ${c.estado === 'pagado' ? 'text-emerald-400' : 'text-white'}`}>
                          {fmt(Number(c.monto))}
                        </span>
                      </div>
                    </div>
                  ))}
                  {d.cobros.length > 6 && (
                    <p className="text-xs text-slate-500">+{d.cobros.length - 6} más — ver cuenta completa</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
