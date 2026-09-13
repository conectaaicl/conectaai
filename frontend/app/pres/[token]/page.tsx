'use client'
import { useEffect, useState, use } from 'react'

export default function PresentacionPublica({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [d, setD] = useState<any>(null); const [err, setErr] = useState('')
  useEffect(() => { fetch(`/api/ventas-terreno/pres/${token}`).then(async r => { if (!r.ok) throw new Error('Presentación no encontrada'); return r.json() }).then(setD).catch(e => setErr(e.message)) }, [token])
  if (err) return <div className="min-h-screen flex items-center justify-center text-slate-600">{err}</div>
  if (!d) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-[#0F766E] border-t-transparent rounded-full animate-spin" /></div>
  const wa = `${d.wa}?text=${encodeURIComponent(`Hola ${d.vendedor?.nombre || ''}, vi la presentación de ConectaAI y quiero saber más.`)}`
  return (
    <div className="min-h-screen bg-[#0B1F2A] text-white">
      <div className="max-w-3xl mx-auto px-5 pt-12 pb-10">
        <p className="text-[11px] font-bold tracking-[.14em] uppercase text-[#7FD1C6]">Presentación ConectaAI</p>
        <h1 className="text-3xl md:text-5xl font-extrabold mt-2">Hola {d.nombre}</h1>
        <p className="text-white/70 mt-2 text-lg">{d.empresa ? `Herramientas pensadas para ${d.empresa}.` : 'Herramientas de IA para tu negocio, en servidor propio y en español.'}</p>
        <div className="flex flex-wrap gap-2 mt-5"><a href={d.pdf_url} className="bg-white/10 border border-white/20 font-bold px-4 py-3 rounded-xl text-sm">Descargar PDF</a><a href={wa} target="_blank" rel="noreferrer" className="bg-[#14B8A6] text-[#0B1F2A] font-bold px-4 py-3 rounded-xl text-sm">Conversemos por WhatsApp</a></div>
      </div>
      <div className="bg-[#F3F6F5] text-[#0B1F2A]"><div className="max-w-3xl mx-auto px-5 py-10 space-y-5">
        {d.productos.map((p: any) => (
          <section key={p.id} className="bg-white rounded-3xl border border-[#DDE4E6] overflow-hidden">
            <div className="p-6 text-white" style={{ background: p.color }}><div className="text-3xl">{p.icon}</div><h2 className="text-2xl font-extrabold mt-1">{p.name}</h2><p className="text-white/85 text-sm">{p.web}</p></div>
            <div className="p-6"><p className="font-semibold text-lg leading-snug">{p.tagline}</p><p className="text-xs text-[#7A8F98] mt-1">Ideal para: {p.idealPara}</p>
              <ul className="mt-4 space-y-2">{p.benefits.map((b: string, i: number) => <li key={i} className="flex gap-2 text-sm text-[#35505C]"><span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />{b}</li>)}</ul>
              {p.landingUrl && <a href={p.landingUrl} target="_blank" rel="noreferrer" className="inline-block mt-5 font-bold text-white px-5 py-3 rounded-xl text-sm" style={{ background: p.color }}>Ver demo en vivo →</a>}</div>
          </section>))}
        <section className="bg-white rounded-3xl border border-[#DDE4E6] p-6 text-center"><h2 className="text-xl font-extrabold">¿Lo vemos en 20 minutos?</h2><p className="text-sm text-[#35505C] mt-1">Te muestro el que más te sirva funcionando con tus datos.</p><a href={wa} target="_blank" rel="noreferrer" className="inline-block mt-4 bg-[#0F766E] text-white font-bold px-6 py-3.5 rounded-2xl">Escribir a {d.vendedor?.nombre?.split(' ')[0] || 'ConectaAI'}</a><p className="text-[11px] text-[#7A8F98] mt-3">{d.vendedor?.nombre} · {d.vendedor?.telefono} · {d.vendedor?.email}</p></section>
      </div></div>
    </div>
  )
}
