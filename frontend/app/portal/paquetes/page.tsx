'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePortalSession } from '../usePortalSession'

interface Paquete {
  id: number
  carrier: string
  tracking_number?: string | null
  nombre_destinatario?: string | null
  descripcion?: string | null
  estado: string
  recibido_at?: string | null
  entregado_at?: string | null
  registrado_por_nombre?: string | null
}

const CARRIER: Record<string, string> = { chilexpress: 'Chilexpress', starken: 'Starken', correos: 'Correos de Chile', bluexpress: 'Blue Express', mercadolibre: 'Mercado Libre', amazon: 'Amazon', otro: 'Otro' }

function cuando(ts?: string | null) {
  if (!ts || ts === 'None') return ''
  const d = new Date(ts.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00'))
  if (isNaN(d.getTime())) return ts.slice(0, 16)
  const hoy = d.toDateString() === new Date().toDateString()
  return (hoy ? 'Hoy ' : d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }) + ' ') + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

export default function PortalPaquetes() {
  const router = useRouter()
  const { token, loading, logout, authFetch } = usePortalSession()
  const [items, setItems] = useState<Paquete[]>([])
  const [fetching, setFetching] = useState(true)

  useEffect(() => { if (!loading && !token) router.push('/portal/login') }, [loading, token, router])
  useEffect(() => {
    if (!token) return
    const load = () => authFetch('/api/portal/mis-paquetes').then(r => r.ok ? r.json() : []).then(d => setItems(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setFetching(false))
    load(); const iv = setInterval(load, 30000); return () => clearInterval(iv)
  }, [token, authFetch])

  if (loading || fetching) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const pendientes = items.filter(p => p.estado === 'pendiente')
  const entregados = items.filter(p => p.estado !== 'pendiente')

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white px-4 pt-8 pb-6">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-indigo-200 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div>
              <h1 className="text-lg font-bold">Mis encomiendas</h1>
              <p className="text-indigo-200 text-xs">Paquetes recibidos en conserjería</p>
            </div>
          </div>
          <button onClick={logout} className="text-indigo-200 hover:text-white text-xs">Salir</button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-3 space-y-4">
        {pendientes.length > 0 ? (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 text-amber-800 text-sm font-semibold">
            📦 Tienes {pendientes.length} paquete{pendientes.length === 1 ? '' : 's'} esperando en conserjería
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center text-slate-500 text-sm">
            <div className="text-4xl mb-2">📭</div>
            No tienes paquetes pendientes de retiro.
          </div>
        )}
        {pendientes.map(p => <Card key={p.id} p={p} />)}
        {entregados.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Ya retirados</h2>
            <div className="space-y-2">{entregados.map(p => <Card key={p.id} p={p} />)}</div>
          </section>
        )}
      </div>
    </div>
  )
}

function Card({ p }: { p: Paquete }) {
  const pend = p.estado === 'pendiente'
  return (
    <div className={`bg-white rounded-2xl border p-4 ${pend ? 'border-amber-200' : 'border-slate-100'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-800">{CARRIER[p.carrier] || p.carrier}</p>
          {p.tracking_number && <p className="text-xs text-slate-500 font-mono truncate">{p.tracking_number}</p>}
          {p.descripcion && <p className="text-xs text-slate-500">{p.descripcion}</p>}
        </div>
        <span className={`shrink-0 text-[11px] font-bold px-2 py-1 rounded-lg ${pend ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{pend ? 'En conserjería' : 'Retirado'}</span>
      </div>
      <div className="mt-2 text-xs text-slate-500 flex flex-wrap gap-x-3">
        <span>Recibido {cuando(p.recibido_at)}</span>
        {!pend && p.entregado_at && <span>Retirado {cuando(p.entregado_at)}</span>}
        {p.registrado_por_nombre && <span>Recibió: {p.registrado_por_nombre}</span>}
      </div>
    </div>
  )
}
