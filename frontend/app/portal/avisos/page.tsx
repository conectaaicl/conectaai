'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePortalSession } from '../usePortalSession'

interface Aviso {
  id: number
  titulo: string
  cuerpo: string
  tipo: string
  fecha: string | null
  leido: boolean
}

const tipoBadge: Record<string,string> = {
  informativo: 'bg-blue-100 text-blue-700',
  urgente: 'bg-red-100 text-red-700',
  mantencion: 'bg-amber-100 text-amber-700',
  reserva: 'bg-emerald-100 text-emerald-700',
}

function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex">
      {[
        {href:'/portal/dashboard', icon:'🏠', label:'Inicio'},
        {href:'/portal/cuenta', icon:'💰', label:'Cuenta'},
        {href:'/portal/avisos', icon:'📢', label:'Avisos'},
        {href:'/portal/qr', icon:'🔑', label:'QR'}
      ].map(n => (
        <a key={n.href} href={n.href}
          className="flex-1 flex flex-col items-center py-3 text-slate-500 hover:text-indigo-600 transition-colors">
          <span className="text-xl">{n.icon}</span>
          <span className="text-xs mt-0.5">{n.label}</span>
        </a>
      ))}
    </nav>
  )
}

export default function PortalAvisos() {
  const router = useRouter()
  const { token, loading, authFetch } = usePortalSession()
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [expanded, setExpanded] = useState<number|null>(null)
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    if (!loading && !token) router.push('/portal/login')
  }, [loading, token, router])

  useEffect(() => {
    if (!token) return
    authFetch('/api/portal/avisos')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setAvisos(data) })
      .catch(() => {})
      .finally(() => setLoadingData(false))
  }, [token])

  const handleExpand = async (aviso: Aviso) => {
    const isOpen = expanded === aviso.id
    setExpanded(isOpen ? null : aviso.id)
    if (!isOpen && !aviso.leido) {
      try {
        await authFetch('/api/portal/avisos/' + aviso.id + '/leer', { method: 'POST' })
        setAvisos(prev => prev.map(a => a.id === aviso.id ? {...a, leido: true} : a))
      } catch {}
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  const noLeidos = avisos.filter(a => !a.leido).length

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-white border-b border-slate-100 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <a href="/portal/dashboard" className="text-slate-400 hover:text-slate-700 text-lg">←</a>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-800">Mis Avisos</h1>
            {noLeidos > 0 && <p className="text-xs text-indigo-500">{noLeidos} sin leer</p>}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-3">
        {loadingData && (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"/>
          </div>
        )}

        {avisos.map(aviso => (
          <div
            key={aviso.id}
            className={`rounded-2xl border overflow-hidden cursor-pointer transition-colors ${
              aviso.leido ? 'bg-white border-slate-100' : 'bg-indigo-50 border-indigo-200'
            }`}
            onClick={() => handleExpand(aviso)}
          >
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tipoBadge[aviso.tipo] || 'bg-slate-100 text-slate-600'}`}>
                      {aviso.tipo}
                    </span>
                    {!aviso.leido && <span className="w-2 h-2 bg-indigo-500 rounded-full inline-block"/>}
                  </div>
                  <p className={`text-sm font-semibold ${aviso.leido ? 'text-slate-700' : 'text-slate-900'}`}>{aviso.titulo}</p>
                  {aviso.fecha && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(aviso.fecha).toLocaleDateString('es-CL', {day:'numeric',month:'short',year:'numeric'})}
                    </p>
                  )}
                </div>
                <span className="text-slate-400 text-xs">{expanded === aviso.id ? '▲' : '▼'}</span>
              </div>
            </div>
            {expanded === aviso.id && (
              <div className="border-t border-slate-100 px-4 pb-4 pt-2">
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{aviso.cuerpo}</p>
              </div>
            )}
          </div>
        ))}

        {!loadingData && avisos.length === 0 && (
          <div className="text-center py-12 text-slate-400">No hay avisos disponibles</div>
        )}
      </div>

      <BottomNav/>
    </div>
  )
}
