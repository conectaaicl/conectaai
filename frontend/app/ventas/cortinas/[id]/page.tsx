'use client'
import { useCallback, useEffect, useState, use } from 'react'
import Link from 'next/link'
import { Phone, MessageCircle, Mail, Plus, Trash2, FileText, Check, RefreshCw } from 'lucide-react'
import { vjson, clp, fecha, hace, telLink, waLink, ETC } from '../../lib'

const inp = 'w-full bg-white border border-[#DDE4E6] rounded-xl px-3 py-2.5 text-sm text-[#0B1F2A] focus:outline-none focus:ring-2 focus:ring-[#C8B48A]'
const AMBIENTES = ['Living', 'Comedor', 'Dormitorio principal', 'Dormitorio 2', 'Dormitorio 3', 'Cocina', 'Baño', 'Estudio', 'Terraza', 'Oficina', 'Sala de reuniones', 'Recepción']
const vacio = () => ({ ambiente: 'Living', producto: 'roller-blackout', ancho_cm: '', alto_cm: '', cantidad: 1, motorizado: false, color: '', nota: '' })

export default function CortinaDetalle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [l, setL] = useState<any>(null); const [cat, setCat] = useState<any>(null)
  const [esp, setEsp] = useState<any[]>([]); const [calc, setCalc] = useState<any>(null)
  const [nivel, setNivel] = useState('confort'); const [desc, setDesc] = useState(0); const [texto, setTexto] = useState(''); const [mail, setMail] = useState(true); const [wa, setWa] = useState(false)
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; t: string; wa?: string } | null>(null); const [dirty, setDirty] = useState(false)

  const load = useCallback(() => vjson(`/cortinas/leads/${id}`).then(x => { setL(x); setEsp((x.espacios || []).length ? x.espacios : [vacio()]); setDirty(false) }).catch(e => setMsg({ ok: false, t: e.message })), [id])
  useEffect(() => { load(); vjson('/cortinas/catalogo').then(setCat).catch(() => {}) }, [load])
  const validos = esp.filter(e => Number(e.ancho_cm) > 0 && Number(e.alto_cm) > 0).map(e => ({ ...e, ancho_cm: Number(e.ancho_cm), alto_cm: Number(e.alto_cm), cantidad: Number(e.cantidad) || 1 }))
  useEffect(() => { if (!validos.length) { setCalc(null); return } const t = setTimeout(() => vjson('/cortinas/calcular', { method: 'POST', body: JSON.stringify({ espacios: validos, descuento_pct: desc }) }).then(setCalc).catch(() => {}), 300); return () => clearTimeout(t) }, [JSON.stringify(validos), desc]) // eslint-disable-line react-hooks/exhaustive-deps

  const upd = (i: number, k: string, v: any) => { setEsp(esp.map((e, j) => j === i ? { ...e, [k]: v } : e)); setDirty(true) }
  async function guardar() { setBusy(true); try { await vjson(`/cortinas/leads/${id}`, { method: 'PATCH', body: JSON.stringify({ espacios: validos }) }); await load(); setMsg({ ok: true, t: `${validos.length} espacios guardados` }) } catch (e: any) { setMsg({ ok: false, t: e.message }) } finally { setBusy(false) } }
  async function etapa(et: string) { await vjson(`/cortinas/leads/${id}`, { method: 'PATCH', body: JSON.stringify({ etapa: et }) }); load() }
  async function enviar() {
    setBusy(true); setMsg(null)
    try {
      if (dirty) await vjson(`/cortinas/leads/${id}`, { method: 'PATCH', body: JSON.stringify({ espacios: validos }) })
      const r = await vjson(`/cortinas/leads/${id}/propuestas`, { method: 'POST', body: JSON.stringify({ nivel_sugerido: nivel, descuento_pct: desc, mensaje: texto || null, enviar_email: mail, enviar_whatsapp: wa }) })
      setMsg({ ok: true, t: `Propuesta lista · ${r.envio.email === 'enviado' ? 'correo enviado' : r.envio.email || 'sin correo'}${r.envio.whatsapp === 'enviado' ? ' · WhatsApp enviado' : ''}`, wa: r.envio.wa_link }); load()
    } catch (e: any) { setMsg({ ok: false, t: e.message }) } finally { setBusy(false) }
  }
  async function reenviar(pid: number, canal: string) { setBusy(true); try { const r = await vjson(`/cortinas/propuestas/${pid}/reenviar?canal=${canal}`, { method: 'POST' }); setMsg({ ok: true, t: `Reenvío: ${r.email || ''} ${r.whatsapp || ''}`, wa: r.wa_link }) } catch (e: any) { setMsg({ ok: false, t: e.message }) } finally { setBusy(false) } }

  if (!l) return <div className="p-8 text-sm text-[#7A8F98]">{msg?.t || 'Cargando…'}</div>
  const E = ETC[l.etapa] || ETC.lead
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><Link href="/ventas/cortinas" className="text-xs text-[#7A8F98]">← Cortinas</Link><h1 className="text-2xl md:text-3xl font-extrabold">{l.nombre}</h1><p className="text-sm text-[#7A8F98]">{[l.direccion, l.comuna, l.tipo].filter(Boolean).join(' · ')}{l.origen !== 'terreno' ? ` · lead vía ${l.origen}` : ''}{l.notas ? ` · ${l.notas}` : ''}</p></div>
        <select value={l.etapa} onChange={e => etapa(e.target.value)} className={`text-sm font-bold rounded-xl px-3 py-2 border-0 ${E.color}`}>{Object.entries(ETC).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
      </div>
      {msg && <div className={`rounded-2xl px-4 py-3 text-sm flex flex-wrap items-center gap-3 ${msg.ok ? 'bg-[#DDF4F0] text-[#0F766E]' : 'bg-rose-50 text-rose-700'}`}><span className="flex-1">{msg.t}</span>{msg.wa && <a href={msg.wa} target="_blank" rel="noreferrer" className="bg-[#25D366] text-white font-bold px-3 py-2 rounded-xl text-xs inline-flex items-center gap-1"><MessageCircle size={14} /> Mandar por mi WhatsApp</a>}</div>}
      <div className="grid grid-cols-3 gap-2">
        <a href={telLink(l.telefono)} className={`bg-white border border-[#DDE4E6] rounded-2xl p-3 text-center ${!l.telefono && 'opacity-40 pointer-events-none'}`}><Phone className="mx-auto text-[#0F766E]" size={20} /><div className="text-xs font-bold mt-1">Llamar</div><div className="text-[10px] text-[#7A8F98]">{l.telefono || '—'}</div></a>
        <a href={waLink(l.telefono, `Hola ${l.nombre.split(' ')[0]}, te escribe TerraBlinds 🪟`)} target="_blank" rel="noreferrer" className={`bg-white border border-[#DDE4E6] rounded-2xl p-3 text-center ${!l.telefono && 'opacity-40 pointer-events-none'}`}><MessageCircle className="mx-auto text-[#25D366]" size={20} /><div className="text-xs font-bold mt-1">WhatsApp</div></a>
        <a href={l.email ? `mailto:${l.email}` : undefined} className={`bg-white border border-[#DDE4E6] rounded-2xl p-3 text-center ${!l.email && 'opacity-40 pointer-events-none'}`}><Mail className="mx-auto text-blue-600" size={20} /><div className="text-xs font-bold mt-1">Correo</div><div className="text-[10px] text-[#7A8F98] truncate">{l.email || 'sin correo'}</div></a>
      </div>

      {/* Medición */}
      <section className="bg-white border border-[#DDE4E6] rounded-2xl p-4 md:p-5">
        <div className="flex items-center justify-between mb-3"><h2 className="font-bold text-sm">Espacios medidos <span className="font-normal text-[#7A8F98]">· catálogo de terrablinds.cl ({cat?.productos?.length || 0} productos)</span></h2>{dirty && <button onClick={guardar} disabled={busy} className="bg-[#0F766E] text-white text-xs font-bold px-3 py-2 rounded-xl inline-flex items-center gap-1"><Check size={14} /> Guardar medidas</button>}</div>
        <div className="space-y-3">{esp.map((e, i) => (
          <div key={i} className="bg-[#F3F6F5] border border-[#DDE4E6] rounded-2xl p-3 grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
            <label className="block md:col-span-2"><span className="text-[10px] font-bold uppercase text-[#7A8F98]">Ambiente</span><input list="ambientes" className={inp} value={e.ambiente} onChange={ev => upd(i, 'ambiente', ev.target.value)} /></label>
            <label className="block md:col-span-2"><span className="text-[10px] font-bold uppercase text-[#7A8F98]">Producto</span><select className={inp} value={e.producto} onChange={ev => upd(i, 'producto', ev.target.value)}>{cat?.productos.map((p: any) => <option key={p.key} value={p.key}>{p.icon} {p.nombre} · {cat.precios[p.key] ? clp(cat.precios[p.key]) + (p.por_unidad ? '/u' : '/m²') : 'a cotizar'}</option>)}</select></label>
            <label className="block"><span className="text-[10px] font-bold uppercase text-[#7A8F98]">Ancho cm</span><input className={inp} inputMode="decimal" value={e.ancho_cm} onChange={ev => upd(i, 'ancho_cm', ev.target.value.replace(',', '.'))} /></label>
            <label className="block"><span className="text-[10px] font-bold uppercase text-[#7A8F98]">Alto cm</span><input className={inp} inputMode="decimal" value={e.alto_cm} onChange={ev => upd(i, 'alto_cm', ev.target.value.replace(',', '.'))} /></label>
            <label className="block"><span className="text-[10px] font-bold uppercase text-[#7A8F98]">Cant.</span><input className={inp} inputMode="numeric" value={e.cantidad} onChange={ev => upd(i, 'cantidad', ev.target.value.replace(/\D/g, ''))} /></label>
            <label className="block md:col-span-2"><span className="text-[10px] font-bold uppercase text-[#7A8F98]">Color / tela</span><input list={`colores-${i}`} className={inp} placeholder="Ej: Blanco hueso, lino" value={e.color || ''} onChange={ev => upd(i, 'color', ev.target.value)} /><datalist id={`colores-${i}`}>{(cat?.productos.find((p: any) => p.key === e.producto)?.colores || []).map((c: string) => <option key={c} value={c} />)}</datalist></label>
            <label className="flex items-center gap-2 text-sm font-semibold py-2 md:col-span-2"><input type="checkbox" className="w-5 h-5 accent-[#0F766E]" checked={!!e.motorizado} onChange={ev => upd(i, 'motorizado', ev.target.checked)} /> Motorizada</label>
            <div className="flex items-center justify-end md:col-span-1"><button onClick={() => { setEsp(esp.filter((_, j) => j !== i)); setDirty(true) }} className="text-rose-500 p-2"><Trash2 size={16} /></button></div>
          </div>))}</div>
        <datalist id="ambientes">{AMBIENTES.map(a => <option key={a} value={a} />)}</datalist>
        <button onClick={() => setEsp([...esp, { ...vacio(), ambiente: AMBIENTES[Math.min(esp.length, AMBIENTES.length - 1)] }])} className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[#0F766E]"><Plus size={16} /> Agregar espacio</button>
      </section>

      {/* Cotizador tres niveles */}
      {calc && <section className="bg-white border border-[#DDE4E6] rounded-2xl p-4 md:p-5">
        <h2 className="font-bold text-sm mb-1">Propuesta · {calc.filas.length} espacios · {calc.m2_total} m²</h2>
        <p className="text-xs text-[#7A8F98] mb-3">El cliente ve tres formas de hacer el mismo proyecto. Marca la que recomiendas.</p>
        <div className="grid md:grid-cols-3 gap-2 mb-3">{Object.entries(calc.niveles).map(([k, n]: any) => (
          <button key={k} onClick={() => setNivel(k)} className={`text-left rounded-2xl border-2 p-4 ${nivel === k ? 'border-[#0B1F2A] bg-[#0B1F2A] text-white' : 'border-[#DDE4E6] bg-white'}`}><div className={`text-[10px] font-bold uppercase tracking-wide ${nivel === k ? 'text-[#C8B48A]' : 'text-[#7A8F98]'}`}>{n.nombre}{nivel === k ? ' · recomendado' : ''}</div><div className="text-2xl font-extrabold">{clp(n.total)}</div><div className={`text-[11px] ${nivel === k ? 'text-white/70' : 'text-[#7A8F98]'}`}>o 12 × {clp(n.mensual_12)}</div><div className={`text-[11px] mt-1 ${nivel === k ? 'text-white/80' : 'text-[#35505C]'}`}>{n.desc}</div></button>))}</div>
        <div className="grid sm:grid-cols-3 gap-2 mb-3">
          <label className="block"><span className="text-[11px] font-bold uppercase text-[#7A8F98]">Descuento % (por cerrar en 15 días)</span><input className={inp} inputMode="numeric" value={desc} onChange={e => setDesc(Math.min(30, Number(e.target.value.replace(/\D/g, '')) || 0))} /></label>
          <label className="block sm:col-span-2"><span className="text-[11px] font-bold uppercase text-[#7A8F98]">Mensaje personal</span><input className={inp} placeholder="Gracias por recibirnos hoy…" value={texto} onChange={e => setTexto(e.target.value)} /></label>
        </div>
        <div className="flex flex-wrap gap-4 text-sm mb-4"><label className="flex items-center gap-2"><input type="checkbox" className="w-5 h-5 accent-[#0F766E]" checked={mail} onChange={e => setMail(e.target.checked)} /> Correo con PDF</label><label className="flex items-center gap-2"><input type="checkbox" className="w-5 h-5 accent-[#0F766E]" checked={wa} onChange={e => setWa(e.target.checked)} /> WhatsApp automático</label></div>
        <button onClick={enviar} disabled={busy || !validos.length} className="bg-[#0B1F2A] disabled:opacity-50 text-white font-bold px-6 py-4 rounded-2xl text-base inline-flex items-center gap-2"><FileText size={18} /> {busy ? 'Generando…' : 'Generar propuesta y enviar'}</button>
      </section>}

      {l.propuestas?.length > 0 && <section className="bg-white border border-[#DDE4E6] rounded-2xl p-4 md:p-5"><h2 className="font-bold text-sm mb-2">Propuestas enviadas</h2>
        {l.propuestas.map((p: any) => (
          <div key={p.id} className="flex flex-wrap items-center gap-2 py-2 border-b border-[#DDE4E6] last:border-0 text-sm">
            <div className="flex-1 min-w-[200px]"><b>{p.aceptada_en ? `✅ Aceptó ${p.niveles[p.nivel_aceptado]?.nombre} · ${clp(p.niveles[p.nivel_aceptado]?.total)}` : `Sugerido ${p.niveles[p.nivel_sugerido]?.nombre} · ${clp(p.niveles[p.nivel_sugerido]?.total)}`}</b><div className="text-xs text-[#7A8F98]">{fecha(p.created_at)} · {p.enviado_email ? 'correo ✓' : 'sin correo'}{p.enviado_wa ? ' · WhatsApp ✓' : ''} · {p.aperturas ? `abierta ×${p.aperturas} (${hace(p.abierto_en)})` : 'aún no la abre'}{p.aceptada_en ? ` · aceptada ${hace(p.aceptada_en)} por ${p.aceptada_por}` : ''}</div></div>
            <a href={p.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#0F766E] bg-[#DDF4F0] px-3 py-2 rounded-xl">Ver web</a><a href={p.pdf_url} target="_blank" rel="noreferrer" className="text-xs font-bold bg-white border border-[#DDE4E6] px-3 py-2 rounded-xl">PDF</a>
            <button onClick={() => reenviar(p.id, 'email')} disabled={busy} className="text-xs font-bold bg-white border border-[#DDE4E6] px-3 py-2 rounded-xl inline-flex items-center gap-1"><RefreshCw size={12} /> Correo</button><button onClick={() => reenviar(p.id, 'whatsapp')} disabled={busy} className="text-xs font-bold bg-[#25D366] text-white px-3 py-2 rounded-xl">WhatsApp</button>
          </div>))}</section>}
    </div>
  )
}
