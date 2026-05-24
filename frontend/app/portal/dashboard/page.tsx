'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePortalSession } from '../usePortalSession'
import { usePushSubscription } from '../usePushSubscription'

const semColorMap: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  verde:    { bg:'bg-emerald-50', border:'border-emerald-400', text:'text-emerald-700', dot:'bg-emerald-400' },
  amarillo: { bg:'bg-amber-50',   border:'border-amber-400',   text:'text-amber-700',   dot:'bg-amber-400'   },
  rojo:     { bg:'bg-red-50',     border:'border-red-500',     text:'text-red-700',     dot:'bg-red-500'      },
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
    <div className="mx-4 mb-1 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-4 text-white shadow-lg">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl">📱</div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">Instalar App del Portal</p>
          {ios ? (
            <p className="text-xs text-indigo-200 mt-0.5">
              Toca <strong>Compartir</strong> → <strong>Agregar a inicio</strong>
            </p>
          ) : (
            <p className="text-xs text-indigo-200 mt-0.5">Accede más rápido desde tu celular</p>
          )}
          <div className="flex gap-2 mt-2.5">
            {!ios && (
              <button onClick={install}
                className="px-3 py-1.5 bg-white text-indigo-700 text-xs rounded-lg font-bold hover:bg-indigo-50 transition">
                Instalar ahora
              </button>
            )}
            <button onClick={() => setShow(false)}
              className="px-3 py-1.5 bg-white/20 text-white text-xs rounded-lg font-medium hover:bg-white/30 transition">
              Ahora no
            </button>
          </div>
        </div>
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
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  const sem = semColorMap[data.semaforo] || semColorMap.verde
  const formatCLP = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white p-6 pt-8">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div>
            <p className="text-indigo-200 text-sm">Bienvenido/a</p>
            <h1 className="text-xl font-bold">{data.residente?.nombre?.split(' ')[0]}</h1>
            {data.residente?.departamento_id && (
              <p className="text-indigo-200 text-xs mt-0.5">Depto {data.residente.departamento_id}</p>
            )}
          </div>
          <button onClick={logout} className="text-indigo-200 hover:text-white text-sm transition-colors">
            Salir
          </button>
        </div>
      </div>

      {/* PWA install banner */}
      <div className="max-w-lg mx-auto pt-4">
        <PWABanner/>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-4 space-y-4">
        {/* Semáforo estado de cuenta */}
        <div className={`rounded-2xl border-2 p-5 ${sem.bg} ${sem.border}`}>
          <div className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded-full flex-shrink-0 ${sem.dot}`}/>
            <div className="flex-1">
              <p className={`font-semibold ${sem.text}`}>{data.semaforo_msg}</p>
              {data.monto_pendiente > 0 && (
                <p className={`text-sm mt-0.5 ${sem.text} opacity-80`}>
                  Pendiente: {formatCLP(data.monto_pendiente)}
                </p>
              )}
            </div>
            {data.monto_pendiente > 0 && (
              <a href="/portal/cuenta"
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white/60 border border-current hover:bg-white/80 transition-colors">
                Pagar
              </a>
            )}
          </div>
          {data.semaforo === 'rojo' && (
            <p className="text-red-600 text-xs mt-3 bg-red-100 rounded-lg p-2 font-medium">
              Con 3 o más meses de deuda la administración puede solicitar corte de suministros según el reglamento de copropiedad.
            </p>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <p className="text-xs text-slate-500">Gastos pendientes</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{data.gastos_pendientes}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 p-4 relative">
            <p className="text-xs text-slate-500">Avisos sin leer</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{data.avisos_no_leidos}</p>
          </div>
        </div>

        {/* Quick access grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label:'Estado de cuenta', href:'/portal/cuenta',     icon:'💰', bg:'bg-indigo-50 border-indigo-100' },
            { label:'Mis avisos',       href:'/portal/avisos',     icon:'📢', bg:'bg-amber-50 border-amber-100',   badge: data.avisos_no_leidos },
            { label:'Mensajes',         href:'/portal/mensajes',   icon:'💬', bg:'bg-sky-50 border-sky-100' },
            { label:'Incidencias',      href:'/portal/incidencias',icon:'🔧', bg:'bg-orange-50 border-orange-100' },
            { label:'Documentos',       href:'/portal/documentos', icon:'📁', bg:'bg-violet-50 border-violet-100' },
            { label:'Reservas',         href:'/portal/reservas',   icon:'📅', bg:'bg-emerald-50 border-emerald-100' },
            { label:'QR Acceso',        href:'/portal/qr',         icon:'🔑', bg:'bg-slate-50 border-slate-200' },
            { label:'Votar',            href:'/portal/votar',      icon:'🗳️', bg:'bg-pink-50 border-pink-100' },
          ].map(item => (
            <a key={item.label + item.href} href={item.href}
              className={`${item.bg} border rounded-2xl p-4 flex flex-col items-start relative hover:opacity-80 transition-opacity`}>
              {'badge' in item && item.badge ? (
                <span className="absolute top-3 right-3 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {item.badge}
                </span>
              ) : null}
              <span className="text-2xl mb-2">{item.icon}</span>
              <span className="text-xs font-semibold text-slate-700 leading-tight">{item.label}</span>
            </a>
          ))}
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex z-40">
        {[
          { href:'/portal/dashboard',  icon:'🏠', label:'Inicio'     },
          { href:'/portal/cuenta',     icon:'💰', label:'Cuenta'     },
          { href:'/portal/mensajes',   icon:'💬', label:'Mensajes'   },
          { href:'/portal/incidencias',icon:'🔧', label:'Incidencias'},
          { href:'/portal/avisos',     icon:'📢', label:'Avisos'     },
        ].map(n => (
          <a key={n.href} href={n.href}
            className="flex-1 flex flex-col items-center py-3 text-slate-500 hover:text-indigo-600 transition-colors">
            <span className="text-xl">{n.icon}</span>
            <span className="text-[10px] mt-0.5">{n.label}</span>
          </a>
        ))}
      </nav>
    </div>
  )
}
