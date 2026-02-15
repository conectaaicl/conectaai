'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface CompanyDetails {
  id: number
  name: string
  email: string
  phone: string | null
  address: string | null
  status: string
  created_at: string
  updated_at: string
  subscription: {
    id: number
    plan: string
    monthly_price: number
    status: string
    modules: Record<string, boolean>
    max_users: number
    max_deals: number
    trial_ends_at: string | null
    next_billing_date: string | null
    activated_at: string
    suspended_at: string | null
  }
  users: Array<{
    id: number
    name: string
    email: string
    role: string
  }>
  payment_history: Array<{
    id: number
    amount: number
    currency: string
    status: string
    payment_method: string | null
    description: string | null
    paid_at: string | null
    created_at: string
  }>
}

export default function CompanyDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const companyId = params.id as string

  const [company, setCompany] = useState<CompanyDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editData, setEditData] = useState({
    name: '',
    phone: '',
    address: '',
    plan: '',
    monthly_price: 0,
    status: 'active'
  })

  useEffect(() => {
    fetchCompany()
  }, [companyId])

  async function fetchCompany() {
    try {
      const response = await fetch(`/api/admin/companies/${companyId}`)
      if (response.ok) {
        const data = await response.json()
        setCompany(data)
        setEditData({
          name: data.name,
          phone: data.phone || '',
          address: data.address || '',
          plan: data.subscription?.plan || '',
          monthly_price: data.subscription?.monthly_price || 0,
          status: data.status
        })
      }
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleActivate() {
    if (!confirm('¿Activar esta empresa?')) return
    
    try {
      const response = await fetch(`/api/admin/companies/${companyId}/activate`, {
        method: 'POST'
      })
      if (response.ok) {
        alert('✅ Empresa activada')
        fetchCompany()
      }
    } catch (err) {
      alert('❌ Error al activar')
    }
  }

  async function handleSuspend() {
    if (!confirm('¿Suspender esta empresa por falta de pago?')) return
    
    try {
      const response = await fetch(`/api/admin/companies/${companyId}/suspend`, {
        method: 'POST'
      })
      if (response.ok) {
        alert('✅ Empresa suspendida')
        fetchCompany()
      }
    } catch (err) {
      alert('❌ Error al suspender')
    }
  }

  async function handleDelete() {
    if (!confirm('⚠️ ¿ELIMINAR PERMANENTEMENTE esta empresa? Esta acción NO se puede deshacer.')) return
    if (!confirm('¿Estás SEGURO? Se eliminarán todos los datos, usuarios y suscripción.')) return
    
    try {
      const response = await fetch(`/api/admin/companies/${companyId}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        alert('✅ Empresa eliminada')
        router.push('/dashboard/admin')
      }
    } catch (err) {
      alert('❌ Error al eliminar')
    }
  }

  async function handleSaveEdit() {
    try {
      // Actualizar empresa
      await fetch(`/api/admin/companies/${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editData.name,
          phone: editData.phone,
          address: editData.address,
          status: editData.status
        })
      })

      // Actualizar suscripción
      await fetch(`/api/admin/companies/${companyId}/subscription`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_name: editData.plan,
          monthly_price: editData.monthly_price
        })
      })

      alert('✅ Cambios guardados')
      setShowEditModal(false)
      fetchCompany()
    } catch (err) {
      alert('❌ Error al guardar')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-700 font-medium">Cargando detalles...</p>
        </div>
      </div>
    )
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-800">❌ Empresa no encontrada</p>
          <Link href="/dashboard/admin" className="mt-4 inline-block px-6 py-3 bg-purple-600 text-white rounded-xl font-bold">
            Volver
          </Link>
        </div>
      </div>
    )
  }

  const statusColor = company.status === 'active' ? 'green' : company.status === 'suspended' ? 'orange' : 'red'
  const subStatusColor = company.subscription.status === 'active' ? 'green' : 'gray'

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/dashboard/admin" className="text-purple-600 hover:text-purple-800 font-semibold mb-2 inline-block">
              ← Volver al panel
            </Link>
            <h1 className="text-3xl font-bold text-gray-800">{company.name}</h1>
            <p className="text-gray-600">ID: {company.id}</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowEditModal(true)}
              className="px-5 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700"
            >
              ✏️ Editar
            </button>
            {company.status === 'suspended' ? (
              <button
                onClick={handleActivate}
                className="px-5 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700"
              >
                ✅ Activar
              </button>
            ) : (
              <button
                onClick={handleSuspend}
                className="px-5 py-3 bg-orange-600 text-white rounded-xl font-semibold hover:bg-orange-700"
              >
                ⏸️ Suspender
              </button>
            )}
            <button
              onClick={handleDelete}
              className="px-5 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700"
            >
              🗑️ Eliminar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Info General */}
          <div className="lg:col-span-2 space-y-6">
            {/* Datos de Empresa */}
            <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-lg">
              <h2 className="text-xl font-bold text-gray-800 mb-4">📋 Información General</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-semibold text-gray-800">{company.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Teléfono</p>
                  <p className="font-semibold text-gray-800">{company.phone || '-'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-600">Dirección</p>
                  <p className="font-semibold text-gray-800">{company.address || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Estado</p>
                  <span className={`inline-block px-3 py-1 bg-${statusColor}-100 text-${statusColor}-700 rounded-full text-sm font-bold`}>
                    {company.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Creada</p>
                  <p className="font-semibold text-gray-800">
                    {new Date(company.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Suscripción */}
            <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-lg">
              <h2 className="text-xl font-bold text-gray-800 mb-4">💳 Suscripción</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Plan</p>
                  <p className="font-semibold text-gray-800 uppercase">{company.subscription.plan}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Precio Mensual</p>
                  <p className="font-semibold text-gray-800">${company.subscription.monthly_price || 0}/mes</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Estado</p>
                  <span className={`inline-block px-3 py-1 bg-${subStatusColor}-100 text-${subStatusColor}-700 rounded-full text-sm font-bold`}>
                    {company.subscription.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Límite Usuarios</p>
                  <p className="font-semibold text-gray-800">{company.subscription.max_users}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Límite Deals</p>
                  <p className="font-semibold text-gray-800">{company.subscription.max_deals}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Activado</p>
                  <p className="font-semibold text-gray-800">
                    {new Date(company.subscription.activated_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-2">Módulos Activos</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(company.subscription.modules).map(([key, enabled]) => (
                    enabled && (
                      <span key={key} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">
                        {key}
                      </span>
                    )
                  ))}
                </div>
              </div>
            </div>

            {/* Usuarios */}
            <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-lg">
              <h2 className="text-xl font-bold text-gray-800 mb-4">👥 Usuarios ({company.users.length})</h2>
              <div className="space-y-3">
                {company.users.map(user => (
                  <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div>
                      <p className="font-semibold text-gray-800">{user.name}</p>
                      <p className="text-sm text-gray-600">{user.email}</p>
                    </div>
                    <span className={`px-3 py-1 ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'} rounded-full text-sm font-semibold`}>
                      {user.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Stats */}
            <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-lg">
              <h3 className="font-bold text-gray-800 mb-4">📊 Estadísticas</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Usuarios</span>
                  <span className="font-bold text-gray-800">{company.users.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Pagos</span>
                  <span className="font-bold text-gray-800">{company.payment_history.length}</span>
                </div>
              </div>
            </div>

            {/* Historial de Pagos */}
            <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-lg">
              <h3 className="font-bold text-gray-800 mb-4">💰 Historial de Pagos</h3>
              {company.payment_history.length === 0 ? (
                <p className="text-gray-500 text-sm">Sin pagos registrados</p>
              ) : (
                <div className="space-y-3">
                  {company.payment_history.map(payment => (
                    <div key={payment.id} className="p-3 bg-gray-50 rounded-xl">
                      <div className="flex justify-between mb-1">
                        <span className="font-semibold text-gray-800">${payment.amount}</span>
                        <span className={`px-2 py-1 ${payment.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'} rounded text-xs font-semibold`}>
                          {payment.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">
                        {new Date(payment.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Editar */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-2xl font-bold text-gray-800">✏️ Editar Empresa</h3>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre</label>
                  <input
                    type="text"
                    value={editData.name}
                    onChange={(e) => setEditData({...editData, name: e.target.value})}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Teléfono</label>
                  <input
                    type="text"
                    value={editData.phone}
                    onChange={(e) => setEditData({...editData, phone: e.target.value})}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Dirección</label>
                  <input
                    type="text"
                    value={editData.address}
                    onChange={(e) => setEditData({...editData, address: e.target.value})}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Plan</label>
                    <select
                      value={editData.plan}
                      onChange={(e) => setEditData({...editData, plan: e.target.value})}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500"
                    >
                      <option value="trial">Trial</option>
                      <option value="basic">Basic</option>
                      <option value="pro">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Precio/Mes</label>
                    <input
                      type="number"
                      value={editData.monthly_price}
                      onChange={(e) => setEditData({...editData, monthly_price: parseFloat(e.target.value)})}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700"
                  >
                    Guardar Cambios
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
