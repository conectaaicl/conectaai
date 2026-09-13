'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Flame, Bell, Hourglass, MailOpen, ChevronRight } from 'lucide-react'
import { vjson, clp, ETAPAS, hace } from '../lib'

export default function Hoy() {
  const [d, setD] = useState<any>(null)
  const [err, setErr] = useState('')
  useEffect(() => { vjson('/hoy').then(setD).catch(e => setErr(e.message)) }, [])
  const k = d?.kpis || {}
  const hoy = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div><p className="text-xs font-bold tracking-widest text-[#0F766E] uppercase">Mi día</p><h1 className="text-2xl md:text-3xl font-extrabold capitalize">{hoy}</h1>
          <p className="text-sm text-[#7A8F98]">{d ? `${d.tareas.length} pendientes · ${k.demos_activos} demos activos · ${k.visitas_hoy} visitas hoy` : 'Cargando…'}</p></div>
        <Link href="/ventas/visita" className="bg-[#0F766E] text-white font-bold px-6 py-4 rounded-2xl text-base shadow-lg shadow-teal-900/10 active:scale-95 transition">＋ Estoy en un edificio</Link>
      </div>
      {err && <p className="text-rose-700 bg-rose-50 rounded-xl px-3 py-2 text-sm mb-4">{err}</p>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[['Edificios', k.edificios], ['Propuestas enviadas', k.propuestas], ['Demos activos', k.demos_activos], ['Cerrados este mes', k.cerrados_mes]].map(([l, v]) => (
          <div key={l as string} className="bg-white border border-[#DDE4E6] rounded-2xl p-4"><div className="text-3xl font-extrabold tabular-nums">{v ?? '–'}</div><div className="text-[11px] font-semibold uppercase tracking-wide text-[#7A8F98]">{l}</div></div>))}
      </div>
      {k.valor_en_juego > 0 && <div className="mb-6 text-sm text-[#35505C]">Valor en juego: <b className="text-[#0B1F2A]">{clp(k.valor_en_juego)} / mes</b> en propuestas, demos y negociaciones.</div>}

      {d?.calientes?.length > 0 && <section className="mb-6">
        <h2 className="text-sm font-bold text-[#35505C] mb-2 flex items-center gap-2"><Flame size={16} className="text-orange-500" /> Están probando en serio</h2>
        {d.calientes.map((c: any, i: number) => (
          <Link key={i} href={`/ventas/edificios/${c.edificio_id}`} className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-2">
            <div className="flex-1 min-w-0"><b className="block">{c.titulo}</b><span className="text-xs text-orange-800 block truncate">{c.detalle}</span></div><ChevronRight className="text-orange-400" /></Link>))}
      </section>}

      <section className="mb-6">
        <h2 className="text-sm font-bold text-[#35505C] mb-2 flex items-center gap-2"><Bell size={16} /> Para hoy</h2>
        {d && d.tareas.length === 0 && <div className="bg-white border border-dashed border-[#DDE4E6] rounded-2xl p-6 text-center text-sm text-[#7A8F98]">Nada pendiente. Sal a visitar edificios: cada visita registrada alimenta el pipeline.</div>}
        {d?.tareas.map((t: any, i: number) => {
          const I = t.tipo === 'demo_vence' ? Hourglass : t.tipo === 'sin_abrir' ? MailOpen : Bell
          return (
            <Link key={i} href={`/ventas/edificios/${t.edificio_id}`} className="flex items-center gap-3 bg-white border border-[#DDE4E6] rounded-2xl p-4 mb-2 active:bg-slate-50">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${t.urgente ? 'bg-rose-100 text-rose-700' : 'bg-[#DDF4F0] text-[#0F766E]'}`}><I size={20} /></div>
              <div className="flex-1 min-w-0"><b className="block text-sm">{t.titulo}</b><span className="text-xs text-[#7A8F98] block truncate">{t.detalle}</span></div>
              <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${t.urgente ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{t.tipo === 'demo_vence' ? 'Demo' : t.tipo === 'sin_abrir' ? 'Reenviar' : t.cuando}</span>
            </Link>)
        })}
      </section>

      {d?.recientes?.length > 0 && <section>
        <h2 className="text-sm font-bold text-[#35505C] mb-2">Últimos movimientos</h2>
        <div className="bg-white border border-[#DDE4E6] rounded-2xl divide-y divide-[#DDE4E6]">
          {d.recientes.map((e: any) => (
            <Link key={e.id} href={`/ventas/edificios/${e.id}`} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0"><b className="block text-sm truncate">{e.nombre}</b><span className="text-xs text-[#7A8F98]">{e.comuna || ''}{e.unidades ? ` · ${e.unidades} unidades` : ''} · {hace(e.updated_at)}</span></div>
              <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${ETAPAS[e.etapa]?.color}`}>{ETAPAS[e.etapa]?.label}</span>
            </Link>))}
        </div>
      </section>}
    </div>
  )
}
