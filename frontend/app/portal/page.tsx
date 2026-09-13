'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Info { nombre: string; es_gimnasio: boolean; portal_label: string; unidad_label: string }

export default function PortalLanding() {
  const router = useRouter()
  const [info, setInfo] = useState<Info | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // Si ya tiene sesion, directo al inicio de la app
    try {
      if (localStorage.getItem('portal_token') && localStorage.getItem('portal_residente')) {
        router.replace('/portal/dashboard'); return
      }
    } catch { }
    setChecking(false)
    fetch('/api/portal/auth/info-publica').then(r => r.ok ? r.json() : null).then(d => d && setInfo(d)).catch(() => {})
  }, [router])

  if (checking) return <div className="min-h-screen bg-indigo-700" />

  const gym = !!info?.es_gimnasio
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-indigo-900 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center text-white">
        <div className="w-20 h-20 rounded-3xl bg-white/15 flex items-center justify-center text-4xl mb-5">{gym ? '🏋️' : '🏢'}</div>
        <p className="text-indigo-200 text-xs font-semibold tracking-widest uppercase mb-1">{info?.portal_label || 'Portal Residentes'}</p>
        <h1 className="text-3xl font-extrabold leading-tight">{info?.nombre || 'ConectaAI'}</h1>
        <p className="text-indigo-200 mt-3 max-w-xs text-sm">
          {gym ? 'Tu llave de acceso, membresía y avisos del gimnasio, desde tu teléfono.'
               : 'Gastos comunes, visitas, encomiendas, reservas y avisos de tu edificio, desde tu teléfono.'}
        </p>

        <div className="w-full max-w-xs mt-8 space-y-3">
          <a href="/portal/login" className="block w-full bg-white text-indigo-700 font-bold py-3.5 rounded-2xl shadow-lg hover:bg-indigo-50 transition">
            Ingresar con mi RUT
          </a>
          <a href="/portal/registro" className="block w-full bg-white/10 border border-white/30 text-white font-semibold py-3.5 rounded-2xl hover:bg-white/20 transition">
            Es mi primera vez — crear mi cuenta
          </a>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-3 max-w-xs w-full text-[11px] text-indigo-100">
          {(gym ? [['🔑', 'Mi llave QR'], ['💳', 'Membresía'], ['📢', 'Avisos']]
               : [['💰', 'Gastos comunes'], ['🚪', 'Visitas y QR'], ['📦', 'Encomiendas']]).map(([i, t]) => (
            <div key={t} className="bg-white/10 rounded-xl py-2.5"><div className="text-xl">{i}</div>{t}</div>
          ))}
        </div>
      </div>
      <p className="text-center text-indigo-300 text-[11px] pb-6">
        ¿Problemas para entrar? Pide a tu administración que verifique tu {info?.unidad_label?.toLowerCase() || 'departamento'} y RUT.
      </p>
    </div>
  )
}
