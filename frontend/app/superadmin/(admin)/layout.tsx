'use client'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

function NavItem({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  const pathname = usePathname()
  const active = pathname === href || (href !== '/superadmin/dashboard' && pathname.startsWith(href))
  return (
    <Link href={href}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
        active
          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}>
      {icon}
      {label}
    </Link>
  )
}

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [admin, setAdmin] = useState<{email:string;nombre:string}|null>(null)
  const [sideOpen, setSideOpen] = useState(false)

  useEffect(() => {
    fetch('/api/superadmin/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setAdmin(d); else router.replace('/superadmin/login') })
      .catch(() => router.replace('/superadmin/login'))
  }, [])

  async function logout() {
    await fetch('/api/superadmin/logout', { method: 'POST', credentials: 'include' })
    router.push('/superadmin/login')
  }

  if (!admin) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  const nav = [
    { href: '/superadmin/dashboard', label: 'Dashboard',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
    },
    { href: '/superadmin/tenants', label: 'Tenants',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
    },
    { href: '/superadmin/sistema', label: 'Sistema',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" /></svg>
    },
    { href: '/superadmin/noc', label: 'NOC',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="1.5"/><circle cx="12" cy="12" r="6" strokeWidth="1.5"/><circle cx="12" cy="12" r="2" strokeWidth="1.5"/><path strokeLinecap="round" strokeWidth="1.5" d="M12 12 L18 6"/></svg>
    },
  ]

  const Sidebar = () => (
    <aside className="w-60 bg-slate-900 border-r border-slate-800 flex flex-col h-full">
      <div className="p-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-500/30">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <div className="font-bold text-white text-sm">ConectaAI</div>
            <div className="text-xs text-indigo-400 font-semibold">Super Admin</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {nav.map(n => <NavItem key={n.href} {...n} />)}
      </nav>
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-indigo-600/20 rounded-lg flex items-center justify-center text-indigo-400 font-bold text-xs">
            {admin.nombre?.charAt(0) || 'S'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-white truncate">{admin.nombre}</div>
            <div className="text-xs text-slate-500 truncate">{admin.email}</div>
          </div>
        </div>
        <button onClick={logout}
          className="w-full text-xs text-slate-400 hover:text-red-400 transition py-2 px-3 rounded-lg hover:bg-red-500/10 flex items-center gap-2">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          Cerrar sesión
        </button>
      </div>
    </aside>
  )

  return (
    <div className="min-h-screen bg-slate-950 text-white flex">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-col" style={{width:240}}>
        <div className="fixed inset-y-0 left-0" style={{width:240}}>
          <Sidebar />
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sideOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setSideOpen(false)}/>
          <div className="relative z-10 flex flex-col" style={{width:240}}>
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0" style={{marginLeft: 0}}>
        <header className="lg:hidden h-14 bg-slate-900 border-b border-slate-800 flex items-center px-4 gap-3">
          <button onClick={() => setSideOpen(true)} className="text-slate-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <span className="font-semibold text-sm">Super Admin</span>
        </header>
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
