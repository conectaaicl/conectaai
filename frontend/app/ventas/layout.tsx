'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { MapPin, PlusCircle, Building2, Kanban, Gift, Presentation, Blinds, FileText, Store, BarChart3, LogOut, Wifi, WifiOff } from 'lucide-react'
import { vfetch } from './lib'

const NAV = [
  { href: '/ventas/hoy',       label: 'Mi día',       icon: MapPin },
  { href: '/ventas/visita',    label: 'Nueva visita', icon: PlusCircle },
  { href: '/ventas/edificios', label: 'Edificios',    icon: Building2 },
  { href: '/ventas/pipeline',  label: 'Pipeline',     icon: Kanban },
  { href: '/ventas/propuestas', label: 'Propuestas',  icon: FileText },
  { href: '/ventas/demos',     label: 'Demos',        icon: Gift },
  { href: '/ventas/negocios',  label: 'Negocios',     icon: Store },
  { href: '/ventas/presentaciones', label: 'Presentaciones', icon: Presentation },
  { href: '/ventas/cortinas',  label: 'Cortinas',     icon: Blinds },
  { href: '/ventas/resultados', label: 'Resultados',  icon: BarChart3 },
]

export default function VentasLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [me, setMe] = useState<any>(null)
  const [online, setOnline] = useState(true)
  const isLogin = pathname === '/ventas/login'
  const isPublic = isLogin

  useEffect(() => {
    if (isPublic) return
    vfetch('/auth/me').then(r => r.ok ? r.json() : null).then(d => { if (!d) router.replace('/ventas/login'); else setMe(d) }).catch(() => {})
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    setOnline(navigator.onLine); window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  useEffect(() => {
    const l = document.createElement('link'); l.rel = 'manifest'; l.href = '/manifest-ventas.json'; document.head.appendChild(l)
    return () => { document.head.removeChild(l) }
  }, [])

  if (isPublic) return <div className="min-h-screen bg-[#F3F6F5] text-[#0B1F2A]">{children}</div>

  async function salir() { await vfetch('/auth/logout', { method: 'POST' }); router.replace('/ventas/login') }

  return (
    <div className="min-h-screen bg-[#F3F6F5] text-[#0B1F2A] md:flex">
      <aside className="hidden md:flex md:flex-col w-56 shrink-0 bg-white border-r border-[#DDE4E6] min-h-screen sticky top-0 p-4">
        <div className="px-2 pb-5 flex items-center gap-3">{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/uploads/branding/conectaai/marca.png" alt="ConectaAI" width={44} height={33} className="w-11 h-auto" /><div><div className="font-extrabold text-lg leading-tight">ConectaAI</div><div className="text-xs text-[#7A8F98] font-medium">Ventas Terreno</div></div></div>
        <nav className="flex flex-col gap-1">
          {NAV.map(n => { const on = pathname.startsWith(n.href); const I = n.icon; return (
            <Link key={n.href} href={n.href} className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold ${on ? 'bg-[#DDF4F0] text-[#0F766E]' : 'text-[#35505C] hover:bg-slate-50'}`}><I size={18} />{n.label}</Link>) })}
        </nav>
        <div className="mt-auto pt-4 border-t border-[#DDE4E6] text-xs text-[#7A8F98]">
          <div className="font-semibold text-[#0B1F2A] text-sm">{me?.nombre || '…'}</div><div>{me?.zona || me?.email}</div>
          <div className={`mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold ${online ? 'bg-[#DDF4F0] text-[#0F766E]' : 'bg-amber-100 text-amber-800'}`}>{online ? <Wifi size={12} /> : <WifiOff size={12} />}{online ? 'Conectado' : 'Sin señal'}</div>
          <button onClick={salir} className="mt-3 flex items-center gap-2 text-[#7A8F98] hover:text-rose-600"><LogOut size={14} /> Salir</button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 pb-24 md:pb-8">{children}</main>
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-[#DDE4E6] flex overflow-x-auto z-40" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {NAV.map(n => { const on = pathname.startsWith(n.href); const I = n.icon; return (
          <Link key={n.href} href={n.href} className={`flex flex-col items-center gap-0.5 py-2 min-w-[72px] shrink-0 text-[10px] font-semibold ${on ? 'text-[#0F766E]' : 'text-[#7A8F98]'}`}><I size={22} strokeWidth={on ? 2.4 : 1.8} />{n.label}</Link>) })}
      </nav>
    </div>
  )
}
