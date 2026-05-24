'use client'
import { useState, useEffect } from 'react'

interface Tenant {
  id: number
  nombre: string
  subdominio: string
  email_contacto: string
  telefono: string | null
  plan: string
  estado: string
  logo_url: string | null
  favicon_url: string | null
  color_primario: string
  color_secundario: string
  color_acento: string
  limite_condominios: number
  limite_departamentos: number
  fecha_inicio: string
  fecha_vencimiento: string | null
}

export default function TenantsAdminPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null)
  
  const [formData, setFormData] = useState({
    nombre: '',
    subdominio: '',
    email_contacto: '',
    telefono: '',
    plan: 'basico',
    color_primario: '#3498db',
    color_secundario: '#2ecc71',
    color_acento: '#e74c3c',
    limite_condominios: 1,
    limite_departamentos: 50
  })

  useEffect(() => { fetchTenants() }, [])

  async function fetchTenants() {
    try {
      const res = await fetch('/api/admin/tenants')
      if (res.ok) setTenants(await res.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const url = editingTenant ? `/api/admin/tenants/${editingTenant.id}` : '/api/admin/tenants/'
      const method = editingTenant ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
      if (res.ok) {
        setShowModal(false)
        fetchTenants()
        resetForm()
        alert(editingTenant ? '✅ Cliente actualizado' : '✅ Cliente creado')
      } else {
        const error = await res.json()
        alert(`❌ Error: ${JSON.stringify(error.detail)}`)
      }
    } catch (err) {
      console.error(err)
      alert('❌ Error al guardar')
    }
  }

  async function handleDelete(tenantId: number) {
    if (tenantId === 1) { alert('❌ No se puede eliminar el tenant demo'); return }
    if (!confirm('¿ELIMINAR cliente? Se perderán TODOS sus datos. Esta acción NO se puede deshacer.')) return
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}`, { method: 'DELETE' })
      if (res.ok) { fetchTenants(); alert('✅ Cliente eliminado') }
    } catch (err) { alert('❌ Error al eliminar') }
  }

  function editTenant(tenant: Tenant) {
    setEditingTenant(tenant)
    setFormData({
      nombre: tenant.nombre, subdominio: tenant.subdominio, email_contacto: tenant.email_contacto,
      telefono: tenant.telefono || '', plan: tenant.plan, color_primario: tenant.color_primario,
      color_secundario: tenant.color_secundario, color_acento: tenant.color_acento,
      limite_condominios: tenant.limite_condominios, limite_departamentos: tenant.limite_departamentos
    })
    setShowModal(true)
  }

  function resetForm() {
    setEditingTenant(null)
    setFormData({ nombre: '', subdominio: '', email_contacto: '', telefono: '', plan: 'basico', color_primario: '#3498db', color_secundario: '#2ecc71', color_acento: '#e74c3c', limite_condominios: 1, limite_departamentos: 50 })
  }

  async function uploadLogo(tenantId: number, file: File) {
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/upload-logo`, { method: 'POST', body: formData })
      if (res.ok) { fetchTenants(); alert('✅ Logo actualizado') }
    } catch (err) { alert('❌ Error al subir logo') }
  }

  if (loading) return (<div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div></div>)

  const PLANES_COLORES = { basico: 'bg-blue-100 text-blue-700', premium: 'bg-purple-100 text-purple-700', enterprise: 'bg-orange-100 text-orange-700' }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div><h1 className="text-3xl font-bold text-gray-800">🏢 Gestión de Clientes (Tenants)</h1><p className="text-gray-600">Sistema Multi-Tenant con Marca Blanca</p></div>
          <button onClick={() => { resetForm(); setShowModal(true) }} className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-800 text-white rounded-xl font-bold hover:shadow-xl">➕ Nuevo Cliente</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tenants.map(tenant => (
            <div key={tenant.id} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-2xl transition-all">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  {tenant.logo_url && (<img src={tenant.logo_url} alt="Logo" className="h-12 w-auto mb-3" />)}
                  <h3 className="text-xl font-bold text-gray-800">{tenant.nombre}</h3>
                  <p className="text-sm text-gray-600">{tenant.subdominio}.conectaai.cl</p>
                  <p className="text-xs text-gray-500">{tenant.email_contacto}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${PLANES_COLORES[tenant.plan as keyof typeof PLANES_COLORES]}`}>{tenant.plan.toUpperCase()}</span>
              </div>
              <div className="mb-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded" style={{backgroundColor: tenant.color_primario}}></div>
                  <div className="w-6 h-6 rounded" style={{backgroundColor: tenant.color_secundario}}></div>
                  <div className="w-6 h-6 rounded" style={{backgroundColor: tenant.color_acento}}></div>
                  <span className="text-xs text-gray-500 ml-2">Colores de marca</span>
                </div>
                <div className="text-sm text-gray-600"><p>🏢 {tenant.limite_condominios} condominios</p><p>🏠 {tenant.limite_departamentos} departamentos</p></div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => editTenant(tenant)} className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold">✏️ Editar</button>
                <button onClick={() => handleDelete(tenant.id)} className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-semibold" disabled={tenant.id === 1}>🗑️ Eliminar</button>
              </div>
              <div className="mt-3"><label className="block text-xs text-gray-600 mb-1">Cambiar Logo:</label><input type="file" accept="image/*" onChange={(e) => e.target.files && uploadLogo(tenant.id, e.target.files[0])} className="text-xs" /></div>
            </div>
          ))}
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full my-8">
              <div className="p-6 border-b bg-gradient-to-r from-purple-600 to-purple-800 text-white rounded-t-2xl"><h3 className="text-2xl font-bold">{editingTenant ? '✏️ Editar Cliente' : '➕ Nuevo Cliente'}</h3></div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-bold mb-2">Nombre Empresa *</label><input type="text" value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} className="w-full px-4 py-3 border-2 rounded-xl outline-none" required /></div>
                  <div><label className="block text-sm font-bold mb-2">Subdomain *</label><div className="flex items-center"><input type="text" value={formData.subdominio} onChange={(e) => setFormData({...formData, subdominio: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')})} className="flex-1 px-4 py-3 border-2 rounded-l-xl outline-none" required disabled={!!editingTenant} /><span className="px-3 py-3 bg-gray-100 border-2 border-l-0 rounded-r-xl text-sm">.conectaai.cl</span></div></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-bold mb-2">Email Contacto *</label><input type="email" value={formData.email_contacto} onChange={(e) => setFormData({...formData, email_contacto: e.target.value})} className="w-full px-4 py-3 border-2 rounded-xl outline-none" required /></div>
                  <div><label className="block text-sm font-bold mb-2">Teléfono</label><input type="tel" value={formData.telefono} onChange={(e) => setFormData({...formData, telefono: e.target.value})} className="w-full px-4 py-3 border-2 rounded-xl outline-none" /></div>
                </div>
                <div><label className="block text-sm font-bold mb-2">Plan *</label><select value={formData.plan} onChange={(e) => setFormData({...formData, plan: e.target.value})} className="w-full px-4 py-3 border-2 rounded-xl outline-none"><option value="basico">Básico ($80.000/mes)</option><option value="premium">Premium ($150.000/mes)</option><option value="enterprise">Enterprise ($300.000/mes)</option></select></div>
                <div className="bg-blue-50 p-4 rounded-xl"><h4 className="font-bold mb-3">🎨 Marca Blanca - Colores</h4><div className="grid grid-cols-3 gap-4"><div><label className="block text-sm font-bold mb-2">Color Primario</label><input type="color" value={formData.color_primario} onChange={(e) => setFormData({...formData, color_primario: e.target.value})} className="w-full h-12 rounded-xl" /></div><div><label className="block text-sm font-bold mb-2">Color Secundario</label><input type="color" value={formData.color_secundario} onChange={(e) => setFormData({...formData, color_secundario: e.target.value})} className="w-full h-12 rounded-xl" /></div><div><label className="block text-sm font-bold mb-2">Color Acento</label><input type="color" value={formData.color_acento} onChange={(e) => setFormData({...formData, color_acento: e.target.value})} className="w-full h-12 rounded-xl" /></div></div></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-bold mb-2">Límite Condominios</label><input type="number" value={formData.limite_condominios} onChange={(e) => setFormData({...formData, limite_condominios: parseInt(e.target.value)})} className="w-full px-4 py-3 border-2 rounded-xl outline-none" min="1" /></div>
                  <div><label className="block text-sm font-bold mb-2">Límite Departamentos</label><input type="number" value={formData.limite_departamentos} onChange={(e) => setFormData({...formData, limite_departamentos: parseInt(e.target.value)})} className="w-full px-4 py-3 border-2 rounded-xl outline-none" min="1" /></div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-xl font-bold hover:bg-gray-50">Cancelar</button>
                  <button type="submit" className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-800 text-white rounded-xl font-bold hover:shadow-xl">{editingTenant ? '💾 Guardar' : '➕ Crear'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
