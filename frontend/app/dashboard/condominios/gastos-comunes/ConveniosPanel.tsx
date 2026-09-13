'use client'
import { useCallback, useEffect, useState } from 'react'

const API = '/api/gastos-comunes/convenios'
const fmt = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-CL')

interface Moroso { departamento_id: number; depto_numero: string; residente: string | null; deuda: number; meses_vencidos: number; periodos_pendientes: number; desde: string; convenio_id: number | null }
interface Cuota { id: number; numero: number; monto: number; fecha_vencimiento: string; estado: string; fecha_pago: string | null; vencida: boolean }
interface Convenio { id: number; departamento_id: number; depto_numero: string; persona_nombre: string | null; monto_deuda: number; pie: number; cuotas: number; monto_cuota: number; fecha_primera_cuota: string; estado: string; solicitado_por: string; notas: string | null; aprobado_por: string | null; created_at: string; cuotas_detalle: Cuota[]; pagadas: number; proxima: Cuota | null }

const EST: Record<string, string> = { propuesto: 'bg-amber-100 text-amber-700', activo: 'bg-indigo-100 text-indigo-700', cumplido: 'bg-emerald-100 text-emerald-700', incumplido: 'bg-red-100 text-red-700', cancelado: 'bg-slate-100 text-slate-500' }
const inp = 'w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800'

