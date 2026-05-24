'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface TenantUser {
  id: number; email: string; nombre_completo: string; rol: string
  activo: boolean; last_login: string | null; created_at: string | null; turno?: string | null
}

interface TenantDetail {
  id: number; nombre: string; subdominio: string; email_contacto: string; telefono?: string
  plan: string; estado: string; limite_condominios: number; limite_departamentos: number
  fecha_vencimiento: string | null; created_at: string | null
  rut?: string; direccion?: string; ciudad?: string
  total_condominios: number; total_departamentos: number
  usuarios: TenantUser[]
}

const ROL_COLOR: Record<string, string> = {
  admin: 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30',
  conserje: 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/30',
  superadmin: 'bg-amber-600/20 text-amber-300',
}
const PLAN_COLOR: Record<string, string> = {
  basico: 'bg-slate-700/50 text-slate-300',
  profesional: 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30',
  enterprise: 'bg-amber-600/20 text-amber-300 border border-amber-500/30',
}

function Inp(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition" />
  )
}
function Sel({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select {...props} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition">{children}</select>
  )
}

function ResetPasswordModal({
  user, tenantId, onClose
}: { user: TenantUser; tenantId: number; onClose: () => void }) {
  const [newPw, setNewPw] = useState('')
  const [auto, setAuto] = useState(true)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ password: string; email: string } | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleReset() {
    setLoading(true)
    try {
      const res = await fetch('/api/superadmin/tenants/' + tenantId + '/reset-password/' + user.id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ new_password: auto ? null : newPw }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail)
      setResult({ password: data.new_password, email: data.email })
    } catch (e: any) {
      alert('Error: ' + e.message)
    } finally { setLoading(false) }
  }

  function copy() {
    if (result) navigator.clipboard.writeText(result.email + ' / ' + result.password).catch(() => null)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white">Resetear contrasena</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <p className="text-sm text-slate-400 mb-4">
          Usuario: <span className="text-white font-medium">{user.nombre_completo}</span>
          <span className="text-slate-500"> &middot; {user.email}</span>
        </p>

        {!result ? (
          <div className="space-y-4">
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={auto} onChange={() => setAuto(true)} className="accent-indigo-500" />
                <span className="text-sm text-slate-300">Generar automaticamente</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={!auto} onChange={() => setAuto(false)} className="accent-indigo-500" />
                <span className="text-sm text-slate-300">Especificar</span>
              </label>
            </div>
            {!auto && (
              <Inp
                type="text"
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="Nueva contrasena (minimo 6 caracteres)"
                minLength={6}
              />
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={onClose}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-xl transition">
                Cancelar
              </button>
              <button onClick={handleReset} disabled={loading || (!auto && newPw.length < 6)}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition">
                {loading ? 'Procesando...' : 'Resetear'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
              <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wide mb-2">Nueva contrasena generada</p>
              <p className="text-sm text-white font-mono mb-1">{result.password}</p>
              <p className="text-xs text-slate-400">{result.email}</p>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-amber-300 text-xs">
              Se envio un email al usuario con las nuevas credenciales.
            </div>
            <div className="flex gap-3">
              <button onClick={copy}
                className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-xl transition flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
              <button onClick={onClose}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition">
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TenantDetailPage() {
  const params = useParams()
  const router = useRouter()
  const tid = Number(params.id)
  const [tenant, setTenant] = useState<TenantDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [resetUser, setResetUser] = useState<TenantUser | null>(null)
  const [toggling, setToggling] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<Partial<TenantDetail>>({})

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/superadmin/tenants/' + tid, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setTenant(d)
          setEditForm({
            nombre: d.nombre, email_contacto: d.email_contacto, telefono: d.telefono || '',
            plan: d.plan, estado: d.estado,
            limite_condominios: d.limite_condominios, limite_departamentos: d.limite_departamentos,
            fecha_vencimiento: d.fecha_vencimiento ? d.fecha_vencimiento.slice(0, 10) : '',
            rut: d.rut || '', direccion: d.direccion || '', ciudad: d.ciudad || '',
          })
        } else {
          router.replace('/superadmin/tenants')
        }
      })
      .finally(() => setLoading(false))
  }, [tid, router])
  useEffect(load, [load])

  async function saveEdit() {
    setSaving(true)
    setSaveMsg('')
    try {
      const res = await fetch('/api/superadmin/tenants/' + tid, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editForm),
      })
      if (res.ok) {
        setSaveMsg('Guardado')
        setEditing(false)
        load()
      } else {
        const d = await res.json()
        setSaveMsg(d.detail || 'Error al guardar')
      }
    } finally { setSaving(false) }
  }

  async function toggleUser(u: TenantUser) {
    setToggling(u.id)
    try {
      await fetch('/api/superadmin/tenants/' + tid + '/usuarios/' + u.id + '/toggle', {
        method: 'PATCH', credentials: 'include',
      })
      load()
    } finally { setToggling(null) }
  }

  async function deleteTenant() {
    if (!confirm('Desactivar tenant "' + tenant?.nombre + '" y todos sus usuarios?')) return
    await fetch('/api/superadmin/tenants/' + tid, { method: 'DELETE', credentials: 'include' })
    router.replace('/superadmin/tenants')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!tenant) return null

  const admins = tenant.usuarios.filter(u => u.rol === 'admin')
  const conserjes = tenant.usuarios.filter(u => u.rol === 'conserje')
  const otros = tenant.usuarios.filter(u => u.rol !== 'admin' && u.rol !== 'conserje')

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {resetUser && (
        <ResetPasswordModal
          user={resetUser}
          tenantId={tid}
          onClose={() => { setResetUser(null); load() }}
        />
      )}

      {/* Back + header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/superadmin/tenants" className="text-slate-400 hover:text-white transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">{tenant.nombre}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-slate-400 text-sm font-mono">{tenant.subdominio}</span>
              <span className={'px-2 py-0.5 rounded-md text-xs font-semibold ' + (PLAN_COLOR[tenant.plan] || '')}>{tenant.plan}</span>
              <span className={'px-2 py-0.5 rounded-md text-xs font-semibold ' + (tenant.estado === 'activo' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400')}>{tenant.estado}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditing(!editing)}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-xl transition flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            {editing ? 'Cancelar' : 'Editar'}
          </button>
          <button onClick={deleteTenant}
            className="px-3 py-2 bg-red-500/15 hover:bg-red-500/25 text-red-400 text-xs rounded-xl transition">
            Desactivar
          </button>
        </div>
      </div>

      {saveMsg && (
        <div className={'px-4 py-2.5 rounded-xl text-sm ' + (saveMsg === 'Guardado' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30')}>
          {saveMsg}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Condominios', value: tenant.total_condominios, color: 'text-indigo-400' },
          { label: 'Departamentos', value: tenant.total_departamentos, color: 'text-blue-400' },
          { label: 'Admins', value: admins.length, color: 'text-white' },
          { label: 'Conserjes', value: conserjes.length, color: 'text-cyan-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400 mb-1">{s.label}</div>
            <div className={'text-2xl font-bold ' + s.color}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Info / Edit */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="font-semibold text-white mb-4">Informacion del edificio</h2>
        {editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { k: 'nombre', label: 'Nombre' },
                { k: 'email_contacto', label: 'Email contacto', type: 'email' },
                { k: 'telefono', label: 'Telefono' },
                { k: 'rut', label: 'RUT' },
                { k: 'direccion', label: 'Direccion' },
                { k: 'ciudad', label: 'Ciudad' },
              ].map(({ k, label, type }) => (
                <div key={k}>
                  <label className="block text-xs text-slate-400 mb-1">{label}</label>
                  <Inp type={type || 'text'} value={(editForm as any)[k] || ''} onChange={e => setEditForm(f => ({ ...f, [k]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label className="block text-xs text-slate-400 mb-1">Plan</label>
                <Sel value={editForm.plan || 'basico'} onChange={e => setEditForm(f => ({ ...f, plan: e.target.value }))}>
                  <option value="basico">Basico</option>
                  <option value="profesional">Profesional</option>
                  <option value="enterprise">Enterprise</option>
                </Sel>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Estado</label>
                <Sel value={editForm.estado || 'activo'} onChange={e => setEditForm(f => ({ ...f, estado: e.target.value }))}>
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </Sel>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Limite condominios</label>
                <Inp type="number" min="1" value={editForm.limite_condominios || 1} onChange={e => setEditForm(f => ({ ...f, limite_condominios: parseInt(e.target.value) }))} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Limite departamentos</label>
                <Inp type="number" min="1" value={editForm.limite_departamentos || 50} onChange={e => setEditForm(f => ({ ...f, limite_departamentos: parseInt(e.target.value) }))} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Fecha vencimiento</label>
                <Inp type="date" value={(editForm.fecha_vencimiento as string) || ''} onChange={e => setEditForm(f => ({ ...f, fecha_vencimiento: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition">Cancelar</button>
              <button onClick={saveEdit} disabled={saving}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition">
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4">
            {[
              ['Email contacto', tenant.email_contacto],
              ['Telefono', tenant.telefono || '-'],
              ['RUT', tenant.rut || '-'],
              ['Direccion', tenant.direccion || '-'],
              ['Ciudad', tenant.ciudad || '-'],
              ['Limite condominios', tenant.limite_condominios],
              ['Limite departamentos', tenant.limite_departamentos],
              ['Vencimiento', tenant.fecha_vencimiento ? tenant.fecha_vencimiento.slice(0, 10) : 'Sin limite'],
              ['Creado', tenant.created_at ? tenant.created_at.slice(0, 10) : '-'],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt className="text-xs text-slate-500 mb-0.5">{label}</dt>
                <dd className="text-sm text-white">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {/* Users table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800">
          <h2 className="font-semibold text-white">Usuarios ({tenant.usuarios.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                {['Nombre', 'Email', 'Rol', 'Turno', 'Activo', 'Ultimo login', 'Acciones'].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {tenant.usuarios.map(u => (
                <tr key={u.id} className="hover:bg-slate-800/30 transition">
                  <td className="px-5 py-3.5 font-medium text-white">{u.nombre_completo}</td>
                  <td className="px-5 py-3.5 text-slate-400 text-xs">{u.email}</td>
                  <td className="px-5 py-3.5">
                    <span className={'px-2 py-0.5 rounded-md text-xs font-medium ' + (ROL_COLOR[u.rol] || 'bg-slate-700 text-slate-300')}>{u.rol}</span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-500 text-xs">{u.turno || '-'}</td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => toggleUser(u)}
                      disabled={toggling === u.id}
                      className={'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ' + (u.activo ? 'bg-emerald-500' : 'bg-slate-600')}
                      aria-checked={u.activo}
                    >
                      <span className={'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ' + (u.activo ? 'translate-x-4' : 'translate-x-0')} />
                    </button>
                  </td>
                  <td className="px-5 py-3.5 text-slate-500 text-xs">
                    {u.last_login ? u.last_login.slice(0, 16).replace('T', ' ') : 'Nunca'}
                  </td>
                  <td className="px-5 py-3.5">
                    <button onClick={() => setResetUser(u)}
                      className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 text-xs rounded-lg transition flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                      Reset
                    </button>
                  </td>
                </tr>
              ))}
              {tenant.usuarios.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-500">Sin usuarios</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
