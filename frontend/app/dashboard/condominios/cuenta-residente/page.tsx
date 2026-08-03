'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSession } from '@/hooks/useSession'
import { useSearchParams } from 'next/navigation'

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

interface Cobro {
  id: number
  depto_numero: string
  nombre_residente: string
  concepto: string
  monto: number
  estado: string
  fecha_vencimiento: string | null
  fecha_pago: string | null
  metodo_pago: string | null
  periodo: string
  notas: string | null
}

interface ResumenDepto {
  depto_numero: string
  nombre_residente: string
  total_pendiente: number
  total_pagado: number
  meses_pendientes: number
  cobros: Cobro[]
}

const ESTADO_COLOR: Record<string, string> = {
  pagado: 'bg-emerald-900/40 text-emerald-300 border-emerald-500/30',
  pendiente: 'bg-amber-900/40 text-amber-300 border-amber-500/30',
  vencido: 'bg-red-900/40 text-red-300 border-red-500/30',
  exento: 'bg-slate-800 text-slate-400 border-slate-700',
}

function EstadoBadge({ estado }: { estado: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${ESTADO_COLOR[estado] || ESTADO_COLOR.pendiente}`}>
      {estado === 'pagado' ? '✓ Pagado' : estado === 'exento' ? 'Exento' : estado === 'vencido' ? '⚠ Vencido' : 'Pendiente'}
    </span>
  )
}

function CuentaCard({ r, onPagar }: { r: ResumenDepto; onPagar: (cobro: Cobro) => void }) {
  const [expanded, setExpanded] = useState(false)
  const estado = r.total_pendiente === 0 ? 'al_dia' : r.meses_pendientes >= 3 ? 'critico' : r.meses_pendientes >= 2 ? 'alerta' : 'pendiente'

  const estadoStyle = {
    al_dia: { border: 'border-emerald-500/30', dot: 'bg-emerald-400', label: 'Al día', labelColor: 'text-emerald-400' },
    pendiente: { border: 'border-amber-500/30', dot: 'bg-amber-400', label: 'Pendiente', labelColor: 'text-amber-400' },
    alerta: { border: 'border-orange-500/30', dot: 'bg-orange-400', label: 'En mora', labelColor: 'text-orange-400' },
    critico: { border: 'border-red-500/30', dot: 'bg-red-400', label: 'Moroso grave', labelColor: 'text-red-400' },
  }[estado]

  return (
    <div className={`bg-slate-900 border ${estadoStyle.border} rounded-2xl overflow-hidden`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-5 flex items-center gap-4 hover:bg-slate-800/40 transition-colors text-left"
      >
        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-black text-slate-300">{r.depto_numero}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-bold text-slate-100 text-sm truncate">{r.nombre_residente || 'Sin residente'}</p>
            <span className={`flex items-center gap-1 text-xs font-semibold ${estadoStyle.labelColor}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${estadoStyle.dot}`} />
              {estadoStyle.label}
            </span>
          </div>
          <p className="text-xs text-slate-500">Depto {r.depto_numero} · {r.cobros.length} cobro{r.cobros.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="text-right flex-shrink-0">
          {r.total_pendiente > 0 ? (
            <>
              <p className="text-sm font-black text-red-400">{fmt(r.total_pendiente)}</p>
              <p className="text-xs text-slate-500">pendiente</p>
            </>
          ) : (
            <>
              <p className="text-sm font-black text-emerald-400">{fmt(r.total_pagado)}</p>
              <p className="text-xs text-slate-500">pagado</p>
            </>
          )}
        </div>
        <span className="text-slate-500 text-xs ml-2">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-800">
          {/* Summary bar */}
          <div className="grid grid-cols-3 divide-x divide-slate-800 bg-slate-900/60">
            <div className="px-4 py-3">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Pagado</p>
              <p className="text-base font-bold text-emerald-400">{fmt(r.total_pagado)}</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Pendiente</p>
              <p className={`text-base font-bold ${r.total_pendiente > 0 ? 'text-red-400' : 'text-slate-400'}`}>{fmt(r.total_pendiente)}</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Meses mora</p>
              <p className={`text-base font-bold ${r.meses_pendientes > 0 ? 'text-amber-400' : 'text-slate-400'}`}>{r.meses_pendientes}</p>
            </div>
          </div>

          {/* Cobros list */}
          <div className="divide-y divide-slate-800">
            {r.cobros.map(c => (
              <div key={c.id} className="px-5 py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-slate-200 font-medium">{c.concepto}</p>
                    <EstadoBadge estado={c.estado} />
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                    <span>{c.periodo}</span>
                    {c.fecha_vencimiento && (
                      <span>Vence: {new Date(c.fecha_vencimiento).toLocaleDateString('es-CL')}</span>
                    )}
                    {c.fecha_pago && (
                      <span className="text-emerald-500">Pagado: {new Date(c.fecha_pago).toLocaleDateString('es-CL')}</span>
                    )}
                    {c.metodo_pago && <span>· {c.metodo_pago}</span>}
                  </div>
                  {c.notas && <p className="text-xs text-slate-600 mt-0.5">{c.notas}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-bold ${c.estado === 'pagado' ? 'text-emerald-400' : 'text-slate-200'}`}>
                    {fmt(c.monto)}
                  </p>
                  {c.estado !== 'pagado' && c.estado !== 'exento' && (
                    <button
                      onClick={() => onPagar(c)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 block"
                    >
                      Registrar pago
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* WhatsApp link if pending */}
          {r.total_pendiente > 0 && (
            <div className="px-5 py-3 bg-slate-800/40 flex items-center justify-between">
              <p className="text-xs text-slate-400">Notificar al residente</p>
              <div className="flex gap-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Estimado/a ${r.nombre_residente}, le informamos que tiene ${r.meses_pendientes} cuota(s) pendiente(s) por un total de ${fmt(r.total_pendiente)} en el condominio. Por favor regularice su situación.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 rounded-lg bg-green-900/40 border border-green-500/30 text-green-400 hover:bg-green-900/60 transition-colors"
                >
                  📱 WhatsApp
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PagarModal({ cobro, onClose, onDone }: { cobro: Cobro; onClose: () => void; onDone: () => void }) {
  const [metodo, setMetodo] = useState('Transferencia')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [notas, setNotas] = useState('')
  const [saving, setSaving] = useState(false)

  async function handlePagar() {
    setSaving(true)
    try {
      const r = await fetch(`/api/gastos-comunes/cobros/${cobro.id}/pagar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metodo_pago: metodo, fecha_pago: fecha, notas }),
      })
      if (r.ok) { onDone(); onClose() }
    } catch {}
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div>
            <h3 className="font-bold text-slate-100">Registrar pago</h3>
            <p className="text-xs text-slate-400 mt-0.5">Depto {cobro.depto_numero} — {cobro.concepto}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-slate-800 rounded-xl p-3 flex justify-between items-center">
            <span className="text-sm text-slate-300">{cobro.concepto}</span>
            <span className="text-lg font-black text-emerald-400">{fmt(cobro.monto)}</span>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Método de pago</label>
            <select value={metodo} onChange={e => setMetodo(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500">
              {['Transferencia', 'Efectivo', 'Cheque', 'RedCompra', 'Débito', 'MercadoPago', 'Flow', 'Otro'].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Fecha de pago</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Notas / N° comprobante</label>
            <input type="text" placeholder="Opcional" value={notas} onChange={e => setNotas(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" />
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-slate-800">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 text-sm hover:bg-slate-800">
            Cancelar
          </button>
          <button onClick={handlePagar} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-40 transition-colors">
            {saving ? 'Guardando…' : '✓ Confirmar pago'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CuentaResidenteInner() {
  const { tenantId } = useSession()
  const searchParams = useSearchParams()
  const deptoInit = searchParams.get('depto') || ''
  const [search, setSearch] = useState(deptoInit)
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'pendiente' | 'pagado'>('todos')
  const [periodo, setPeriodo] = useState('')
  const [data, setData] = useState<ResumenDepto[]>([])
  const [loading, setLoading] = useState(false)
  const [cobroAPagar, setCobroAPagar] = useState<Cobro | null>(null)

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (periodo) params.set('estado', '')
      const r = await fetch(`/api/gastos-comunes/cobros?${params}`)
      if (r.ok) {
        const raw: Cobro[] = await r.json()
        // Group by depto
        const map = new Map<string, ResumenDepto>()
        for (const c of raw) {
          const key = c.depto_numero || '?'
          if (!map.has(key)) {
            map.set(key, {
              depto_numero: key,
              nombre_residente: c.nombre_residente || 'Sin residente',
              total_pendiente: 0,
              total_pagado: 0,
              meses_pendientes: 0,
              cobros: [],
            })
          }
          const entry = map.get(key)!
          entry.cobros.push(c)
          if (c.estado === 'pagado') {
            entry.total_pagado += c.monto
          } else if (c.estado !== 'exento') {
            entry.total_pendiente += c.monto
            entry.meses_pendientes += 1
          }
        }
        setData(Array.from(map.values()).sort((a, b) => b.total_pendiente - a.total_pendiente))
      }
    } catch {}
    setLoading(false)
  }, [tenantId, periodo])

  useEffect(() => { load() }, [load])

  const visible = data.filter(r => {
    const matchSearch = !search || r.depto_numero.toLowerCase().includes(search.toLowerCase()) ||
      r.nombre_residente.toLowerCase().includes(search.toLowerCase())
    const matchEstado = filtroEstado === 'todos' ||
      (filtroEstado === 'pendiente' && r.total_pendiente > 0) ||
      (filtroEstado === 'pagado' && r.total_pendiente === 0)
    return matchSearch && matchEstado
  })

  const totalPendiente = visible.reduce((s, r) => s + r.total_pendiente, 0)
  const totalPagado = visible.reduce((s, r) => s + r.total_pagado, 0)
  const morosos = visible.filter(r => r.total_pendiente > 0).length

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 lg:p-8">
      {cobroAPagar && (
        <PagarModal cobro={cobroAPagar} onClose={() => setCobroAPagar(null)} onDone={load} />
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">💳 Cuentas por Residente</h1>
        <p className="text-slate-400 text-sm mt-0.5">Estado de cuenta completo por unidad</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-slate-900 border border-red-500/20 rounded-xl p-4">
          <p className="text-xs text-red-400 uppercase tracking-wider">Deuda total</p>
          <p className="text-xl font-black text-red-400 mt-1">{fmt(totalPendiente)}</p>
          <p className="text-xs text-slate-500 mt-0.5">{morosos} unidades con mora</p>
        </div>
        <div className="bg-slate-900 border border-emerald-500/20 rounded-xl p-4">
          <p className="text-xs text-emerald-400 uppercase tracking-wider">Pagado</p>
          <p className="text-xl font-black text-emerald-400 mt-1">{fmt(totalPagado)}</p>
          <p className="text-xs text-slate-500 mt-0.5">{visible.filter(r => r.total_pendiente === 0).length} unidades al día</p>
        </div>
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Unidades</p>
          <p className="text-xl font-black text-slate-200 mt-1">{visible.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {totalPendiente + totalPagado > 0
              ? `${Math.round(totalPagado / (totalPendiente + totalPagado) * 100)}% cobrado`
              : 'Sin cobros'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Buscar por depto o residente…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
        />
        <div className="flex rounded-lg overflow-hidden border border-slate-700">
          {(['todos', 'pendiente', 'pagado'] as const).map(s => (
            <button key={s}
              onClick={() => setFiltroEstado(s)}
              className={`px-4 py-2 text-xs font-semibold transition-colors ${filtroEstado === s ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
              {s === 'todos' ? 'Todos' : s === 'pendiente' ? '⚠ Con mora' : '✓ Al día'}
            </button>
          ))}
        </div>
        <button onClick={load} className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 text-xs hover:bg-slate-700">
          ↻
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Cargando cuentas…</div>
      ) : visible.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-3xl mb-3">🏠</div>
          <p className="text-slate-400 text-sm">No hay datos. Genera cobros en Gastos Comunes primero.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(r => (
            <CuentaCard key={r.depto_numero} r={r} onPagar={setCobroAPagar} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function CuentaResidentePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">Cargando…</div>}>
      <CuentaResidenteInner />
    </Suspense>
  )
}
