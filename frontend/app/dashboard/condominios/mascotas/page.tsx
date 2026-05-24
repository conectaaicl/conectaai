'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from '@/hooks/useSession'

const ESPECIES = ['perro', 'gato', 'ave', 'otro']

const ESPECIE_EMOJI: Record<string, string> = {
  perro: 'dog',
  gato: 'cat',
  ave: 'bird',
  otro: 'paw',
}

function EspecieIcon({ especie }: { especie: string }) {
  if (especie === 'perro') return (
    <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
      <path d="M4.5 11.5A6 6 0 0 1 10.5 6h3A6 6 0 0 1 19.5 12v2a2 2 0 0 1-2 2h-.5v1a2 2 0 0 1-4 0v-1h-1v1a2 2 0 0 1-4 0v-1H7a2 2 0 0 1-2-2v-1.5zM9 13.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm6 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM7 9l-2-3 2.5-.5L9 8M17 9l2-3-2.5-.5L15 8" />
    </svg>
  )
  if (especie === 'gato') return (
    <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1 13.5a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm-3-1a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm8 0a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM8 8l-2-3 3 1-1 2zm8 0 2-3-3 1 1 2z" />
    </svg>
  )
  if (especie === 'ave') return (
    <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.5c1.5-2 4-3 6-2-1 2-3 3-5 3m-7 5c0-3 2-5 4-6l1 3-2 1m4 2c0 2-1 3.5-2 4.5H7.5A4.5 4.5 0 0 1 3 13.5v-1C3 9 5 7 8 7c.5 0 1 .1 1.5.3" />
    </svg>
  )
  return (
    <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12c2.5 0 4-1.5 4-3.5S14.5 5 12 5 8 6.5 8 8.5 9.5 12 12 12zm0 0c-3 0-8 1.5-8 4.5V18h16v-1.5c0-3-5-4.5-8-4.5z" />
    </svg>
  )
}

