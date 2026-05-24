'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

const TENANT_ID = 1

type Tab = 'dispositivos' | 'log' | 'personas' | 'stats'

interface Dispositivo {
  id: number
  nombre: string
  marca: string
  modelo?: string
  serial_number?: string
  ip?: string
  puerto: number
  puerta_nombre?: string
  ubicacion?: string
}

interface Registro {
  id: number
  marca: string
  dispositivo_serial?: string
  persona_nombre?: string
  resultado: string
  similitud?: number
  evento_tipo: string
  created_at: string
}

interface Stats {
  reconocido: number
  desconocido: number
  denegado: number
  personas_registradas: number
  por_marca: Record<string, number>
}

interface Persona {
  id: number
  nombre_completo: string
  departamento?: string
}

const MARCA_BADGE: Record<string, string> = {
  zkteco: 'bg-blue-100 text-blue-700',
  hikvision: 'bg-indigo-100 text-indigo-700',
  dahua: 'bg-purple-100 text-purple-700',
  otro: 'bg-slate-100 text-slate-600',
}

const RESULT_BADGE: Record<string, string> = {
  reconocido: 'bg-green-100 text-green-700',
  desconocido: 'bg-amber-100 text-amber-700',
  denegado: 'bg-red-100 text-red-700',
}

export default function FacialPage() {
  const [tab, setTab] = useState<Tab>('dispositivos')
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([])
  const [registros, setRegistros] = useState<Registro[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [personas, setPersonas] = useState<Persona[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showPersonaModal, setShowPersonaModal] = useState(false)
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null)
  const [saving, setSaving] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [form, setForm] = useState({
    nombre: '', marca: 'zkteco', modelo: '', serial_number: '',
    ip: '', puerto: 80, usuario: '', puerta_id: '', ubicacion: '',
  })

  const [facialForm, setFacialForm] = useState({
    zkteco_pin: '', hikvision_face_id: '', dahua_person_id: '', foto_url: '',
  })

  const showMsg = (type: 'ok' | 'err', text: string) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 4000)
  }

  const fetchDispositivos = useCallback(async () => {
    try {
      const r = await fetch('/api/facial/dispositivos?tenant_id=' + TENANT_ID)
      const d = await r.json()
      setDispositivos(Array.isArray(d) ? d : [])
    } catch {}
  }, [])

  const fetchRegistros = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/facial/registros?tenant_id=' + TENANT_ID + '&limit=200')
      const d = await r.json()
      setRegistros(Array.isArray(d) ? d : [])
    } catch { setRegistros([]) } finally { setLoading(false) }
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const r = await fetch('/api/facial/stats?tenant_id=' + TENANT_ID)
      setStats(await r.json())
    } catch {}
  }, [])

  const fetchPersonas = useCallback(async () => {
    try {
      const r = await fetch('/api/personas?tenant_id=' + TENANT_ID + '&limit=500')
      const d = await r.json()
      setPersonas(Array.isArray(d) ? d : (Array.isArray(d?.personas) ? d.personas : []))
    } catch {}
  }, [])

  useEffect(() => {
    fetchDispositivos()
    fetchStats()
  }, [fetchDispositivos, fetchStats])

  useEffect(() => {
    if (tab === 'log') fetchRegistros()
    if (tab === 'personas') fetchPersonas()
    if (tab === 'stats') fetchStats()
  }, [tab, fetchRegistros, fetchPersonas, fetchStats])

  useEffect(() => {
    if (autoRefresh && tab === 'log') {
      autoRefreshRef.current = setInterval(fetchRegistros, 5000)
    } else {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current)
    }
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current) }
  }, [autoRefresh, tab, fetchRegistros])

  async function handleCreateDispositivo(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const r = await fetch('/api/facial/dispositivos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form, tenant_id: TENANT_ID, puerto: Number(form.puerto),
          puerta_id: form.puerta_id ? Number(form.puerta_id) : null,
        }),
      })
      if (r.ok) {
        setShowModal(false)
        setForm({ nombre: '', marca: 'zkteco', modelo: '', serial_number: '', ip: '', puerto: 80, usuario: '', puerta_id: '', ubicacion: '' })
        fetchDispositivos()
        showMsg('ok', 'Dispositivo agregado correctamente')
      } else {
        const err = await r.json()
        showMsg('err', err.detail || 'Error al crear')
      }
    } catch { showMsg('err', 'Error de red') } finally { setSaving(false) }
  }

  async function handleDeleteDispositivo(id: number) {
    if (!confirm('Eliminar este dispositivo?')) return
    await fetch('/api/facial/dispositivos/' + id, { method: 'DELETE' })
    fetchDispositivos()
    showMsg('ok', 'Dispositivo eliminado')
  }

  async function openPersonaModal(p: Persona) {
    setSelectedPersona(p)
    setFacialForm({ zkteco_pin: '', hikvision_face_id: '', dahua_person_id: '', foto_url: '' })
    try {
      const r = await fetch('/api/facial/personas/' + p.id + '/facial?tenant_id=' + TENANT_ID)
      const d = await r.json()
      if (d.registrado) {
        setFacialForm({
          zkteco_pin: d.zkteco_pin || '',
          hikvision_face_id: d.hikvision_face_id || '',
          dahua_person_id: d.dahua_person_id || '',
          foto_url: d.foto_url || '',
        })
      }
    } catch {}
    setShowPersonaModal(true)
  }

  async function handleSaveFacial(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPersona) return
    setSaving(true)
    try {
      const r = await fetch('/api/facial/personas/' + selectedPersona.id + '/facial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...facialForm, tenant_id: TENANT_ID }),
      })
      if (r.ok) {
        setShowPersonaModal(false)
        showMsg('ok', 'ID facial guardado correctamente')
      } else showMsg('err', 'Error al guardar')
    } catch { showMsg('err', 'Error de red') } finally { setSaving(false) }
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'dispositivos', label: 'Dispositivos' },
    { id: 'log', label: 'Log en Vivo' },
    { id: 'personas', label: 'Registrar Personas' },
    { id: 'stats', label: 'Estadisticas' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reconocimiento Facial</h1>
          <p className="text-slate-500 text-sm mt-1">ZKTeco · Hikvision · Dahua</p>
        </div>
        {tab === 'dispositivos' && (
          <button onClick={() => setShowModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            + Agregar Dispositivo
          </button>
        )}
      </div>

      {msg && (
        <div className={'px-4 py-3 rounded-lg text-sm ' + (msg.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200')}>
          {msg.text}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Reconocidos hoy', value: stats.reconocido, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Desconocidos hoy', value: stats.desconocido, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Denegados hoy', value: stats.denegado, color: 'text-red-600', bg: 'bg-red-50' },
            { label: 'Personas registradas', value: stats.personas_registradas, color: 'text-blue-600', bg: 'bg-blue-50' },
          ].map(s => (
            <div key={s.label} className={s.bg + ' rounded-xl p-4'}>
              <p className={'text-2xl font-bold ' + s.color}>{s.value}</p>
              <p className="text-xs text-slate-600 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="border-b border-slate-200">
        <nav className="flex gap-6">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={'pb-3 text-sm font-medium border-b-2 transition-colors ' + (
                tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              )}>
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'dispositivos' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {dispositivos.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <div className="text-5xl mb-3">📷</div>
              <p className="font-medium">Sin dispositivos configurados</p>
              <p className="text-sm mt-1">Agrega terminales ZKTeco, Hikvision o Dahua</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Nombre', 'Marca', 'IP', 'Serie', 'Puerta', 'Ubicacion', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dispositivos.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{d.nombre}</td>
                    <td className="px-4 py-3">
                      <span className={'px-2 py-0.5 rounded-full text-xs font-medium capitalize ' + (MARCA_BADGE[d.marca] || 'bg-slate-100 text-slate-600')}>
                        {d.marca}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{d.ip || '-'}:{d.puerto}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{d.serial_number || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{d.puerta_nombre || '-'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{d.ubicacion || '-'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDeleteDispositivo(d.id)} className="text-red-500 hover:text-red-700 text-xs">
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'log' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{registros.length} eventos recientes</p>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
                Auto-refresh (5s)
              </label>
              <button onClick={fetchRegistros} className="text-sm text-blue-600 hover:text-blue-800 border border-blue-200 px-3 py-1.5 rounded-lg">
                Actualizar
              </button>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {loading ? (
              <div className="text-center py-12 text-slate-400">Cargando...</div>
            ) : registros.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <div className="text-5xl mb-3">📋</div>
                <p>Sin eventos registrados</p>
              </div>
            ) : (
              <div className="overflow-auto max-h-[600px]">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                    <tr>
                      {['Hora', 'Marca', 'Dispositivo', 'Persona', 'Resultado', 'Similitud'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {registros.map(r => (
                      <tr key={r.id} className={r.resultado === 'reconocido' ? 'bg-green-50/30' : r.resultado === 'denegado' ? 'bg-red-50/30' : ''}>
                        <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                          {new Date(r.created_at).toLocaleTimeString('es-CL')}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={'px-2 py-0.5 rounded-full text-xs font-medium capitalize ' + (MARCA_BADGE[r.marca] || 'bg-slate-100 text-slate-600')}>
                            {r.marca}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{r.dispositivo_serial || '-'}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-800">
                          {r.persona_nombre || <span className="text-slate-400 italic">Desconocido</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={'px-2 py-0.5 rounded-full text-xs font-medium capitalize ' + (RESULT_BADGE[r.resultado] || 'bg-slate-100 text-slate-600')}>
                            {r.resultado}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-500">
                          {r.similitud != null ? Math.round(r.similitud * 100) + '%' : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'personas' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Asigna PIN ZKTeco, Face ID Hikvision o Person ID Dahua a cada residente.</p>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {personas.length === 0 ? (
              <div className="text-center py-12 text-slate-400">Cargando personas...</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Nombre', 'Depto', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {personas.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{p.nombre_completo}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{p.departamento || '-'}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => openPersonaModal(p)}
                          className="text-blue-600 hover:text-blue-800 text-xs border border-blue-200 px-2 py-1 rounded">
                          Configurar ID Facial
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'stats' && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-800 mb-4">Resultados de hoy</h3>
              <div className="space-y-3">
                {[
                  { label: 'Reconocidos', value: stats.reconocido, color: 'bg-green-500' },
                  { label: 'Desconocidos', value: stats.desconocido, color: 'bg-amber-500' },
                  { label: 'Denegados', value: stats.denegado, color: 'bg-red-500' },
                ].map(s => {
                  const total = stats.reconocido + stats.desconocido + stats.denegado
                  return (
                    <div key={s.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-600">{s.label}</span>
                        <span className="font-medium">{s.value}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={'h-full ' + s.color + ' rounded-full'} style={{ width: total > 0 ? (s.value / total * 100) + '%' : '0%' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-800 mb-4">Por marca</h3>
              {Object.entries(stats.por_marca).length === 0 ? (
                <p className="text-slate-400 text-sm">Sin datos hoy</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(stats.por_marca).map(([marca, total]) => (
                    <div key={marca} className="flex items-center justify-between">
                      <span className={'px-3 py-1 rounded-full text-xs font-medium capitalize ' + (MARCA_BADGE[marca] || 'bg-slate-100 text-slate-600')}>
                        {marca}
                      </span>
                      <span className="text-2xl font-bold text-slate-700">{total}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-6 pt-4 border-t border-slate-100">
                <p className="text-slate-500 text-sm">Personas con ID facial registrado</p>
                <p className="text-3xl font-bold text-blue-600 mt-1">{stats.personas_registradas}</p>
              </div>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-sm text-blue-800">
            <p className="font-semibold mb-2">Configuracion de webhooks en los dispositivos</p>
            <div className="space-y-2 font-mono text-xs">
              <p>ZKTeco PUSH SDK → <span className="bg-blue-100 px-2 py-0.5 rounded">POST https://conectaai.cl/api/facial/webhook/zkteco</span></p>
              <p>Hikvision ISAPI → <span className="bg-blue-100 px-2 py-0.5 rounded">POST https://conectaai.cl/api/facial/webhook/hikvision</span></p>
              <p>Dahua HTTP Callback → <span className="bg-blue-100 px-2 py-0.5 rounded">POST https://conectaai.cl/api/facial/webhook/dahua</span></p>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="font-semibold text-slate-800">Agregar Dispositivo Facial</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">x</button>
            </div>
            <form onSubmit={handleCreateDispositivo} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
                  <input required value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                    placeholder="Ej: Terminal Entrada Principal"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Marca *</label>
                  <select value={form.marca} onChange={e => setForm(p => ({ ...p, marca: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="zkteco">ZKTeco</option>
                    <option value="hikvision">Hikvision</option>
                    <option value="dahua">Dahua</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Modelo</label>
                  <input value={form.modelo} onChange={e => setForm(p => ({ ...p, modelo: e.target.value }))}
                    placeholder="Ej: SpeedFace-V5L"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">N Serie</label>
                  <input value={form.serial_number} onChange={e => setForm(p => ({ ...p, serial_number: e.target.value }))}
                    placeholder="Serial del dispositivo"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">IP</label>
                  <input value={form.ip} onChange={e => setForm(p => ({ ...p, ip: e.target.value }))}
                    placeholder="192.168.1.100"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Puerto</label>
                  <input type="number" value={form.puerto} onChange={e => setForm(p => ({ ...p, puerto: +e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">ID Puerta vinculada</label>
                  <input type="number" value={form.puerta_id} onChange={e => setForm(p => ({ ...p, puerta_id: e.target.value }))}
                    placeholder="ID de puerta (opcional)"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Ubicacion</label>
                  <input value={form.ubicacion} onChange={e => setForm(p => ({ ...p, ubicacion: e.target.value }))}
                    placeholder="Ej: Entrada principal Piso 1"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              {form.marca === 'zkteco' && (
                <div className="bg-blue-50 text-blue-700 rounded-lg p-3 text-xs">
                  ZKTeco: configura PUSH SDK en el terminal → Server URL: https://conectaai.cl/api/facial/webhook/zkteco
                </div>
              )}
              {form.marca === 'hikvision' && (
                <div className="bg-indigo-50 text-indigo-700 rounded-lg p-3 text-xs">
                  Hikvision: ISAPI → Event → Face Recognition → HTTP Notification → /api/facial/webhook/hikvision
                </div>
              )}
              {form.marca === 'dahua' && (
                <div className="bg-purple-50 text-purple-700 rounded-lg p-3 text-xs">
                  Dahua: Smart Event → Face Recognition → HTTP Callback → /api/facial/webhook/dahua · Puerto tipico: 37777
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm hover:bg-slate-50">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Agregar Dispositivo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPersonaModal && selectedPersona && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div>
                <h2 className="font-semibold text-slate-800">ID Facial — {selectedPersona.nombre_completo}</h2>
                <p className="text-xs text-slate-400 mt-0.5">Asigna los identificadores segun los dispositivos configurados</p>
              </div>
              <button onClick={() => setShowPersonaModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">x</button>
            </div>
            <form onSubmit={handleSaveFacial} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-blue-700 mb-1">ZKTeco — PIN del terminal</label>
                <input value={facialForm.zkteco_pin} onChange={e => setFacialForm(p => ({ ...p, zkteco_pin: e.target.value }))}
                  placeholder="Ej: 1001"
                  className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <p className="text-xs text-slate-400 mt-1">El PIN asignado en el terminal ZKTeco</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-indigo-700 mb-1">Hikvision — Face ID</label>
                <input value={facialForm.hikvision_face_id} onChange={e => setFacialForm(p => ({ ...p, hikvision_face_id: e.target.value }))}
                  placeholder="Ej: face_001 o UserID"
                  className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <p className="text-xs text-slate-400 mt-1">El faceID o UserID de la camara Hikvision</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-purple-700 mb-1">Dahua — Person ID</label>
                <input value={facialForm.dahua_person_id} onChange={e => setFacialForm(p => ({ ...p, dahua_person_id: e.target.value }))}
                  placeholder="Ej: person_123 o PersonId"
                  className="w-full border border-purple-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500" />
                <p className="text-xs text-slate-400 mt-1">El PersonId de la camara Dahua</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowPersonaModal(false)}
                  className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm hover:bg-slate-50">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Guardar IDs Faciales'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
