'use client'
import { useEffect, useState } from 'react'
import { MessageCircle, Mail, Eye, EyeOff, Trash2, RefreshCw } from 'lucide-react'
import { vjson, hace } from '../lib'

const inp = 'w-full bg-white border border-[#DDE4E6] rounded-xl px-3 py-2.5 text-sm text-[#0B1F2A] focus:outline-none focus:ring-2 focus:ring-[#14B8A6]'
const EST: Record<string, string> = { nuevo: 'bg-slate-100 text-slate-700', contactado: 'bg-amber-100 text-amber-800', interesado: 'bg-blue-100 text-blue-800', cliente: 'bg-emerald-100 text-emerald-800', descartado: 'bg-rose-100 text-rose-700' }

export default function Presentaciones() {
  const [cat, setCat] = useState<any>(null)
  const [list, setList] = useState<any[]>([])
  const [f, setF] = useState<any>({ nombre: '', empresa: '', whatsapp: '', email: '', productos: [], notas: '', enviar_wa: true, enviar_email: true })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; t: string; wa?: string } | null>(null)
  const load = () => vjson('/presentaciones').then(setList).catch(() => {})
  useEffect(() => { vjson('/catalogo').then(setCat).catch(() => {}); load() }, [])

  async function enviar() {
    setBusy(true); setMsg(null)
    try {
      const r = await vjson('/presentaciones', { method: 'POST', body: JSON.stringify(f) })
      setMsg({ ok: true, t: `Presentación creada · ${r.envio.wa === 'enviado' ? 'WhatsApp enviado' : 'WhatsApp: usa el botón'} · ${r.envio.email === 'enviado' ? 'correo enviado' : r.envio.email || 'sin correo'}`, wa: r.envio.wa_link })
      setF({ nombre: '', empresa: '', whatsapp: '', email: '', productos: [], notas: '', enviar_wa: true, enviar_email: true }); load()
    } catch (e: any) { setMsg({ ok: false, t: e.message }) } finally { setBusy(false) }
  }
  async function estado(id: number, estado: string) { await vjson(`/presentaciones/${id}`, { method: 'PATCH', body: JSON.stringify({ estado }) }); load() }
  async function reenviar(id: number, canal: string) { setBusy(true); try { const r = await vjson(`/presentaciones/${id}/reenviar?canal=${canal}`, { method: 'POST' }); if (r.wa !== 'enviado' && r.wa_link) window.open(r.wa_link, '_blank'); setMsg({ ok: true, t: (r.email === 'enviado' ? 'Correo reenviado · ' : '') + (r.wa === 'enviado' ? 'WhatsApp enviado' : 'se abrió WhatsApp con el mensaje listo'), wa: r.wa_link }) } catch (e: any) { setMsg({ ok: false, t: e.message }) } finally { setBusy(false) } }
  async function borrar(id: number) { if (!confirm('¿Eliminar esta presentación?')) return; await vfetchDel(id); load() }
  async function vfetchDel(id: number) { await fetch(`/api/ventas-terreno/presentaciones/${id}`, { method: 'DELETE', credentials: 'include' }) }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-4"><p className="text-xs font-bold tracking-widest text-[#0F766E] uppercase">Ecosistema ConectaAI</p><h1 className="text-2xl font-extrabold">Presentaciones</h1><p className="text-sm text-[#7A8F98]">Elige los productos, escribe el contacto y sale por WhatsApp y correo con PDF y link que avisa cuando lo abren.</p></div>
      {msg && <div role="status" className={`fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-2xl shadow-2xl border rounded-2xl px-4 py-3 text-sm flex flex-wrap items-center gap-3 ${msg.ok ? 'bg-[#DDF4F0] text-[#0F766E] border-teal-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}><span className="flex-1">{msg.t}</span><button onClick={() => setMsg(null)} className="text-xs font-bold opacity-60">✕</button>{msg.wa && <a href={msg.wa} target="_blank" rel="noreferrer" className="bg-[#25D366] text-white font-bold px-3 py-2 rounded-xl text-xs inline-flex items-center gap-1"><MessageCircle size={14} /> Mandar por mi WhatsApp</a>}</div>}
      <div className="grid lg:grid-cols-[minmax(0,420px)_1fr] gap-4">
        <section className="bg-white border border-[#DDE4E6] rounded-2xl p-4 space-y-3 h-fit">
          <h2 className="font-bold text-sm">Nueva presentación</h2>
          <div className="grid grid-cols-2 gap-2">
            <input className={inp} placeholder="Nombre *" value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} />
            <input className={inp} placeholder="Empresa / local" value={f.empresa} onChange={e => setF({ ...f, empresa: e.target.value })} />
            <input className={inp} placeholder="WhatsApp +56 9" inputMode="tel" value={f.whatsapp} onChange={e => setF({ ...f, whatsapp: e.target.value })} />
            <input className={inp} placeholder="Correo" type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
          </div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-[#7A8F98]">Productos a presentar</div>
          <div className="space-y-2">{cat?.productos.map((p: any) => { const on = f.productos.includes(p.id); return (
            <button key={p.id} type="button" onClick={() => setF({ ...f, productos: on ? f.productos.filter((x: string) => x !== p.id) : [...f.productos, p.id] })} className={`w-full text-left flex items-start gap-3 rounded-xl border-2 p-3 ${on ? 'border-[#0F766E] bg-[#DDF4F0]' : 'border-[#DDE4E6]'}`}>
              <span className="text-xl">{p.icon}</span><span className="min-w-0"><b className="block text-sm" style={{ color: p.color }}>{p.name}</b><span className="text-[11px] text-[#35505C] block">{p.web} · {p.tagline}</span></span></button>) })}</div>
          <textarea className={inp + ' h-16'} placeholder="Notas internas" value={f.notas} onChange={e => setF({ ...f, notas: e.target.value })} />
          <div className="flex gap-4 text-sm"><label className="flex items-center gap-2"><input type="checkbox" className="w-5 h-5 accent-[#0F766E]" checked={f.enviar_wa} onChange={e => setF({ ...f, enviar_wa: e.target.checked })} /> WhatsApp</label><label className="flex items-center gap-2"><input type="checkbox" className="w-5 h-5 accent-[#0F766E]" checked={f.enviar_email} onChange={e => setF({ ...f, enviar_email: e.target.checked })} /> Correo + PDF</label></div>
          <button onClick={enviar} disabled={busy || !f.nombre || !f.productos.length} className="w-full bg-[#0F766E] disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl">{busy ? 'Enviando…' : 'Crear y enviar'}</button>
        </section>
        <section className="bg-white border border-[#DDE4E6] rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#DDE4E6] font-bold text-sm">Enviadas ({list.length})</div>
          <div className="divide-y divide-[#DDE4E6]">
            {list.map(p => (
              <div key={p.id} className="px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
                <div className="flex-1 min-w-[180px]"><b>{p.nombre}</b>{p.empresa && <span className="text-[#7A8F98]"> · {p.empresa}</span>}<div className="text-xs text-[#7A8F98]">{[p.whatsapp, p.email].filter(Boolean).join(' · ')}</div><div className="text-xs text-[#35505C]">{(p.productos || []).map((x: string) => cat?.productos.find((c: any) => c.id === x)?.name || x).join(', ')}</div></div>
                <div className="text-xs text-[#7A8F98] flex items-center gap-2">{p.enviado_wa && <MessageCircle size={14} className="text-[#25D366]" />}{p.enviado_email && <Mail size={14} className="text-blue-600" />}{p.aperturas ? <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold"><Eye size={14} /> abierto {hace(p.abierto_en)}</span> : <span className="inline-flex items-center gap-1"><EyeOff size={14} /> sin abrir</span>}</div>
                <select value={p.estado} onChange={e => estado(p.id, e.target.value)} className={`text-xs font-bold rounded-lg px-2 py-1.5 border-0 ${EST[p.estado]}`}>{cat?.estados.map((s: string) => <option key={s} value={s}>{s}</option>)}</select>
                <a href={`/pres/${p.token}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#0F766E] underline">ver</a>
                <button onClick={() => reenviar(p.id, 'ambos')} disabled={busy} className="text-[#7A8F98]" title="Reenviar"><RefreshCw size={14} /></button>
                <button onClick={() => borrar(p.id)} className="text-rose-500" title="Eliminar"><Trash2 size={14} /></button>
              </div>))}
            {list.length === 0 && <div className="p-8 text-center text-sm text-[#7A8F98]">Sin presentaciones todavía.</div>}
          </div>
        </section>
      </div>
    </div>
  )
}
