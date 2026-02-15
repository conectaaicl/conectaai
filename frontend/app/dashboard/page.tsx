'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Usuario {
  id: number
  email: string
  nombre_completo: string
  rol: string
  tenant_id: number
  empresa: string
  cargo: string
  tenant: {
    nombre: string
    modulos_activos: string[]
    plan: string
    logo_url: string
    color_primario: string
    color_secundario: string
  }
}

export default function DashboardPage() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const [saludo, setSaludo] = useState('')

  useEffect(() => {
    cargarUsuario()
    generarSaludo()
  }, [])

  const cargarUsuario = async () => {
    try {
      const response = await fetch('https://sistema.conectaai.cl/api/auth/me', {
        credentials: 'include',
      })
      
      if (response.ok) {
        const data = await response.json()
        setUsuario(data)
      }
    } catch (error) {
      console.error('Error cargando usuario:', error)
    } finally {
      setLoading(false)
    }
  }

  const generarSaludo = () => {
    const hora = new Date().getHours()
    if (hora < 12) setSaludo('Buenos días')
    else if (hora < 20) setSaludo('Buenas tardes')
    else setSaludo('Buenas noches')
  }

  const tieneModulo = (modulo: string) => {
    if (!usuario) return false
    if (usuario.rol === 'superadmin') return true
    return usuario.tenant?.modulos_activos?.includes(modulo) || false
  }

  const obtenerNombrePila = () => {
    if (!usuario) return ''
    return usuario.nombre_completo.split(' ')[0]
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-700 font-semibold">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Mensaje de Bienvenida Personalizado */}
        <div className="mb-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-3xl p-8 shadow-2xl text-white">
          <h1 className="text-4xl font-extrabold mb-2">
            {saludo}, {obtenerNombrePila()}! 👋
          </h1>
          <p className="text-xl opacity-90">
            {usuario?.rol === 'superadmin' 
              ? 'Bienvenido al Panel de Super Administrador de ConectaAI'
              : `Bienvenido a ${usuario?.tenant?.nombre || 'tu empresa'}`
            }
          </p>
          <div className="mt-4 flex items-center gap-4 text-sm opacity-80">
            <span>📧 {usuario?.email}</span>
            <span>•</span>
            <span>👔 {usuario?.cargo || 'Usuario'}</span>
            <span>•</span>
            <span>🏢 Plan {usuario?.tenant?.plan}</span>
          </div>
        </div>

        {/* Cards de Módulos según lo que compró */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* MÓDULO CONDOMINIOS */}
          {tieneModulo('condominios') && (
            <Link href="/dashboard/condominios" className="group">
              <div className="bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all p-8 border-2 border-transparent hover:border-green-400 transform hover:-translate-y-2">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition">
                  <span className="text-4xl">🏢</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">Condominios</h2>
                <p className="text-gray-600 mb-4">
                  Gestión completa de edificios, departamentos, residentes y finanzas.
                </p>
                <div className="flex items-center text-green-600 font-semibold group-hover:gap-3 transition-all">
                  <span>Acceder</span>
                  <span className="group-hover:translate-x-2 transition-transform">→</span>
                </div>
              </div>
            </Link>
          )}

          {/* MÓDULO VENTAS */}
          {tieneModulo('ventas') && (
            <Link href="/dashboard/ventas" className="group">
              <div className="bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all p-8 border-2 border-transparent hover:border-purple-400 transform hover:-translate-y-2">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition">
                  <span className="text-4xl">💼</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">Ventas</h2>
                <p className="text-gray-600 mb-4">
                  Pipeline de ventas, cotizaciones, reportes y gestión comercial.
                </p>
                <div className="flex items-center text-purple-600 font-semibold group-hover:gap-3 transition-all">
                  <span>Acceder</span>
                  <span className="group-hover:translate-x-2 transition-transform">→</span>
                </div>
              </div>
            </Link>
          )}

          {/* MÓDULO WHATSAPP 360 */}
          {tieneModulo('whatsapp360') && (
            <Link href="/dashboard/ventas/inbox" className="group">
              <div className="bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all p-8 border-2 border-transparent hover:border-blue-400 transform hover:-translate-y-2">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition">
                  <span className="text-4xl">💬</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">WhatsApp 360</h2>
                <p className="text-gray-600 mb-4">
                  Gestión multicanal de conversaciones, leads y atención al cliente.
                </p>
                <div className="flex items-center text-blue-600 font-semibold group-hover:gap-3 transition-all">
                  <span>Acceder</span>
                  <span className="group-hover:translate-x-2 transition-transform">→</span>
                </div>
              </div>
            </Link>
          )}

          {/* MÓDULO ADMIN (Solo SuperAdmin) */}
          {usuario?.rol === 'superadmin' && (
            <Link href="/dashboard/admin" className="group">
              <div className="bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all p-8 border-2 border-transparent hover:border-red-400 transform hover:-translate-y-2">
                <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition">
                  <span className="text-4xl">👨‍💼</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">Administración</h2>
                <p className="text-gray-600 mb-4">
                  Gestión de tenants, usuarios, planes y configuración del sistema.
                </p>
                <div className="flex items-center text-red-600 font-semibold group-hover:gap-3 transition-all">
                  <span>Acceder</span>
                  <span className="group-hover:translate-x-2 transition-transform">→</span>
                </div>
              </div>
            </Link>
          )}
        </div>

        {/* Info adicional según el rol */}
        <div className="mt-8 bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            {usuario?.rol === 'superadmin' ? '🔧 Panel de Control SuperAdmin' : '📊 Resumen de tu Cuenta'}
          </h3>
          
          {usuario?.rol === 'superadmin' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-purple-50 rounded-xl p-4">
                <p className="text-sm text-purple-600 font-semibold mb-1">Acceso Total</p>
                <p className="text-2xl font-bold text-purple-900">Todos los Tenants</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-sm text-blue-600 font-semibold mb-1">Permisos</p>
                <p className="text-2xl font-bold text-blue-900">Super Administrador</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4">
                <p className="text-sm text-green-600 font-semibold mb-1">Módulos</p>
                <p className="text-2xl font-bold text-green-900">Todos</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-indigo-50 rounded-xl p-4">
                <p className="text-sm text-indigo-600 font-semibold mb-1">Empresa</p>
                <p className="text-lg font-bold text-indigo-900">{usuario?.empresa}</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-4">
                <p className="text-sm text-purple-600 font-semibold mb-1">Plan Activo</p>
                <p className="text-lg font-bold text-purple-900 capitalize">{usuario?.tenant?.plan}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-sm text-blue-600 font-semibold mb-1">Módulos Activos</p>
                <p className="text-lg font-bold text-blue-900">{usuario?.tenant?.modulos_activos?.length || 0}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
