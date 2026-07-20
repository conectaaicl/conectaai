'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePortalSession } from '../usePortalSession'
import BottomNav from '../components/BottomNav'
import PortalHeader from '../components/PortalHeader'
import { ChevronDown, ChevronUp, Megaphone } from 'lucide-react'

interface Aviso {
  id: number
  titulo: string
  cuerpo: string
  tipo: string
  fecha: string | null
  leido: boolean
}

const tipoBadge: Record<string,string> = {
  informativo: 'bg-accent-100 text-accent-800',
  urgente: 'bg-red-100 text-red-700',
  mantencion: 'bg-amber-100 text-amber-800',
  reserva: 'bg-emerald-100 text-emerald-700',
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
      <div className="w-8 h-8 border-4 border-brand-700 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  const noLeidos = avisos.filter(a => !a.leido).length

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <PortalHeader title="Mis avisos" subtitle={noLeidos > 0 ? `${noLeidos} sin leer` : undefined} />

      <div className="max-w-lg mx-auto p-4 space-y-3">
        {loadingData && (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-4 border-brand-600 border-t-transparent rounded-full animate-spin"/>
          </div>
        )}

        {avisos.map(aviso => (
          <div
            key={aviso.id}
            className={`rounded-2xl border overflow-hidden cursor-pointer transition-colors ${
              aviso.leido ? 'bg-white border-slate-200' : 'bg-brand-50 border-brand-200'
            }`}
            onClick={() => handleExpand(aviso)}
          >
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${tipoBadge[aviso.tipo] || 'bg-slate-100 text-slate-600'}`}>
                      {aviso.tipo}
                    </span>
                    {!aviso.leido && <span className="w-2 h-2 bg-brand-600 rounded-full inline-block" aria-label="No leido" />}
                  </div>
                  <p className={`text-sm font-semibold ${aviso.leido ? 'text-slate-700' : 'text-slate-900'}`}>{aviso.titulo}</p>
                  {aviso.fecha && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(aviso.fecha).toLocaleDateString('es-CL', {day:'numeric',month:'short',year:'numeric'})}
                    </p>
                  )}
                </div>
                {expanded === aviso.id
                  ? <ChevronUp size={16} className="text-slate-400 shrink-0 mt-0.5" />
                  : <ChevronDown size={16} className="text-slate-400 shrink-0 mt-0.5" />}
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
          <div className="text-center py-16 text-slate-400 flex flex-col items-center gap-2">
            <Megaphone size={28} strokeWidth={1.5} />
            <p className="text-sm">No hay avisos por ahora</p>
          </div>
        )}
      </div>

      <BottomNav/>
    </div>
  )
}
