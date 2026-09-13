'use client'
import { useEffect, useState } from 'react'
import { RotateCcw, Save, ShieldAlert } from 'lucide-react'
import { vfetch, vjson, clp } from '../lib'

type Cfg = { valor: any; guardado: boolean; actualizado_por: string | null; updated_at: string | null }
type Todo = { condominios: Cfg; negocios: Cfg; cortinas: Cfg }

const NOMBRES: Record<string, string> = { conectatap: 'ConectaTap', menusmart: 'MenuSmart', condominios: 'ConectaAI Condominios', control: 'Control ConectaAI', working: 'ConectaWork', omniflow: 'OmniFlow' }
const NIVEL: Record<string, string> = { esencial: 'Esencial', confort: 'Confort', premium: 'Premium' }

const Num = ({ v, on, step = 1, w = 'w-28' }: { v: number; on: (n: number) => void; step?: number; w?: string }) => (
  <input type="number" inputMode="decimal" step={step} min={0} value={v ?? 0} onChange={e => on(Number(e.target.value))}
    className={`${w} border border-[#DDE4E6] rounded-lg px-2 py-1.5 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0F766E]/40`} />
)

function Seccion({ titulo, sub, cfg, dirty, guardando, onSave, onReset, children }: any) {
  return (
    <section className="bg-white border border-[#DDE4E6] rounded-2xl p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div><h2 className="font-bold">{titulo}</h2><p className="text-xs text-[#7A8F98]">{sub}</p></div>
        <div className="flex items-center gap-2">
          {cfg.guardado
            ? <span className="text-[11px] px-2 py-1 rounded-full bg-[#DDF4F0] text-[#0F766E] font-semibold" title={cfg.updated_at ? new Date(cfg.updated_at).toLocaleString('es-CL') : ''}>Editado por {cfg.actualizado_por}</span>
            : <span className="text-[11px] px-2 py-1 rounded-full bg-[#F3F6F5] text-[#7A8F98] font-semibold">Valores por defecto</span>}
          {cfg.guardado && <button onClick={onReset} className="text-xs flex items-center gap-1 text-[#7A8F98] hover:text-rose-600"><RotateCcw size={13} /> Restablecer</button>}
          <button onClick={onSave} disabled={!dirty || guardando} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold bg-[#0F766E] text-white disabled:opacity-40"><Save size={14} /> {guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
      {children}
    </section>
  )
}

export default function Precios() {
  const [d, setD] = useState<Todo | null>(null)
  const [orig, setOrig] = useState<string>('')
  const [me, setMe] = useState<any>(null)
  const [err, setErr] = useState(''); const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState('')

  async function cargar() {
    const t = await vjson<Todo>('/config'); setD(t); setOrig(JSON.stringify(t))
  }
  useEffect(() => { vjson('/auth/me').then(setMe).catch(() => {}); cargar().catch(e => setErr(e.message)) }, [])

  const dirty = (k: keyof Todo) => d && orig ? JSON.stringify(d[k].valor) !== JSON.stringify(JSON.parse(orig)[k].valor) : false
  const set = (k: keyof Todo, fn: (v: any) => void) => setD(p => { if (!p) return p; const c = structuredClone(p); fn(c[k].valor); return c })

  async function guardar(k: keyof Todo) {
    if (!d) return; setBusy(k); setErr(''); setMsg('')
    const r = await vfetch(`/config/${k}`, { method: 'PUT', body: JSON.stringify({ valor: d[k].valor }) })
    const j = await r.json().catch(() => ({}))
    setBusy('')
    if (!r.ok) { setErr(j.detail || 'No se pudo guardar'); return }
    setMsg('Precios guardados. Las próximas propuestas y cotizaciones usan estos valores.'); await cargar()
  }
  async function restablecer(k: keyof Todo) {
    if (!confirm('¿Volver a los valores por defecto del sistema para esta sección?')) return
    const r = await vfetch(`/config/${k}/restablecer`, { method: 'POST' })
    if (!r.ok) { setErr('No se pudo restablecer'); return }
    setMsg('Valores restablecidos.'); await cargar()
  }

  if (err && !d) return <div className="p-8 text-sm text-rose-700">{err}</div>
  if (!d) return <div className="p-8 text-sm text-[#7A8F98]">Cargando…</div>
  if (me && me.rol !== 'admin') return <div className="p-8 max-w-lg"><div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm text-amber-900 flex gap-3"><ShieldAlert className="shrink-0" /> Solo el administrador de ventas puede cambiar precios. Los tuyos se aplican automáticamente en cada propuesta.</div></div>

  const c = d.condominios.valor, n = d.negocios.valor, t = d.cortinas.valor

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-4">
      <div><p className="text-xs font-bold tracking-widest text-[#0F766E] uppercase">Precios</p><h1 className="text-2xl font-extrabold">Lista de precios</h1>
        <p className="text-sm text-[#7A8F98] mt-1">Lo que cambies aquí rige para las propuestas, PDFs y cotizaciones que se generen desde ahora. Las propuestas ya enviadas conservan su precio. Valores en CLP, IVA incluido.</p></div>
      {err && <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl px-4 py-2">{err}</div>}
      {msg && <div className="bg-[#DDF4F0] border border-[#0F766E]/20 text-[#0F766E] text-sm rounded-xl px-4 py-2">{msg}</div>}

      <Seccion titulo="Condominios" sub="Precio mensual por unidad (departamento o casa) de cada módulo." cfg={d.condominios} dirty={dirty('condominios')} guardando={busy === 'condominios'} onSave={() => guardar('condominios')} onReset={() => restablecer('condominios')}>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-[11px] uppercase tracking-wide text-[#7A8F98] text-left"><th className="py-1">Módulo</th><th className="text-right">$/unidad/mes</th></tr></thead>
          <tbody>{c.modulos.map((m: any, i: number) => (
            <tr key={m.key} className="border-t border-[#DDE4E6]"><td className="py-2"><div className="font-semibold">{m.nombre}</div><div className="text-xs text-[#7A8F98]">{m.detalle}</div></td>
              <td className="text-right"><Num v={m.precio} on={x => set('condominios', v => { v.modulos[i].precio = x })} step={10} /></td></tr>))}
          </tbody></table></div>
        <div className="mt-3 flex items-center justify-between gap-3 bg-[#F3F6F5] rounded-xl px-3 py-2 text-sm"><div><b>Mínimo mensual</b><div className="text-xs text-[#7A8F98]">Un edificio chico nunca paga menos que esto por mes.</div></div><Num v={c.minimo_mensual} on={x => set('condominios', v => { v.minimo_mensual = x })} step={1000} /></div>
        <p className="text-xs text-[#7A8F98] mt-2">Ejemplo: 60 unidades con plan base = {clp(60 * Number(c.modulos.find((m: any) => m.key === 'base')?.precio || 0))}/mes.</p>
      </Seccion>

      <Seccion titulo="Negocios" sub="Planes de ConectaTap, MenuSmart, Control, ConectaWork y OmniFlow." cfg={d.negocios} dirty={dirty('negocios')} guardando={busy === 'negocios'} onSave={() => guardar('negocios')} onReset={() => restablecer('negocios')}>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-[11px] uppercase tracking-wide text-[#7A8F98] text-left"><th className="py-1">Producto</th><th className="text-right">Mensual</th><th className="text-right">Mínimo</th><th className="text-right">Puesta en marcha</th></tr></thead>
          <tbody>{Object.entries(n.planes).map(([k, p]: any) => (
            <tr key={k} className="border-t border-[#DDE4E6]"><td className="py-2"><div className="font-semibold">{NOMBRES[k] || k}</div><div className="text-xs text-[#7A8F98]">{p.unidad} · {p.setup_desc}</div></td>
              <td className="text-right"><Num v={p.mensual} on={x => set('negocios', v => { v.planes[k].mensual = x })} step={1000} /></td>
              <td className="text-right"><Num v={p.min} on={x => set('negocios', v => { v.planes[k].min = x })} w="w-20" /></td>
              <td className="text-right"><Num v={p.setup} on={x => set('negocios', v => { v.planes[k].setup = x })} step={1000} /></td></tr>))}
          </tbody></table></div>
      </Seccion>

      <Seccion titulo="Cortinas TerraBlinds" sub="El precio por m² viene del catálogo de terrablinds.cl; estos son los de respaldo por categoría cuando el catálogo trae $0, más el motor y los factores de cada nivel." cfg={d.cortinas} dirty={dirty('cortinas')} guardando={busy === 'cortinas'} onSave={() => guardar('cortinas')} onReset={() => restablecer('cortinas')}>
        <div className="grid md:grid-cols-2 gap-4">
          <div><h3 className="text-xs font-bold uppercase tracking-wide text-[#7A8F98] mb-1">Respaldo $/m² por categoría</h3>
            {Object.entries(t.precios).map(([k, v]: any) => <div key={k} className="flex items-center justify-between py-1.5 border-t border-[#DDE4E6] text-sm"><span>{k}</span><Num v={v} on={x => set('cortinas', c => { c.precios[k] = x })} step={1000} /></div>)}
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-[#7A8F98] mb-1">Motorización</h3>
            <div className="flex items-center justify-between py-1.5 text-sm"><span>Motor por cortina</span><Num v={t.motor} on={x => set('cortinas', c => { c.motor = x })} step={5000} /></div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-[#7A8F98] mt-4 mb-1">Factor por nivel</h3>
            <p className="text-xs text-[#7A8F98] mb-1">Multiplica el subtotal de telas. 1,15 = 15 % más caro que Esencial.</p>
            {Object.entries(t.niveles).map(([k, nv]: any) => <div key={k} className="flex items-center justify-between py-1.5 border-t border-[#DDE4E6] text-sm"><span>{NIVEL[k] || k}</span><Num v={nv.factor} on={x => set('cortinas', c => { c.niveles[k].factor = x })} step={0.05} w="w-20" /></div>)}
          </div>
        </div>
      </Seccion>
    </div>
  )
}
