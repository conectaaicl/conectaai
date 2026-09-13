'use client'
import { useState, useEffect, useMemo } from 'react'

const API = '/api/gastos-comunes'
const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const SUGERIDOS = ['Sueldos conserjería', 'Aseo y limpieza', 'Electricidad áreas comunes', 'Agua áreas comunes', 'Mantención ascensores', 'Seguro del edificio', 'Administración', 'Jardinería', 'Fondo de reserva', 'Mantención general']
const METODOS = [
  { v: 'igualitaria', t: 'Partes iguales', d: 'Todas las unidades pagan lo mismo' },
  { v: 'metraje', t: 'Por metros cuadrados', d: 'Proporcional al tamaño de cada unidad' },
  { v: 'alicuota', t: 'Por alícuota (%)', d: 'Según el porcentaje de prorrateo de cada unidad' },
]

interface Unidad { departamento_id: number; numero: string; metraje: number | null; alicuota: number | null; residente: string | null; peso?: number; monto: number | null }
interface Props { onClose: () => void; onCreated: (r: { periodo_id: number; cobros_created: number; total_monto: number; departamentos: number }) => void }

function periodoActual() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
function vencimientoSugerido(periodo: string) {
  const [y, m] = periodo.split('-').map(Number)
  const d = new Date(y, m, 10) // día 10 del mes siguiente
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-10`
}
function nombrePeriodo(p: string) { const [y, m] = p.split('-'); return m && MESES[Number(m) - 1] ? `${MESES[Number(m) - 1]} ${y}` : p }

const inp = 'w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500'

export default function NuevoPeriodoWizard({ onClose, onCreated }: Props) {
  const [paso, setPaso] = useState(1)
  const [periodo, setPeriodo] = useState(periodoActual())
  const [venc, setVenc] = useState(vencimientoSugerido(periodoActual()))
  const [notas, setNotas] = useState('')
  const [items, setItems] = useState<{ concepto: string; monto: string }[]>([{ concepto: 'Sueldos conserjería', monto: '' }])
  const [metodo, setMetodo] = useState('igualitaria')
  const [unidades, setUnidades] = useState<Unidad[]>([])
  const [previewMsg, setPreviewMsg] = useState('')
  const [edicion, setEdicion] = useState<Record<number, string>>({})
  const [guardandoProrrateo, setGuardandoProrrateo] = useState(false)
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState('')

  const total = useMemo(() => items.reduce((a, i) => a + (parseFloat(i.monto) || 0), 0), [items])
  const itemsValidos = items.filter(i => i.concepto.trim() && parseFloat(i.monto) > 0)

  async function cargarPreview(m = metodo) {
    const r = await fetch(`${API}/preview-distribucion?metodo=${m}&total=${total}`, { credentials: 'include' })
    const d = await r.json().catch(() => null)
    if (!d) return
    setUnidades(d.unidades || []); setPreviewMsg(d.ok ? '' : d.detail || '')
    const e: Record<number, string> = {}
    for (const u of d.unidades || []) e[u.departamento_id] = m === 'metraje' ? (u.metraje ?? '') + '' : m === 'alicuota' ? (u.alicuota ?? '') + '' : ''
    setEdicion(e)
  }
  useEffect(() => { if (paso === 3) cargarPreview() }, [paso, metodo]) // eslint-disable-line react-hooks/exhaustive-deps

  async function guardarProrrateo() {
    setGuardandoProrrateo(true); setError('')
    try {
      const campo = metodo === 'metraje' ? 'metraje' : 'alicuota'
      const body = { items: unidades.map(u => ({ departamento_id: u.departamento_id, [campo]: parseFloat(edicion[u.departamento_id]) || null })) }
      const r = await fetch(`${API}/prorrateo`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!r.ok) { setError('No se pudo guardar el prorrateo'); return }
      await cargarPreview()
    } finally { setGuardandoProrrateo(false) }
  }

  function repartirAlicuotaIgual() {
    const n = unidades.length; if (!n) return
    const v = (100 / n).toFixed(4)
    const e: Record<number, string> = {}; for (const u of unidades) e[u.departamento_id] = v
    setEdicion(e)
  }

  const sumaAlicuota = useMemo(() => unidades.reduce((a, u) => a + (parseFloat(edicion[u.departamento_id]) || 0), 0), [unidades, edicion])

  async function crear() {
    setError(''); setCreando(true)
    try {
      const r = await fetch(`${API}/periodos/completo`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodo, fecha_vencimiento: venc, metodo, notas: notas || null, items: itemsValidos.map(i => ({ concepto: i.concepto.trim(), monto_total: parseFloat(i.monto) })) }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setError(d.detail || 'No se pudo crear el periodo'); return }
      onCreated(d)
    } catch { setError('Error de conexión') }
    finally { setCreando(false) }
  }

  function siguiente() {
    setError('')
    if (paso === 1) { if (!/^\d{4}-\d{2}$/.test(periodo)) { setError('Elige el mes.'); return } if (!venc) { setError('Elige la fecha de vencimiento.'); return } }
    if (paso === 2 && itemsValidos.length === 0) { setError('Agrega al menos un gasto con monto.'); return }
    setPaso(p => p + 1)
  }

  const listo = paso === 3 && !previewMsg && unidades.length > 0 && !(metodo === 'alicuota' && Math.abs(sumaAlicuota - 100) > 0.5)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !creando && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800">Nuevo periodo de gastos comunes</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
          </div>
          <div className="flex gap-2 mt-3">
            {[['1', 'El mes'], ['2', 'Los gastos'], ['3', 'El reparto']].map(([n, t], i) => (
              <div key={n} className={`flex-1 flex items-center gap-2 text-xs font-semibold ${paso === i + 1 ? 'text-indigo-700' : paso > i + 1 ? 'text-emerald-700' : 'text-slate-400'}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${paso === i + 1 ? 'bg-indigo-600 text-white' : paso > i + 1 ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>{paso > i + 1 ? '✓' : n}</span>
                {t}
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1">
          {error && <p className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}

          {paso === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">¿De qué mes son estos gastos comunes y hasta cuándo pueden pagar los vecinos?</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mes</label>
                  <input type="month" value={periodo} onChange={e => { setPeriodo(e.target.value); setVenc(vencimientoSugerido(e.target.value)) }} className={inp} />
                  <p className="text-xs text-slate-500 mt-1">{nombrePeriodo(periodo)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Vence el</label>
                  <input type="date" value={venc} onChange={e => setVenc(e.target.value)} className={inp} />
                  <p className="text-xs text-slate-500 mt-1">Sugerido: día 10 del mes siguiente</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notas para los vecinos <span className="text-slate-400 font-normal">(opcional)</span></label>
                <textarea value={notas} onChange={e => setNotas(e.target.value)} className={inp + ' h-20 resize-none'} placeholder="Ej: este mes incluye la reparación del portón" />
              </div>
            </div>
          )}

          {paso === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">Escribe cada gasto del mes con su monto total. Después lo repartimos entre las unidades.</p>
              <div className="flex flex-wrap gap-1.5">
                {SUGERIDOS.filter(s => !items.some(i => i.concepto === s)).map(s => (
                  <button key={s} type="button" onClick={() => setItems(l => [...l.filter(i => i.concepto.trim() || i.monto), { concepto: s, monto: '' }])}
                    className="text-xs px-2.5 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-indigo-400 hover:text-indigo-700">+ {s}</button>
                ))}
              </div>
              <div className="space-y-2">
                {items.map((it, i) => (
                  <div key={i} className="grid grid-cols-[1fr_150px_auto] gap-2 items-center">
                    <input value={it.concepto} onChange={e => setItems(l => l.map((x, j) => j === i ? { ...x, concepto: e.target.value } : x))} placeholder="Concepto" className={inp} />
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                      <input type="number" min={0} value={it.monto} onChange={e => setItems(l => l.map((x, j) => j === i ? { ...x, monto: e.target.value } : x))} placeholder="0" className={inp + ' pl-6 text-right tabular-nums'} />
                    </div>
                    <button type="button" onClick={() => setItems(l => l.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500 px-1 text-lg">×</button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setItems(l => [...l, { concepto: '', monto: '' }])} className="w-full py-2 rounded-xl border border-dashed border-slate-300 text-sm text-slate-600 hover:border-indigo-400 hover:text-indigo-700">+ Otro gasto</button>
              <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                <span className="text-sm text-slate-600">Total del mes ({itemsValidos.length} gasto{itemsValidos.length === 1 ? '' : 's'})</span>
                <span className="text-lg font-bold text-slate-800 tabular-nums">{fmt(total)}</span>
              </div>
            </div>
          )}

          {paso === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">¿Cómo se reparten los <b>{fmt(total)}</b> entre las {unidades.length || ''} unidades?</p>
              <div className="grid sm:grid-cols-3 gap-2">
                {METODOS.map(m => (
                  <button key={m.v} type="button" onClick={() => setMetodo(m.v)}
                    className={`text-left p-3 rounded-xl border-2 ${metodo === m.v ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <div className="text-sm font-semibold text-slate-800">{m.t}</div>
                    <div className="text-[11px] text-slate-500">{m.d}</div>
                  </button>
                ))}
              </div>

              {previewMsg && (
                <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  {previewMsg} {metodo === 'alicuota' && <button type="button" onClick={repartirAlicuotaIgual} className="underline font-semibold ml-1">Repartir 100% en partes iguales</button>}
                </div>
              )}
              {metodo === 'alicuota' && !previewMsg && Math.abs(sumaAlicuota - 100) > 0.5 && (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">Las alícuotas suman {sumaAlicuota.toFixed(2)}% — deben sumar 100%.</p>
              )}

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500 uppercase sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2">Unidad</th>
                        <th className="text-left px-3 py-2">Residente</th>
                        {metodo !== 'igualitaria' && <th className="text-right px-3 py-2">{metodo === 'metraje' ? 'm²' : 'Alícuota %'}</th>}
                        <th className="text-right px-3 py-2">Paga</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unidades.map(u => (
                        <tr key={u.departamento_id} className="border-t border-slate-100">
                          <td className="px-3 py-1.5 font-semibold text-slate-800">{u.numero}</td>
                          <td className="px-3 py-1.5 text-slate-500 truncate max-w-[160px]">{u.residente || '—'}</td>
                          {metodo !== 'igualitaria' && (
                            <td className="px-3 py-1 text-right">
                              <input type="number" step="0.01" min={0} value={edicion[u.departamento_id] ?? ''} onChange={e => setEdicion(x => ({ ...x, [u.departamento_id]: e.target.value }))}
                                className="w-24 border border-slate-200 rounded-lg px-2 py-1 text-right text-sm text-slate-800" />
                            </td>
                          )}
                          <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-slate-800">{u.monto != null ? fmt(u.monto) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {metodo !== 'igualitaria' && (
                <div className="flex justify-end gap-2">
                  {metodo === 'alicuota' && <button type="button" onClick={repartirAlicuotaIgual} className="text-xs text-slate-600 underline">Repartir 100% en partes iguales</button>}
                  <button type="button" onClick={guardarProrrateo} disabled={guardandoProrrateo} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 text-white disabled:opacity-50">
                    {guardandoProrrateo ? 'Guardando…' : `Guardar ${metodo === 'metraje' ? 'metros' : 'alícuotas'} y recalcular`}
                  </button>
                </div>
              )}
              <p className="text-xs text-slate-500">Los {metodo === 'metraje' ? 'metros' : 'porcentajes'} quedan guardados en cada unidad para los próximos meses.</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          {paso > 1 ? <button onClick={() => { setError(''); setPaso(p => p - 1) }} className="text-sm text-slate-600 hover:text-slate-900">← Volver</button> : <button onClick={onClose} className="text-sm text-slate-500">Cancelar</button>}
          {paso < 3
            ? <button onClick={siguiente} className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium">Continuar →</button>
            : <button onClick={crear} disabled={!listo || creando} className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium">
                {creando ? 'Creando…' : `Crear y repartir en ${unidades.length} unidades`}
              </button>}
        </div>
      </div>
    </div>
  )
}
