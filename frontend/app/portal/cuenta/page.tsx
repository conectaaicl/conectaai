'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePortalSession } from '../usePortalSession'

interface Gasto {
  id: number
  periodo: string | null
  descripcion: string | null
  monto_total: number
  vencimiento: string | null
  estado: string
  desglose: Record<string,any> | null
}

interface Metodos { flow: boolean; mp: boolean }

const estadoBadge: Record<string,string> = {
  pagado:   'bg-emerald-100 text-emerald-700',
  pendiente:'bg-amber-100 text-amber-700',
  atrasado: 'bg-red-100 text-red-700',
}

function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex z-40">
      {[
        {href:'/portal/dashboard', icon:'🏠', label:'Inicio'},
        {href:'/portal/cuenta',    icon:'💰', label:'Cuenta'},
        {href:'/portal/avisos',    icon:'📢', label:'Avisos'},
        {href:'/portal/qr',        icon:'🔑', label:'QR'},
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

export default function PortalCuenta() {
  const router = useRouter()
  const { token, loading, authFetch, residente } = usePortalSession()
  const [gastos,        setGastos]   = useState<Gasto[]>([])
  const [metodos,       setMetodos]  = useState<Metodos>({ flow: false, mp: false })
  const [loadingData,   setLData]    = useState(true)
  const [expanded,      setExpanded] = useState<number|null>(null)
  const [payingId,      setPayingId] = useState<number|null>(null)
  const [payError,      setPayError] = useState<string|null>(null)

  useEffect(() => {
    if (!loading && !token) router.push('/portal/login')
  }, [loading, token, router])

  useEffect(() => {
    if (!token) return
    Promise.all([
      authFetch('/api/portal/cuenta').then(r => r.json()),
      authFetch('/api/portal/pagos/metodos').then(r => r.json()),
    ])
      .then(([cuenta, mets]) => {
        if (Array.isArray(cuenta)) setGastos(cuenta)
        if (mets && typeof mets === 'object') setMetodos(mets)
      })
      .catch(() => {})
      .finally(() => setLData(false))
  }, [token])

  const formatCLP = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')
  const pendientes = gastos.filter(g => g.estado !== 'pagado')
  const totalPendiente = pendientes.reduce((s, g) => s + (g.monto_total || 0), 0)

  async function pagar(gastoId: number, metodo: 'flow' | 'mp') {
    setPayingId(gastoId)
    setPayError(null)
    try {
      const endpoint = metodo === 'flow'
        ? '/api/portal/pagos/flow/iniciar'
        : '/api/portal/pagos/mp/iniciar'
      const r = await authFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ gasto_comun_id: gastoId }),
      })
      const data = await r.json()
      if (!r.ok) {
        setPayError(data.detail || 'Error al iniciar pago')
        return
      }
      const url = data.url || data.sandbox_url
      if (url) window.location.href = url
      else setPayError('No se recibió URL de pago')
    } catch {
      setPayError('Error de conexión. Intente nuevamente.')
    } finally {
      setPayingId(null)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  const hayPagos = metodos.flow || metodos.mp

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-white border-b border-slate-100 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <a href="/portal/dashboard" className="text-slate-400 hover:text-slate-700 text-lg">←</a>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Estado de Cuenta</h1>
            {residente?.nombre && <p className="text-xs text-slate-500">{residente.nombre}</p>}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">

        {payError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-start gap-2">
            <span className="text-base flex-shrink-0">⚠</span>
            <span>{payError}</span>
            <button onClick={() => setPayError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {totalPendiente > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
            <p className="text-sm text-red-500 font-medium">Total pendiente</p>
            <p className="text-3xl font-bold text-red-600 mt-1">{formatCLP(totalPendiente)}</p>
            <p className="text-xs text-red-400 mt-1">{pendientes.length} cargo(s) sin pagar</p>
            {!hayPagos && (
              <p className="text-xs text-red-400 mt-2 border-t border-red-100 pt-2">
                Pago en línea no disponible — contacte a la administración
              </p>
            )}
          </div>
        )}
        {totalPendiente === 0 && !loadingData && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
            <p className="text-emerald-700 font-semibold">✓ Al día con todos los pagos</p>
          </div>
        )}

        {loadingData && (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"/>
          </div>
        )}

        {gastos.map(g => (
          <div key={g.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
            <div
              className="p-4 cursor-pointer flex items-start justify-between"
              onClick={() => setExpanded(expanded === g.id ? null : g.id)}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {g.periodo && <span className="text-sm font-semibold text-slate-800">{g.periodo}</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoBadge[g.estado] || 'bg-slate-100 text-slate-600'}`}>
                    {g.estado}
                  </span>
                </div>
                {g.descripcion && <p className="text-xs text-slate-500 mt-0.5">{g.descripcion}</p>}
                {g.vencimiento && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    Vence: {new Date(g.vencimiento).toLocaleDateString('es-CL')}
                  </p>
                )}
              </div>
              <div className="text-right ml-4">
                <p className="text-base font-bold text-slate-800">{formatCLP(g.monto_total)}</p>
                <span className="text-xs text-slate-400">{expanded === g.id ? '▲' : '▼'}</span>
              </div>
            </div>

            {expanded === g.id && (
              <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
                {g.desglose && Object.keys(g.desglose).length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-600 mb-2">Desglose</p>
                    {Object.entries(g.desglose).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs text-slate-600">
                        <span className="capitalize">{k.replace(/_/g,' ')}</span>
                        <span>{typeof v === 'number' ? formatCLP(v) : String(v)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Sin desglose disponible</p>
                )}

                {g.estado !== 'pagado' && hayPagos && (
                  <div className="space-y-2 pt-1">
                    <p className="text-xs font-semibold text-slate-600">Pagar con:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {metodos.flow && (
                        <button
                          onClick={() => pagar(g.id, 'flow')}
                          disabled={payingId === g.id}
                          className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm
                            bg-gradient-to-r from-indigo-600 to-indigo-700 text-white
                            hover:from-indigo-500 hover:to-indigo-600
                            disabled:opacity-50 disabled:cursor-not-allowed
                            transition-all active:scale-95 shadow"
                        >
                          {payingId === g.id ? (
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
                              </svg>
                              Flow.cl
                            </>
                          )}
                        </button>
                      )}
                      {metodos.mp && (
                        <button
                          onClick={() => pagar(g.id, 'mp')}
                          disabled={payingId === g.id}
                          className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm
                            bg-gradient-to-r from-sky-500 to-blue-600 text-white
                            hover:from-sky-400 hover:to-blue-500
                            disabled:opacity-50 disabled:cursor-not-allowed
                            transition-all active:scale-95 shadow"
                        >
                          {payingId === g.id ? (
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                              </svg>
                              Mercado Pago
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {g.estado !== 'pagado' && !hayPagos && (
                  <p className="text-xs text-slate-400 italic pt-1">
                    Pago en línea no habilitado — contacte a la administración
                  </p>
                )}
              </div>
            )}
          </div>
        ))}

        {!loadingData && gastos.length === 0 && (
          <div className="text-center py-12 text-slate-400">Sin registros de gastos</div>
        )}
      </div>
      <BottomNav/>
    </div>
  )
}
