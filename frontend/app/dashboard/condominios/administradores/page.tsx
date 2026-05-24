'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from '@/hooks/useSession'

interface AdminUser {
  id: number
  nombre_completo: string
  email: string
  cargo: string
  telefono?: string
  activo: boolean
  last_login?: string
  created_at?: string
}

interface FormData {
  nombre_completo: string
  email: string
  password: string
  cargo: string
  telefono: string
}

const empty: FormData = { nombre_completo: '', email: '', password: '', cargo: '', telefono: '' }

function formatDate(iso?: string) {
  if (!iso) return 'Nunca'
  return new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

export default function AdministradoresPage() {
  const { tenantId, loading } = useSession()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null)
  const [generatedPass, setGeneratedPass] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(empty)
  const [formErr, setFormErr] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchUsers = useCallback(async () => {
    if (!tenantId) return
    setFetching(true)
    setError(null)
    try {
      const r = await fetch(`/api/admin-users?tenant_id=${tenantId}`)
      if (!r.ok) throw new Error('Error al cargar administradores')
      const d = await r.json()
      setUsers(Array.isArray(d) ? d : [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setFetching(false)
    }
  }, [tenantId])

  useEffect(() => { if (!loading && tenantId) fetchUsers() }, [loading, tenantId, fetchUsers])

  function openCreate() { setEditTarget(null); setForm(empty); setFormErr(null); setGeneratedPass(null); setShowCreate(true) }
  function openEdit(u: AdminUser) { setEditTarget(u); setForm({ nombre_completo: u.nombre_completo, email: u.email, password: '', cargo: u.cargo || '', telefono: u.telefono || '' }); setFormErr(null); setGeneratedPass(null); setShowCreate(true) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormErr(null)
    if (!form.nombre_completo.trim()) return setFormErr('Nombre requerido')
    if (!form.email.trim()) return setFormErr('Email requerido')
    if (!editTarget && form.password.length < 6) return setFormErr('Contraseña mínimo 6 caracteres')
    setSubmitting(true)
    try {
      const url = editTarget ? `/api/admin-users/${editTarget.id}` : '/api/admin-users'
      const method = editTarget ? 'PUT' : 'POST'
      const body: Record<string, unknown> = { nombre_completo: form.nombre_completo, email: form.email, cargo: form.cargo, telefono: form.telefono }
      if (!editTarget) body.tenant_id = tenantId
      if (form.password) body.password = form.password
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.detail || 'Error al guardar')
      setShowCreate(false)
      fetchUsers()
    } catch (e: unknown) {
      setFormErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setSubmitting(false)
    }
  }

  async function resetPassword(u: AdminUser) {
    if (!confirm(`Resetear contraseña de ${u.nombre_completo}?`)) return
    const r = await fetch(`/api/admin-users/${u.id}/reset-password`, { method: 'POST' })
    const d = await r.json()
    if (r.ok) { alert(`Nueva contraseña: ${d.nueva_password}\nGuárdala o cópiala ahora.`) }
  }

  async function toggleActive(u: AdminUser) {
    const action = u.activo ? 'desactivar' : 'activar'
    if (!confirm(`${action} cuenta de ${u.nombre_completo}?`)) return
    await fetch(`/api/admin-users/${u.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo: !u.activo }) })
    fetchUsers()
  }

  if (loading || fetching) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Administradores del Sistema</h1>
          <p className="text-sm text-slate-500 mt-0.5">Usuarios con acceso al panel de administración del condominio</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Administrador
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6 flex gap-3">
        <svg className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="text-sm text-indigo-800">
          <p className="font-semibold">¿Para qué sirven los administradores?</p>
          <p className="mt-0.5 text-indigo-700">Son los usuarios que pueden iniciar sesión en este panel para gestionar residentes, gastos comunes, puertas, cámaras y todo el sistema. Cada edificio puede tener múltiples administradores.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-red-700 text-sm">{error}</div>
      )}

      {users.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h3 className="text-slate-700 font-semibold mb-1">Sin administradores registrados</h3>
          <p className="text-slate-400 text-sm mb-4">Crea el primer usuario administrador para entregar acceso al edificio</p>
          <button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl text-sm font-medium">
            Crear Primer Administrador
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Cargo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Último acceso</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm shrink-0">
                        {u.nombre_completo.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800 text-sm">{u.nombre_completo}</p>
                        <p className="text-xs text-slate-400 md:hidden">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 hidden md:table-cell">{u.email}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {u.cargo ? (
                      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-full">{u.cargo}</span>
                    ) : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 hidden lg:table-cell">{formatDate(u.last_login)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${u.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${u.activo ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(u)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Editar">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => resetPassword(u)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Resetear contraseña">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                      </button>
                      <button onClick={() => toggleActive(u)} className={`p-1.5 rounded-lg transition-colors ${u.activo ? 'text-slate-400 hover:text-red-600 hover:bg-red-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`} title={u.activo ? 'Desactivar' : 'Activar'}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={u.activo ? 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636' : 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'} />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal crear/editar */}
      {showCreate && (
        <Modal title={editTarget ? 'Editar Administrador' : 'Nuevo Administrador'} onClose={() => setShowCreate(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre completo *</label>
                <input
                  value={form.nombre_completo}
                  onChange={e => setForm(f => ({ ...f, nombre_completo: e.target.value }))}
                  placeholder="Ej: Juan Pérez Soto"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email (login) *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="admin@edificio.cl"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {editTarget ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cargo</label>
                  <input
                    value={form.cargo}
                    onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))}
                    placeholder="Ej: Administrador"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                  <input
                    value={form.telefono}
                    onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                    placeholder="+56 9 1234 5678"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {formErr && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{formErr}</p>}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowCreate(false)} className="flex-1 border border-slate-300 text-slate-700 rounded-xl py-2 text-sm font-medium hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={submitting} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl py-2 text-sm font-medium transition-colors">
                {submitting ? 'Guardando...' : editTarget ? 'Guardar cambios' : 'Crear administrador'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
