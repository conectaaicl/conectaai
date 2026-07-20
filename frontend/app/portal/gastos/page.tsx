'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { usePortalSession } from '../usePortalSession'

function formatCLP(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CL')
}

interface Gasto {
  id: number
  periodo: string | null
  descripcion: string | null
  monto_total: number
  vencimiento: string | null
  estado: string
  desglose: Record<string, any> | null
}

interface Toast {
  id: number
  msg: string
  type: 'error' | 'ok'
}

// ── color palette by estado ────────────────────────────────────────────────
const colorMap: Record<string, { bg: string; border: string; badge: string }> = {
  pendiente: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
  },
  atrasado: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-700',
  },
  pagado: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  exento: {
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    badge: 'bg-slate-100 text-slate-500',
  },
}

function fallbackColors(estado: string) {
  return colorMap[estado] || { bg: 'bg-white', border: 'border-slate-200', badge: 'bg-slate-100 text-slate-600' }
}

// ── Spinner SVG ────────────────────────────────────────────────────────────
function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={'animate-spin ' + (className || 'w-3.5 h-3.5')}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

// ── Payment buttons for a single gasto ────────────────────────────────────
function PaymentButtons({
  gasto,
  authFetch,
  onToast,
}: {
  gasto: Gasto
  authFetch: (url: string, init?: RequestInit) => Promise<Response>
  onToast: (msg: string, type?: 'error' | 'ok') => void
}) {
  const [loadingFlow, setLoadingFlow] = useState(false)
  const [loadingMp, setLoadingMp] = useState(false)

  async function handleFlow() {
    setLoadingFlow(true)
    try {
      const r = await authFetch('/api/pagos/flow/create-gasto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gasto_comun_id: gasto.id }),
      })
      if (!r.ok) {
        let msg = 'Flow no configurado'
        try {
          const d = await r.json()
          msg = d.detail || d.message || msg
        } catch {
          // ignore parse error
        }
        onToast(msg, 'error')
        return
      }
      const d = await r.json()
      if (d.url) {
        window.open(d.url, '_blank', 'noopener,noreferrer')
      } else {
        onToast('No se recibio URL de pago', 'error')
      }
    } catch {
      onToast('Error de conexion con Flow', 'error')
    } finally {
      setLoadingFlow(false)
    }
  }

  async function handleMp() {
    setLoadingMp(true)
    try {
      const r = await authFetch('/api/pagos/mp/create-gasto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gasto_comun_id: gasto.id }),
      })
      if (!r.ok) {
        let msg = 'Mercado Pago no configurado'
        try {
          const d = await r.json()
          msg = d.detail || d.message || msg
        } catch {
          // ignore parse error
        }
        onToast(msg, 'error')
        return
      }
      const d = await r.json()
      if (d.init_point) {
        window.open(d.init_point, '_blank', 'noopener,noreferrer')
      } else {
        onToast('No se recibio URL de Mercado Pago', 'error')
      }
    } catch {
      onToast('Error de conexion con Mercado Pago', 'error')
    } finally {
      setLoadingMp(false)
    }
  }

  return (
    <div className="flex items-center gap-2 pt-3 mt-3 border-t border-slate-100">
      <span className="text-xs text-slate-500 mr-1">Pagar con:</span>
      <button
        onClick={handleFlow}
        disabled={loadingFlow || loadingMp}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
      >
        {loadingFlow ? <Spinner /> : '💳'}
        Flow
      </button>
      <button
        onClick={handleMp}
        disabled={loadingFlow || loadingMp}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-sky-500 text-white hover:bg-sky-600 disabled:opacity-60 transition-colors"
      >
        {loadingMp ? <Spinner /> : '🛒'}
        MP
      </button>
    </div>
  )
}