function vacunaStatus(m: Mascota): { label: string; color: string } {
  if (!m.fecha_proxima_vacuna && !m.fecha_ultima_vacuna) return { label: 'Sin registro', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' }
  const hoy = new Date()
  if (m.fecha_proxima_vacuna) {
    const proxima = new Date(m.fecha_proxima_vacuna)
    if (proxima < hoy) return { label: 'Vencida', color: 'bg-red-500/20 text-red-400 border-red-500/30' }
    const diff = (proxima.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
    if (diff <= 30) return { label: 'Vence pronto', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' }
  }
  if (m.vacunas_vigentes) return { label: 'Al dia', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' }
  return { label: 'Sin registro', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' }
}

interface Mascota {
  id: number
  depto_numero: string
  nombre: string
  especie: string
  raza: string
  color: string
  edad_anios: number
  peso_kg: number
  chip_numero: string
  vacunas_vigentes: boolean
  fecha_ultima_vacuna: string
  fecha_proxima_vacuna: string
  observaciones: string
}

const emptyForm = {
  depto_numero: '', nombre: '', especie: 'perro', raza: '', color: '',
  edad_anios: '', peso_kg: '', chip_numero: '', foto_url: '',
  vacunas_vigentes: false, fecha_ultima_vacuna: '', fecha_proxima_vacuna: '', observaciones: '',
}

export default function MascotasPage() {
  const { user } = useSession()
  const tenantId = typeof window !== 'undefined' ? Number(localStorage.getItem('current_condominio_id') || 0) : 0

  const [mascotas, setMascotas] = useState<Mascota[]>([])
  const [resumen, setResumen] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterEspecie, setFilterEspecie] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState({ ...emptyForm })

  const fetchData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ tenant_id: String(tenantId) })
      if (filterEspecie) params.set('especie', filterEspecie)
      const [mRes, rRes] = await Promise.all([
        fetch(`/api/mascotas?${params}`),
        fetch(`/api/mascotas/resumen?tenant_id=${tenantId}`),
      ])
      if (mRes.ok) setMascotas(await mRes.json())
      if (rRes.ok) setResumen(await rRes.json())
    } finally {
      setLoading(false)
    }
  }, [tenantId, filterEspecie])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = mascotas.filter(m =>
    !search || m.nombre.toLowerCase().includes(search.toLowerCase()) || m.depto_numero.includes(search)
  )

  function openCreate() {
    setEditId(null)
    setForm({ ...emptyForm })
    setShowModal(true)
  }

  function openEdit(m: Mascota) {
    setEditId(m.id)
    setForm({
      depto_numero: m.depto_numero || '',
      nombre: m.nombre || '',
      especie: m.especie || 'perro',
      raza: m.raza || '',
      color: m.color || '',
      edad_anios: String(m.edad_anios || ''),
      peso_kg: String(m.peso_kg || ''),
      chip_numero: m.chip_numero || '',
      foto_url: '',
      vacunas_vigentes: m.vacunas_vigentes || false,
      fecha_ultima_vacuna: m.fecha_ultima_vacuna || '',
      fecha_proxima_vacuna: m.fecha_proxima_vacuna || '',
      observaciones: m.observaciones || '',
    })
    setShowModal(true)
  }

  async function handleSave() {
    const body: any = {
      ...form,
      tenant_id: tenantId,
      edad_anios: form.edad_anios ? parseInt(form.edad_anios) : null,
      peso_kg: form.peso_kg ? parseFloat(form.peso_kg) : null,
      fecha_ultima_vacuna: form.fecha_ultima_vacuna || null,
      fecha_proxima_vacuna: form.fecha_proxima_vacuna || null,
    }
    if (editId) {
      await fetch(`/api/mascotas/${editId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    } else {
      await fetch('/api/mascotas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    }
    setShowModal(false)
    fetchData()
  }

  async function handleDelete(id: number) {
    if (!confirm('Eliminar mascota?')) return
    await fetch(`/api/mascotas/${id}`, { method: 'DELETE' })
    fetchData()
  }

  const totalMascotas = mascotas.length
  const totalPerros = mascotas.filter(m => m.especie === 'perro').length
  const totalGatos = mascotas.filter(m => m.especie === 'gato').length
  const alertas = resumen?.alertas_vacunas ?? 0

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Mascotas</h1>
          <p className="text-slate-400 text-sm mt-1">Registro de mascotas del condominio</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
          style={{ background: 'linear-gradient(135deg, #6366f1, #9333ea)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Registrar Mascota
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Mascotas', value: totalMascotas, color: 'text-white' },
          { label: 'Perros', value: totalPerros, color: 'text-amber-400' },
          { label: 'Gatos', value: totalGatos, color: 'text-purple-400' },
          { label: 'Alertas Vacunas', value: alertas, color: alertas > 0 ? 'text-red-400' : 'text-emerald-400' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4 border border-slate-700/50" style={{ background: 'rgba(15,23,42,0.8)' }}>
            <p className="text-slate-400 text-xs mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o depto..."
            className="pl-9 pr-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm focus:outline-none focus:border-indigo-500 w-56"
          />
        </div>
        <button
          onClick={() => setFilterEspecie('')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${!filterEspecie ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' : 'text-slate-400 border-slate-700 hover:border-slate-500'}`}
        >
          Todas las especies
        </button>
        {ESPECIES.map(e => (
          <button
            key={e}
            onClick={() => setFilterEspecie(filterEspecie === e ? '' : e)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${filterEspecie === e ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' : 'text-slate-400 border-slate-700 hover:border-slate-500'}`}
          >
            {e}
          </button>
        ))}
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="text-center py-20 text-slate-500">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-500">No hay mascotas registradas</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(m => {
            const vs = vacunaStatus(m)
            return (
              <div key={m.id} className="pro-card rounded-xl border border-slate-700/50 p-4 space-y-3" style={{ background: 'rgba(15,23,42,0.9)' }}>
                <div className="flex items-start justify-between">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${m.especie === 'perro' ? 'bg-amber-500/10 text-amber-400' : m.especie === 'gato' ? 'bg-purple-500/10 text-purple-400' : 'bg-cyan-500/10 text-cyan-400'}`}>
                    <EspecieIcon especie={m.especie} />
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${vs.color}`}>{vs.label}</span>
                </div>
                <div>
                  <p className="text-white font-bold text-base">{m.nombre}</p>
                  <p className="text-slate-400 text-xs mt-0.5">Depto {m.depto_numero}</p>
                </div>
                <div className="space-y-1 text-xs text-slate-400">
                  {m.raza && <p><span className="text-slate-500">Raza:</span> {m.raza}</p>}
                  {m.peso_kg && <p><span className="text-slate-500">Peso:</span> {m.peso_kg} kg</p>}
                  {m.edad_anios != null && <p><span className="text-slate-500">Edad:</span> {m.edad_anios} {m.edad_anios === 1 ? 'ano' : 'anos'}</p>}
                  {m.chip_numero && <p><span className="text-slate-500">Chip:</span> {m.chip_numero}</p>}
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => openEdit(m)} className="flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30 transition-all">
                    Editar
                  </button>
                  <button onClick={() => handleDelete(m.id)} className="px-2 py-1.5 rounded-lg text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition-all">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 p-6 space-y-4 max-h-[90vh] overflow-y-auto" style={{ background: '#0f172a' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">{editId ? 'Editar Mascota' : 'Registrar Mascota'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: 'nombre', label: 'Nombre', placeholder: 'Rex', required: true },
                { key: 'depto_numero', label: 'Depto', placeholder: '101', required: true },
                { key: 'raza', label: 'Raza', placeholder: 'Labrador' },
                { key: 'color', label: 'Color', placeholder: 'Marron' },
                { key: 'edad_anios', label: 'Edad (anos)', placeholder: '3', type: 'number' },
                { key: 'peso_kg', label: 'Peso (kg)', placeholder: '25', type: 'number' },
                { key: 'chip_numero', label: 'Numero Chip', placeholder: '000123456' },
                { key: 'foto_url', label: 'URL Foto', placeholder: 'https://...' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-slate-400 mb-1 block">{f.label}{f.required && <span className="text-red-400 ml-0.5">*</span>}</label>
                  <input
                    type={f.type || 'text'}
                    value={(form as any)[f.key]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              ))}
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Especie</label>
                <select value={form.especie} onChange={e => setForm(f => ({ ...f, especie: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm focus:outline-none focus:border-indigo-500">
                  {ESPECIES.map(e => <option key={e} value={e} className="capitalize">{e}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input type="checkbox" id="vacunas" checked={form.vacunas_vigentes} onChange={e => setForm(f => ({ ...f, vacunas_vigentes: e.target.checked }))} className="w-4 h-4 accent-indigo-500" />
                <label htmlFor="vacunas" className="text-sm text-slate-300">Vacunas vigentes</label>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Ultima Vacuna</label>
                <input type="date" value={form.fecha_ultima_vacuna} onChange={e => setForm(f => ({ ...f, fecha_ultima_vacuna: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Proxima Vacuna</label>
                <input type="date" value={form.fecha_proxima_vacuna} onChange={e => setForm(f => ({ ...f, fecha_proxima_vacuna: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-400 mb-1 block">Observaciones</label>
                <textarea value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 border border-slate-600 hover:bg-slate-800 transition-all">Cancelar</button>
              <button onClick={handleSave} className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all" style={{ background: 'linear-gradient(135deg, #6366f1, #9333ea)' }}>
                {editId ? 'Guardar Cambios' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
