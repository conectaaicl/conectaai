'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Tenant {
  id: number; nombre: string; subdominio: string; email_contacto: string
  telefono?: string; plan: string; estado: string
  limite_condominios: number; limite_departamentos: number
  total_condominios: number; total_usuarios: number
  created_at: string | null; fecha_vencimiento: string | null
}

interface ConserjeRow { nombre: string; email: string; password: string; turno: string }

interface OnboardingResult {
  tenant_id: number; subdominio: string
  admin: { id: number; nombre: string; email: string; password: string }
  conserjes: { id: number; nombre: string; email: string; password: string }[]
}

const PLAN_COLOR: Record<string, string> = {
  basico: 'bg-slate-700/50 text-slate-300',
  profesional: 'bg-indigo-600/20 text-indigo-300 border border-indigo-600/30',
  enterprise: 'bg-amber-600/20 text-amber-300 border border-amber-600/30',
}
const ESTADO_COLOR: Record<string, string> = {
  activo: 'bg-emerald-500/15 text-emerald-400',
  inactivo: 'bg-red-500/15 text-red-400',
}

function Inp(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition" />
  )
}
function Sel({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select {...props} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition">
      {children}
    </select>
  )
}
function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  )
}

function OnboardingModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<OnboardingResult | null>(null)
  const [showPw, setShowPw] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  const [form, setForm] = useState({
    nombre: '', subdominio: '', rut: '', direccion: '', ciudad: '',
    email_contacto: '', telefono: '',
    plan: 'basico', limite_condominios: '1', limite_departamentos: '50',
    fecha_vencimiento: '',
    admin_nombre: '', admin_email: '', admin_password: '',
  })
  const [conserjes, setConserjes] = useState<ConserjeRow[]>([])

  function set(k: string, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function autoSubdominio(nombre: string) {
    return nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50)
  }

  function handleNombre(v: string) {
    setForm(f => ({
      ...f, nombre: v,
      subdominio: f.subdominio ? f.subdominio : autoSubdominio(v)
    }))
  }

  function addConserje() {
    setConserjes(c => [...c, { nombre: '', email: '', password: '', turno: '' }])
  }
  function removeConserje(i: number) {
    setConserjes(c => c.filter((_, idx) => idx !== i))
  }
  function setConserje(i: number, k: keyof ConserjeRow, v: string) {
    setConserjes(c => c.map((row, idx) => idx === i ? { ...row, [k]: v } : row))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.admin_password.length < 8) { setError('La contrasena del admin debe tener minimo 8 caracteres'); return }
    for (const c of conserjes) {
      if (!c.nombre || !c.email || !c.password) { setError('Completa todos los campos de los conserjes'); return }
      if (c.password.length < 6) { setError('La contrasena de conserje debe tener al menos 6 caracteres'); return }
    }
    setLoading(true)
    try {
      const payload = {
        nombre: form.nombre, subdominio: form.subdominio,
        rut: form.rut || null, direccion: form.direccion || null, ciudad: form.ciudad || null,
        email_contacto: form.email_contacto, telefono: form.telefono || null,
        plan: form.plan,
        limite_condominios: parseInt(form.limite_condominios),
        limite_departamentos: parseInt(form.limite_departamentos),
        fecha_vencimiento: form.fecha_vencimiento || null,
        admin_nombre: form.admin_nombre, admin_email: form.admin_email, admin_password: form.admin_password,
        conserjes: conserjes.map(c => ({ nombre: c.nombre, email: c.email, password: c.password, turno: c.turno || null })),
      }
      const res = await fetch('/api/superadmin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.detail || 'Error al crear el edificio'); return }
      setResult(data)
      onCreated()
    } catch {
      setError('Error de conexion')
    } finally {
      setLoading(false)
    }
  }

  function copyAll() {
    const lines = [
      'ADMIN: ' + result!.admin.nombre + ' | ' + result!.admin.email + ' | ' + result!.admin.password,
      ...result!.conserjes.map((c, i) => 'CONSERJE ' + (i+1) + ': ' + c.nombre + ' | ' + c.email + ' | ' + c.password),
    ]
    navigator.clipboard.writeText(lines.join('\n')).catch(() => null)
    setCopiedIdx(-1)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  function copyLine(text: string, idx: number) {
    navigator.clipboard.writeText(text).catch(() => null)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  if (result) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-center w-14 h-14 bg-emerald-500/15 rounded-full mx-auto mb-4">
          <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-white text-center mb-1">Edificio creado exitosamente</h2>
        <p className="text-slate-400 text-sm text-center mb-5">ID #{result.tenant_id} &middot; <span className="font-mono text-slate-300">{result.subdominio}</span></p>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-4 text-amber-300 text-xs flex gap-2">
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" /></svg>
          Guarda estas contrasenas ahora. No se mostraran de nuevo.
        </div>

        <div className="space-y-2 mb-4">
          {/* Admin */}
          <div className="bg-slate-800 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wide">Administrador</span>
              <button onClick={() => copyLine(result.admin.email + ' / ' + result.admin.password, 0)}
                className="text-xs text-slate-400 hover:text-white transition px-2 py-0.5 rounded bg-slate-700">
                {copiedIdx === 0 ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
            <p className="text-sm text-white font-medium">{result.admin.nombre}</p>
            <p className="text-xs text-slate-400">{result.admin.email}</p>
            <p className="text-xs font-mono text-emerald-300 mt-1">{result.admin.password}</p>
          </div>

          {result.conserjes.map((c, i) => (
            <div key={i} className="bg-slate-800 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wide">Conserje {i + 1}</span>
                <button onClick={() => copyLine(c.email + ' / ' + c.password, i + 1)}
                  className="text-xs text-slate-400 hover:text-white transition px-2 py-0.5 rounded bg-slate-700">
                  {copiedIdx === i + 1 ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
              <p className="text-sm text-white font-medium">{c.nombre}</p>
              <p className="text-xs text-slate-400">{c.email}</p>
              <p className="text-xs font-mono text-emerald-300 mt-1">{c.password}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={copyAll}
            className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-xl transition flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            {copiedIdx === -1 ? 'Copiado!' : 'Copiar todo'}
          </button>
          <button onClick={onClose}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )

  const steps = ['Edificio', 'Administrador', 'Conserjes']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="font-bold text-white">Onboarding — Nuevo Edificio</h2>
            <p className="text-xs text-slate-400 mt-0.5">Crea el tenant, admin y conserjes en un paso</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Steps */}
        <div className="flex gap-0 px-6 pt-4">
          {steps.map((s, i) => (
            <button key={i} onClick={() => setStep(i + 1)}
              className="flex-1 flex flex-col items-center gap-1 pb-3 border-b-2 transition text-xs font-medium"
              style={{ borderColor: step === i + 1 ? '#6366f1' : 'transparent', color: step > i ? '#fff' : step === i + 1 ? '#fff' : '#64748b' }}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step > i + 1 ? 'bg-emerald-500 text-white' : step === i + 1 ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                {step > i + 1 ? <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> : i + 1}
              </span>
              {s}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm flex gap-2 items-start">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                {error}
              </div>
            )}

            {/* Step 1 — Edificio */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Fld label="Nombre del edificio *">
                      <Inp value={form.nombre} onChange={e => handleNombre(e.target.value)} required placeholder="Edificio Las Palmas" />
                    </Fld>
                  </div>
                  <Fld label="Subdominio *">
                    <Inp value={form.subdominio} onChange={e => set('subdominio', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} required placeholder="edificio-palmas" />
                  </Fld>
                  <Fld label="RUT (opcional)">
                    <Inp value={form.rut} onChange={e => set('rut', e.target.value)} placeholder="76.000.000-0" />
                  </Fld>
                  <Fld label="Direccion">
                    <Inp value={form.direccion} onChange={e => set('direccion', e.target.value)} placeholder="Av. Providencia 1234" />
                  </Fld>
                  <Fld label="Ciudad">
                    <Inp value={form.ciudad} onChange={e => set('ciudad', e.target.value)} placeholder="Santiago" />
                  </Fld>
                  <Fld label="Email de contacto *">
                    <Inp type="email" value={form.email_contacto} onChange={e => set('email_contacto', e.target.value)} required placeholder="admin@edificio.cl" />
                  </Fld>
                  <Fld label="Telefono">
                    <Inp value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="+56 9 1234 5678" />
                  </Fld>
                  <Fld label="Plan">
                    <Sel value={form.plan} onChange={e => set('plan', e.target.value)}>
                      <option value="basico">Basico</option>
                      <option value="profesional">Profesional</option>
                      <option value="enterprise">Enterprise</option>
                    </Sel>
                  </Fld>
                  <Fld label="Limite condominios">
                    <Inp type="number" min="1" value={form.limite_condominios} onChange={e => set('limite_condominios', e.target.value)} />
                  </Fld>
                  <Fld label="Limite departamentos">
                    <Inp type="number" min="1" value={form.limite_departamentos} onChange={e => set('limite_departamentos', e.target.value)} />
                  </Fld>
                  <Fld label="Vencimiento (opcional)">
                    <Inp type="date" value={form.fecha_vencimiento} onChange={e => set('fecha_vencimiento', e.target.value)} />
                  </Fld>
                </div>
              </div>
            )}

            {/* Step 2 — Admin */}
            {step === 2 && (
              <div className="space-y-4">
                <p className="text-slate-400 text-sm">Este usuario accede al panel de administracion del edificio.</p>
                <Fld label="Nombre completo *">
                  <Inp value={form.admin_nombre} onChange={e => set('admin_nombre', e.target.value)} required placeholder="Juan Perez" />
                </Fld>
                <Fld label="Email *">
                  <Inp type="email" value={form.admin_email} onChange={e => set('admin_email', e.target.value)} required placeholder="admin@edificio.cl" />
                </Fld>
                <Fld label="Contrasena (minimo 8 caracteres)">
                  <div className="relative">
                    <Inp
                      type={showPw ? 'text' : 'password'}
                      value={form.admin_password}
                      onChange={e => set('admin_password', e.target.value)}
                      required minLength={8} placeholder="••••••••"
                      style={{ paddingRight: '2.5rem' }}
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                      {showPw
                        ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                        : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
                    </button>
                  </div>
                </Fld>
              </div>
            )}

            {/* Step 3 — Conserjes */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-slate-400 text-sm">Agrega los conserjes del edificio (opcional).</p>
                  <button type="button" onClick={addConserje}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-medium rounded-lg transition">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Agregar conserje
                  </button>
                </div>

                {conserjes.length === 0 && (
                  <div className="text-center py-8 text-slate-500 text-sm border border-dashed border-slate-700 rounded-xl">
                    No hay conserjes aun. Puedes agregar desde el detalle del tenant.
                  </div>
                )}

                {conserjes.map((c, i) => (
                  <div key={i} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wide">Conserje {i + 1}</span>
                      <button type="button" onClick={() => removeConserje(i)}
                        className="text-red-400 hover:text-red-300 transition p-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Fld label="Nombre *">
                        <Inp value={c.nombre} onChange={e => setConserje(i, 'nombre', e.target.value)} required placeholder="Pedro Gomez" />
                      </Fld>
                      <Fld label="Email *">
                        <Inp type="email" value={c.email} onChange={e => setConserje(i, 'email', e.target.value)} required placeholder="conserje@edificio.cl" />
                      </Fld>
                      <Fld label="Contrasena *">
                        <Inp type="text" value={c.password} onChange={e => setConserje(i, 'password', e.target.value)} required placeholder="Minimo 6 caracteres" />
                      </Fld>
                      <Fld label="Turno (opcional)">
                        <Sel value={c.turno} onChange={e => setConserje(i, 'turno', e.target.value)}>
                          <option value="">Sin especificar</option>
                          <option value="manana">Manana</option>
                          <option value="tarde">Tarde</option>
                          <option value="noche">Noche</option>
                          <option value="full">Full</option>
                        </Sel>
                      </Fld>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
            <button type="button" onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition rounded-lg hover:bg-slate-800">
              {step === 1 ? 'Cancelar' : 'Atras'}
            </button>
            <div className="flex gap-3">
              {step < 3 ? (
                <button type="button" onClick={() => setStep(s => s + 1)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition shadow-md shadow-indigo-500/20">
                  Siguiente
                </button>
              ) : (
                <button type="submit" disabled={loading}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition shadow-md">
                  {loading ? 'Creando...' : 'Crear edificio'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function SATenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPlan, setFilterPlan] = useState('')
  const [filterEstado, setFilterEstado] = useState('')
  const [acting, setActing] = useState<number | null>(null)
  const [showModal, setShowModal] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/superadmin/tenants', { credentials: 'include' })
      .then(r => r.json()).then(d => setTenants(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [])
  useEffect(load, [load])

  const filtered = tenants.filter(t => {
    if (search && !t.nombre.toLowerCase().includes(search.toLowerCase()) && !t.subdominio.includes(search.toLowerCase())) return false
    if (filterPlan && t.plan !== filterPlan) return false
    if (filterEstado && t.estado !== filterEstado) return false
    return true
  })

  const activos = tenants.filter(t => t.estado === 'activo').length
  const vencidos = tenants.filter(t => t.fecha_vencimiento && new Date(t.fecha_vencimiento) < new Date()).length
  const totalUsuarios = tenants.reduce((a, t) => a + t.total_usuarios, 0)

  async function toggleEstado(t: Tenant) {
    if (!confirm((t.estado === 'activo' ? 'Desactivar' : 'Activar') + ' tenant "' + t.nombre + '"?')) return
    setActing(t.id)
    try {
      await fetch('/api/superadmin/tenants/' + t.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ estado: t.estado === 'activo' ? 'inactivo' : 'activo' }),
      })
      load()
    } finally { setActing(null) }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {showModal && (
        <OnboardingModal
          onClose={() => setShowModal(false)}
          onCreated={() => { load(); setShowModal(false) }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Tenants</h1>
          <p className="text-slate-400 text-sm mt-1">{tenants.length} organizaciones registradas</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-md shadow-indigo-500/20">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nuevo Edificio
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: tenants.length, color: 'text-white' },
          { label: 'Activos', value: activos, color: 'text-emerald-400' },
          { label: 'Vencidos', value: vencidos, color: 'text-red-400' },
          { label: 'Usuarios', value: totalUsuarios, color: 'text-indigo-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400 mb-1">{s.label}</div>
            <div className={'text-2xl font-bold ' + s.color}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre o subdominio..."
          className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
        />
        <select value={filterPlan} onChange={e => setFilterPlan(e.target.value)}
          className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">Todos los planes</option>
          <option value="basico">Basico</option>
          <option value="profesional">Profesional</option>
          <option value="enterprise">Enterprise</option>
        </select>
        <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)}
          className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {['Edificio', 'Plan', 'Estado', 'Limites', 'Uso', 'Vencimiento', 'Acciones'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filtered.map(t => (
                  <tr key={t.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-5 py-4">
                      <div className="font-medium text-white">{t.nombre}</div>
                      <div className="text-xs text-slate-500 font-mono">{t.subdominio}</div>
                      <div className="text-xs text-slate-500">{t.email_contacto}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={'px-2.5 py-1 rounded-lg text-xs font-semibold ' + (PLAN_COLOR[t.plan] || 'bg-slate-700 text-slate-300')}>{t.plan}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={'px-2.5 py-1 rounded-lg text-xs font-semibold ' + (ESTADO_COLOR[t.estado] || '')}>{t.estado}</span>
                    </td>
                    <td className="px-5 py-4 text-slate-400 text-xs">
                      <div>{t.limite_condominios} condominios</div>
                      <div>{t.limite_departamentos} deptos</div>
                    </td>
                    <td className="px-5 py-4 text-slate-300 text-xs">
                      <div>{t.total_condominios} condominios</div>
                      <div>{t.total_usuarios} usuarios</div>
                    </td>
                    <td className="px-5 py-4 text-slate-400 text-xs">
                      {t.fecha_vencimiento ? (
                        <span className={new Date(t.fecha_vencimiento) < new Date() ? 'text-red-400' : 'text-slate-400'}>
                          {t.fecha_vencimiento.slice(0, 10)}
                        </span>
                      ) : <span className="text-slate-600">Sin limite</span>}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Link href={'/superadmin/tenants/' + t.id}
                          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-xs text-white rounded-lg transition">
                          Ver
                        </Link>
                        <button onClick={() => toggleEstado(t)} disabled={acting === t.id}
                          className={'px-3 py-1.5 text-xs rounded-lg transition disabled:opacity-50 ' + (
                            t.estado === 'activo'
                              ? 'bg-red-500/15 hover:bg-red-500/25 text-red-400'
                              : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400'
                          )}>
                          {t.estado === 'activo' ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    {search || filterPlan || filterEstado ? 'Sin resultados para los filtros aplicados' : 'No hay tenants creados aun'}
                  </td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
