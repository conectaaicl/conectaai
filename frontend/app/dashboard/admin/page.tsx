'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Company {
  id: number
  name: string
  email: string
  phone: string | null
  address: string | null
  status: string
  subscription: {
    plan: string
    modules: Record<string, boolean>
    status: string
    monthly_price: number
  } | null
  user_count: number
}

interface NewCompany {
  name: string
  admin_name: string
  admin_email: string
  phone: string
  address: string
  plan: string
  monthly_price: number
}

export default function AdminPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all') // all, active, suspended
  const [showModal, setShowModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newCompany, setNewCompany] = useState<NewCompany>({
    name: '',
    admin_name: '',
    admin_email: '',
    phone: '',
    address: '',
    plan: 'trial',
    monthly_price: 0
  })
  const [createdPassword, setCreatedPassword] = useState<string | null>(null)
  const [createdEmail, setCreatedEmail] = useState<string | null>(null)

  useEffect(() => {
    fetchCompanies()
  }, [filter])

  async function fetchCompanies() {
    try {
      setLoading(true)
      const url = filter === 'all' 
        ? '/api/admin/companies' 
        : `/api/admin/companies?status=${filter}`
      
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setCompanies(data)
      }
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateCompany(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    
    try {
      const response = await fetch('/api/admin/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCompany)
      })

      if (response.ok) {
        const data = await response.json()
        setCreatedPassword(data.admin_password)
        setCreatedEmail(data.email)
        fetchCompanies()
        setNewCompany({
          name: '',
          admin_name: '',
          admin_email: '',
          phone: '',
          address: '',
          plan: 'trial',
          monthly_price: 0
        })
      } else {
        const error = await response.json()
        alert('❌ Error: ' + error.detail)
      }
    } catch (err: any) {
      alert('❌ Error: ' + err.message)
    } finally {
      setCreating(false)
    }
  }

  function closeModal() {
    setShowModal(false)
    setCreatedPassword(null)
    setCreatedEmail(null)
  }



  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-700 font-medium">Cargando empresas...</p>
        </div>
      </div>
    )
  }

  const activeCount = companies.filter(c => c.status === 'active').length
  const suspendedCount = companies.filter(c => c.status === 'suspended').length

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-700 to-purple-900 shadow-xl px-8 py-6 mb-8">
        <div className="flex justify-between items-center">
          <div className="text-white">
            <h1 className="text-3xl font-bold mb-1">👑 Panel de Administración</h1>
            <p className="text-purple-200 text-sm font-medium">
              Gestión de empresas y clientes
            </p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => setShowModal(true)}
              className="px-6 py-3 bg-white text-purple-700 rounded-xl font-bold hover:bg-purple-50 transition-all shadow-lg"
            >
              ➕ Nueva Empresa
            </button>
            <Link 
              href="/dashboard"
              className="px-5 py-3 bg-white/20 backdrop-blur-sm text-white rounded-xl font-semibold hover:bg-white/30 transition-all"
            >
              ← Volver
            </Link>
          </div>
        </div>
      </div>

      <div className="px-8 pb-8">
        {/* Filtros */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              filter === 'all' 
                ? 'bg-purple-600 text-white shadow-lg' 
                : 'bg-white/80 text-gray-700 hover:bg-white'
            }`}
          >
            Todas ({companies.length})
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              filter === 'active' 
                ? 'bg-green-600 text-white shadow-lg' 
                : 'bg-white/80 text-gray-700 hover:bg-white'
            }`}
          >
            Activas ({activeCount})
          </button>
          <button
            onClick={() => setFilter('suspended')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              filter === 'suspended' 
                ? 'bg-orange-600 text-white shadow-lg' 
                : 'bg-white/80 text-gray-700 hover:bg-white'
            }`}
          >
            Suspendidas ({suspendedCount})
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-4xl">🏢</span>
              <div>
                <p className="text-sm text-gray-600">Total Empresas</p>
                <p className="text-3xl font-bold text-gray-800">{companies.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-4xl">✅</span>
              <div>
                <p className="text-sm text-gray-600">Activas</p>
                <p className="text-3xl font-bold text-green-600">{activeCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-4xl">⏸️</span>
              <div>
                <p className="text-sm text-gray-600">Suspendidas</p>
                <p className="text-3xl font-bold text-orange-600">{suspendedCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-4xl">👥</span>
              <div>
                <p className="text-sm text-gray-600">Total Usuarios</p>
                <p className="text-3xl font-bold text-purple-600">
                  {companies.reduce((sum, c) => sum + c.user_count, 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Empresas */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-800">📊 Empresas Registradas</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">ID</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Empresa</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Contacto</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Plan</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Precio</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Estado</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Usuarios</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {companies.map((company) => (
                  <tr key={company.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-600">{company.id}</td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-800">{company.name}</p>
                      <p className="text-xs text-gray-500">{company.email}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {company.phone || '-'}
                    </td>
                    <td className="px-6 py-4">
                      {company.subscription ? (
                        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold uppercase">
                          {company.subscription.plan}
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">
                          Sin plan
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-gray-800">
                        ${company.subscription?.monthly_price || 0}/mes
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {company.status === 'active' ? (
                        <span className="flex items-center gap-2 text-green-600 font-semibold text-sm">
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          Activa
                        </span>
                      ) : company.status === 'suspended' ? (
                        <span className="flex items-center gap-2 text-orange-600 font-semibold text-sm">
                          <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                          Suspendida
                        </span>
                      ) : (
                        <span className="flex items-center gap-2 text-gray-500 font-semibold text-sm">
                          <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                          Inactiva
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 font-semibold">
                      {company.user_count}
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/dashboard/admin/${company.id}`}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition-all"
                      >
                        Ver Detalles
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Crear Empresa */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-2xl font-bold text-gray-800">➕ Crear Nueva Empresa</h3>
            </div>

            {!createdPassword ? (
              <form onSubmit={handleCreateCompany} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Nombre de la Empresa *
                    </label>
                    <input
                      type="text"
                      value={newCompany.name}
                      onChange={(e) => setNewCompany({...newCompany, name: e.target.value})}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500"
                      placeholder="Empresa ABC"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Nombre del Administrador *
                    </label>
                    <input
                      type="text"
                      value={newCompany.admin_name}
                      onChange={(e) => setNewCompany({...newCompany, admin_name: e.target.value})}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500"
                      placeholder="Juan Pérez"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email del Administrador *
                    </label>
                    <input
                      type="email"
                      value={newCompany.admin_email}
                      onChange={(e) => setNewCompany({...newCompany, admin_email: e.target.value})}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500"
                      placeholder="admin@empresa.cl"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      value={newCompany.phone}
                      onChange={(e) => setNewCompany({...newCompany, phone: e.target.value})}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500"
                      placeholder="+56 9 1234 5678"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Dirección
                  </label>
                  <input
                    type="text"
                    value={newCompany.address}
                    onChange={(e) => setNewCompany({...newCompany, address: e.target.value})}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500"
                    placeholder="Av. Principal 123, Santiago"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Plan *
                    </label>
                    <select
                      value={newCompany.plan}
                      onChange={(e) => setNewCompany({...newCompany, plan: e.target.value})}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500"
                    >
                      <option value="trial">Trial (Gratis)</option>
                      <option value="basic">Basic ($150/mes)</option>
                      <option value="pro">Pro ($350/mes)</option>
                      <option value="enterprise">Enterprise ($800/mes)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Precio Mensual
                    </label>
                    <input
                      type="number"
                      value={newCompany.monthly_price}
                      onChange={(e) => setNewCompany({...newCompany, monthly_price: parseFloat(e.target.value)})}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 bg-gray-50"
                      // editable
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-800 text-white rounded-xl font-bold hover:from-purple-700 hover:to-purple-900 disabled:opacity-50"
                  >
                    {creating ? 'Creando...' : 'Crear Empresa'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-6">
                <div className="bg-green-50 border-2 border-green-500 rounded-xl p-6 mb-6">
                  <h4 className="text-lg font-bold text-green-800 mb-4">✅ Empresa Creada Exitosamente</h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600">Email:</p>
                      <p className="font-mono font-bold text-gray-800">{createdEmail}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Password (guárdalo):</p>
                      <p className="font-mono font-bold text-2xl text-green-700 bg-green-100 p-3 rounded-lg">
                        {createdPassword}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-orange-600 mt-4 font-semibold">
                    ⚠️ Guarda este password ahora. No podrás verlo de nuevo.
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  className="w-full px-6 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700"
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
