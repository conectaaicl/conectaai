'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, MapPin } from 'lucide-react'
import { vjson, clp, hace, ETAPAS, RESULTADOS } from '../lib'

const inp = 'w-full bg-white border border-[#DDE4E6] rounded-xl px-3 py-3 text-base text-[#0B1F2A] focus:outline-none focus:ring-2 focus:ring-[#14B8A6]'
const Seg = ({ opts, value, onChange, multi = false }: any) => (
  <div className="flex flex-wrap gap-2">{opts.map(([k, l]: any) => { const on = multi ? value.includes(k) : value === k; return (
    <button type="button" key={k} onClick={() => onChange(multi ? (on ? value.filter((x: string) => x !== k) : [...value, k]) : k)} className={`px-3 py-2 rounded-xl border text-sm font-semibold ${on ? 'bg-[#0F766E] border-[#0F766E] text-white' : 'bg-white border-[#DDE4E6] text-[#35505C]'}`}>{l}</button>) })}</div>)

export default function Negocios() {
  const router = useRouter()
  const [cat, setCat] = useState<any>(null)
  const [q, setQ] = useState(''); const [etapa, setEtapa] = useState(''); const [list, setList] = useState<any[]>([])
  const [nuevo, setNuevo] = useState(false)
  const [f, setF] = useState<any>({ nombre: '', rubro: 'restaurante', direccion: '', comuna: '', contacto: '', telefono: '', email: '', productos: [], dolores: [], resultado: 'interesado', nota_visita: '', proxima_accion: 'Enviar propuesta', proxima_fecha: new Date().toISOString().slice(0, 10) })
  const [gps, setGps] = useState<any>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  useEffect(() => { vjson('/negocios/catalogo').then(setCat).catch(() => {}) }, [])
  useEffect(() => { const t = setTimeout(() => vjson(`/negocios/?q=${encodeURIComponent(q)}&etapa=${etapa}`).then(setList).catch(() => {}), 250); return () => clearTimeout(t) }, [q, etapa])
  useEffect(() => {
    if (!nuevo || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude: lat, longitude: lng } = pos.coords; setGps({ lat, lng })
      try { const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=es`); const d = await r.json(); const a = d.address || {}
        setF((s: any) => ({ ...s, direccion: s.direccion || [a.road, a.house_number].filter(Boolean).join(' '), comuna: s.comuna || a.city_district || a.suburb || a.town || a.city || '' })) } catch {}
    }, () => {}, { enableHighAccuracy: true, timeout: 8000 })
  }, [nuevo])
  async function crear(ir: boolean) {
    if (!f.nombre.trim()) { setErr('Nombre del negocio'); return }
    setBusy(true); setErr('')
    try { const n = await vjson('/negocios/', { method: 'POST', body: JSON.stringify({ ...f, lat: gps?.lat, lng: gps?.lng }) }); router.push(`/ventas/negocios/${n.id}${ir ? '?propuesta=1' : ''}`) } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4"><div><p className="text-xs font-bold tracking-widest text-[#0F766E] uppercase">Ecosistema ConectaAI</p><h1 className="text-2xl font-extrabold">Negocios</h1><p className="text-sm text-[#7A8F98]">Restaurantes, tiendas, talleres, oficinas: ConectaTap, MenuSmart, OmniFlow, Control y ConectaWork.</p></div><button onClick={() => setNuevo(!nuevo)} className="bg-[#0F766E] text-white font-bold px-5 py-3 rounded-2xl text-sm">＋ Estoy en un negocio</button></div>
      {nuevo && cat && <div className="bg-white border border-[#DDE4E6] rounded-2xl p-4 mb-4 space-y-3">
        <div className="grid md:grid-cols-2 gap-2">
          <input className={inp} placeholder="Nombre del negocio *" value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} />
          <select className={inp} value={f.rubro} onChange={e => setF({ ...f, rubro: e.target.value })}>{cat.rubros.map((r: string) => <option key={r} value={r}>{r}</option>)}</select>
          <input className={inp} placeholder="Dirección" value={f.direccion} onChange={e => setF({ ...f, direccion: e.target.value })} />
          <input className={inp} placeholder="Comuna" value={f.comuna} onChange={e => setF({ ...f, comuna: e.target.value })} />
          <input className={inp} placeholder="Con quién hablaste" value={f.contacto} onChange={e => setF({ ...f, contacto: e.target.value })} />
          <input className={inp} placeholder="WhatsApp +56 9" inputMode="tel" value={f.telefono} onChange={e => setF({ ...f, telefono: e.target.value })} />
          <input className={inp} placeholder="Correo (recibe la propuesta)" type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
        </div>
        <div><div className="text-[11px] font-bold uppercase text-[#7A8F98] mb-1">Productos que le interesan</div><Seg multi opts={cat.productos.map((p: any) => [p.id, `${p.icon} ${p.name}`])} value={f.productos} onChange={(v: any) => setF({ ...f, productos: v })} /></div>
        <div><div className="text-[11px] font-bold uppercase text-[#7A8F98] mb-1">Lo que le duele</div><Seg multi opts={Object.entries(cat.dolores).map(([k, v]: any) => [k, v[0]])} value={f.dolores} onChange={(v: any) => setF({ ...f, dolores: v })} /></div>
        <div><div className="text-[11px] font-bold uppercase text-[#7A8F98] mb-1">Resultado</div><Seg opts={Object.entries(RESULTADOS)} value={f.resultado} onChange={(v: any) => setF({ ...f, resultado: v })} /></div>
        <textarea className={inp + ' h-16'} placeholder="Nota" value={f.nota_visita} onChange={e => setF({ ...f, nota_visita: e.target.value })} />
        {err && <p className="text-sm text-rose-700">{err}</p>}
        <div className="flex flex-wrap items-center gap-3"><button onClick={() => crear(true)} disabled={busy} className="bg-[#0F766E] text-white font-bold px-5 py-3 rounded-xl text-sm">{busy ? 'Guardando…' : 'Guardar y armar propuesta →'}</button><button onClick={() => crear(false)} disabled={busy} className="bg-white border border-[#DDE4E6] font-bold px-5 py-3 rounded-xl text-sm">Solo guardar</button><span className="text-xs text-[#7A8F98] inline-flex items-center gap-1"><MapPin size={12} />{gps ? 'Ubicación guardada' : 'Buscando GPS…'}</span></div>
      </div>}
      <div className="relative mb-3"><Search size={16} className="absolute left-3 top-3.5 text-[#7A8F98]" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Nombre, rubro, comuna o contacto" className="w-full bg-white border border-[#DDE4E6] rounded-xl pl-9 pr-3 py-3 text-sm" /></div>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3">{[['', 'Todos'], ...Object.entries(ETAPAS).map(([k, v]) => [k, v.label])].map(([k, l]) => <button key={k} onClick={() => setEtapa(k)} className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold border ${etapa === k ? 'bg-[#0B1F2A] text-white border-[#0B1F2A]' : 'bg-white border-[#DDE4E6] text-[#35505C]'}`}>{l}</button>)}</div>
      <div className="bg-white border border-[#DDE4E6] rounded-2xl divide-y divide-[#DDE4E6]">
        {list.length === 0 && <div className="p-8 text-center text-sm text-[#7A8F98]">Sin negocios todavía.</div>}
        {list.map(n => (
          <Link key={n.id} href={`/ventas/negocios/${n.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-slate-50">
            <div className="w-10 h-10 rounded-xl bg-[#F3F6F5] flex items-center justify-center text-lg shrink-0">{(cat?.productos.find((p: any) => p.id === (n.productos || [])[0]) || {}).icon || '🏪'}</div>
            <div className="flex-1 min-w-0"><b className="block text-sm truncate">{n.nombre}</b><span className="text-xs text-[#7A8F98] block truncate">{[n.rubro, n.comuna, (n.productos || []).map((x: string) => cat?.productos.find((p: any) => p.id === x)?.name || x).join(', ')].filter(Boolean).join(' · ')} · {hace(n.updated_at)}</span></div>
            <div className="text-right shrink-0"><span className={`text-[11px] font-bold px-2 py-1 rounded-full ${ETAPAS[n.etapa]?.color}`}>{ETAPAS[n.etapa]?.label}</span>{n.valor_mensual > 0 && <div className="text-[11px] text-[#35505C] mt-1 font-semibold">{clp(n.valor_mensual)}/mes</div>}{n.aceptada_en && <div className="text-[10px] text-emerald-700 font-bold">quiere partir</div>}</div>
          </Link>))}
      </div>
    </div>
  )
}
