'use client'
import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'

const NAV_ITEMS = [
  {
    href: '/conserje/central',
    label: 'Central',
    icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 17a2 2 0 002 2h2a2 2 0 002-2m0 0V7m0 10a2 2 0 012 2h2a2 2 0 012-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2',
    exact: true,
  },
  {
    href: '/conserje/accesos',
    label: 'Accesos QR',
    icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  },
  {
    href: '/conserje/puertas',
    label: 'Puertas',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  },
  {
    href: '/conserje/visitas',
    label: 'Visitas',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  },
  {
    href: '/conserje/paqueteria',
    label: 'Paqueteria',
    icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
  },
  {
    href: '/conserje/reservas',
    label: 'Reservas',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  {
    href: '/conserje/incidencias',
    label: 'Incidencias',
    icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  },
  {
    href: '/conserje/historial',
    label: 'Historial',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    href: '/conserje/alarmas',
    label: 'Alarmas',
    icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  },
]

function NavIcon({ d }: { d: string }) {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={d} />
    </svg>
  )
}

export default function ConserjeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => { setOpen(false) }, [pathname])

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) { router.push('/login'); return }
        if (data.rol !== 'conserje') { router.push('/dashboard'); return }
        setUser(data)
      })
      .catch(() => router.push('/login'))
  }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  const initials = user?.nombre_completo?.split(' ').map((n: string) => n[0]).slice(0, 2).join('') || '?'
  const currentLabel = NAV_ITEMS.find(i => isActive(i.href, i.exact))?.label || 'Conserjería'

  const SidebarContent = () => (
    <div className="flex flex-col h-full text-white" style={{ background: 'linear-gradient(180deg, #0f172a 0%, #020617 100%)' }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800/60">
        <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/40">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <span className="font-bold text-base tracking-tight block" style={{ background: 'linear-gradient(90deg, #34d399, #67e8f9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Conserjería
          </span>
          <span className="text-slate-500 text-xs">ConectaAI</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {NAV_ITEMS.map(item => {
          const active = isActive(item.href, item.exact)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${active ? 'text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}`}
              style={active ? {
                background: 'linear-gradient(90deg, rgba(52,211,153,0.18) 0%, rgba(52,211,153,0.07) 100%)',
                borderLeft: '2px solid #34d399',
                boxShadow: '0 0 12px rgba(52,211,153,0.12)',
              } : { borderLeft: '2px solid transparent' }}
            >
              <NavIcon d={item.icon} />
              <span>{item.label}</span>
              {active && <span className="ml-auto w-1.5 h-1.5 bg-emerald-400 rounded-full" />}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="shrink-0 border-t border-slate-800/60 p-3">
        {user && (
          <div className="flex items-center gap-3 px-3 py-3 mb-2 rounded-xl" style={{ background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(51,65,85,0.5)' }}>
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{user.nombre_completo}</p>
              <p className="text-emerald-400 text-xs">Conserje</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:bg-red-900/40 hover:text-red-400 transition-all duration-200"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>Cerrar sesión</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-56 flex-col shrink-0 border-r border-slate-800/60">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="relative z-50 flex w-64 flex-col border-r border-slate-800/60">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-14 border-b border-slate-800/60 flex items-center gap-3 px-4 shrink-0" style={{ background: 'rgba(15,23,42,0.95)' }}>
          <button
            onClick={() => setOpen(true)}
            className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-slate-100 font-semibold text-sm flex-1">{currentLabel}</span>
          <button
            onClick={() => window.open('/conserje/camaras', '_blank')}
            title="Abrir monitor de camaras en nueva ventana"
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors border border-slate-700 mr-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
            Camaras
          </button>
          {user && (
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">
              {initials}
            </div>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
