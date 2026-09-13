'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePortalSession } from '../usePortalSession'

interface Votacion { id: number; titulo: string; descripcion?: string | null; estado: string; opciones: string[]; fecha_cierre?: string | null; created_at?: string | null; ya_vote: boolean }

export default function PortalVotaciones() {
  const router = useRouter()
  const { token, loading, logout, authFetch } = usePortalSession()
  const [items, setItems] = useState<Votacion[]>([])
  const [fetching, setFetching] = useState(true)

  useEffect(() => { if (!loading && !token) router.push('/portal/login') }, [loading, token, router])
  useEffect(() => {
    if (!token) return
    authFetch('/api/portal/votaciones').then(r => r.ok ? r.json() : []).then(d => setItems(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setFetching(false))
  }, [token, authFetch])

  if (loading || fetching) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>

  const activas = items.filter(v => v.estado === 'activa')
  const cerradas = items.filter(v => v.estado !== 'activa')

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white px-4 pt-8 pb-6">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/portal/dashboard')} className="text-indigo-200 hover:text-white"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
            <div><h1 className="text-lg font-bold">Votaciones</h1><p className="text-indigo-200 text-xs">Un voto por departamento</p></div>
          </div>
          <button onClick={logout} className="text-indigo-200 hover:text-white text-xs">Salir</button>
        </div>
      </div>
      <div className="max-w-lg mx-auto px-4 -mt-3 space-y-4">
        {items.length === 0 && <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-slate-500 text-sm"><div className="text-4xl mb-2">🗳️</div>No hay votaciones por ahora.</div>}
        {activas.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-2">Abiertas</h2>
            <div className="space-y-2">{activas.map(v => (
              <button key={v.id} onClick={() => router.push('/portal/votar/' + v.id)} className="w-full text-left bg-white rounded-2xl border border-slate-100 p-4 hover:border-indigo-300">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-slate-800">{v.titulo}</p>
                  <span className={`shrink-0 text-[11px] font-bold px-2 py-1 rounded-lg ${v.ya_vote ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>{v.ya_vote ? 'Ya votaste' : 'Votar'}</span>
                </div>
                {v.descripcion && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{v.descripcion}</p>}
                {v.fecha_cierre && <p className="text-[11px] text-slate-400 mt-1">Cierra {v.fecha_cierre.slice(0, 10)}</p>}
              </button>
            ))}</div>
          </section>
        )}
        {cerradas.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Cerradas</h2>
            <div className="space-y-2">{cerradas.map(v => (
              <button key={v.id} onClick={() => router.push('/portal/votar/' + v.id)} className="w-full text-left bg-white rounded-2xl border border-slate-100 p-4 opacity-80">
                <p className="font-semibold text-slate-700">{v.titulo}</p><p className="text-[11px] text-slate-400 mt-1">Ver resultados →</p>
              </button>
            ))}</div>
          </section>
        )}
      </div>
    </div>
  )
}
