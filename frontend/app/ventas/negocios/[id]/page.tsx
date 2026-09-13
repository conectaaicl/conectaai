'use client'
import { useCallback, useEffect, useState, use } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Phone, MessageCircle, Mail, FileText, Clock, RefreshCw, Pencil, Check } from 'lucide-react'
import { vjson, clp, fecha, hace, telLink, waLink, ETAPAS, RESULTADOS } from '../../lib'

const inp = 'w-full bg-white border border-[#DDE4E6] rounded-xl px-3 py-2.5 text-sm text-[#0B1F2A] focus:outline-none focus:ring-2 focus:ring-[#14B8A6]'
const Card = ({ title, icon: I, children, right }: any) => <section className="bg-white border border-[#DDE4E6] rounded-2xl p-4 md:p-5"><div className="flex items-center justify-between mb-3"><h2 className="font-bold flex items-center gap-2 text-sm">{I && <I size={16} className="text-[#0F766E]" />}{title}</h2>{right}</div>{children}</section>

export default function NegocioDetalle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const sp = useSearchParams()
  const [n, setN] = useState<any>(null); const [cat, setCat] = useState<any>(null)
  const [tab, setTab] = useState<'propuesta' | 'visita' | 'editar' | null>(sp.get('propuesta') ? 'propuesta' : null)
  const [items, setItems] = useState<any[]>([]); const [desc, setDesc] = useState(0); const [gratis, setGratis] = useState(0); const [texto, setTexto] = useState(''); const [mail, setMail] = useState(true); const [wa, setWa] = useState(false)
  const [cot, setCot] = useState<any>(null); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; t: string; wa?: string } | null>(null)
  const [res, setRes] = useState('seguimiento'); const [nota, setNota] = useState(''); const [pa, setPa] = useState(''); const [pf, setPf] = useState('')
  const [ed, setEd] = useState<any>({})

  const load = useCallback(() => vjson(`/negocios/${id}`).then(x => { setN(x); setEd({ nombre: x.nombre, rubro: x.rubro || '', contacto: x.contacto || '', telefono: x.telefono || '', email: x.email || '', direccion: x.direccion || '', comuna: x.comuna || '', notas: x.notas || '' }); if (!items.length) setItems((x.productos || []).map((p: string) => ({ producto: p, cantidad: 1 }))) }).catch(e => setMsg({ ok: false, t: e.message })), [id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); vjson('/negocios/catalogo').then(setCat).catch(() => {}) }, [load])
  useEffect(() => { if (!items.length) { setCot(null); return } const t = setTimeout(() => vjson('/negocios/cotizar', { method: 'POST', body: JSON.stringify({ items, descuento_pct: desc, meses_gratis: gratis }) }).then(setCot).catch(() => {}), 250); return () => clearTimeout(t) }, [JSON.stringify(items), desc, gratis]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (k: string) => setItems(items.some(i => i.producto === k) ? items.filter(i => i.producto !== k) : [...items, { producto: k, cantidad: 1 }])
  const setCant = (k: string, c: number) => setItems(items.map(i => i.producto === k ? { ...i, cantidad: Math.max(1, c) } : i))
  async function etapa(et: string) { await vjson(`/negocios/${id}`, { method: 'PATCH', body: JSON.stringify({ etapa: et }) }); load() }
  async function guardarEd() { setBusy(true); try { await vjson(`/negocios/${id}`, { method: 'PATCH', body: JSON.stringify(ed) }); setTab(null); load(); setMsg({ ok: true, t: 'Datos guardados' }) } catch (e: any) { setMsg({ ok: false, t: e.message }) } finally { setBusy(false) } }
  async function visita() { setBusy(true); try { await vjson(`/negocios/${id}/visitas`, { method: 'POST', body: JSON.stringify({ resultado: res, nota, proxima_accion: pa || null, proxima_fecha: pf || null }) }); setTab(null); setNota(''); load(); setMsg({ ok: true, t: 'Visita registrada' }) } catch (e: any) { setMsg({ ok: false, t: e.message }) } finally { setBusy(false) } }
  async function enviar() { setBusy(true); setMsg(null); try { const r = await vjson(`/negocios/${id}/propuestas`, { method: 'POST', body: JSON.stringify({ items, descuento_pct: desc, meses_gratis: gratis, mensaje: texto || null, enviar_email: mail, enviar_whatsapp: wa }) }); setMsg({ ok: true, t: `Propuesta lista · ${r.envio.email === 'enviado' ? 'correo enviado' : r.envio.email || 'sin correo'}${r.envio.whatsapp === 'enviado' ? ' · WhatsApp enviado' : ''}`, wa: r.envio.wa_link }); setTab(null); load() } catch (e: any) { setMsg({ ok: false, t: e.message }) } finally { setBusy(false) } }
  async function reenviar(pid: number, canal: string) { setBusy(true); try { const r = await vjson(`/negocios/propuestas/${pid}/reenviar?canal=${canal}`, { method: 'POST' }); setMsg({ ok: true, t: `Reenvío: ${r.email || ''} ${r.whatsapp || ''}`, wa: r.wa_link }); load() } catch (e: any) { setMsg({ ok: false, t: e.message }) } finally { setBusy(false) } }

  if (!n) return <div className="p-8 text-sm text-[#7A8F98]">{msg?.t || 'Cargando…'}</div>
  const E = ETAPAS[n.etapa] || ETAPAS.visitado
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><Link href="/ventas/negocios" className="text-xs text-[#7A8F98]">← Negocios</Link><h1 className="text-2xl md:text-3xl font-extrabold">{n.nombre}</h1><p className="text-sm text-[#7A8F98]">{[n.rubro, n.direccion, n.comuna, n.contacto].filter(Boolean).join(' · ')}{n.origen !== 'terreno' ? ` · vía ${n.origen}` : ''}</p></div>
        <div className="flex items-center gap-2"><select value={n.etapa} onChange={e => etapa(e.target.value)} className={`text-sm font-bold rounded-xl px-3 py-2 border-0 ${E.color}`}>{Object.entries(ETAPAS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select><button onClick={() => setTab(tab === 'editar' ? null : 'editar')} className="w-10 h-10 rounded-xl bg-white border border-[#DDE4E6] flex items-center justify-center"><Pencil size={16} /></button></div>
      </div>
      {msg && <div className={`rounded-2xl px-4 py-3 text-sm flex flex-wrap items-center gap-3 ${msg.ok ? 'bg-[#DDF4F0] text-[#0F766E]' : 'bg-rose-50 text-rose-700'}`}><span className="flex-1">{msg.t}</span>{msg.wa && <a href={msg.wa} target="_blank" rel="noreferrer" className="bg-[#25D366] text-white font-bold px-3 py-2 rounded-xl text-xs inline-flex items-center gap-1"><MessageCircle size={14} /> Mandar por mi WhatsApp</a>}</div>}
      <div className="grid grid-cols-3 gap-2">
        <a href={telLink(n.telefono)} className={`bg-white border border-[#DDE4E6] rounded-2xl p-3 text-center ${!n.telefono && 'opacity-40 pointer-events-none'}`}><Phone className="mx-auto text-[#0F766E]" size={20} /><div className="text-xs font-bold mt-1 truncate">{n.contacto || 'Llamar'}</div><div className="text-[10px] text-[#7A8F98]">{n.telefono || '—'}</div></a>
        <a href={waLink(n.telefono, `Hola ${n.contacto || ''}, te escribe ConectaAI 👋`)} target="_blank" rel="noreferrer" className={`bg-white border border-[#DDE4E6] rounded-2xl p-3 text-center ${!n.telefono && 'opacity-40 pointer-events-none'}`}><MessageCircle className="mx-auto text-[#25D366]" size={20} /><div className="text-xs font-bold mt-1">WhatsApp</div></a>
        <a href={n.email ? `mailto:${n.email}` : undefined} className={`bg-white border border-[#DDE4E6] rounded-2xl p-3 text-center ${!n.email && 'opacity-40 pointer-events-none'}`}><Mail className="mx-auto text-blue-600" size={20} /><div className="text-xs font-bold mt-1">Correo</div><div className="text-[10px] text-[#7A8F98] truncate">{n.email || 'sin correo'}</div></a>
      </div>
      <div className="flex flex-wrap gap-2"><button onClick={() => setTab(tab === 'propuesta' ? null : 'propuesta')} className="bg-[#0F766E] text-white font-bold px-5 py-3 rounded-2xl text-sm flex items-center gap-2"><FileText size={16} /> {n.propuestas?.length ? 'Nueva propuesta' : 'Armar propuesta'}</button><button onClick={() => setTab(tab === 'visita' ? null : 'visita')} className="bg-white border border-[#DDE4E6] font-bold px-5 py-3 rounded-2xl text-sm">＋ Registrar visita / llamada</button></div>

      {tab === 'editar' && <Card title="Editar datos" icon={Pencil} right={<button onClick={guardarEd} disabled={busy} className="bg-[#0F766E] text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1"><Check size={14} /> Guardar</button>}>
        <div className="grid md:grid-cols-2 gap-2">{[['nombre', 'Nombre'], ['rubro', 'Rubro'], ['contacto', 'Contacto'], ['telefono', 'WhatsApp'], ['email', 'Correo'], ['direccion', 'Dirección'], ['comuna', 'Comuna']].map(([k, l]) => <label key={k} className="block"><span className="text-[11px] font-bold uppercase text-[#7A8F98]">{l}</span><input className={inp} value={ed[k] ?? ''} onChange={e => setEd({ ...ed, [k]: e.target.value })} /></label>)}<label className="block md:col-span-2"><span className="text-[11px] font-bold uppercase text-[#7A8F98]">Notas</span><textarea className={inp + ' h-20'} value={ed.notas} onChange={e => setEd({ ...ed, notas: e.target.value })} /></label></div></Card>}

      {tab === 'visita' && <Card title="Registrar visita o llamada" icon={Clock}>
        <div className="flex flex-wrap gap-2 mb-3">{Object.entries(RESULTADOS).map(([k, l]) => <button key={k} onClick={() => setRes(k)} className={`px-3 py-2 rounded-xl border text-sm font-semibold ${res === k ? 'bg-[#0F766E] border-[#0F766E] text-white' : 'bg-white border-[#DDE4E6] text-[#35505C]'}`}>{l}</button>)}</div>
        <textarea className={inp + ' h-20 mb-2'} placeholder="¿Qué pasó?" value={nota} onChange={e => setNota(e.target.value)} /><div className="grid grid-cols-2 gap-2 mb-3"><input className={inp} placeholder="Próxima acción" value={pa} onChange={e => setPa(e.target.value)} /><input type="date" className={inp} value={pf} onChange={e => setPf(e.target.value)} /></div>
        <button onClick={visita} disabled={busy} className="bg-[#0F766E] text-white font-bold px-5 py-3 rounded-xl text-sm">Guardar</button></Card>}

      {tab === 'propuesta' && cat && <Card title="Propuesta" icon={FileText}>
        {!n.email && <p className="text-sm text-amber-800 bg-amber-50 rounded-xl px-3 py-2 mb-3">Sin correo del contacto no se puede enviar por correo (edita con el lápiz).</p>}
        <div className="grid sm:grid-cols-2 gap-2 mb-3">{cat.productos.map((p: any) => { const it = items.find(i => i.producto === p.id); return (
          <div key={p.id} className={`rounded-xl border-2 p-3 ${it ? 'border-[#0F766E] bg-[#DDF4F0]' : 'border-[#DDE4E6] bg-white'}`}>
            <button type="button" onClick={() => toggle(p.id)} className="w-full text-left"><div className="flex justify-between text-sm font-bold"><span>{p.icon} {p.name}</span><span className="text-[#0F766E]">{p.plan ? clp(p.plan.mensual) + '/mes' : ''}</span></div><div className="text-[11px] text-[#7A8F98] mt-0.5">{p.tagline}</div>{p.plan && <div className="text-[11px] text-[#35505C]">{p.plan.unidad}{p.plan.setup ? ` · puesta en marcha ${clp(p.plan.setup)}` : ' · sin costo inicial'}</div>}</button>
            {it && <label className="flex items-center gap-2 mt-2 text-xs font-semibold">Cantidad <input className="w-20 border border-[#DDE4E6] rounded-lg px-2 py-1 text-sm" inputMode="numeric" value={it.cantidad} onChange={e => setCant(p.id, Number(e.target.value.replace(/\D/g, '')) || 1)} /> <span className="text-[#7A8F98] font-normal">{p.plan?.unidad}</span></label>}
          </div>) })}</div>
        <div className="grid sm:grid-cols-3 gap-2 mb-3">
          <label className="block"><span className="text-[11px] font-bold uppercase text-[#7A8F98]">Descuento %</span><input className={inp} inputMode="numeric" value={desc} onChange={e => setDesc(Math.min(50, Number(e.target.value.replace(/\D/g, '')) || 0))} /></label>
          <label className="block"><span className="text-[11px] font-bold uppercase text-[#7A8F98]">Meses gratis</span><input className={inp} inputMode="numeric" value={gratis} onChange={e => setGratis(Math.min(3, Number(e.target.value.replace(/\D/g, '')) || 0))} /></label>
          <label className="block"><span className="text-[11px] font-bold uppercase text-[#7A8F98]">Mensaje personal</span><input className={inp} placeholder="Gracias por recibirme…" value={texto} onChange={e => setTexto(e.target.value)} /></label>
        </div>
        {cot && cot.items.length > 0 && <div className="bg-[#0B1F2A] text-white rounded-2xl p-4 mb-3"><div className="text-2xl font-extrabold">{clp(cot.total_mensual)} <span className="text-sm font-medium text-white/70">/ mes</span>{cot.total_setup > 0 && <span className="text-sm font-medium text-white/70"> + {clp(cot.total_setup)} puesta en marcha</span>}</div><div className="text-xs text-white/70">{cot.items.map((i: any) => `${i.nombre} ×${i.cantidad}`).join(' · ')}{desc ? ` · ${desc}% dcto` : ''}{gratis ? ` · ${gratis} mes(es) gratis` : ''}</div></div>}
        <div className="flex flex-wrap gap-4 text-sm mb-4"><label className="flex items-center gap-2"><input type="checkbox" className="w-5 h-5 accent-[#0F766E]" checked={mail} onChange={e => setMail(e.target.checked)} /> Correo con PDF</label><label className="flex items-center gap-2"><input type="checkbox" className="w-5 h-5 accent-[#0F766E]" checked={wa} onChange={e => setWa(e.target.checked)} /> WhatsApp automático</label></div>
        <button onClick={enviar} disabled={busy || !items.length} className="bg-[#D97706] disabled:opacity-50 text-white font-bold px-6 py-4 rounded-2xl text-base">{busy ? 'Generando…' : 'Generar y enviar'}</button>
      </Card>}

      {n.propuestas?.length > 0 && <Card title="Propuestas" icon={FileText}>{n.propuestas.map((p: any) => (
        <div key={p.id} className="flex flex-wrap items-center gap-2 py-2 border-b border-[#DDE4E6] last:border-0 text-sm">
          <div className="flex-1 min-w-[200px]"><b>{p.aceptada_en ? '🚀 Quiere partir · ' : ''}{clp(p.total_mensual)}/mes{p.total_setup ? ` + ${clp(p.total_setup)}` : ''}</b><div className="text-xs text-[#7A8F98]">{(p.items || []).map((i: any) => i.nombre).join(', ')} · {fecha(p.created_at)} · {p.enviado_email ? 'correo ✓' : 'sin correo'}{p.enviado_wa ? ' · WhatsApp ✓' : ''} · {p.aperturas ? `abierta ×${p.aperturas} (${hace(p.abierto_en)})` : 'aún no la abre'}</div></div>
          <a href={p.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#0F766E] bg-[#DDF4F0] px-3 py-2 rounded-xl">Ver web</a><a href={p.pdf_url} target="_blank" rel="noreferrer" className="text-xs font-bold bg-white border border-[#DDE4E6] px-3 py-2 rounded-xl">PDF</a>
          <button onClick={() => reenviar(p.id, 'email')} disabled={busy} className="text-xs font-bold bg-white border border-[#DDE4E6] px-3 py-2 rounded-xl inline-flex items-center gap-1"><RefreshCw size={12} /> Correo</button><button onClick={() => reenviar(p.id, 'whatsapp')} disabled={busy} className="text-xs font-bold bg-[#25D366] text-white px-3 py-2 rounded-xl">WhatsApp</button>
        </div>))}</Card>}

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Lo que le duele">{(n.dolores || []).length === 0 ? <p className="text-sm text-[#7A8F98]">Sin dolores registrados.</p> : <ul className="space-y-2">{n.dolores.map((k: string) => n.catalogo_dolores?.[k] && <li key={k} className="text-sm"><b>{n.catalogo_dolores[k][0]}</b><div className="text-xs text-[#35505C]">{n.catalogo_dolores[k][1]}</div></li>)}</ul>}{n.notas && <p className="mt-3 text-xs text-[#35505C] bg-slate-50 rounded-xl p-3 whitespace-pre-wrap">{n.notas}</p>}</Card>
        <Card title="Historial" icon={Clock}>{n.visitas.length === 0 && <p className="text-sm text-[#7A8F98]">Sin visitas.</p>}<ul className="space-y-2">{n.visitas.map((v: any) => <li key={v.id} className="text-sm flex gap-3"><span className="text-xs text-[#7A8F98] tabular-nums w-14 shrink-0">{fecha(v.fecha)}</span><div><b>{RESULTADOS[v.resultado] || v.resultado}</b>{v.nota && <div className="text-xs text-[#35505C]">{v.nota}</div>}</div></li>)}</ul></Card>
      </div>
    </div>
  )
}
