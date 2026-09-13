'use client'
import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutGrid, QrCode, DoorClosed, Users, Package,
  CalendarDays, AlertTriangle, History, Siren,
  Menu, LogOut, Camera, ShieldCheck, CircleDot,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/conserje/central',    label: 'Central',     icon: LayoutGrid, exact: true },
  { href: '/conserje/accesos',    label: 'Accesos QR',  icon: QrCode },
  { href: '/conserje/puertas',    label: 'Puertas',     icon: DoorClosed },
  { href: '/conserje/kiosco',     label: 'Kiosco Acceso', icon: ShieldCheck },
  { href: '/conserje/visitas',    label: 'Visitas',     icon: Users },
  { href: '/conserje/paqueteria', label: 'Paqueteria',  icon: Package },
  { href: '/conserje/reservas',   label: 'Reservas',    icon: CalendarDays },
  { href: '/conserje/incidencias',label: 'Incidencias', icon: AlertTriangle },
  { href: '/conserje/historial',  label: 'Historial',   icon: History },
  { href: '/conserje/alarmas',    label: 'Alarmas',     icon: Siren },
]

export default function ConserjeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => { setOpen(false) }, [pathname])

  useEffect(() => {
    // El login vive dentro de este mismo segmento de ruta pero no requiere sesion.
    if (pathname === '/conserje/login') return

    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) { router.push('/conserje/login'); return }
        if (data.rol !== 'conserje') { router.push('/dashboard'); return }
        localStorage.setItem('conserje_tenant_id', String(data.tenant_id || ''))
        localStorage.setItem('conserje_user', JSON.stringify({ id: data.id, nombre_completo: data.nombre_completo, tenant_id: data.tenant_id }))
        setUser(data)
      })
      .catch(() => router.push('/conserje/login'))
  }, [pathname])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/conserje/login')
  }

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname?.startsWith(href)
  }

  // La pantalla de login se renderiza sola, sin el shell (sidebar/topbar).
  if (pathname === '/conserje/login') return <>{children}</>

  const initials = user?.nombre_completo?.split(' ').map((n: string) => n[0]).slice(0, 2).join('') || '?'
  const currentLabel = NAV_ITEMS.find(i => isActive(i.href, i.exact))?.label || 'Conserjeria'

  const SidebarContent = () => (
    <div className="flex flex-col h-full text-white bg-slate-950">
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800">
        <div className="w-9 h-9 bg-brand-700 rounded-xl flex items-center justify-center shrink-0">
          <ShieldCheck size={18} className="text-white" strokeWidth={2} />
        </div>
        <div>
          <span className="font-bold text-base tracking-tight block text-white">Conserjeria</span>
          <span className="text-slate-500 text-xs">ConectaAI</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {NAV_ITEMS.map(item => {
          const active = isActive(item.href, item.exact)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 border-l-2 ${
                active ? 'text-white bg-brand-500/15 border-brand-400' : 'text-slate-400 hover:text-white hover:bg-slate-900 border-transparent'
              }`}
            >
              <Icon size={18} strokeWidth={1.75} className="shrink-0" />
              <span>{item.label}</span>
              {active && <span className="ml-auto w-1.5 h-1.5 bg-brand-400 rounded-full" />}
            </Link>
          )
        })}
      </nav>

      <div className="shrink-0 border-t border-slate-800 p-3">
        {user && (
          <div className="flex items-center gap-3 px-3 py-3 mb-2 rounded-xl bg-slate-900 border border-slate-800">
            <div className="w-8 h-8 bg-brand-700 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{user.nombre_completo}</p>
              <p className="text-brand-400 text-xs">Conserje</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:bg-red-950/60 hover:text-red-400 transition-colors duration-150"
        >
          <LogOut size={16} className="shrink-0" />
          <span>Cerrar sesion</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      <aside className="hidden lg:flex w-56 flex-col shrink-0 border-r border-slate-800">
        <SidebarContent />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="fixed inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="relative z-50 flex w-64 flex-col border-r border-slate-800">
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 border-b border-slate-800 flex items-center gap-3 px-4 shrink-0 bg-slate-950/95">
          <button
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
            className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
          >
            <Menu size={20} />
          </button>
          <span className="text-slate-100 font-semibold text-sm flex-1">{currentLabel}</span>
          {user?.en_turno && (
            <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 text-xs font-medium mr-2">
              <CircleDot size={11} className="animate-pulse" />
              En turno{user?.turno_desde ? ' desde ' + new Date(user.turno_desde).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
          )}
          <button
            onClick={() => window.open('/conserje/camaras', '_blank')}
            title="Abrir monitor de camaras en nueva ventana"
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium transition-colors border border-slate-800 mr-2"
          >
            <Camera size={14} />
            Camaras
          </button>
          {user && (
            <div className="w-8 h-8 bg-brand-700 rounded-lg flex items-center justify-center text-white text-xs font-bold">
              {initials}
            </div>
          )}
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
