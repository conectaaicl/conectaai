'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePortalSession } from '../usePortalSession'

interface Visita {
  id: number
  nombre_visitante: string
  rut_visitante?: string | null
  motivo?: string | null
  patente?: string | null
  estado?: string | null
  aprobado_por?: string | null
  motivo_rechazo?: string | null
  entrada_at?: string | null
  salida_at?: string | null
  registrado_por_nombre?: string | null
}

const MOTIVO: Record<string, string> = { visita: 'Visita', delivery: 'Delivery', proveedor: 'Proveedor', tecnico: 'Técnico', otro: 'Otro' }

function cuando(ts?: string | null) {
  if (!ts || ts === 'None') return ''
  const d = new Date(ts.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00'))
  if (isNaN(d.getTime())) return ts.slice(0, 16)
  const hoy = d.toDateString() === new Date().toDateString()
  return (hoy ? 'Hoy ' : d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }) + ' ') + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

function estadoDe(v: Visita) {
  if (v.estado === 'pendiente') return { t: 'Esperando aprobación', c: 'bg-amber-100 text-amber-700' }
  if (v.estado === 'rechazado') return { t: 'Rechazada', c: 'bg-red-100 text-red-700' }
  if (!v.salida_at || v.salida_at === 'None') return { t: 'En el edificio', c: 'bg-emerald-100 text-emerald-700' }
  return { t: 'Ya salió', c: 'bg-slate-100 text-slate-600' }
}

export default function PortalVisitas() {
  const router = useRouter()
  const { token, loading, logout, authFetch } = usePortalSession()
  const [items, setItems] = useState<Visita[]>([])
  const [fetching, setFetching] = useState(true)

  useEffect(() => { if (!loading && !token) router.push('/portal/login') }, [loading, token, router])
  useEffect(() => {
    if (!token) return
    const load = () => authFetch('/api/portal/mis-visitas').then(r => r.ok ? r.json() : []).then(d => setItems(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setFetching(false))
    load(); const iv = setInterval(load, 20000); return () => clearInterval(iv)
  }, [token, authFetch])

  if (loading || fetching) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const pendientes = items.filter(v => v.estado === 'pendiente')
  const resto = items.filter(v => v.estado !== 'pendiente')

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white px-4 pt-8 pb-6">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-indigo-200 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div>
              <h1 className="text-lg font-bold">Visitas a mi depto</h1>
              <p className="text-indigo-200 text-xs">Lo que registra conserjería para tu departamento</p>
            </div>
          </div>
          <button onClick={logout} className="text-indigo-200 hover:text-white text-xs">Salir</button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-3 space-y-4">
        {items.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-slate-500 text-sm">
            <div className="text-4xl mb-2">🚪</div>
            Aún no hay visitas registradas para tu departamento.
          </div>
        )}
        {pendientes.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-2">Esperando aprobación</h2>
            <div className="space-y-2">{pendientes.map(v => <Card key={v.id} v={v} />)}</div>
          </section>
        )}
        {resto.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Historial</h2>
            <div className="space-y-2">{resto.map(v => <Card key={v.id} v={v} />)}</div>
          </section>
        )}
        <p className="text-[11px] text-slate-400 text-center">Para pre-autorizar a alguien tú mismo, usa <a href="/portal/qr" className="text-indigo-600 font-semibold">QR Acceso</a>.</p>
      </div>
    </div>
  )
}

function Card({ v }: { v: Visita }) {
  const e = estadoDe(v)
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 truncate">{v.nombre_visitante}</p>
          <p className="text-xs text-slate-500">{MOTIVO[v.motivo || ''] || v.motivo || 'Visita'}{v.patente ? ` · ${v.patente}` : ''}</p>
        </div>
        <span className={`shrink-0 text-[11px] font-bold px-2 py-1 rounded-lg ${e.c}`}>{e.t}</span>
      </div>
      <div className="mt-2 text-xs text-slate-500 flex flex-wrap gap-x-3">
        <span>{cuando(v.entrada_at)}</span>
        {v.registrado_por_nombre && <span>Registró: {v.registrado_por_nombre}</span>}
        {v.estado === 'aprobado' && v.aprobado_por && <span>Aprobó: {v.aprobado_por}</span>}
        {v.estado === 'rechazado' && v.motivo_rechazo && <span className="text-red-600">Motivo: {v.motivo_rechazo}</span>}
      </div>
    </div>
  )
}
