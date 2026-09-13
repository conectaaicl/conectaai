'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Flame } from 'lucide-react'
import { vjson, clp, ETAPAS, hace, diasRestantes } from '../lib'

export default function Pipeline() {
  const [d, setD] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const load = () => vjson('/pipeline').then(setD).catch(() => {})
  useEffect(() => { load() }, [])
  async function mover(id: number, etapa: string) { setBusy(true); try { await vjson(`/edificios/${id}`, { method: 'PATCH', body: JSON.stringify({ etapa }) }); await load() } finally { setBusy(false) } }
  if (!d) return <div className="p-8 text-sm text-[#7A8F98]">Cargando…</div>
  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4 max-w-7xl mx-auto"><div><p className="text-xs font-bold tracking-widest text-[#0F766E] uppercase">Pipeline</p><h1 className="text-2xl font-extrabold">Dónde está cada edificio</h1></div><span className="text-sm text-[#35505C]">Valor en juego: <b>{clp(d.valor_en_juego)} / mes</b></span></div>
      <div className="overflow-x-auto -mx-4 px-4 pb-4"><div className="grid grid-flow-col auto-cols-[260px] md:auto-cols-[minmax(220px,1fr)] gap-3 min-w-max md:min-w-0 max-w-7xl mx-auto">
        {d.etapas.map((et: string) => { const col = d.columnas[et] || []; const E = ETAPAS[et]; return (
          <div key={et} className="bg-white border border-[#DDE4E6] rounded-2xl p-2.5 min-h-[300px]">
            <div className="flex items-center justify-between px-1 mb-2"><span className={`text-[11px] font-bold uppercase tracking-wide px-2 py-1 rounded-full ${E.color}`}>{E.label}</span><span className="text-xs text-[#7A8F98] font-bold">{col.length}</span></div>
            {col.map((c: any) => { const dias = diasRestantes(c.demo_vence); return (
              <div key={c.id} className="bg-[#F3F6F5] border border-[#DDE4E6] rounded-xl p-3 mb-2">
                <Link href={`/ventas/edificios/${c.id}`} className="block"><b className="text-sm flex items-center gap-1">{c.nombre}{c.temperatura === 'caliente' && <Flame size={12} className="text-orange-500" />}</b>
                  <div className="text-[11px] text-[#7A8F98]">{[c.comuna, c.unidades ? `${c.unidades} u.` : null, c.valor_mensual ? clp(c.valor_mensual) + '/mes' : null].filter(Boolean).join(' · ')}</div>
                  <div className="text-[11px] text-[#35505C] mt-1">{et === 'propuesta' ? (c.aperturas ? `Abierta ×${c.aperturas} · ${hace(c.abierto_en)}` : c.enviado_en ? `Sin abrir · enviada ${hace(c.enviado_en)}` : 'No enviada') : et === 'demo' ? (dias !== null ? `${dias > 0 ? `Vence en ${dias}d` : 'Vencido'} · ${c.demo_ingresos || 0} ingresos` : '') : c.proxima_accion ? `${c.proxima_accion}${c.proxima_fecha ? ' · ' + c.proxima_fecha.slice(5) : ''}` : hace(c.updated_at)}</div></Link>
                <select value={et} disabled={busy} onChange={ev => mover(c.id, ev.target.value)} className="mt-2 w-full text-[11px] font-semibold bg-white border border-[#DDE4E6] rounded-lg px-2 py-1.5 text-[#35505C]">{d.etapas.map((x: string) => <option key={x} value={x}>{x === et ? 'Mover a…' : ETAPAS[x].label}</option>)}</select>
              </div>) })}
          </div>) })}
      </div></div>
    </div>
  )
}
