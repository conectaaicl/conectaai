'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
  const { branding } = useBranding()
  const [mostrarMenuVentas, setMostrarMenuVentas] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [usuario, setUsuario] = useState<Usuario | null>(null)

  useEffect(() => { cargarUsuario() }, [])
  useEffect(() => { setMobileOpen(false) }, [pathname])

  const cargarUsuario = async () => {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' })
      if (response.ok) setUsuario(await response.json())
    } catch {}
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
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }) } catch {}
    localStorage.removeItem('token')
    window.location.href = '/login'
  }

  const navLinkClass = (active: boolean) =>
    `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all min-h-[44px] ${
      active ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg' : 'text-gray-700 hover:bg-purple-50'
    }`

  const mobileNavClass = (active: boolean) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all mb-1 min-h-[44px] ${
      active ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' : 'text-gray-700 hover:bg-purple-50'
    }`

  return (
    <>
      <nav className="bg-white shadow-lg border-b-4 border-purple-600 relative z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Menu"
              >
                {mobileOpen ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                )}
              </button>
              <Link href="/dashboard" className="flex items-center">
                {branding?.logo_url ? (
                  <img src={branding.logo_url} alt="Logo" className="h-8 w-auto" />
                ) : (
                  <span className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                    {branding?.brand_name || 'ConectaAI'}
                  </span>
                )}
              </Link>
              <div className="hidden md:flex ml-6 space-x-1">
                <Link href="/dashboard" className={navLinkClass(pathname === '/dashboard')}>🏠 Dashboard</Link>
                {tieneModulo('condominios') && (
                  <Link href="/dashboard/condominios" className={navLinkClass(pathname.startsWith('/dashboard/condominios'))}>🏢 Condominios</Link>
                )}
                {tieneModulo('ventas') && (
                  <div className="relative">
                    <button
                      onMouseEnter={() => setMostrarMenuVentas(true)}
                      onMouseLeave={() => setMostrarMenuVentas(false)}
                      className={navLinkClass(pathname.startsWith('/dashboard/ventas'))}
                    >💼 Ventas ▼</button>
                    {mostrarMenuVentas && (
                      <div
                        onMouseEnter={() => setMostrarMenuVentas(true)}
                        onMouseLeave={() => setMostrarMenuVentas(false)}
                        className="absolute top-full left-0 mt-1 w-56 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 z-50"
                      >
                        {menuVentas.map((item) => (
                          <Link key={item.href} href={item.href}
                            className={`flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-all ${pathname === item.href ? 'bg-purple-50 text-purple-700 border-l-4 border-purple-600' : 'text-gray-700 hover:bg-gray-50'}`}
                          >
                            <span className="text-xl">{item.icon}</span><span>{item.label}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {usuario?.rol === 'superadmin' && (
                  <Link href="/dashboard/admin" className={navLinkClass(pathname.startsWith('/dashboard/admin'))}>👨‍💼 Admin</Link>
                )}
                <Link href="/dashboard/perfil" className={navLinkClass(pathname === '/dashboard/perfil')}>👤 Mi Cuenta</Link>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <Link href="/dashboard/configuracion" className="hidden sm:flex items-center px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-lg transition min-h-[44px]">⚙️ Config</Link>
              <button onClick={handleLogout} className="px-3 sm:px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-lg transition shadow-md min-h-[44px]">🚪 Salir</button>
            </div>
          </div>
        </div>
      </nav>

      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setMobileOpen(false)} />}

      <div className={`fixed top-0 left-0 h-full w-72 bg-white shadow-2xl z-40 transform transition-transform duration-200 ease-in-out md:hidden overflow-y-auto ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-purple-600 to-blue-600">
          <span className="text-white font-bold text-lg">{branding?.brand_name || 'ConectaAI'}</span>
          <button onClick={() => setMobileOpen(false)} className="text-white p-1 rounded-lg hover:bg-white/20 transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-3 pb-20">
          <Link href="/dashboard" className={mobileNavClass(pathname === '/dashboard')}>🏠 Dashboard</Link>
          {tieneModulo('condominios') && (
            <Link href="/dashboard/condominios" className={mobileNavClass(pathname.startsWith('/dashboard/condominios'))}>🏢 Condominios</Link>
          )}
          {tieneModulo('ventas') && (
            <div className="border-t border-gray-100 pt-2 mt-2">
              <p className="px-4 text-xs font-bold text-gray-400 uppercase mb-1">Ventas</p>
              {menuVentas.map((item) => (
                <Link key={item.href} href={item.href} className={mobileNavClass(pathname === item.href)}>
                  <span>{item.icon}</span><span>{item.label}</span>
                </Link>
              ))}
            </div>
          )}
          <div className="border-t border-gray-100 pt-2 mt-2">
            {usuario?.rol === 'superadmin' && (
              <Link href="/dashboard/admin" className={mobileNavClass(pathname.startsWith('/dashboard/admin'))}>👨‍💼 Admin</Link>
            )}
            <Link href="/dashboard/perfil" className={mobileNavClass(pathname === '/dashboard/perfil')}>👤 Mi Cuenta</Link>
            <Link href="/dashboard/configuracion" className={mobileNavClass(pathname.startsWith('/dashboard/configuracion'))}>⚙️ Configuración</Link>
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition min-h-[44px] mt-2">🚪 Cerrar sesión</button>
          </div>
        </div>
      </div>
    </>
  )
}
