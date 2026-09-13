'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { usePortalSession } from '../usePortalSession'

const fmt = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-CL')
interface Cuota { numero: number; monto: number; fecha_vencimiento: string; estado: string; vencida: boolean }
interface Data { umbral_meses: number; puede_solicitar: boolean; deuda: { total: number; meses_vencidos: number; periodos: string[] } | null; convenio: { id: number; estado: string; monto_deuda: number; pie: number; cuotas: number; monto_cuota: number; pagadas: number; cuotas_detalle: Cuota[]; proxima: Cuota | null; solicitado_por: string } | null }

export default function PortalConvenio() {
  const router = useRouter()
  const { token, loading, logout, authFetch } = usePortalSession()
  const [data, setData] = useState<Data | null>(null)
  const [cuotas, setCuotas] = useState(6)
  const [pie, setPie] = useState(0)
  const [mensaje, setMensaje] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => { if (!loading && !token) router.push('/portal/login') }, [loading, token, router])
  const load = useCallback(() => { if (!token) return; authFetch('/api/portal/convenio').then(r => r.ok ? r.json() : null).then(setData).catch(() => {}) }, [token, authFetch])
  useEffect(() => { load() }, [load])

  async function solicitar(e: React.FormEvent) {
    e.preventDefault(); setSending(true); setMsg(null)
    try {
      const r = await authFetch('/api/portal/convenio/solicitar', { method: 'POST', body: JSON.stringify({ cuotas, pie, mensaje }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setMsg({ ok: false, t: d.detail || 'No se pudo enviar' }); return }
      setMsg({ ok: true, t: 'Solicitud enviada. Administración la revisará y te avisará.' }); load()
    } catch { setMsg({ ok: false, t: 'Error de conexión' }) } finally { setSending(false) }
  }

  if (loading || !data) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
  const c = data.convenio
  const cuotaEst = c ? Math.round(Math.max((data.deuda?.total || c.monto_deuda) - pie, 0) / cuotas) : Math.round(Math.max((data.deuda?.total || 0) - pie, 0) / cuotas)

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white px-4 pt-8 pb-6">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/portal/dashboard')} className="text-indigo-200 hover:text-white"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
            <div><h1 className="text-lg font-bold">Convenio de pago</h1><p className="text-indigo-200 text-xs">Regulariza tu deuda en cuotas</p></div>
          </div>
          <button onClick={logout} className="text-indigo-200 hover:text-white text-xs">Salir</button>
        </div>
      </div>
      <div className="max-w-lg mx-auto px-4 -mt-3 space-y-4">
        {c ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
            <div className="flex items-center justify-between"><p className="font-bold text-slate-800">Convenio #{c.id}</p><span className={`text-[11px] font-bold px-2 py-1 rounded-lg ${c.estado === 'activo' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>{c.estado === 'propuesto' ? 'Esperando aprobación' : 'Activo'}</span></div>
            <p className="text-sm text-slate-600">Deuda {fmt(c.monto_deuda)}{c.pie ? ` · pie ${fmt(c.pie)}` : ''} · <b>{c.cuotas} cuotas de {fmt(c.monto_cuota)}</b></p>
            {c.estado === 'activo' && <>
              <div className="h-2 bg-slate-100 rounded-full"><div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(c.pagadas / c.cuotas) * 100}%` }} /></div>
              <p className="text-xs text-slate-500">{c.pagadas} de {c.cuotas} cuotas pagadas{c.proxima ? ` · próxima vence ${c.proxima.fecha_vencimiento}` : ''}</p>
              <div className="divide-y divide-slate-100">{c.cuotas_detalle.map(q => (
                <div key={q.numero} className="flex items-center justify-between py-2 text-sm"><span className="text-slate-700">Cuota {q.numero} · {q.fecha_vencimiento}</span><span className={q.estado === 'pagado' ? 'text-emerald-700 font-semibold' : q.vencida ? 'text-red-600 font-semibold' : 'text-slate-500'}>{q.estado === 'pagado' ? 'Pagada' : q.vencida ? `Vencida · ${fmt(q.monto)}` : fmt(q.monto)}</span></div>
              ))}</div>
              <p className="text-[11px] text-slate-400">Paga cada cuota en administración o por transferencia; ellos la registran aquí.</p>
            </>}
          </div>
        ) : data.puede_solicitar ? (
          <form onSubmit={solicitar} className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
            <p className="font-bold text-slate-800">Tienes {data.deuda?.meses_vencidos} meses vencidos ({fmt(data.deuda?.total || 0)})</p>
            <p className="text-sm text-slate-600">Puedes proponer un convenio para pagar en cuotas. Administración lo revisa y, si lo aprueba, tus cobros dejan de figurar como morosos mientras cumplas.</p>
            {msg && <p className={`text-sm rounded-xl px-3 py-2 ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{msg.t}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-semibold text-slate-600">Cuotas</label><select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900" value={cuotas} onChange={e => setCuotas(Number(e.target.value))}>{[2, 3, 4, 6, 9, 12].map(n => <option key={n} value={n}>{n} cuotas</option>)}</select></div>
              <div><label className="text-xs font-semibold text-slate-600">Pie que puedo dar ahora</label><input type="number" min={0} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900" value={pie} onChange={e => setPie(parseFloat(e.target.value) || 0)} /></div>
            </div>
            <div className="bg-indigo-50 rounded-xl p-3 text-sm text-indigo-900">{cuotas} cuotas de <b>{fmt(cuotaEst)}</b>{pie ? ` + pie ${fmt(pie)}` : ''}</div>
            <textarea className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 h-20" placeholder="Mensaje para administración (opcional)" value={mensaje} onChange={e => setMensaje(e.target.value)} />
            <button type="submit" disabled={sending} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl">{sending ? 'Enviando…' : 'Solicitar convenio'}</button>
          </form>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center text-slate-600 text-sm">
            <div className="text-4xl mb-2">🤝</div>
            {data.deuda && data.deuda.total > 0
              ? <>Tienes {fmt(data.deuda.total)} pendiente ({data.deuda.meses_vencidos} mes{data.deuda.meses_vencidos === 1 ? '' : 'es'} vencido{data.deuda.meses_vencidos === 1 ? '' : 's'}). El convenio de pago se habilita desde {data.umbral_meses} meses vencidos; puedes pagar desde <a href="/portal/cuenta" className="text-indigo-600 font-semibold">Estado de cuenta</a>.</>
              : <>Estás al día. No necesitas convenio de pago.</>}
          </div>
        )}
      </div>
    </div>
  )
}
