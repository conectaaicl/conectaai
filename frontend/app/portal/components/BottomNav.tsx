'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Wallet, MessageSquare, Wrench, Bell } from 'lucide-react'

const ITEMS = [
  { href: '/portal/dashboard',   icon: Home,          label: 'Inicio' },
  { href: '/portal/cuenta',      icon: Wallet,         label: 'Cuenta' },
  { href: '/portal/mensajes',    icon: MessageSquare, label: 'Mensajes' },
  { href: '/portal/incidencias', icon: Wrench,         label: 'Reportes' },
  { href: '/portal/avisos',      icon: Bell,          label: 'Avisos' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 flex"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {ITEMS.map(item => {
        const active = pathname === item.href || pathname?.startsWith(item.href + '/')
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex-1 flex flex-col items-center gap-1 py-2.5 min-h-[56px] justify-center relative"
          >
            {active && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-brand-700" />
            )}
            <Icon
              size={22}
              strokeWidth={active ? 2.25 : 1.75}
              className={active ? 'text-brand-700' : 'text-slate-400'}
            />
            <span className={`text-[11px] leading-none ${active ? 'text-brand-700 font-semibold' : 'text-slate-500 font-medium'}`}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
