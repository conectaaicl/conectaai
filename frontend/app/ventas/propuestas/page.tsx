'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText, Eye, EyeOff, Search, MessageCircle, RefreshCw } from 'lucide-react'
import { vjson, clp, fecha, hace, ETAPAS, ETC } from '../lib'

export default function Propuestas() {
  const router = useRouter()
  const [d, setD] = useState<any>(null)
  const [filtro, setFiltro] = useState<'todas' | 'condominio' | 'cortinas' | 'negocio'>('todas')
  const [nueva, setNueva] = useState(false); const [q, setQ] = useState(''); const [cands, setCands] = useState<any[]>([])
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; t: string; wa?: string } | null>(null)
  const load = () => vjson('/propuestas').then(setD).catch(e => setMsg({ ok: false, t: e.message }))
  useEffect(() => { load() }, [])
  useEffect(() => { if (!nueva) return; const t = setTimeout(() => vjson(`/edificios?q=${encodeURIComponent(q)}`).then(l => setCands(l.slice(0, 8))).catch(() => {}), 250); return () => clearTimeout(t) }, [q, nueva])
  async function reenviar(p: any, canal: string) {
    setBusy(true)
    try { const r = await vjson(p.tipo === 'cortinas' ? `/cortinas/propuestas/${p.id}/reenviar?canal=${canal}` : p.tipo === 'negocio' ? `/negocios/propuestas/${p.id}/reenviar?canal=${canal}` : `/propuestas/${p.id}/reenviar?canal=${canal}`, { method: 'POST' }); if (canal === 'whatsapp' && r.whatsapp !== 'enviado' && r.wa_link) window.open(r.wa_link, '_blank'); setMsg({ ok: true, t: `${p.nombre}: ` + (r.whatsapp === 'enviado' ? 'WhatsApp enviado automáticamente' : r.email === 'enviado' ? 'correo reenviado' : r.email ? 'correo ' + r.email : 'se abrió WhatsApp con el mensaje listo'), wa: r.wa_link }); load() }
    catch (e: any) { setMsg({ ok: false, t: e.message }) } finally { setBusy(false) }
  }
  const list = (d?.propuestas || []).filter((p: any) => filtro === 'todas' || p.tipo === filtro)
  const EST = (p: any) => (p.tipo === 'cortinas' ? ETC : ETAPAS)[p.etapa]
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div><p className="text-xs font-bold tracking-widest text-[#0F766E] uppercase">Propuestas</p><h1 className="text-2xl font-extrabold">Todo lo que has enviado</h1><p className="text-sm text-[#7A8F98]">{d ? `${d.resumen.total} propuestas · ${d.resumen.abiertas} abiertas · ${d.resumen.sin_abrir} sin abrir · ${d.resumen.aceptadas} aceptadas` : 'Cargando…'}</p></div>
        <button onClick={() => setNueva(!nueva)} className="bg-[#0F766E] text-white font-bold px-5 py-3 rounded-2xl text-sm inline-flex items-center gap-2"><FileText size={16} /> Nueva propuesta</button>
      </div>
      {nueva && <div className="bg-white border border-[#DDE4E6] rounded-2xl p-4 mb-4">
        <p className="text-sm font-bold mb-2">¿Para qué edificio?</p>
        <div className="relative"><Search size={16} className="absolute left-3 top-3.5 text-[#7A8F98]" /><input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Busca por nombre, dirección o administrador" className="w-full bg-white border border-[#DDE4E6] rounded-xl pl-9 pr-3 py-3 text-sm" /></div>
        <div className="mt-2 divide-y divide-[#DDE4E6]">{cands.map(e => (
          <button key={e.id} onClick={() => router.push(`/ventas/edificios/${e.id}?propuesta=1`)} className="w-full text-left py-2.5 flex items-center gap-3">
            <span className="text-lg">{e.tipo === 'casas' ? '🏘️' : '🏢'}</span>
            <span className="flex-1 min-w-0"><b className="block text-sm truncate">{e.nombre}</b><span className="text-xs text-[#7A8F98]">{[e.comuna, e.unidades ? `${e.unidades} unidades` : 'sin N° unidades', e.administrador_email || 'sin correo'].join(' · ')}</span></span>
            <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${ETAPAS[e.etapa]?.color}`}>{ETAPAS[e.etapa]?.label}</span>
          </button>))}</div>
        <div className="flex flex-wrap gap-3 mt-3 text-sm"><Link href="/ventas/visita" className="font-bold text-[#0F766E]">＋ Es un edificio nuevo (registrar visita)</Link><Link href="/ventas/negocios" className="font-bold text-[#0F766E]">🏪 Propuesta para un negocio (MenuSmart, Tap, OmniFlow…)</Link><Link href="/ventas/cortinas" className="font-bold text-[#8A7340]">🪟 Propuesta de cortinas TerraBlinds</Link></div>
      </div>}
      {msg && <div role="status" className={`fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-2xl shadow-2xl border rounded-2xl px-4 py-3 text-sm flex flex-wrap items-center gap-3 ${msg.ok ? 'bg-[#DDF4F0] text-[#0F766E] border-teal-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}><span className="flex-1">{msg.t}</span><button onClick={() => setMsg(null)} className="text-xs font-bold opacity-60">✕</button>{msg.wa && <a href={msg.wa} target="_blank" rel="noreferrer" className="bg-[#25D366] text-white font-bold px-3 py-2 rounded-xl text-xs inline-flex items-center gap-1"><MessageCircle size={14} /> Mandar por mi WhatsApp</a>}</div>}
      <div className="flex gap-2 mb-3">{[['todas', 'Todas'], ['condominio', '🏢 Condominios'], ['negocio', '🏪 Negocios'], ['cortinas', '🪟 Cortinas']].map(([k, l]) => <button key={k} onClick={() => setFiltro(k as any)} className={`px-3 py-2 rounded-xl text-xs font-bold border ${filtro === k ? 'bg-[#0B1F2A] text-white border-[#0B1F2A]' : 'bg-white border-[#DDE4E6] text-[#35505C]'}`}>{l}</button>)}</div>
      <div className="bg-white border border-[#DDE4E6] rounded-2xl divide-y divide-[#DDE4E6]">
        {d && list.length === 0 && <div className="p-8 text-center text-sm text-[#7A8F98]">Aún no hay propuestas. Crea una desde la ficha de un edificio o con el botón de arriba.</div>}
        {list.map((p: any) => (
          <div key={p.tipo + p.id} className="px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
            <div className="w-10 h-10 rounded-xl bg-[#F3F6F5] flex items-center justify-center text-lg shrink-0">{p.tipo === 'cortinas' ? '🪟' : p.tipo === 'negocio' ? '🏪' : '🏢'}</div>
            <div className="flex-1 min-w-[200px]">
              <Link href={p.ficha} className="font-bold block truncate">{p.nombre}</Link>
              <div className="text-xs text-[#7A8F98]">{p.tipo === 'cortinas' ? `${p.nivel || ''} · ${clp(p.total)}` : p.tipo === 'negocio' ? `${p.productos} · ${clp(p.total_mensual)}/mes` : `${clp(p.precio_unidad)}/unidad · ${clp(p.total_mensual)}/mes · ${p.unidades} u.`} · {fecha(p.created_at)}{p.demo_dominio ? ` · demo ${p.demo_estado}` : ''}</div>
              <div className="text-xs mt-0.5 flex items-center gap-2">
                {p.aceptada_en ? <span className="text-emerald-700 font-bold">✅ Aceptada {hace(p.aceptada_en)}</span> : p.aperturas ? <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold"><Eye size={12} /> abierta ×{p.aperturas} · {hace(p.abierto_en)}</span> : <span className="inline-flex items-center gap-1 text-[#7A8F98]"><EyeOff size={12} /> {p.enviado_en ? `sin abrir · enviada ${hace(p.enviado_en)}` : 'no enviada'}</span>}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${EST(p)?.color}`}>{EST(p)?.label}</span>
              </div>
            </div>
            <a href={p.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#0F766E] bg-[#DDF4F0] px-3 py-2 rounded-xl">Ver web</a>
            <a href={p.pdf_url} target="_blank" rel="noreferrer" className="text-xs font-bold bg-white border border-[#DDE4E6] px-3 py-2 rounded-xl">PDF</a>
            <button onClick={() => reenviar(p, 'email')} disabled={busy} className="text-xs font-bold bg-white border border-[#DDE4E6] px-3 py-2 rounded-xl inline-flex items-center gap-1"><RefreshCw size={12} /> Correo</button>
            <button onClick={() => reenviar(p, 'whatsapp')} disabled={busy} className="text-xs font-bold bg-[#25D366] text-white px-3 py-2 rounded-xl">WhatsApp</button>
          </div>))}
      </div>
    </div>
  )
}