export default function ConveniosPanel({ onChange }: { onChange?: () => void }) {
  const [morosos, setMorosos] = useState<Moroso[]>([])
  const [umbral, setUmbral] = useState(3)
  const [convenios, setConvenios] = useState<Convenio[]>([])
  const [nuevo, setNuevo] = useState<Moroso | null>(null)
  const [form, setForm] = useState({ cuotas: 6, pie: 0, fecha: '', notas: '' })
  const [sim, setSim] = useState<{ total: number; monto_cuota: number } | null>(null)
  const [ver, setVer] = useState<Convenio | null>(null)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const [m, c] = await Promise.all([
      fetch(API + '/morosos', { credentials: 'include' }).then(r => r.ok ? r.json() : { morosos: [] }),
      fetch(API, { credentials: 'include' }).then(r => r.ok ? r.json() : []),
    ])
    setMorosos(m.morosos || []); setUmbral(m.umbral_meses || 3); setConvenios(Array.isArray(c) ? c : [])
  }, [])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!nuevo) return
    const id = setTimeout(async () => {
      const r = await fetch(`${API}/simular?departamento_id=${nuevo.departamento_id}&cuotas=${form.cuotas}&pie=${form.pie || 0}`, { credentials: 'include' })
      if (r.ok) setSim(await r.json())
    }, 250)
    return () => clearTimeout(id)
  }, [nuevo, form.cuotas, form.pie])

  async function crear(e: React.FormEvent) {
    e.preventDefault(); setMsg('')
    const r = await fetch(API, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ departamento_id: nuevo!.departamento_id, cuotas: form.cuotas, pie: form.pie || 0, fecha_primera_cuota: form.fecha || null, notas: form.notas || null }) })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { setMsg(d.detail || 'No se pudo crear'); return }
    setNuevo(null); setForm({ cuotas: 6, pie: 0, fecha: '', notas: '' }); load(); onChange?.()
  }
  async function accion(c: Convenio, a: 'aprobar' | 'cancelar') {
    if (a === 'cancelar' && !window.confirm('¿Cancelar el convenio? Los cobros vuelven a quedar pendientes.')) return
    await fetch(`${API}/${c.id}/${a}`, { method: 'PATCH', credentials: 'include' }); setVer(null); load(); onChange?.()
  }
  async function pagarCuota(c: Convenio, n: number) {
    const r = await fetch(`${API}/${c.id}/cuotas/${n}/pagar`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ metodo_pago: 'transferencia' }) })
    if (r.ok) { const lista: Convenio[] = await fetch(API, { credentials: 'include' }).then(x => x.json()); setConvenios(lista); setVer(lista.find(x => x.id === c.id) || null); onChange?.() }
  }

  const propuestos = convenios.filter(c => c.estado === 'propuesto')
  const activos = convenios.filter(c => c.estado === 'activo')
  const historicos = convenios.filter(c => !['propuesto', 'activo'].includes(c.estado))

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-bold text-slate-800">Morosidad y convenios de pago</h2>
          <p className="text-xs text-slate-500">Un departamento con {umbral} o más meses vencidos puede regularizar su deuda en cuotas. El vecino también puede pedirlo desde su app.</p>
        </div>
        <div className="flex gap-3 text-xs">
          <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-700 font-semibold">{morosos.length} moroso{morosos.length === 1 ? '' : 's'}</span>
          <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-semibold">{activos.length} convenio{activos.length === 1 ? '' : 's'} activo{activos.length === 1 ? '' : 's'}</span>
        </div>
      </div>

      {propuestos.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-sm font-semibold text-amber-800 mb-2">Solicitudes de convenio por aprobar ({propuestos.length})</p>
          <div className="space-y-2">
            {propuestos.map(c => (
              <div key={c.id} className="bg-white rounded-lg p-3 flex items-center gap-3 border border-amber-200">
                <div className="flex-1 min-w-0 text-sm"><b className="text-slate-800">Depto {c.depto_numero}</b> · {c.persona_nombre || '—'} · deuda {fmt(c.monto_deuda)} → {c.cuotas} cuotas de {fmt(c.monto_cuota)}{c.pie ? ` + pie ${fmt(c.pie)}` : ''}{c.notas ? <p className="text-xs text-slate-500 truncate">“{c.notas}”</p> : null}</div>
                <button onClick={() => accion(c, 'cancelar')} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-700">Rechazar</button>
                <button onClick={() => accion(c, 'aprobar')} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white">Aprobar</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Departamentos con {umbral}+ meses vencidos</p>
          {morosos.length === 0 ? <p className="text-sm text-slate-500 bg-slate-50 rounded-xl p-4">Sin morosos por ahora.</p> : (
            <div className="space-y-2">
              {morosos.map(m => (
                <div key={m.departamento_id} className="border border-red-100 bg-red-50/40 rounded-xl p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0"><p className="font-semibold text-slate-800">Depto {m.depto_numero} <span className="text-slate-500 font-normal">· {m.residente || 'sin residente'}</span></p><p className="text-xs text-slate-600">{fmt(m.deuda)} · {m.meses_vencidos} meses vencidos (desde {m.desde})</p></div>
                  {m.convenio_id ? <span className="text-xs text-indigo-700 font-semibold">Convenio #{m.convenio_id}</span>
                    : <button onClick={() => { setNuevo(m); setSim(null) }} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white">Crear convenio</button>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Convenios activos</p>
          {activos.length === 0 ? <p className="text-sm text-slate-500 bg-slate-50 rounded-xl p-4">No hay convenios activos.</p> : (
            <div className="space-y-2">
              {activos.map(c => (
                <button key={c.id} onClick={() => setVer(c)} className="w-full text-left border border-indigo-100 rounded-xl p-3 hover:border-indigo-300">
                  <div className="flex items-center justify-between"><p className="font-semibold text-slate-800">Depto {c.depto_numero} · #{c.id}</p><span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${EST[c.estado]}`}>{c.pagadas}/{c.cuotas} cuotas</span></div>
                  <p className="text-xs text-slate-600">{c.persona_nombre || ''} · {fmt(c.monto_cuota)} mensuales{c.proxima ? ` · próxima ${c.proxima.fecha_vencimiento}${c.proxima.vencida ? ' (vencida)' : ''}` : ''}</p>
                  <div className="h-1.5 bg-slate-100 rounded-full mt-2"><div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(c.pagadas / c.cuotas) * 100}%` }} /></div>
                </button>
              ))}
            </div>
          )}
          {historicos.length > 0 && <p className="text-[11px] text-slate-400 mt-2">{historicos.length} convenio(s) cumplidos/cancelados en el historial.</p>}
        </div>
      </div>

      {nuevo && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setNuevo(null)}>
          <form onSubmit={crear} onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-6 w-full max-w-md space-y-3 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-800">Convenio de pago · Depto {nuevo.depto_numero}</h3>
            <p className="text-sm text-slate-600">Deuda actual <b>{fmt(nuevo.deuda)}</b> ({nuevo.meses_vencidos} meses vencidos). Los cobros incluidos dejan de figurar como morosos mientras el convenio esté al día.</p>
            {msg && <p className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{msg}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-semibold text-slate-600">Número de cuotas</label><input type="number" min={1} max={24} className={inp} value={form.cuotas} onChange={e => setForm({ ...form, cuotas: Math.max(1, Math.min(24, parseInt(e.target.value) || 1)) })} /></div>
              <div><label className="text-xs font-semibold text-slate-600">Pie (abono inicial)</label><input type="number" min={0} className={inp} value={form.pie} onChange={e => setForm({ ...form, pie: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <div><label className="text-xs font-semibold text-slate-600">Primera cuota vence</label><input type="date" className={inp} value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} /><p className="text-[11px] text-slate-400 mt-0.5">Si lo dejas vacío: día 10 del próximo mes.</p></div>
            <div><label className="text-xs font-semibold text-slate-600">Notas</label><input className={inp} placeholder="Acuerdo firmado en administración…" value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} /></div>
            <div className="bg-indigo-50 rounded-xl p-3 text-sm text-indigo-900">{sim ? <>{form.cuotas} cuotas de <b>{fmt(sim.monto_cuota)}</b>{form.pie ? <> + pie de <b>{fmt(form.pie)}</b></> : null} = {fmt(sim.total)}</> : 'Calculando…'}</div>
            <div className="flex gap-2 pt-1"><button type="button" onClick={() => setNuevo(null)} className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm">Cancelar</button><button type="submit" className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold">Crear convenio</button></div>
          </form>
        </div>
      )}

      {ver && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setVer(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div><h3 className="text-lg font-bold text-slate-800">Convenio #{ver.id} · Depto {ver.depto_numero}</h3><p className="text-xs text-slate-500">{ver.persona_nombre || ''} · deuda {fmt(ver.monto_deuda)}{ver.pie ? ` · pie ${fmt(ver.pie)}` : ''} · {ver.cuotas} cuotas de {fmt(ver.monto_cuota)} · solicitado por {ver.solicitado_por}{ver.aprobado_por ? ` · aprobó ${ver.aprobado_por}` : ''}</p></div>
              <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${EST[ver.estado]}`}>{ver.estado}</span>
            </div>
            <table className="w-full text-sm mt-4">
              <thead className="text-xs text-slate-500 uppercase"><tr><th className="text-left py-1">Cuota</th><th className="text-left py-1">Vence</th><th className="text-right py-1">Monto</th><th className="text-right py-1">Estado</th></tr></thead>
              <tbody>{ver.cuotas_detalle.map(q => (
                <tr key={q.id} className="border-t border-slate-100">
                  <td className="py-2 text-slate-800">{q.numero}</td><td className={`py-2 ${q.vencida ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>{q.fecha_vencimiento}{q.vencida ? ' · vencida' : ''}</td><td className="py-2 text-right tabular-nums text-slate-800">{fmt(q.monto)}</td>
                  <td className="py-2 text-right">{q.estado === 'pagado' ? <span className="text-emerald-700 text-xs font-semibold">Pagada {q.fecha_pago?.slice(0, 10)}</span> : ver.estado === 'activo' ? <button onClick={() => pagarCuota(ver, q.numero)} className="text-xs font-semibold px-2 py-1 rounded-lg bg-emerald-600 text-white">Registrar pago</button> : <span className="text-xs text-slate-400">pendiente</span>}</td>
                </tr>
              ))}</tbody>
            </table>
            {ver.notas && <p className="text-xs text-slate-500 mt-3">Notas: {ver.notas}</p>}
            <div className="flex gap-2 mt-5">
              {ver.estado === 'activo' && <button onClick={() => accion(ver, 'cancelar')} className="px-4 py-2 rounded-xl border border-red-200 text-red-700 text-sm">Cancelar convenio</button>}
              <button onClick={() => setVer(null)} className="ml-auto px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
