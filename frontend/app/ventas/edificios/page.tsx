'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { vjson, ETAPAS, hace, diasRestantes } from '../lib'

export default function Edificios() {
  const [q, setQ] = useState(''); const [etapa, setEtapa] = useState(''); const [list, setList] = useState<any[]>([])
  useEffect(() => { const t = setTimeout(() => vjson(`/edificios?q=${encodeURIComponent(q)}&etapa=${etapa}`).then(setList).catch(() => {}), 250); return () => clearTimeout(t) }, [q, etapa])
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4"><div><p className="text-xs font-bold tracking-widest text-[#0F766E] uppercase">Cartera</p><h1 className="text-2xl font-extrabold">Edificios</h1></div><Link href="/ventas/visita" className="bg-[#0F766E] text-white font-bold px-5 py-3 rounded-2xl text-sm">＋ Nueva visita</Link></div>
      <div className="flex gap-2 mb-3"><div className="relative flex-1"><Search size={16} className="absolute left-3 top-3.5 text-[#7A8F98]" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Nombre, dirección, comuna o administrador" className="w-full bg-white border border-[#DDE4E6] rounded-xl pl-9 pr-3 py-3 text-sm" /></div></div>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3">{[['', 'Todos'], ...Object.entries(ETAPAS).map(([k, v]) => [k, v.label])].map(([k, l]) => <button key={k} onClick={() => setEtapa(k)} className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold border ${etapa === k ? 'bg-[#0B1F2A] text-white border-[#0B1F2A]' : 'bg-white border-[#DDE4E6] text-[#35505C]'}`}>{l}</button>)}</div>
      <div className="bg-white border border-[#DDE4E6] rounded-2xl divide-y divide-[#DDE4E6]">
        {list.length === 0 && <div className="p-8 text-center text-sm text-[#7A8F98]">Sin edificios todavía.</div>}
        {list.map(e => { const dias = diasRestantes(e.demo_vence); return (
          <Link key={e.id} href={`/ventas/edificios/${e.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-slate-50">
            <div className="w-10 h-10 rounded-xl bg-[#F3F6F5] flex items-center justify-center text-lg shrink-0">{e.tipo === 'casas' ? '🏘️' : '🏢'}</div>
            <div className="flex-1 min-w-0"><b className="block text-sm truncate">{e.nombre}</b><span className="text-xs text-[#7A8F98] block truncate">{[e.comuna, e.unidades ? `${e.unidades} unidades` : null, e.administrador_nombre].filter(Boolean).join(' · ')} · {e.visitas} visita(s) · {hace(e.updated_at)}</span></div>
            <div className="text-right shrink-0"><span className={`text-[11px] font-bold px-2 py-1 rounded-full ${ETAPAS[e.etapa]?.color}`}>{ETAPAS[e.etapa]?.label}</span>{e.demo_estado === 'activo' && dias !== null && <div className={`text-[10px] mt-1 ${dias <= 1 ? 'text-rose-600 font-bold' : 'text-[#7A8F98]'}`}>demo {dias > 0 ? `${dias}d` : 'vencido'}</div>}{e.aperturas > 0 && <div className="text-[10px] text-[#7A8F98]">abrió ×{e.aperturas}</div>}</div>
          </Link>) })}
      </div>
    </div>
  )
}
