'use client'
import { useEffect, useState, use } from 'react'

interface Inv {
  token: string; visitante: string; motivo?: string; estado: string; valida_hasta?: string; hora_entrada?: string
  activada: boolean; celular_oculto?: string | null; condominio: string; direccion?: string | null
  unidad?: string | null; torre?: string | null; anfitrion?: string | null; marca?: string | null; qr_data?: string
}

const fmt = (iso?: string) => iso ? new Date(iso).toLocaleString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : ''

export default function InvitacionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [inv, setInv] = useState<Inv | null>(null)
  const [error, setError] = useState('')
  const [celular, setCelular] = useState('')
  const [sending, setSending] = useState(false)
  const [formError, setFormError] = useState('')

  const cargar = () => fetch(`/api/invitacion/${token}`).then(async r => {
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || 'Invitación no encontrada')
    return r.json()
  }).then(setInv).catch(e => setError(e.message))

  useEffect(() => { cargar() }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  // refresca cada 20s cuando el QR esta visible para reflejar el ingreso
  useEffect(() => {
    if (!inv?.activada || inv.estado !== 'pendiente' && inv.estado !== 'aprobado') return
    const t = setInterval(cargar, 20000); return () => clearInterval(t)
  }, [inv?.activada, inv?.estado]) // eslint-disable-line react-hooks/exhaustive-deps

  async function activar(e: React.FormEvent) {
    e.preventDefault(); setSending(true); setFormError('')
    try {
      const r = await fetch(`/api/invitacion/${token}/activar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ celular }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setFormError(d.detail || 'No se pudo activar'); return }
      setInv(d)
    } catch { setFormError('Sin conexión. Intenta de nuevo.') } finally { setSending(false) }
  }

  const marca = inv?.marca || 'ConectaAI'
  const unidad = inv?.unidad ? `${inv.torre && inv.torre !== 'A' && inv.torre !== 'Casas' ? inv.torre + ' · ' : ''}${/^\d/.test(inv.unidad) ? (inv.torre === 'Casas' ? 'Casa ' : 'Depto ') : ''}${inv.unidad}` : null
  const vigente = inv && (inv.estado === 'pendiente' || inv.estado === 'aprobado')

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-full px-4 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Invitación de acceso · {marca}
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
          <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 text-white px-6 pt-7 pb-6">
            <p className="text-indigo-200 text-xs font-semibold uppercase tracking-wider">Te invitan a</p>
            <h1 className="text-2xl font-extrabold leading-tight mt-1">{inv?.condominio || (error ? 'Invitación' : '…')}</h1>
            {inv?.direccion && <p className="text-indigo-200 text-sm mt-1">{inv.direccion}</p>}
            {inv && (
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="bg-white/10 rounded-xl px-3 py-2"><p className="text-indigo-200 text-[11px] uppercase">Visitante</p><p className="font-semibold truncate">{inv.visitante}</p></div>
                <div className="bg-white/10 rounded-xl px-3 py-2"><p className="text-indigo-200 text-[11px] uppercase">{unidad ? 'Unidad' : 'Motivo'}</p><p className="font-semibold truncate">{unidad || inv.motivo || 'Visita'}</p></div>
                {inv.anfitrion && <div className="bg-white/10 rounded-xl px-3 py-2 col-span-2"><p className="text-indigo-200 text-[11px] uppercase">Te invita</p><p className="font-semibold truncate">{inv.anfitrion}</p></div>}
              </div>
            )}
          </div>

          <div className="p-6">
            {error && (
              <div className="text-center py-6">
                <div className="text-5xl mb-3">🚫</div>
                <p className="font-bold text-slate-800">{error}</p>
                <p className="text-sm text-slate-500 mt-1">Pide a quien te invitó que genere una nueva invitación.</p>
              </div>
            )}

            {inv && !vigente && (
              <div className="text-center py-4">
                <div className="text-5xl mb-3">{inv.estado === 'ingresado' ? '✅' : '⏰'}</div>
                <p className="font-bold text-slate-800">
                  {inv.estado === 'ingresado' ? `Ingreso registrado ${inv.hora_entrada ? 'a las ' + new Date(inv.hora_entrada).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : ''}` :
                   inv.estado === 'expirado' ? 'Esta invitación venció' : inv.estado === 'salido' ? 'Visita finalizada' : 'Invitación no vigente'}
                </p>
                <p className="text-sm text-slate-500 mt-1">{inv.estado === 'ingresado' ? 'Este código ya fue usado y no sirve para un segundo ingreso.' : 'Pide una nueva a quien te invitó.'}</p>
              </div>
            )}

            {inv && vigente && !inv.activada && (
              <form onSubmit={activar} className="space-y-4">
                <div>
                  <p className="font-bold text-slate-800">Ingresa tu celular para ver tu código QR</p>
                  <p className="text-sm text-slate-500 mt-1">La invitación queda ligada a tu número y permite el acceso de una sola persona.</p>
                </div>
                <div className="flex gap-2">
                  <span className="inline-flex items-center px-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 text-sm font-semibold">🇨🇱 +56</span>
                  <input inputMode="tel" autoComplete="tel-national" placeholder="9 1234 5678" value={celular} onChange={e => setCelular(e.target.value)} required
                    className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-lg text-slate-900 tracking-wide focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                {formError && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{formError}</p>}
                <button type="submit" disabled={sending} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl text-base">
                  {sending ? 'Activando…' : 'Ver mi código QR'}
                </button>
                <p className="text-[11px] text-slate-400 text-center">Válida hasta {fmt(inv.valida_hasta)}</p>
              </form>
            )}

            {inv && vigente && inv.activada && (
              <div className="text-center">
                {inv.qr_data ? (
                  <div className="inline-block bg-white p-3 rounded-2xl border-2 border-slate-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="Código QR de acceso" width={260} height={260}
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=520x520&margin=0&data=${encodeURIComponent(inv.qr_data)}`} />
                  </div>
                ) : (
                  <div className="py-6 text-slate-500 text-sm">Esta invitación fue activada desde otro celular ({inv.celular_oculto}).</div>
                )}
                <p className="font-bold text-slate-800 mt-4">Muestra este código en la entrada</p>
                <p className="text-sm text-slate-500 mt-1">Sube el brillo de la pantalla y mantén el celular quieto frente al lector o al conserje.</p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-[11px] text-slate-600">
                  <div className="bg-slate-50 rounded-xl p-2">📱<br/>Ligado a {inv.celular_oculto}</div>
                  <div className="bg-slate-50 rounded-xl p-2">1️⃣<br/>Un solo ingreso</div>
                  <div className="bg-slate-50 rounded-xl p-2">⏰<br/>Hasta {inv.valida_hasta ? new Date(inv.valida_hasta).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</div>
                </div>
                <p className="text-[11px] text-slate-400 mt-4">Al ingresar se avisa automáticamente a {inv.anfitrion || 'quien te invitó'} y a conserjería.</p>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-5">Sistema de acceso {marca} · No compartas este link: solo sirve para una persona.</p>
      </div>
    </div>
  )
}
