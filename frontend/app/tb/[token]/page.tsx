'use client'
import { useEffect, useState, use } from 'react'

const clp = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-CL')

export default function PropuestaTerraBlinds({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [d, setD] = useState<any>(null); const [err, setErr] = useState('')
  const [nivel, setNivel] = useState(''); const [nombre, setNombre] = useState(''); const [tel, setTel] = useState(''); const [com, setCom] = useState('')
  const [busy, setBusy] = useState(false); const [ok, setOk] = useState('')
  useEffect(() => { fetch(`/api/ventas-terreno/cortinas/p/${token}`).then(async r => { if (!r.ok) throw new Error('Propuesta no encontrada'); return r.json() }).then(x => { setD(x); setNivel(x.nivel_aceptado || x.nivel_sugerido); setNombre(x.cliente?.nombre || ''); setTel(x.cliente?.telefono || '') }).catch(e => setErr(e.message)) }, [token])
  async function aceptar() {
    setBusy(true)
    try { const r = await fetch(`/api/ventas-terreno/cortinas/p/${token}/aceptar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nivel, nombre, telefono: tel, comentario: com }) }); const j = await r.json(); if (!r.ok) throw new Error(j.detail || 'Error'); setOk(j.mensaje); setD({ ...d, aceptada: true, nivel_aceptado: nivel }) } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  if (err && !d) return <div className="min-h-screen flex items-center justify-center text-slate-600">{err}</div>
  if (!d) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-[#0B1F2A] border-t-transparent rounded-full animate-spin" /></div>
  const c = d.cliente; const n = d.niveles; const wa = `${d.wa}?text=${encodeURIComponent(`Hola, vi mi propuesta TerraBlinds (${c.nombre}) y tengo una consulta.`)}`
  return (
    <div className="min-h-screen bg-[#EEF3FF] text-[#0A1F5C]">
      <div className="bg-[#0A1F5C] text-white"><div className="max-w-3xl mx-auto px-5 pt-8 pb-14">
        {d.logo && /* eslint-disable-next-line @next/next/no-img-element */ <img src={d.logo} alt="TerraBlinds" width={92} height={92} className="w-[92px] h-[92px] rounded-2xl bg-white p-1.5 mb-5" />}
        <p className="text-[11px] font-bold tracking-[.14em] uppercase text-[#9DB9FF]">TerraBlinds · Propuesta de proyecto</p>
        <h1 className="text-3xl md:text-5xl font-extrabold mt-2 leading-tight">Las cortinas de {c.nombre.split(' ')[0]}</h1>
        <p className="text-white/70 mt-2">{d.espacios.length} espacios · {d.m2_total} m²{c.comuna ? ` · ${c.comuna}` : ''}</p>
        {d.mensaje && <p className="mt-5 text-white/90 text-lg leading-relaxed">“{d.mensaje}”</p>}
        <p className="mt-3 text-sm text-white/60">— {d.vendedor?.nombre}, TerraBlinds</p>
      </div></div>
      <div className="max-w-3xl mx-auto px-5 -mt-8 space-y-5 pb-16">
        {(d.aceptada || ok) && <div className="bg-emerald-600 text-white rounded-3xl p-5 shadow-xl"><b className="text-lg">✅ Propuesta aceptada · nivel {n[d.nivel_aceptado || nivel]?.nombre}</b><p className="text-sm text-white/90 mt-1">{ok || 'Ya registramos tu aceptación. Te contactaremos para coordinar telas e instalación.'}</p></div>}

        <section className="bg-white rounded-3xl border border-[#DDE4E6] shadow-xl p-6">
          <p className="text-[11px] font-bold tracking-[.12em] uppercase text-[#1F5FD6]">Tres formas de hacerlo</p><h2 className="text-xl font-extrabold mb-4">Elige tu nivel</h2>
          <div className="grid md:grid-cols-3 gap-3">{['esencial', 'confort', 'premium'].map(k => { const on = nivel === k; const rec = d.nivel_sugerido === k; return (
            <button key={k} disabled={d.aceptada} onClick={() => setNivel(k)} className={`text-left rounded-2xl border-2 p-4 transition ${on ? 'border-[#0A1F5C] bg-[#0A1F5C] text-white' : 'border-[#DDE4E6] bg-white'}`}>
              <div className={`text-[10px] font-bold uppercase tracking-wide ${on ? 'text-[#9DB9FF]' : 'text-[#7A8F98]'}`}>{n[k].nombre}{rec ? ' · recomendado' : ''}</div>
              <div className="text-2xl font-extrabold mt-1">{clp(n[k].total)}</div><div className={`text-xs ${on ? 'text-white/70' : 'text-[#7A8F98]'}`}>o 12 cuotas de {clp(n[k].mensual_12)}</div>
              <p className={`text-xs mt-2 ${on ? 'text-white/85' : 'text-[#35505C]'}`}>{n[k].desc}</p></button>) })}</div>
          {d.descuento_pct > 0 && <p className="text-xs text-[#1F5FD6] font-semibold mt-3">Incluye {d.descuento_pct}% de descuento por confirmar dentro de 15 días.</p>}
          {!d.aceptada && !ok && <div className="mt-5 grid md:grid-cols-3 gap-2">
            <input className="border border-[#DDE4E6] rounded-xl px-3 py-3 text-sm" placeholder="Tu nombre" value={nombre} onChange={e => setNombre(e.target.value)} />
            <input className="border border-[#DDE4E6] rounded-xl px-3 py-3 text-sm" placeholder="WhatsApp" inputMode="tel" value={tel} onChange={e => setTel(e.target.value)} />
            <input className="border border-[#DDE4E6] rounded-xl px-3 py-3 text-sm" placeholder="Comentario (opcional)" value={com} onChange={e => setCom(e.target.value)} />
            <button onClick={aceptar} disabled={busy || !nombre} className="md:col-span-3 bg-[#1F5FD6] disabled:opacity-50 text-white font-extrabold py-4 rounded-2xl text-base">{busy ? 'Enviando…' : `Aceptar nivel ${n[nivel]?.nombre} · ${clp(n[nivel]?.total)}`}</button>
            <p className="md:col-span-3 text-[11px] text-[#7A8F98] text-center">Al aceptar no pagas nada todavía: te contactamos para confirmar telas, colores y fecha. 50% al confirmar, 50% contra instalación.</p>
          </div>}
          {err && <p className="text-sm text-rose-700 mt-2">{err}</p>}
        </section>

        <section className="bg-white rounded-3xl border border-[#DDE4E6] p-6">
          <p className="text-[11px] font-bold tracking-[.12em] uppercase text-[#1F5FD6]">Tu proyecto</p><h2 className="text-xl font-extrabold mb-3">Espacio por espacio, tal como lo medimos</h2>
          <div className="divide-y divide-[#DDE4E6]">{d.espacios.map((f: any, i: number) => <div key={i} className="py-3 flex items-center gap-3 text-sm">{f.imagen ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={f.imagen} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" /> : /* eslint-disable-next-line @next/next/no-img-element */ <img src={d.logo} alt="" className="w-12 h-12 rounded-xl bg-white border border-[#DDE4E6] p-0.5 shrink-0" />}<div className="flex-1"><b>{f.ambiente}</b> · {f.producto_nombre}{f.motorizado ? ' · motorizada' : ''}<div className="text-xs text-[#7A8F98]">{f.ancho_cm}×{f.alto_cm} cm{f.cantidad > 1 ? ` ×${f.cantidad}` : ''} · {f.m2} m²{f.color ? ` · ${f.color}` : ''}</div></div><span className="text-xs text-[#7A8F98]">{f.a_cotizar ? 'a cotizar' : 'ref. ' + clp(f.subtotal)}</span></div>)}</div>
          <div className="grid sm:grid-cols-2 gap-3 mt-4">{Object.values(d.productos).map((p: any) => <div key={p.key} className="bg-[#EEF3FF] rounded-2xl p-4 flex gap-3 items-start">{p.imagen && /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.imagen} alt={p.nombre} className="w-20 h-20 rounded-xl object-cover shrink-0" />}<div><b>{p.nombre}</b><p className="text-xs text-[#35505C] mt-1">{p.desc}</p>{p.colores?.length > 0 && <p className="text-[11px] text-[#6B7A99] mt-1">Colores: {p.colores.slice(0, 6).join(", ")}</p>}</div></div>)}</div>
        </section>

        <section className="bg-white rounded-3xl border border-[#DDE4E6] p-6">
          <h2 className="text-xl font-extrabold mb-3">Por qué TerraBlinds</h2>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">{[['🏭', 'Fabricación propia', 'A la medida exacta de tu ventana, sin intermediarios: entrega en 7 a 12 días hábiles.'], ['🛠️', 'Instalación incluida', 'Nuestro equipo instala, prueba cada cortina y deja todo limpio.'], ['🛡️', 'Garantía por escrito', 'Mecanismos y telas cubiertos; servicio técnico post-venta.'], ['🎨', 'Asesoría en tu casa', 'Muestrario físico de telas y colores; te ayudamos a elegir.']].map(([i, t, s]) => <div key={t} className="flex gap-3"><span className="text-2xl">{i}</span><div><b>{t}</b><p className="text-[#35505C] text-xs mt-0.5">{s}</p></div></div>)}</div>
          <div className="mt-5 flex flex-wrap gap-2"><a href={d.pdf_url} className="bg-white border border-[#DDE4E6] font-bold px-4 py-3 rounded-xl text-sm">Descargar PDF</a><a href={wa} target="_blank" rel="noreferrer" className="bg-[#0A1F5C] text-white font-bold px-4 py-3 rounded-xl text-sm">Tengo una duda</a><a href={d.web} target="_blank" rel="noreferrer" className="font-bold px-4 py-3 rounded-xl text-sm text-[#1F5FD6]">terrablinds.cl →</a></div>
          <p className="text-[11px] text-[#7A8F98] mt-3">Precios con IVA · válidos 15 días · {d.vendedor?.nombre} · {d.vendedor?.telefono}</p>
        </section>
      </div>
    </div>
  )
}
