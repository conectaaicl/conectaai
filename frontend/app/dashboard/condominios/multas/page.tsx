'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from '@/hooks/useSession'

const TIPOS = ['ruido', 'mascotas', 'basura', 'estacionamiento', 'visitas', 'reglamento', 'otro']
const ESTADOS = ['pendiente', 'notificada', 'apelada', 'pagada', 'anulada']

const TIPO_COLORS: Record<string, string> = {
  ruido: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  mascotas: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  basura: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  estacionamiento: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  visitas: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  reglamento: 'bg-red-500/20 text-red-300 border-red-500/30',
  otro: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
}

const ESTADO_COLORS: Record<string, string> = {
  pendiente: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  notificada: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  apelada: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  pagada: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  anulada: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
}

interface Multa {
  id: number
  depto_numero: string
  nombre_infractor: string
  tipo: string
  descripcion: string
  monto: number
  estado: string
  fecha_infraccion: string
  notificado_por: string
  created_at: string
}

interface Resumen {
  por_estado: Record<string, { cantidad: number; total_monto: number }>
  monto_pendiente: number
}

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${colorClass} capitalize`}>
      {label}
    </span>
  )
}

export default function MultasPage() {
  const { user } = useSession()
  const tenantId = typeof window !== 'undefined' ? Number(localStorage.getItem('current_condominio_id') || 0) : 0

  const [multas, setMultas] = useState<Multa[]>([])
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterEstado, setFilterEstado] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [anularId, setAnularId] = useState<number | null>(null)
  const [anularMotivo, setAnularMotivo] = useState('')

  const [form, setForm] = useState({
    depto_numero: '', nombre_infractor: '', tipo: 'ruido',
    descripcion: '', monto: '', fecha_infraccion: new Date().toISOString().slice(0, 10),
    notificado_por: user?.nombre_completo || '',
  })

  const fetchData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ tenant_id: String(tenantId) })
      if (filterEstado) params.set('estado', filterEstado)
      if (filterTipo) params.set('tipo', filterTipo)
      const [mRes, rRes] = await Promise.all([
        fetch(`/api/multas?${params}`),
        fetch(`/api/multas/resumen?tenant_id=${tenantId}`),
      ])
      if (mRes.ok) setMultas(await mRes.json())
      if (rRes.ok) setResumen(await rRes.json())
    } finally {
      setLoading(false)
    }
  }, [tenantId, filterEstado, filterTipo])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleCreate() {
    const body = { ...form, tenant_id: tenantId, monto: parseFloat(form.monto) || 0 }
    const res = await fetch('/api/multas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) { setShowModal(false); fetchData() }
  }

  async function handleNotificar(id: number) {
    await fetch(`/api/multas/${id}/notificar`, { method: 'PATCH' })
    fetchData()
  }

  async function handlePagar(id: number) {
    await fetch(`/api/multas/${id}/pagar`, { method: 'PATCH' })
    fetchData()
  }

  async function handleAnular() {
    if (!anularId) return
    await fetch(`/api/multas/${anularId}/anular`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo: anularMotivo }),
    })
    setAnularId(null)
    setAnularMotivo('')
    fetchData()
  }

  const total = multas.length
  const pendientes = multas.filter(m => m.estado === 'pendiente').length
  const pagadas = multas.filter(m => m.estado === 'pagada').length
  const montoPendiente = resumen?.monto_pendiente ?? 0

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Multas e Infracciones</h1>
          <p className="text-slate-400 text-sm mt-1">Registro y seguimiento de multas del condominio</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
          style={{ background: 'linear-gradient(135deg, #6366f1, #9333ea)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva Multa
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Multas', value: total, color: 'text-white' },
          { label: 'Pendientes', value: pendientes, color: 'text-amber-400' },
          { label: 'Pagadas', value: pagadas, color: 'text-emerald-400' },
          { label: 'Monto Pendiente', value: `$${montoPendiente.toLocaleString('es-CL')}`, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4 border border-slate-700/50" style={{ background: 'rgba(15,23,42,0.8)' }}>
            <p className="text-slate-400 text-xs mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterEstado('')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${!filterEstado ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' : 'text-slate-400 border-slate-700 hover:border-slate-500'}`}
        >
          Todos los estados
        </button>
        {ESTADOS.map(e => (
          <button
            key={e}
            onClick={() => setFilterEstado(filterEstado === e ? '' : e)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${filterEstado === e ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' : 'text-slate-400 border-slate-700 hover:border-slate-500'}`}
          >
            {e}
          </button>
        ))}
        <div className="w-px bg-slate-700 mx-1" />
        {TIPOS.map(t => (
          <button
            key={t}
            onClick={() => setFilterTipo(filterTipo === t ? '' : t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${filterTipo === t ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'text-slate-400 border-slate-700 hover:border-slate-500'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-700/50 overflow-hidden" style={{ background: 'rgba(15,23,42,0.8)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm pro-table">
            <thead>
              <tr className="border-b border-slate-700/50">
                {['Depto', 'Infractor', 'Tipo', 'Descripcion', 'Monto', 'Estado', 'Fecha', 'Acciones'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-500">Cargando...</td></tr>
              ) : multas.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-500">No hay multas registradas</td></tr>
              ) : multas.map(m => (
                <tr key={m.id}>
                  <td className="px-4 py-3 text-white font-semibold">{m.depto_numero || '-'}</td>
                  <td className="px-4 py-3 text-slate-300">{m.nombre_infractor || '-'}</td>
                  <td className="px-4 py-3"><Badge label={m.tipo} colorClass={TIPO_COLORS[m.tipo] || TIPO_COLORS.otro} /></td>
                  <td className="px-4 py-3 text-slate-400 max-w-xs truncate" title={m.descripcion}>{m.descripcion}</td>
                  <td className="px-4 py-3 text-white font-semibold">${Number(m.monto).toLocaleString('es-CL')}</td>
                  <td className="px-4 py-3"><Badge label={m.estado} colorClass={ESTADO_COLORS[m.estado] || ''} /></td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{m.fecha_infraccion}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {m.estado === 'pendiente' && (
                        <button onClick={() => handleNotificar(m.id)} className="px-2 py-1 rounded-lg text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 transition-all">
                          Notificar
                        </button>
                      )}
                      {(m.estado === 'pendiente' || m.estado === 'notificada') && (
                        <button onClick={() => handlePagar(m.id)} className="px-2 py-1 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all">
                          Pagar
                        </button>
                      )}
                      {m.estado !== 'anulada' && m.estado !== 'pagada' && (
                        <button onClick={() => setAnularId(m.id)} className="px-2 py-1 rounded-lg text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition-all">
                          Anular
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nueva Multa Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 p-6 space-y-4" style={{ background: '#0f172a' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Nueva Multa</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Depto</label>
                <input value={form.depto_numero} onChange={e => setForm(f => ({ ...f, depto_numero: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm focus:outline-none focus:border-indigo-500" placeholder="101" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Nombre Infractor</label>
                <input value={form.nombre_infractor} onChange={e => setForm(f => ({ ...f, nombre_infractor: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm focus:outline-none focus:border-indigo-500" placeholder="Opcional" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Tipo</label>
                <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm focus:outline-none focus:border-indigo-500">
                  {TIPOS.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Monto ($)</label>
                <input type="number" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm focus:outline-none focus:border-indigo-500" placeholder="0" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Fecha Infraccion</label>
                <input type="date" value={form.fecha_infraccion} onChange={e => setForm(f => ({ ...f, fecha_infraccion: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Notificado por</label>
                <input value={form.notificado_por} onChange={e => setForm(f => ({ ...f, notificado_por: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm focus:outline-none focus:border-indigo-500" placeholder="Nombre conserje/admin" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-400 mb-1 block">Descripcion</label>
                <textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none" placeholder="Detalle de la infraccion..." />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 border border-slate-600 hover:bg-slate-800 transition-all">Cancelar</button>
              <button onClick={handleCreate} className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all" style={{ background: 'linear-gradient(135deg, #6366f1, #9333ea)' }}>Registrar Multa</button>
            </div>
          </div>
        </div>
      )}

      {/* Anular Modal */}
      {anularId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md rounded-2xl border border-slate-700 p-6 space-y-4" style={{ background: '#0f172a' }}>
            <h2 className="text-lg font-bold text-white">Anular Multa</h2>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Motivo (opcional)</label>
              <textarea value={anularMotivo} onChange={e => setAnularMotivo(e.target.value)} rows={3}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none" placeholder="Motivo de anulacion..." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setAnularId(null); setAnularMotivo('') }} className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 border border-slate-600 hover:bg-slate-800 transition-all">Cancelar</button>
              <button onClick={handleAnular} className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-all">Anular</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
