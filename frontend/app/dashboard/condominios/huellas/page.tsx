'use client'
import { useState, useEffect, useCallback } from 'react'

const TENANT_ID = 1

const DEDOS = [
  { value: 'pulgar_der', label: 'Pulgar derecho' },
  { value: 'indice_der', label: 'Indice derecho' },
  { value: 'medio_der', label: 'Medio derecho' },
  { value: 'pulgar_izq', label: 'Pulgar izquierdo' },
  { value: 'indice_izq', label: 'Indice izquierdo' },
  { value: 'medio_izq', label: 'Medio izquierdo' },
]

function FingerprintIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
    </svg>
  )
}

export default function HuellasPage() {
  const [huellas, setHuellas] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    empleado_id: '',
    empleado_nombre: '',
    dedo: 'indice_der',
    template_hash: '',
  })
  const [saving, setSaving] = useState(false)

  const fetchHuellas = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/biometrico/huellas?tenant_id=${TENANT_ID}`)
      const d = await r.json()
      setHuellas(Array.isArray(d) ? d : [])
    } catch { setHuellas([]) } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchHuellas() }, [fetchHuellas])

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('tenant_id', String(TENANT_ID))
      fd.append('empleado_id', form.empleado_id)
      fd.append('empleado_nombre', form.empleado_nombre)
      fd.append('dedo', form.dedo)
      fd.append('template_hash', form.template_hash)
      const r = await fetch('/api/biometrico/huellas', { method: 'POST', body: fd })
      if (r.ok) {
        setShowModal(false)
        setForm({ empleado_id: '', empleado_nombre: '', dedo: 'indice_der', template_hash: '' })
        fetchHuellas()
      }
    } finally { setSaving(false) }
  }

  async function handleDeactivate(id: number) {
    if (!confirm('Desactivar esta huella?')) return
    await fetch(`/api/biometrico/huellas/${id}`, { method: 'DELETE' })
    fetchHuellas()
  }

  return (
    <div className="p-6 min-h-screen bg-slate-950 text-white">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FingerprintIcon />
              Huellas Digitales
            </h1>
            <p className="text-slate-400 text-sm mt-1">Registro biometrico del personal</p>
          </div>
          <button onClick={() => setShowModal(true)}
            className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2">
            <FingerprintIcon />
            Enrollar huella
          </button>
        </div>

        {/* Info banner */}
        <div className="bg-indigo-950/50 border border-indigo-800/50 rounded-xl p-4 mb-6">
          <p className="text-indigo-300 text-sm font-semibold mb-1">Integracion hardware</p>
          <p className="text-slate-400 text-xs mb-2">
            Los dispositivos biometricos deben enviar eventos POST al siguiente endpoint webhook:
          </p>
          <code className="text-indigo-400 text-xs bg-slate-900 px-3 py-1.5 rounded-lg block">
            POST https://conectaai.cl/api/biometrico/evento
          </code>
          <p className="text-slate-500 text-xs mt-2">
            Body JSON: {'{ device_id, empleado_id, tarjeta_uid, tipo, metodo, timestamp }'}
          </p>
        </div>

        {/* Table */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h2 className="font-semibold">{huellas.length} huellas registradas</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-slate-500">Cargando...</div>
          ) : huellas.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No hay huellas enrolladas</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50">
                <tr>
                  {['Empleado', 'ID', 'Dedo', 'Estado', 'Fecha registro', 'Acciones'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-slate-400 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {huellas.map((h: any) => (
                  <tr key={h.id} className="border-t border-slate-800 hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-medium">{h.empleado_nombre}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs font-mono">#{h.empleado_id}</td>
                    <td className="px-4 py-3">
                      <span className="bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full text-xs font-medium">
                        {DEDOS.find(d => d.value === h.dedo)?.label || h.dedo}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        h.activo ? 'bg-green-500/20 text-green-400' : 'bg-slate-600/40 text-slate-400'
                      }`}>
                        {h.activo ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {h.created_at ? new Date(h.created_at).toLocaleDateString('es-CL') : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {h.activo && (
                        <button onClick={() => handleDeactivate(h.id)}
                          className="text-red-400 hover:text-red-300 text-xs font-medium transition">
                          Desactivar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal enrollar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <FingerprintIcon />
              Enrollar nueva huella
            </h3>
            <form onSubmit={handleEnroll} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">ID empleado</label>
                <input required type="number" value={form.empleado_id}
                  onChange={e => setForm(p => ({ ...p, empleado_id: e.target.value }))}
                  placeholder="Ej: 42"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Nombre completo</label>
                <input required value={form.empleado_nombre}
                  onChange={e => setForm(p => ({ ...p, empleado_nombre: e.target.value }))}
                  placeholder="Ej: Juan Perez"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Dedo</label>
                <select value={form.dedo} onChange={e => setForm(p => ({ ...p, dedo: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
                  {DEDOS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">
                  Template hash (base64 del dispositivo)
                  <span className="text-slate-600 ml-1">- opcional si se captura desde hardware</span>
                </label>
                <textarea value={form.template_hash}
                  onChange={e => setForm(p => ({ ...p, template_hash: e.target.value }))}
                  rows={3}
                  placeholder="Base64 del template biometrico capturado por el lector"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono resize-none" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-sm transition">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium transition">
                  {saving ? 'Guardando...' : 'Enrollar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
