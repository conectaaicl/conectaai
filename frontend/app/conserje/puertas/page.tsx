'use client'
import { useState, useEffect, useCallback } from 'react'

interface Puerta {
  id: number
  nombre: string
  ubicacion: string
  tipo: string
  estado: string
  modo: string
  activa: boolean
}

type StyleSet = { label: string; bg: string; border: string; text: string; dot: string }

const MODE_STYLES: Record<string, StyleSet> = {
  libre_paso: { label: 'Paso Libre', bg: 'bg-blue-500/10',    border: 'border-blue-500/40',    text: 'text-blue-300',    dot: 'bg-blue-400 animate-pulse' },
  bloqueada:  { label: 'Bloqueada',  bg: 'bg-red-500/10',     border: 'border-red-500/40',     text: 'text-red-300',     dot: 'bg-red-400' },
}

const STATE_STYLES: Record<string, StyleSet> = {
  abierta:  { label: 'Abierta',   bg: 'bg-emerald-500/10', border: 'border-emerald-500/40', text: 'text-emerald-300', dot: 'bg-emerald-400 animate-pulse' },
  cerrada:  { label: 'Cerrada',   bg: 'bg-slate-800',       border: 'border-slate-700/60',  text: 'text-slate-300',   dot: 'bg-slate-500' },
  error:    { label: 'Error',     bg: 'bg-red-500/10',      border: 'border-red-500/40',    text: 'text-red-300',     dot: 'bg-red-400 animate-pulse' },
}

const FALLBACK: StyleSet = { label: 'Sin senal', bg: 'bg-yellow-500/10', border: 'border-yellow-500/40', text: 'text-yellow-300', dot: 'bg-yellow-400' }

function cardStyle(p: Puerta): StyleSet {
  return MODE_STYLES[p.modo] ?? STATE_STYLES[p.estado] ?? FALLBACK
}

const ACTIONS: { accion: string; label: string; color: string; icon: React.ReactNode }[] = [
  {
    accion: 'libre_paso',
    label: 'Paso Libre',
    color: 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 shadow-blue-900/40',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
      </svg>
    ),
  },
  {
    accion: 'abrir',
    label: 'Abrir',
    color: 'bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 shadow-emerald-900/40',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    accion: 'cerrar',
    label: 'Cerrar',
    color: 'bg-slate-700 hover:bg-slate-600 active:bg-slate-800 shadow-black/40',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zM10 7a2 2 0 114 0v3H10V7z" />
      </svg>
    ),
  },
  {
    accion: 'bloquear',
    label: 'Bloquear',
    color: 'bg-rose-700 hover:bg-rose-600 active:bg-rose-800 shadow-red-900/40',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
  },
]

export default function ConserjeAccesosPuertas() {
  const [puertas, setPuertas] = useState<Puerta[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)

  const tid = () =>
    typeof window !== 'undefined' ? (localStorage.getItem('current_condominio_id') || '1') : '1'

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/condominios/puertas?tenant_id=' + tid(), { credentials: 'include' })
      if (r.ok) setPuertas(await r.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const iv = setInterval(load, 15000)
    return () => clearInterval(iv)
  }, [load])

  async function comando(id: number, accion: string) {
    setBusy(id)
    try {
      const r = await fetch('/api/condominios/puertas/' + id + '/comando', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion }),
      })
      const d = await r.json()
      setToast({ ok: r.ok, msg: d.mensaje || (r.ok ? 'Comando enviado' : 'Error al ejecutar') })
      setTimeout(() => setToast(null), 4000)
      setTimeout(load, 1500)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="p-4 space-y-4">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-2xl text-sm font-semibold transition-all ${toast.ok ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast.ok ? '✓' : '✗'} {toast.msg}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && puertas.length === 0 && (
        <p className="text-center text-slate-500 py-16">No hay puertas configuradas</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {puertas.map(p => {
          const st = cardStyle(p)
          const isBusy = busy === p.id
          return (
            <div key={p.id} className={`rounded-2xl border p-5 transition-all ${st.bg} ${st.border}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${st.dot}`} />
                    <h3 className={`font-bold text-lg leading-tight ${st.text}`}>{p.nombre}</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 ml-5">
                    {p.ubicacion} <span className="capitalize">· {p.tipo}</span>
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-xl text-xs font-bold border ${st.bg} ${st.text} ${st.border}`}>
                  {st.label}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {ACTIONS.map(a => (
                  <button
                    key={a.accion}
                    onClick={() => comando(p.id, a.accion)}
                    disabled={isBusy}
                    className={`flex flex-col items-center justify-center gap-1.5 h-20 rounded-2xl ${a.color} disabled:opacity-40 text-white font-bold transition-all active:scale-95 shadow-lg`}
                  >
                    {a.icon}
                    <span className="text-xs font-bold">{isBusy ? '...' : a.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {!loading && puertas.length > 0 && (
        <p className="text-center text-xs text-slate-600 pt-2">Auto-actualiza cada 15 seg</p>
      )}
    </div>
  )
}
