'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  )
}
function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props}
      className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
    />
  )
}
function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select {...props}
      className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition">
      {children}
    </select>
  )
}

export default function NewTenantPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    nombre: '', subdominio: '', email_contacto: '', telefono: '',
    plan: 'basico', limite_condominios: '1', limite_departamentos: '50', fecha_vencimiento: '',
    admin_email: '', admin_password: '', admin_nombre: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<{tenant_id:number;subdominio:string}|null>(null)
  const [showPw, setShowPw] = useState(false)

  function set(k: string, v: string) {
    setForm(f => ({ ...f, [k]: v }))
    if (k === 'nombre' && !form.subdominio) {
      setForm(f => ({ ...f, nombre: v, subdominio: v.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g,'-').replace(/^-|-$/g,'') }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.admin_password.length < 8) { setError('La contraseña del admin debe tener al menos 8 caracteres.'); return }
    setLoading(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k,v]) => fd.append(k, v))
      const res = await fetch('/api/superadmin/tenants', { method: 'POST', body: fd, credentials: 'include' })
      const data = await res.json()
      if (!res.ok) { setError(data.detail || 'Error al crear tenant'); return }
      setSuccess({ tenant_id: data.tenant_id, subdominio: data.subdominio })
    } catch { setError('Error de conexión') }
    finally { setLoading(false) }
  }

  if (success) return (
    <div className="max-w-lg mx-auto mt-12 text-center">
      <div className="w-16 h-16 bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Tenant creado exitosamente</h2>
      <p className="text-slate-400 text-sm mb-6">ID #{success.tenant_id} · <span className="font-mono text-slate-300">{success.subdominio}</span></p>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-left text-sm mb-6">
        <p className="text-slate-400 mb-1">El admin puede acceder con:</p>
        <p className="text-white"><strong>Email:</strong> {form.admin_email}</p>
        <p className="text-white"><strong>Contraseña:</strong> la que ingresaste</p>
        <p className="text-slate-500 text-xs mt-2">Recuerda compartir estas credenciales de forma segura.</p>
      </div>
      <div className="flex gap-3 justify-center">
        <Link href="/superadmin/tenants" className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-xl transition">Ver todos los tenants</Link>
        <button onClick={() => { setSuccess(null); setForm({ nombre:'',subdominio:'',email_contacto:'',telefono:'',plan:'basico',limite_condominios:'1',limite_departamentos:'50',fecha_vencimiento:'',admin_email:'',admin_password:'',admin_nombre:'' }) }}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-xl transition">
          Crear otro
        </button>
      </div>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/superadmin/tenants" className="text-slate-400 hover:text-white transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">Nuevo Tenant</h1>
          <p className="text-slate-400 text-sm">Crear organización + admin inicial</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm flex items-start gap-2">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            {error}
          </div>
        )}

        {/* Tenant info */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-white border-b border-slate-800 pb-3">Información del Tenant</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nombre de la organización" hint="Ej: Edificio Las Palmas, Condominio Rio Norte">
              <Input value={form.nombre} onChange={e => set('nombre', e.target.value)} required placeholder="Nombre del condominio" />
            </Field>
            <Field label="Subdominio" hint="Solo letras, números y guiones">
              <Input value={form.subdominio} onChange={e => set('subdominio', e.target.value)} required placeholder="ej: edificio-palmas" />
            </Field>
            <Field label="Email de contacto">
              <Input type="email" value={form.email_contacto} onChange={e => set('email_contacto', e.target.value)} required placeholder="contacto@condominio.cl" />
            </Field>
            <Field label="Teléfono (opcional)">
              <Input value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="+56 9 1234 5678" />
            </Field>
          </div>
        </div>

        {/* Plan */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-white border-b border-slate-800 pb-3">Plan y Límites</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="Plan">
              <Select value={form.plan} onChange={e => set('plan', e.target.value)}>
                <option value="basico">Básico</option>
                <option value="profesional">Profesional</option>
                <option value="enterprise">Enterprise</option>
              </Select>
            </Field>
            <Field label="Límite condominios">
              <Input type="number" min="1" value={form.limite_condominios} onChange={e => set('limite_condominios', e.target.value)} />
            </Field>
            <Field label="Límite departamentos">
              <Input type="number" min="1" value={form.limite_departamentos} onChange={e => set('limite_departamentos', e.target.value)} />
            </Field>
            <Field label="Vencimiento (opcional)">
              <Input type="date" value={form.fecha_vencimiento} onChange={e => set('fecha_vencimiento', e.target.value)} />
            </Field>
          </div>
        </div>

        {/* Admin inicial */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-white border-b border-slate-800 pb-3">Administrador Inicial</h2>
          <p className="text-slate-400 text-xs -mt-2">Este usuario podrá acceder al panel de administración del tenant en <span className="text-slate-300">/login</span></p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nombre completo">
              <Input value={form.admin_nombre} onChange={e => set('admin_nombre', e.target.value)} required placeholder="Juan Pérez" />
            </Field>
            <Field label="Email del admin">
              <Input type="email" value={form.admin_email} onChange={e => set('admin_email', e.target.value)} required placeholder="admin@condominio.cl" />
            </Field>
            <Field label="Contraseña" hint="Mínimo 8 caracteres">
              <div className="relative">
                <Input
                  type={showPw ? 'text' : 'password'}
                  value={form.admin_password}
                  onChange={e => set('admin_password', e.target.value)}
                  required minLength={8} placeholder="••••••••"
                  style={{paddingRight:'3rem'}}
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                </button>
              </div>
            </Field>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link href="/superadmin/tenants"
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-xl transition">
            Cancelar
          </Link>
          <button type="submit" disabled={loading}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition shadow-md shadow-indigo-500/20">
            {loading ? 'Creando...' : 'Crear Tenant →'}
          </button>
        </div>
      </form>
    </div>
  )
}
