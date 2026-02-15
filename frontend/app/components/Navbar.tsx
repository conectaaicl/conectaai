'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useBranding } from '../hooks/useBranding'
import { useState, useEffect } from 'react'

interface Usuario {
  id: number
  rol: string
  tenant_id: number
  tenant: {
    modulos_activos: string[]
  }
}

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { branding, loading } = useBranding()
  const [mostrarMenuVentas, setMostrarMenuVentas] = useState(false)
  const [usuario, setUsuario] = useState<Usuario | null>(null)

  useEffect(() => {
    cargarUsuario()
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
    }
  }

  const tieneModulo = (modulo: string) => {
    if (!usuario) return false
    if (usuario.rol === 'superadmin') return true
    return usuario.tenant?.modulos_activos?.includes(modulo) || false
  }

  const menuVentas = [
    { href: '/dashboard/ventas', label: 'Pipeline', icon: '📋' },
    { href: '/dashboard/ventas/inbox', label: 'Inbox', icon: '💬' },
    { href: '/dashboard/ventas/leads', label: 'Leads', icon: '🔥' },
    { href: '/dashboard/ventas/stats', label: 'Estadísticas', icon: '📊' },
    { href: '/dashboard/ventas/cotizaciones', label: 'Cotizaciones', icon: '💰' },
    { href: '/dashboard/ventas/reportes', label: 'Reportes', icon: '📈' },
  ]

  const handleLogout = async () => {
    try {
      const response = await fetch('https://sistema.conectaai.cl/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })

      localStorage.removeItem('token')
      window.location.href = '/login'
    } catch (error) {
      console.error('Error al cerrar sesión:', error)
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
  }

  return (
    <nav className="bg-white shadow-lg border-b-4 border-gradient-to-r from-purple-600 to-blue-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            {/* Logo/Brand */}
            <Link href="/dashboard" className="flex items-center">
              {branding?.logo_url ? (
                <img src={branding.logo_url} alt="Logo" className="h-8 w-auto" />
              ) : (
                <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  {branding?.brand_name || 'ConectaAI'}
                </span>
              )}
            </Link>

            {/* Nav Links - Solo mostrar según módulos activos */}
            <div className="hidden md:flex ml-10 space-x-2">
              {/* Dashboard siempre visible */}
              <Link
                href="/dashboard"
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  pathname === '/dashboard'
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                    : 'text-gray-700 hover:bg-purple-50'
                }`}
              >
                🏠 Dashboard
              </Link>

              {/* Condominios - Solo si tiene el módulo */}
              {tieneModulo('condominios') && (
                <Link
                  href="/dashboard/condominios"
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    pathname.startsWith('/dashboard/condominios')
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                      : 'text-gray-700 hover:bg-purple-50'
                  }`}
                >
                  🏢 Condominios
                </Link>
              )}

              {/* Ventas - Solo si tiene el módulo */}
              {tieneModulo('ventas') && (
                <div className="relative">
                  <button
                    onMouseEnter={() => setMostrarMenuVentas(true)}
                    onMouseLeave={() => setMostrarMenuVentas(false)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      pathname.startsWith('/dashboard/ventas')
                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                        : 'text-gray-700 hover:bg-purple-50'
                    }`}
                  >
                    💼 Ventas ▼
                  </button>

                  {mostrarMenuVentas && (
                    <div
                      onMouseEnter={() => setMostrarMenuVentas(true)}
                      onMouseLeave={() => setMostrarMenuVentas(false)}
                      className="absolute top-full left-0 mt-1 w-56 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 z-50"
                    >
                      {menuVentas.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-all ${
                            pathname === item.href
                              ? 'bg-purple-50 text-purple-700 border-l-4 border-purple-600'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <span className="text-xl">{item.icon}</span>
                          <span>{item.label}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Admin - Solo SuperAdmin */}
              {usuario?.rol === 'superadmin' && (
                <Link
                  href="/dashboard/admin"
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    pathname.startsWith('/dashboard/admin')
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                      : 'text-gray-700 hover:bg-purple-50'
                  }`}
                >
                  👨‍💼 Admin
                </Link>
              )}

              {/* Mi Cuenta */}
              <Link
                href="/dashboard/perfil"
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  pathname === '/dashboard/perfil'
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                    : 'text-gray-700 hover:bg-purple-50'
                }`}
              >
                👤 Mi Cuenta
              </Link>
            </div>
          </div>

          {/* User Menu */}
          <div className="flex items-center space-x-2">
            <Link
              href="/dashboard/configuracion"
              className="px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              ⚙️ Configuración
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-lg transition shadow-md"
            >
              🚪 Salir
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className="md:hidden px-4 pb-3">
        <div className="space-y-1">
          <Link
            href="/dashboard"
            className={`block px-3 py-2 rounded-md text-base font-medium ${
              pathname === '/dashboard'
                ? 'bg-purple-600 text-white'
                : 'text-gray-700 hover:bg-purple-50'
            }`}
          >
            🏠 Dashboard
          </Link>

          {tieneModulo('condominios') && (
            <Link
              href="/dashboard/condominios"
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                pathname.startsWith('/dashboard/condominios')
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-700 hover:bg-purple-50'
              }`}
            >
              🏢 Condominios
            </Link>
          )}

          {tieneModulo('ventas') && (
            <div className="border-t border-gray-200 pt-2 mt-2">
              <p className="px-3 text-xs font-bold text-gray-500 uppercase">Ventas</p>
              {menuVentas.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block px-3 py-2 rounded-md text-base font-medium ${
                    pathname === item.href
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-700 hover:bg-purple-50'
                  }`}
                >
                  {item.icon} {item.label}
                </Link>
              ))}
            </div>
          )}

          {usuario?.rol === 'superadmin' && (
            <Link
              href="/dashboard/admin"
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                pathname.startsWith('/dashboard/admin')
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-700 hover:bg-purple-50'
              }`}
            >
              👨‍💼 Admin
            </Link>
          )}

          <Link
            href="/dashboard/perfil"
            className={`block px-3 py-2 rounded-md text-base font-medium ${
              pathname === '/dashboard/perfil'
                ? 'bg-purple-600 text-white'
                : 'text-gray-700 hover:bg-purple-50'
            }`}
          >
            👤 Mi Cuenta
          </Link>
        </div>
      </div>
    </nav>
  )
}