// ── Toast stack ─────────────────────────────────────────────────────────
function ToastStack({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={
            'px-4 py-2.5 rounded-xl shadow-xl text-sm font-medium text-white pointer-events-auto ' +
            (t.type === 'error' ? 'bg-red-600' : 'bg-emerald-600')
          }
        >
          {t.msg}
        </div>
      ))}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function PortalGastosPage() {
  const router = useRouter()
  const { residente, token, authFetch, loading: sessionLoading } = usePortalSession()
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    if (!sessionLoading && !token) router.push('/portal/login')
  }, [sessionLoading, token, router])

  const loadGastos = useCallback(async () => {
    if (!residente?.id) return
    setLoading(true)
    try {
      const r = await authFetch('/api/portal/cuenta')
      if (r.ok) {
        const data = await r.json()
        // Accept either { gastos: [] } or a plain array
        setGastos(Array.isArray(data) ? data : (Array.isArray(data.gastos) ? data.gastos : []))
      }
    } catch {
      setGastos([])
    } finally {
      setLoading(false)
    }
  }, [residente, authFetch])

  useEffect(() => {
    loadGastos()
  }, [loadGastos])

  function addToast(msg: string, type: 'error' | 'ok' = 'ok') {
    const id = Date.now()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }

  if (sessionLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const pendientes = gastos.filter(g => g.estado === 'pendiente' || g.estado === 'atrasado')
  const totalPendiente = pendientes.reduce((s, g) => s + Number(g.monto_total), 0)

  // Group by periodo
  const byPeriodo: Record<string, Gasto[]> = {}
  for (const g of gastos) {
    const key = g.periodo || 'Sin periodo'
    if (!byPeriodo[key]) byPeriodo[key] = []
    byPeriodo[key].push(g)
  }
  const sortedPeriodos = Object.keys(byPeriodo).sort((a, b) => b.localeCompare(a))

  function toggleExpand(id: number) {
    setExpanded(prev => (prev === id ? null : id))
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white px-4 pt-8 pb-6">
        <div className="max-w-lg mx-auto">
          <button
            onClick={() => router.push('/portal/dashboard')}
            className="flex items-center gap-1.5 text-indigo-200 hover:text-white text-sm mb-4 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver al inicio
          </button>
          <h1 className="text-2xl font-bold">Gastos Comunes</h1>
          <p className="text-indigo-200 text-sm mt-1">{residente?.nombre_completo}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-4">
        {/* Total pendiente card */}
        {totalPendiente > 0 ? (
          <div className="bg-white rounded-2xl border-2 border-amber-300 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Total Pendiente</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">{formatCLP(totalPendiente)}</p>
                <p className="text-sm text-slate-500 mt-0.5">
                  {pendientes.length} gasto{pendientes.length !== 1 ? 's' : ''} por pagar
                </p>
              </div>
              <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center">
                <svg className="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                </svg>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border-2 border-emerald-300 p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-emerald-700">Al dia con tus gastos</p>
                <p className="text-sm text-slate-500 mt-0.5">No tienes cobros pendientes</p>
              </div>
            </div>
          </div>
        )}

        {/* Gastos list */}
        {gastos.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
            <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
            </svg>
            <p className="text-slate-500 text-sm">No tienes gastos registrados</p>
          </div>
        ) : sortedPeriodos.map(periodo => {
          const pGastos = byPeriodo[periodo]
          const pTotal = pGastos.reduce((s, g) => s + Number(g.monto_total), 0)
          const allPaid = pGastos.every(g => g.estado === 'pagado' || g.estado === 'exento')

          return (
            <div key={periodo} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
              {/* Period header */}
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <span className="font-mono font-bold text-slate-700 text-sm">{periodo}</span>
                  <span className="ml-2 text-xs text-slate-400">
                    {pGastos.length} gasto{pGastos.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-700">{formatCLP(pTotal)}</span>
                  {allPaid && (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                      Pagado
                    </span>
                  )}
                </div>
              </div>

              {/* Gasto rows */}
              <div className="divide-y divide-slate-50">
                {pGastos.map(g => {
                  const colors = fallbackColors(g.estado)
                  const isOpen = expanded === g.id
                  const canPay = g.estado === 'pendiente' || g.estado === 'atrasado'

                  return (
                    <div key={g.id} className="px-4 py-3">
                      {/* Main row — clickable to expand */}
                      <button
                        onClick={() => toggleExpand(g.id)}
                        className="w-full text-left"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">
                              {g.descripcion || 'Gasto comun'}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors.badge}`}>
                                {g.estado}
                              </span>
                              {g.vencimiento && g.estado !== 'pagado' && g.estado !== 'exento' && (
                                <span className="text-xs text-slate-400">
                                  Vence: {new Date(g.vencimiento).toLocaleDateString('es-CL')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <p className="font-bold text-slate-800">{formatCLP(Number(g.monto_total))}</p>
                            <svg
                              className={'w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ' + (isOpen ? 'rotate-180' : '')}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </button>

                      {/* Expanded section */}
                      {isOpen && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          {/* Desglose */}
                          {g.desglose && Object.keys(g.desglose).length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Desglose</p>
                              <div className="space-y-1">
                                {Object.entries(g.desglose).map(([concepto, monto]) => (
                                  <div key={concepto} className="flex justify-between text-xs text-slate-600">
                                    <span>{concepto}</span>
                                    <span className="font-medium">{formatCLP(Number(monto))}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Payment buttons — only for payable states */}
                          {canPay && (
                            <PaymentButtons
                              gasto={g}
                              authFetch={authFetch}
                              onToast={addToast}
                            />
                          )}

                          {/* Paid message */}
                          {g.estado === 'pagado' && (
                            <div className="flex items-center gap-2 pt-3 mt-3 border-t border-slate-100">
                              <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span className="text-xs text-emerald-600 font-medium">Gasto pagado</span>
                            </div>
                          )}

                          {/* Exento message */}
                          {g.estado === 'exento' && (
                            <div className="flex items-center gap-2 pt-3 mt-3 border-t border-slate-100">
                              <span className="text-xs text-slate-500 font-medium">Exento de pago</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Toast stack */}
      <ToastStack toasts={toasts} />

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex">
        {[
          {
            href: '/portal/dashboard',
            label: 'Inicio',
            active: false,
            icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
          },
          {
            href: '/portal/cuenta',
            label: 'Cuenta',
            active: false,
            icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z',
          },
          {
            href: '/portal/gastos',
            label: 'Gastos',
            active: true,
            icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
          },
          {
            href: '/portal/avisos',
            label: 'Avisos',
            active: false,
            icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
          },
        ].map(n => (
          <a
            key={n.href}
            href={n.href}
            className={
              'flex-1 flex flex-col items-center py-3 transition-colors ' +
              (n.active ? 'text-indigo-600' : 'text-slate-500 hover:text-indigo-600')
            }
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={n.icon} />
            </svg>
            <span className="text-xs mt-0.5">{n.label}</span>
          </a>
        ))}
      </nav>
    </div>
  )
}
