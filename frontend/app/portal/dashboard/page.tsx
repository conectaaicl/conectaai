'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePortalSession } from '../usePortalSession'
import { usePushSubscription } from '../usePushSubscription'
import BottomNav from '../components/BottomNav'
import {
  Wallet, Megaphone, MessageSquare, Wrench, FolderOpen,
  CalendarDays, QrCode, Vote, LogOut, Smartphone, X,
} from 'lucide-react'

const semColorMap: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  verde:    { bg:'bg-emerald-50', border:'border-emerald-300', text:'text-emerald-800', dot:'bg-emerald-500' },
  amarillo: { bg:'bg-amber-50',   border:'border-amber-300',   text:'text-amber-800',   dot:'bg-amber-500'   },
  rojo:     { bg:'bg-red-50',     border:'border-red-300',     text:'text-red-800',     dot:'bg-red-500'      },
}

function PWABanner() {
  const [show, setShow]     = useState(false)
  const [prompt, setPrompt] = useState<any>(null)
  const [ios, setIos]       = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(display-mode: standalone)').matches) return
    const ua = navigator.userAgent
    if (/iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream) {
      setIos(true); setShow(true); return
    }
    const handler = (e: any) => { e.preventDefault(); setPrompt(e); setShow(true) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!show) return null

  const install = async () => {
    if (prompt) {
      prompt.prompt()
      const { outcome } = await prompt.userChoice
      if (outcome === 'accepted') setShow(false)
    }
  }

  return (
    <div className="mx-4 mb-1 bg-brand-800 rounded-2xl p-4 text-white">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center shrink-0">
          <Smartphone size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Instala la app del portal</p>
          {ios ? (
            <p className="text-xs text-brand-100 mt-0.5">
              Toca Compartir y luego Agregar a inicio
            </p>
          ) : (
            <p className="text-xs text-brand-100 mt-0.5">Accede mas rapido desde tu celular</p>
          )}
          <div className="flex gap-2 mt-2.5">
            {!ios && (
              <button onClick={install}
                className="px-3 py-1.5 bg-white text-brand-800 text-xs rounded-lg font-semibold hover:bg-brand-50 transition-colors">
                Instalar ahora
              </button>
            )}
            <button onClick={() => setShow(false)}
              className="px-3 py-1.5 bg-white/10 text-white text-xs rounded-lg font-medium hover:bg-white/20 transition-colors">
              Ahora no
            </button>
          </div>
        </div>
        <button onClick={() => setShow(false)} aria-label="Cerrar" className="text-brand-200 hover:text-white shrink-0">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

export default function PortalDashboard() {
  const router = useRouter()
  const { residente, token, loading, logout, authFetch } = usePortalSession()
  usePushSubscription(token, residente)
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    if (!loading && !token) router.push('/portal/login')
  }, [loading, token, router])

  useEffect(() => {
    if (!token) return
    authFetch('/api/portal/dashboard').then(r => r.json()).then(setData).catch(() => {})
  }, [token])

  if (loading || !data) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-brand-700 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  const sem = semColorMap[data.semaforo] || semColorMap.verde
  const formatCLP = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')

  const quickAccess = [
    { label:'Estado de cuenta', href:'/portal/cuenta',      icon: Wallet,        badge: 0 },
    { label:'Mis avisos',       href:'/portal/avisos',      icon: Megaphone,     badge: data.avisos_no_leidos },
    { label:'Mensajes',         href:'/portal/mensajes',    icon: MessageSquare, badge: 0 },
    { label:'Incidencias',      href:'/portal/incidencias', icon: Wrench,        badge: 0 },
    { label:'Documentos',       href:'/portal/documentos',  icon: FolderOpen,    badge: 0 },
    { label:'Reservas',         href:'/portal/reservas',    icon: CalendarDays,  badge: 0 },
    { label:'QR de acceso',     href:'/portal/qr',          icon: QrCode,        badge: 0 },
    { label:'Votaciones',       href:'/portal/votar',       icon: Vote,          badge: 0 },
  ]

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-brand-800 text-white p-6 pt-8">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div>
            <p className="text-brand-200 text-sm">Bienvenido/a</p>
            <h1 className="text-xl font-bold">{data.residente?.nombre?.split(' ')[0]}</h1>
            {data.residente?.departamento_id && (
              <p className="text-brand-200 text-xs mt-0.5">Depto {data.residente.departamento_id}</p>
            )}
          </div>
          <button onClick={logout} className="flex items-center gap-1.5 text-brand-200 hover:text-white text-sm transition-colors">
            <LogOut size={15} />
            Salir
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto pt-4">
        <PWABanner/>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-4 space-y-4">
        <div className={`rounded-2xl border p-5 ${sem.bg} ${sem.border}`}>
          <div className="flex items-center gap-3">
            <div className={`w-3.5 h-3.5 rounded-full shrink-0 ${sem.dot}`}/>
            <div className="flex-1">
              <p className={`font-semibold text-sm ${sem.text}`}>{data.semaforo_msg}</p>
              {data.monto_pendiente > 0 && (
                <p className={`text-sm mt-0.5 ${sem.text} opacity-80`}>
                  Pendiente: {formatCLP(data.monto_pendiente)}
                </p>
              )}
            </div>
            {data.monto_pendiente > 0 && (
              <a href="/portal/cuenta"
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border ${sem.border} ${sem.text} hover:bg-white/70 transition-colors shrink-0`}>
                Pagar
              </a>
            )}
          </div>
          {data.semaforo === 'rojo' && (
            <p className="text-red-700 text-xs mt-3 bg-red-100 rounded-lg p-2.5 font-medium">
              Con 3 o mas meses de deuda la administracion puede solicitar corte de suministros segun el reglamento de copropiedad.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 font-medium">Gastos pendientes</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{data.gastos_pendientes}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 font-medium">Avisos sin leer</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{data.avisos_no_leidos}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {quickAccess.map(item => {
            const Icon = item.icon
            return (
              <a key={item.label} href={item.href}
                className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col items-start gap-2.5 relative hover:border-brand-300 hover:shadow-sm transition-all">
                {item.badge ? (
                  <span className="absolute top-3 right-3 bg-red-600 text-white text-[11px] rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center font-bold">
                    {item.badge}
                  </span>
                ) : null}
                <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center">
                  <Icon size={18} strokeWidth={1.75} />
                </div>
                <span className="text-xs font-semibold text-slate-700 leading-tight">{item.label}</span>
              </a>
            )
          })}
        </div>
      </div>

      <BottomNav/>
    </div>
  )
}
