'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, MapPin } from 'lucide-react'
import { vjson, clp, hace, ETC } from '../lib'

const inp = 'w-full bg-white border border-[#DDE4E6] rounded-xl px-3 py-3 text-base text-[#0B1F2A] focus:outline-none focus:ring-2 focus:ring-[#C8B48A]'

export default function Cortinas() {
  const router = useRouter()
  const [q, setQ] = useState(''); const [etapa, setEtapa] = useState(''); const [list, setList] = useState<any[]>([])
  const [nuevo, setNuevo] = useState(false)
  const [f, setF] = useState<any>({ nombre: '', tipo: 'casa', direccion: '', comuna: '', telefono: '', email: '' })
  const [gps, setGps] = useState<any>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  useEffect(() => { const t = setTimeout(() => vjson(`/cortinas/leads?q=${encodeURIComponent(q)}&etapa=${etapa}`).then(setList).catch(() => {}), 250); return () => clearTimeout(t) }, [q, etapa])
  useEffect(() => {
    if (!nuevo || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude: lat, longitude: lng } = pos.coords; setGps({ lat, lng })
      try { const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=es`); const d = await r.json(); const a = d.address || {}
        setF((s: any) => ({ ...s, direccion: s.direccion || [a.road, a.house_number].filter(Boolean).join(' '), comuna: s.comuna || a.city_district || a.suburb || a.town || a.city || '' })) } catch {}
    }, () => {}, { enableHighAccuracy: true, timeout: 8000 })
  }, [nuevo])
  async function crear() {
    if (!f.nombre.trim()) { setErr('Nombre del cliente'); return }
    setBusy(true); setErr('')
    try { const l = await vjson('/cortinas/leads', { method: 'POST', body: JSON.stringify({ ...f, lat: gps?.lat, lng: gps?.lng }) }); router.push(`/ventas/cortinas/${l.id}`) } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4"><div><p className="text-xs font-bold tracking-widest text-[#8A7340] uppercase">TerraBlinds</p><h1 className="text-2xl font-extrabold">Cortinas</h1><p className="text-sm text-[#7A8F98]">Mide en terreno, propone tres niveles, el cliente acepta con un clic.</p></div><button onClick={() => setNuevo(!nuevo)} className="bg-[#0B1F2A] text-white font-bold px-5 py-3 rounded-2xl text-sm">＋ Nuevo cliente</button></div>
      {nuevo && <div className="bg-white border border-[#DDE4E6] rounded-2xl p-4 mb-4 grid md:grid-cols-2 gap-2">
        <input className={inp} placeholder="Nombre del cliente *" value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} />
        <div className="flex gap-2">{[['casa', 'Casa'], ['departamento', 'Depto'], ['oficina', 'Oficina'], ['comunidad', 'Edificio']].map(([k, l]) => <button key={k} onClick={() => setF({ ...f, tipo: k })} className={`flex-1 px-2 py-3 rounded-xl border text-sm font-semibold ${f.tipo === k ? 'bg-[#0B1F2A] text-white border-[#0B1F2A]' : 'bg-white border-[#DDE4E6] text-[#35505C]'}`}>{l}</button>)}</div>
        <input className={inp} placeholder="Dirección" value={f.direccion} onChange={e => setF({ ...f, direccion: e.target.value })} />
        <input className={inp} placeholder="Comuna" value={f.comuna} onChange={e => setF({ ...f, comuna: e.target.value })} />
        <input className={inp} placeholder="WhatsApp +56 9" inputMode="tel" value={f.telefono} onChange={e => setF({ ...f, telefono: e.target.value })} />
        <input className={inp} placeholder="Correo (recibe la propuesta)" type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
        {err && <p className="text-sm text-rose-700 md:col-span-2">{err}</p>}
        <div className="md:col-span-2 flex items-center gap-3"><button onClick={crear} disabled={busy} className="bg-[#0F766E] text-white font-bold px-5 py-3 rounded-xl text-sm">{busy ? 'Creando…' : 'Crear y medir espacios →'}</button><span className="text-xs text-[#7A8F98] inline-flex items-center gap-1"><MapPin size={12} />{gps ? 'Ubicación guardada' : 'Buscando GPS…'}</span></div>
      </div>}
      <div className="relative mb-3"><Search size={16} className="absolute left-3 top-3.5 text-[#7A8F98]" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Nombre, dirección, comuna o teléfono" className="w-full bg-white border border-[#DDE4E6] rounded-xl pl-9 pr-3 py-3 text-sm" /></div>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3">{[['', 'Todos'], ...Object.entries(ETC).map(([k, v]) => [k, v.label])].map(([k, l]) => <button key={k} onClick={() => setEtapa(k)} className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold border ${etapa === k ? 'bg-[#0B1F2A] text-white border-[#0B1F2A]' : 'bg-white border-[#DDE4E6] text-[#35505C]'}`}>{l}</button>)}</div>
      <div className="bg-white border border-[#DDE4E6] rounded-2xl divide-y divide-[#DDE4E6]">
        {list.length === 0 && <div className="p-8 text-center text-sm text-[#7A8F98]">Sin clientes de cortinas todavía.</div>}
        {list.map(l => (
          <Link key={l.id} href={`/ventas/cortinas/${l.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-slate-50">
            <div className="w-10 h-10 rounded-xl bg-[#F4EFE6] flex items-center justify-center text-lg shrink-0">🪟</div>
            <div className="flex-1 min-w-0"><b className="block text-sm truncate">{l.nombre}</b><span className="text-xs text-[#7A8F98] block truncate">{[l.comuna, l.tipo, l.espacios?.length ? `${l.espacios.length} espacios · ${l.m2_total} m²` : 'sin medir', l.origen !== 'terreno' ? `vía ${l.origen}` : null].filter(Boolean).join(' · ')} · {hace(l.updated_at)}</span></div>
            <div className="text-right shrink-0"><span className={`text-[11px] font-bold px-2 py-1 rounded-full ${ETC[l.etapa]?.color}`}>{ETC[l.etapa]?.label}</span>{l.estimado > 0 && <div className="text-[11px] text-[#35505C] mt-1 font-semibold">{clp(l.estimado)}</div>}{l.aperturas > 0 && <div className="text-[10px] text-[#7A8F98]">abrió ×{l.aperturas}</div>}</div>
          </Link>))}
      </div>
    </div>
  )
}
