'use client'
import { useEffect, useState } from 'react'
import { vjson, clp, ETAPAS } from '../lib'

const Card = ({ title, children }: any) => <section className="bg-white border border-[#DDE4E6] rounded-2xl p-4 md:p-5"><h2 className="font-bold text-sm mb-3">{title}</h2>{children}</section>
const Bar = ({ v, max, color = '#0F766E' }: { v: number; max: number; color?: string }) => <div className="h-2 bg-[#F3F6F5] rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${max ? Math.round((v / max) * 100) : 0}%`, background: color }} /></div>

export default function Resultados() {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState('')
  useEffect(() => { vjson('/resultados').then(setD).catch(e => setErr(e.message)) }, [])
  if (err) return <div className="p-8 text-sm text-rose-700">{err}</div>
  if (!d) return <div className="p-8 text-sm text-[#7A8F98]">Cargando…</div>
  const t = d.totales || {}
  const maxE = Math.max(1, ...d.embudo.map((x: any) => Number(x.n)))
  const maxC = Math.max(1, ...d.comunas.map((x: any) => Number(x.edificios)))
  const maxS = Math.max(1, ...d.semanas.map((x: any) => Number(x.visitas)))
  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-4">
      <div><p className="text-xs font-bold tracking-widest text-[#0F766E] uppercase">Resultados</p><h1 className="text-2xl font-extrabold">Cómo va la venta</h1></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[['Prospectos', Number(t.edificios || 0) + Number(t.negocios || 0) + Number(t.cortinas || 0), `${t.edificios} edificios · ${t.negocios} negocios · ${t.cortinas} cortinas`], ['Propuestas', t.propuestas, 'enviadas en total'], ['Cerrados', t.cerrados, 'clientes + cortinas aceptadas'], ['Recurrente', clp(Number(t.mrr || 0)) + '/mes', `+ ${clp(Number(t.cortinas_vendido || 0))} en cortinas`]].map(([l, v, s]) => (
          <div key={l as string} className="bg-white border border-[#DDE4E6] rounded-2xl p-4"><div className="text-2xl font-extrabold tabular-nums">{v as any}</div><div className="text-[11px] font-semibold uppercase tracking-wide text-[#7A8F98]">{l as string}</div><div className="text-[11px] text-[#7A8F98]">{s as string}</div></div>))}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Embudo de condominios">{Object.keys(ETAPAS).map(et => { const r = d.embudo.find((x: any) => x.etapa === et) || { n: 0, valor: 0 }; return <div key={et} className="mb-2"><div className="flex justify-between text-xs mb-1"><span className="font-semibold">{ETAPAS[et].label}</span><span className="text-[#7A8F98]">{r.n} · {clp(Number(r.valor))}/mes</span></div><Bar v={Number(r.n)} max={maxE} /></div> })}</Card>
        <Card title="Demos">
          <div className="grid grid-cols-2 gap-2 text-sm">{[['Entregados', d.demos.total], ['Activos', d.demos.activos], ['Con uso real', d.demos.con_uso], ['Convertidos', d.demos.convertidos]].map(([l, v]) => <div key={l as string} className="bg-[#F3F6F5] rounded-xl p-3"><div className="text-xl font-extrabold">{v ?? 0}</div><div className="text-[11px] text-[#7A8F98]">{l as string}</div></div>)}</div>
          <p className="text-xs text-[#7A8F98] mt-3">Conversión demo → cliente: <b>{d.demos.total ? Math.round((Number(d.demos.convertidos || 0) / Number(d.demos.total)) * 100) : 0}%</b>{Number(d.demos.total) > 0 && Number(d.demos.con_uso) < Number(d.demos.total) ? ` · ${Number(d.demos.total) - Number(d.demos.con_uso)} demo(s) nunca abiertos: reenvía las claves por WhatsApp.` : ''}</p>
        </Card>
        <Card title="Por comuna">{d.comunas.length === 0 ? <p className="text-sm text-[#7A8F98]">Sin datos.</p> : d.comunas.map((c: any) => <div key={c.comuna} className="mb-2"><div className="flex justify-between text-xs mb-1"><span className="font-semibold">{c.comuna}</span><span className="text-[#7A8F98]">{c.edificios} edif. · {c.unidades} u. · {c.clientes} cliente(s) · {c.en_curso} en curso</span></div><Bar v={Number(c.edificios)} max={maxC} color="#2563EB" /></div>)}</Card>
        <Card title="Visitas por semana">{d.semanas.length === 0 ? <p className="text-sm text-[#7A8F98]">Sin visitas aún.</p> : <div className="flex items-end gap-1 h-32">{d.semanas.map((s: any) => <div key={s.semana} className="flex-1 flex flex-col items-center gap-1"><div className="w-full bg-[#0F766E] rounded-t-md" style={{ height: `${(Number(s.visitas) / maxS) * 100}%` }} /><span className="text-[9px] text-[#7A8F98]">{s.semana}</span></div>)}</div>}</Card>
        <Card title="Por vendedor"><div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-[#7A8F98] text-left"><th className="py-1">Vendedor</th><th>Visitas 30d</th><th>Edif.</th><th>Prop.</th><th>Abiertas</th><th>Clientes</th><th>MRR</th><th>Cortinas</th><th>Negocios</th></tr></thead><tbody>{d.vendedores.map((v: any) => <tr key={v.nombre} className="border-t border-[#DDE4E6]"><td className="py-1.5 font-semibold">{v.nombre}</td><td>{v.visitas_30d}</td><td>{v.edificios}</td><td>{v.propuestas}</td><td>{v.abiertas}</td><td>{v.clientes}</td><td>{clp(Number(v.mrr))}</td><td>{v.cortinas_aceptadas}</td><td>{v.negocios_aceptados}</td></tr>)}</tbody></table></div></Card>
        <Card title="Productos más propuestos">
          {d.productos.length === 0 && d.cortinas.length === 0 && <p className="text-sm text-[#7A8F98]">Sin propuestas aún.</p>}
          {d.productos.map((p: any) => <div key={p.producto} className="flex justify-between text-sm py-1 border-b border-[#DDE4E6] last:border-0"><span>{p.producto}</span><span className="text-[#7A8F98]">{p.propuestas} propuestas · {p.aceptadas} aceptadas</span></div>)}
          {d.cortinas.map((p: any) => <div key={p.producto} className="flex justify-between text-sm py-1 border-b border-[#DDE4E6] last:border-0"><span>🪟 {p.producto}</span><span className="text-[#7A8F98]">{p.espacios} espacios · {p.m2} m²</span></div>)}
        </Card>
      </div>
    </div>
  )
}
