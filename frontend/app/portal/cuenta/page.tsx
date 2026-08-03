'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePortalSession } from '../usePortalSession'

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')

interface Cobro {
  id: number
  periodo: string | null
  descripcion: string | null
  concepto?: string
  monto_total: number
  vencimiento: string | null
  fecha_pago?: string | null
  metodo_pago?: string | null
  estado: string
  desglose: Record<string, any> | null
  source?: string
}

interface Metodos { flow: boolean; mp: boolean }

const ESTADO: Record<string, { label: string; cls: string; dot: string }> = {
  pagado:   { label: '✓ Pagado',   cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400' },
  pendiente:{ label: 'Pendiente',  cls: 'bg-amber-100 text-amber-700 border-amber-200',       dot: 'bg-amber-400' },
  vencido:  { label: '⚠ Vencido', cls: 'bg-red-100 text-red-700 border-red-200',             dot: 'bg-red-500' },
  atrasado: { label: '⚠ Atrasado',cls: 'bg-red-100 text-red-700 border-red-200',             dot: 'bg-red-500' },
  exento:   { label: 'Exento',     cls: 'bg-slate-100 text-slate-500 border-slate-200',       dot: 'bg-slate-400' },
}

function EstadoBadge({ estado }: { estado: string }) {
  const e = ESTADO[estado] || ESTADO.pendiente
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${e.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${e.dot}`} />
      {e.label}
    </span>
  )
}

function BottomNav() {
  const items = [
    { href: '/portal/dashboard', icon: '🏠', label: 'Inicio' },
    { href: '/portal/cuenta',    icon: '💰', label: 'Mi Cuenta' },
    { href: '/portal/avisos',    icon: '📢', label: 'Avisos' },
    { href: '/portal/qr',        icon: '🔑', label: 'Acceso QR' },
  ]
  const current = typeof window !== 'undefined' ? window.location.pathname : ''
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex z-40 pb-safe">
      {items.map(n => (
        <a key={n.href} href={n.href}
          className={`flex-1 flex flex-col items-center py-3 transition-colors ${current === n.href ? 'text-indigo-600' : 'text-slate-500 hover:text-indigo-500'}`}>
          <span className="text-xl">{n.icon}</span>
          <span className="text-xs mt-0.5 font-medium">{n.label}</span>
        </a>
      ))}
    </nav>
  )
}

export default function PortalCuenta() {
  const router = useRouter()
  const { token, loading, authFetch, residente } = usePortalSession()
  const [cobros, setCobros] = useState<Cobro[]>([])
  const [metodos, setMetodos] = useState<Metodos>({ flow: false, mp: false })
  const [loadingData, setLoading2] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [payingId, setPayingId] = useState<number | null>(null)
  const [payError, setPayError] = useState<string | null>(null)
  const [tab, setTab] = useState<'pendientes' | 'historial'>('pendientes')

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
        if (Array.isArray(cuenta)) setCobros(cuenta)
        if (mets && typeof mets === 'object') setMetodos(mets)
      })
      .catch(() => {})
      .finally(() => setLoading2(false))
  }, [token])

  const pendientes = cobros.filter(c => !['pagado', 'exento'].includes(c.estado))
  const pagados = cobros.filter(c => c.estado === 'pagado')
  const totalPendiente = pendientes.reduce((s, c) => s + (c.monto_total || 0), 0)

  async function pagar(cobroId: number, metodo: 'flow' | 'mp') {
    setPayingId(cobroId)
    setPayError(null)
    try {
      const endpoint = metodo === 'flow' ? '/api/portal/pagos/flow/iniciar' : '/api/portal/pagos/mp/iniciar'
      const r = await authFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gasto_id: cobroId, monto: cobros.find(c => c.id === cobroId)?.monto_total }),
      })
      const data = await r.json()
      if (data.url) window.location.href = data.url
      else setPayError(data.detail || 'Error al iniciar pago')
    } catch {
      setPayError('Error de conexión')
    }
    setPayingId(null)
  }

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const visible = tab === 'pendientes' ? pendientes : pagados

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white px-4 pt-8 pb-16">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-bold mb-0.5">Mi Cuenta</h1>
          <p className="text-indigo-200 text-sm">{residente?.nombre_completo}</p>
        </div>
      </div>

      {/* Balance card */}
      <div className="max-w-lg mx-auto px-4 -mt-10 mb-4">
        <div className={`rounded-2xl p-5 shadow-lg text-white ${totalPendiente > 0 ? 'bg-gradient-to-br from-red-500 to-red-700' : 'bg-gradient-to-br from-emerald-500 to-emerald-700'}`}>
          <p className="text-sm font-medium opacity-80">
            {totalPendiente > 0 ? 'Total pendiente de pago' : '¡Al día con sus pagos!'}
          </p>
          <p className="text-4xl font-black mt-1 tracking-tight">{fmt(totalPendiente)}</p>
          <div className="flex items-center gap-4 mt-3 text-sm opacity-80">
            <span>{pendientes.length} cuota{pendientes.length !== 1 ? 's' : ''} pendiente{pendientes.length !== 1 ? 's' : ''}</span>
            <span>·</span>
            <span>{pagados.length} pagada{pagados.length !== 1 ? 's' : ''}</span>
          </div>
          {totalPendiente > 0 && (
            <div className="mt-3 pt-3 border-t border-white/20">
              <p className="text-xs opacity-70">Pague con Flow o MercadoPago desde cada cuota</p>
            </div>
          )}
        </div>
      </div>

      {/* PDF Download */}
      <div className="max-w-lg mx-auto px-4 mb-4">
        <button
          onClick={() => authFetch('/api/portal/cuenta/pdf').then(r => r.blob()).then(b => {
            const url = URL.createObjectURL(b)
            const a = document.createElement('a'); a.href = url; a.download = 'estado-cuenta.pdf'; a.click()
          })}
          className="w-full py-2.5 rounded-xl border border-indigo-200 text-indigo-700 text-sm font-semibold text-center bg-white hover:bg-indigo-50 transition-colors"
        >
          📄 Descargar estado de cuenta PDF
        </button>
      </div>

      {/* Tabs */}
      <div className="max-w-lg mx-auto px-4 mb-3">
        <div className="flex rounded-xl overflow-hidden border border-slate-200 bg-white">
          <button onClick={() => setTab('pendientes')}
            className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${tab === 'pendientes' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
            Pendientes ({pendientes.length})
          </button>
          <button onClick={() => setTab('historial')}
            className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${tab === 'historial' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
            Historial ({pagados.length})
          </button>
        </div>
      </div>

      {/* List */}
      <div className="max-w-lg mx-auto px-4 space-y-3">
        {payError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{payError}</div>
        )}
        {visible.length === 0 && (
          <div className="text-center py-10">
            <div className="text-4xl mb-3">{tab === 'pendientes' ? '✅' : '📋'}</div>
            <p className="text-slate-500 text-sm">
              {tab === 'pendientes' ? '¡Sin cuotas pendientes!' : 'Sin pagos registrados aún'}
            </p>
          </div>
        )}
        {visible.map(c => {
          const label = c.descripcion || c.concepto || 'Gasto común'
          const isExpanded = expanded === c.id
          return (
            <div key={`${c.source}-${c.id}`} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <button
                onClick={() => setExpanded(isExpanded ? null : c.id)}
                className="w-full p-4 flex items-start gap-3 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold text-slate-800 text-sm truncate">{label}</p>
                    <EstadoBadge estado={c.estado} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    {c.periodo && <span>Período: {c.periodo}</span>}
                    {c.vencimiento && (
                      <span className={new Date(c.vencimiento) < new Date() && c.estado !== 'pagado' ? 'text-red-500 font-medium' : ''}>
                        · Vence: {new Date(c.vencimiento).toLocaleDateString('es-CL')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-lg font-black ${c.estado === 'pagado' ? 'text-emerald-600' : 'text-slate-800'}`}>
                    {fmt(c.monto_total)}
                  </p>
                  <span className="text-xs text-slate-400">{isExpanded ? '▲' : '▼'}</span>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-slate-100 p-4 space-y-3">
                  {/* Desglose if available */}
                  {c.desglose && Object.keys(c.desglose).length > 0 && (
                    <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-1.5">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Desglose</p>
                      {Object.entries(c.desglose).map(([k, v]) => (
                        <div key={k} className="flex justify-between">
                          <span className="text-slate-600">{k}</span>
                          <span className="font-medium text-slate-800">{fmt(Number(v))}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Payment date if paid */}
                  {c.estado === 'pagado' && c.fecha_pago && (
                    <p className="text-xs text-emerald-600 font-medium">
                      ✓ Pagado el {new Date(c.fecha_pago).toLocaleDateString('es-CL')}
                      {c.metodo_pago && ` · ${c.metodo_pago}`}
                    </p>
                  )}

                  {/* Pay buttons */}
                  {c.estado !== 'pagado' && c.estado !== 'exento' && (
                    <div className="space-y-2">
                      {metodos.flow && (
                        <button
                          onClick={() => pagar(c.id, 'flow')}
                          disabled={payingId === c.id}
                          className="w-full py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                          {payingId === c.id ? 'Iniciando pago…' : `Pagar con Flow — ${fmt(c.monto_total)}`}
                        </button>
                      )}
                      {metodos.mp && (
                        <button
                          onClick={() => pagar(c.id, 'mp')}
                          disabled={payingId === c.id}
                          className="w-full py-3 rounded-xl bg-sky-600 text-white text-sm font-bold hover:bg-sky-700 disabled:opacity-50 transition-colors"
                        >
                          {payingId === c.id ? 'Iniciando…' : `Pagar con MercadoPago — ${fmt(c.monto_total)}`}
                        </button>
                      )}
                      {!metodos.flow && !metodos.mp && (
                        <p className="text-xs text-slate-400 text-center">
                          Contacte a la administración para realizar su pago.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <BottomNav />
    </div>
  )
}
