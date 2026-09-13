'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Flame, ExternalLink } from 'lucide-react'
import { vjson, hace, diasRestantes, fecha } from '../lib'

export default function Demos() {
  const [list, setList] = useState<any[]>([]); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('')
  const load = () => vjson('/demos').then(setList).catch(() => {})
  useEffect(() => { load() }, [])
  async function acc(id: number, a: string) { setBusy(true); try { const r = await vjson(`/demos/${id}/${a}`, { method: 'POST', body: a === 'extender' ? JSON.stringify({ dias: 5 }) : undefined }); setMsg(a === 'extender' ? `Extendido hasta ${fecha(r.vence)}` : 'Listo'); load() } catch (e: any) { setMsg(e.message) } finally { setBusy(false) } }
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-4"><p className="text-xs font-bold tracking-widest text-[#0F766E] uppercase">Demos</p><h1 className="text-2xl font-extrabold">Copias vivas de Los Álamos entregadas</h1><p className="text-sm text-[#7A8F98]">Cada prospecto tiene su propio edificio de prueba. Aquí ves quién lo está usando de verdad.</p></div>
      {msg && <p className="text-sm bg-[#DDF4F0] text-[#0F766E] rounded-xl px-3 py-2 mb-3">{msg}</p>}
      {list.length === 0 && <div className="bg-white border border-dashed border-[#DDE4E6] rounded-2xl p-8 text-center text-sm text-[#7A8F98]">Todavía no has entregado demos. Se crean al armar una propuesta desde la ficha de un edificio.</div>}
      {list.map(d => { const est = d.estado_actual; const dias = diasRestantes(d.vence); const t = d.telemetria; return (
        <div key={d.id} className="bg-white border border-[#DDE4E6] rounded-2xl p-4 mb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0"><Link href={`/ventas/edificios/${d.edificio_id}`} className="font-bold flex items-center gap-1.5">{d.edificio}{d.temperatura === 'caliente' && <Flame size={14} className="text-orange-500" />}</Link>
              <a href={`https://${d.dominio}/login`} target="_blank" rel="noreferrer" className="text-xs text-[#0F766E] inline-flex items-center gap-1">{d.dominio} <ExternalLink size={11} /></a>
              <div className="text-xs text-[#7A8F98]">{d.administrador_nombre || d.email} · creado {fecha(d.created_at)}</div></div>
            <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${d.estado === 'convertido' ? 'bg-emerald-100 text-emerald-800' : d.estado === 'eliminado' ? 'bg-slate-100 text-slate-500' : est?.vencido ? 'bg-rose-100 text-rose-700' : 'bg-teal-100 text-teal-800'}`}>{d.estado === 'convertido' ? 'Cliente' : d.estado === 'eliminado' ? 'Desactivado' : est?.vencido ? 'Vitrina (vencido)' : `Activo · ${dias}d`}</span>
          </div>
          <div className="mt-2 text-xs text-[#35505C] bg-slate-50 rounded-xl p-3">{t.ingresos ? <><b>{t.ingresos} ingreso(s)</b>, último {hace(t.ultimo)}. Vio: {t.modulos.map((m: any) => m.detalle).join(', ') || '—'}</> : 'Aún no ha entrado. Mándale un WhatsApp recordando las claves.'}</div>
          {d.estado === 'activo' && <div className="flex flex-wrap gap-2 mt-2">
            <button onClick={() => acc(d.id, 'extender')} disabled={busy} className="bg-white border border-[#DDE4E6] text-xs font-bold px-3 py-2 rounded-xl">+5 días</button>
            <button onClick={() => { if (confirm('¿Convertir en cliente?')) acc(d.id, 'convertir') }} disabled={busy} className="bg-emerald-600 text-white text-xs font-bold px-3 py-2 rounded-xl">Convertir en cliente</button>
            <button onClick={() => { if (confirm('¿Desactivar demo?')) acc(d.id, 'eliminar') }} disabled={busy} className="text-rose-600 text-xs font-bold px-3 py-2">Desactivar</button></div>}
        </div>) })}
    </div>
  )
}
