'use client'
import { useEffect, useState, use } from 'react'
import FirmaPad from '../../components/FirmaPad'

const clp = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-CL')

export default function PropuestaNegocio({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [d, setD] = useState<any>(null); const [err, setErr] = useState('')
  const [nombre, setNombre] = useState(''); const [tel, setTel] = useState(''); const [com, setCom] = useState(''); const [busy, setBusy] = useState(false); const [ok, setOk] = useState(''); const [firma, setFirma] = useState('')
  useEffect(() => { fetch(`/api/ventas-terreno/negocios/p/${token}`).then(async r => { if (!r.ok) throw new Error('Propuesta no encontrada'); return r.json() }).then(x => { setD(x); setNombre(x.negocio?.contacto || ''); setTel(x.negocio?.telefono || '') }).catch(e => setErr(e.message)) }, [token])
  async function aceptar() { setBusy(true); try { const r = await fetch(`/api/ventas-terreno/negocios/p/${token}/aceptar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre, telefono: tel, comentario: com, firma_data: firma || null }) }); const j = await r.json(); if (!r.ok) throw new Error(j.detail || 'Error'); setOk(j.mensaje); setD({ ...d, aceptada: true }) } catch (e: any) { setErr(e.message) } finally { setBusy(false) } }
  if (err && !d) return <div className="min-h-screen flex items-center justify-center text-slate-600">{err}</div>
  if (!d) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-[#0F766E] border-t-transparent rounded-full animate-spin" /></div>
  const n = d.negocio; const wa = `${d.wa}?text=${encodeURIComponent(`Hola ${d.vendedor?.nombre || ''}, vi la propuesta para ${n.nombre} y tengo una consulta.`)}`
  return (
    <div className="min-h-screen bg-[#F3F6F5] text-[#0B1F2A]">
      <div className="bg-[#0B1F2A] text-white"><div className="max-w-3xl mx-auto px-5 pt-8 pb-12">
        {/* eslint-disable-next-line @next/next/no-img-element */}<img src="/uploads/branding/conectaai/logo.png" alt="ConectaAI" width={92} height={92} className="w-[92px] h-[92px] rounded-2xl bg-white p-1.5 mb-5" />
        <p className="text-[11px] font-bold tracking-[.14em] uppercase text-[#7FD1C6]">Propuesta ConectaAI</p>
        <h1 className="text-3xl md:text-5xl font-extrabold mt-2 leading-tight">{n.nombre}</h1>
        <p className="text-white/70 mt-2">{[n.rubro, n.comuna].filter(Boolean).join(' · ')}</p>
        {d.mensaje && <p className="mt-5 text-white/90 text-lg leading-relaxed">“{d.mensaje}”</p>}<p className="mt-3 text-sm text-white/60">— {d.vendedor?.nombre}, ConectaAI</p>
      </div></div>
      <div className="max-w-3xl mx-auto px-5 -mt-6 space-y-5 pb-16">
        {(d.aceptada || ok) && <div className="bg-emerald-600 text-white rounded-3xl p-5 shadow-xl"><b className="text-lg">🚀 ¡Listo, partimos!</b><p className="text-sm text-white/90 mt-1">{ok || 'Ya registramos tu confirmación. Te contactamos hoy para la puesta en marcha.'}</p></div>}
        <section className="bg-white rounded-3xl border border-[#DDE4E6] shadow-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4"><div><div className="text-3xl font-extrabold">{clp(d.total_mensual)} <span className="text-base font-medium text-[#7A8F98]">/ mes</span></div><div className="text-sm text-[#35505C]">{d.total_setup ? `+ ${clp(d.total_setup)} de puesta en marcha (una vez) · ` : ''}IVA incluido · sin permanencia{d.descuento_pct ? ` · ${d.descuento_pct}% de descuento` : ''}{d.meses_gratis ? ` · ${d.meses_gratis} mes(es) gratis` : ''}</div></div><a href={d.pdf_url} className="bg-white border border-[#DDE4E6] font-bold px-4 py-3 rounded-xl text-sm">Descargar PDF</a></div>
          <div className="divide-y divide-[#DDE4E6]">{d.items.map((i: any) => <div key={i.producto} className="py-3 flex items-center gap-3 text-sm"><span className="text-2xl">{i.icon}</span><div className="flex-1"><b>{i.nombre}</b><div className="text-xs text-[#7A8F98]">{i.cantidad} {i.unidad}{i.setup ? ` · puesta en marcha ${clp(i.setup)}: ${i.setup_desc}` : ''}</div></div><b className="text-[#0F766E]">{clp(i.subtotal_mensual)}/mes</b></div>)}</div>
          {!d.aceptada && !ok && <div className="mt-5 grid md:grid-cols-3 gap-2">
            <input className="border border-[#DDE4E6] rounded-xl px-3 py-3 text-sm" placeholder="Tu nombre" value={nombre} onChange={e => setNombre(e.target.value)} /><input className="border border-[#DDE4E6] rounded-xl px-3 py-3 text-sm" placeholder="WhatsApp" inputMode="tel" value={tel} onChange={e => setTel(e.target.value)} /><input className="border border-[#DDE4E6] rounded-xl px-3 py-3 text-sm" placeholder="Comentario (opcional)" value={com} onChange={e => setCom(e.target.value)} />
            <div className="md:col-span-3"><FirmaPad onChange={setFirma} /></div>
            <button onClick={aceptar} disabled={busy || !nombre} className="md:col-span-3 bg-[#0F766E] disabled:opacity-50 text-white font-extrabold py-4 rounded-2xl text-base">{busy ? 'Enviando…' : 'Quiero partir'}</button>
            <p className="md:col-span-3 text-[11px] text-[#7A8F98] text-center">No pagas nada todavía: te contactamos para coordinar la puesta en marcha.</p></div>}
          {err && <p className="text-sm text-rose-700 mt-2">{err}</p>}
        </section>
        {d.dolores?.length > 0 && <section className="bg-white rounded-3xl border border-[#DDE4E6] p-6"><p className="text-[11px] font-bold tracking-[.12em] uppercase text-[#0F766E]">Lo que nos contaste</p><h2 className="text-xl font-extrabold mb-4">Tus prioridades y cómo las resolvemos</h2><div className="space-y-3">{d.dolores.map((x: any) => <div key={x.key} className="bg-[#DDF4F0] rounded-2xl p-4"><b>{x.titulo}</b><p className="text-sm text-[#35505C] mt-1">{x.solucion}</p></div>)}</div></section>}
        {Object.values(d.productos).map((p: any) => (
          <section key={p.id} className="bg-white rounded-3xl border border-[#DDE4E6] overflow-hidden">
            <div className="p-6 text-white" style={{ background: p.color }}><div className="text-3xl">{p.icon}</div><h2 className="text-2xl font-extrabold mt-1">{p.name}</h2><p className="text-white/85 text-sm">{p.web}</p></div>
            <div className="p-6"><p className="font-semibold text-lg leading-snug">{p.tagline}</p><p className="text-xs text-[#7A8F98] mt-1">Ideal para: {p.idealPara}</p>
              <ul className="mt-4 space-y-2">{p.benefits.map((b: string, i: number) => <li key={i} className="flex gap-2 text-sm text-[#35505C]"><span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />{b}</li>)}</ul>
              {p.demo?.url && <a href={p.demo.url} target="_blank" rel="noreferrer" className="inline-block mt-5 font-bold text-white px-5 py-3 rounded-xl text-sm" style={{ background: p.color }}>Pruébalo → <span className="font-normal text-white/80">{p.demo.nota}</span></a>}</div>
          </section>))}
        <section className="bg-white rounded-3xl border border-[#DDE4E6] p-6 text-center"><h2 className="text-xl font-extrabold">¿Lo vemos funcionando con tus datos?</h2><a href={wa} target="_blank" rel="noreferrer" className="inline-block mt-4 bg-[#0B1F2A] text-white font-bold px-6 py-3.5 rounded-2xl">Escribir a {d.vendedor?.nombre?.split(' ')[0] || 'ConectaAI'}</a><p className="text-[11px] text-[#7A8F98] mt-3">{d.vendedor?.nombre} · {d.vendedor?.telefono} · {d.vendedor?.email} · válida 15 días</p></section>
      </div>
    </div>
  )
}
