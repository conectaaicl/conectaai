'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'

interface Info { nombre: string; tipo: string; tipo_label: string; ubicacion?: string | null; marca_modelo?: string | null; proveedor?: string | null; condominio: string; direccion?: string | null; ultimos: { fecha: string; tecnico_nombre: string; empresa?: string | null; tipo_trabajo: string; resumen: string }[] }

const ICON: Record<string, string> = { ascensor: '🛗', bomba_agua: '💧', porton: '🚧', caldera: '🔥', generador: '⚡', piscina: '🏊', citofonia: '📞', camaras: '📷', extintores: '🧯', otro: '🔧' }
const TIPOS_TRABAJO = [['preventiva', 'Mantención preventiva'], ['correctiva', 'Reparación / correctiva'], ['inspeccion', 'Inspección / certificación'], ['emergencia', 'Emergencia']]
const inp = 'w-full border border-slate-300 rounded-xl px-3 py-3 text-base text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600'

function fmtFecha(s: string) { const d = new Date(s.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')); return isNaN(d.getTime()) ? s.slice(0, 10) : d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) }

function FirmaPad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const dirty = useRef(false)
  useEffect(() => {
    const c = ref.current!; const ctx = c.getContext('2d')!
    const ratio = window.devicePixelRatio || 1
    c.width = c.offsetWidth * ratio; c.height = 180 * ratio; ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.strokeStyle = '#0f172a'
  }, [])
  const pos = (e: any) => { const r = ref.current!.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e; return { x: t.clientX - r.left, y: t.clientY - r.top } }
  const start = (e: any) => { e.preventDefault(); drawing.current = true; const ctx = ref.current!.getContext('2d')!; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y) }
  const move = (e: any) => { if (!drawing.current) return; e.preventDefault(); const ctx = ref.current!.getContext('2d')!; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); dirty.current = true }
  const end = () => { if (!drawing.current) return; drawing.current = false; if (dirty.current) onChange(ref.current!.toDataURL('image/png')) }
  const clear = () => { const c = ref.current!; const ctx = c.getContext('2d')!; ctx.clearRect(0, 0, c.width, c.height); dirty.current = false; onChange(null) }
  return (
    <div>
      <div className="border-2 border-dashed border-slate-300 rounded-xl bg-white overflow-hidden relative">
        <canvas ref={ref} className="w-full h-[180px] touch-none" onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end} onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
        <span className="absolute bottom-2 left-3 text-[11px] text-slate-400 pointer-events-none">Firma aquí con el dedo</span>
      </div>
      <button type="button" onClick={clear} className="mt-1 text-xs text-slate-500 underline">Borrar firma</button>
    </div>
  )
}

export default function MantencionPublica() {
  const { token } = useParams<{ token: string }>()
  const [info, setInfo] = useState<Info | null>(null)
  const [err, setErr] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [folio, setFolio] = useState<number | null>(null)
  const [firma, setFirma] = useState<string | null>(null)
  const [f, setF] = useState({ tecnico_nombre: '', tecnico_rut: '', tecnico_email: '', tecnico_telefono: '', empresa: '', tipo_trabajo: 'preventiva', descripcion: '', observaciones: '', repuestos: '', proximo_mantenimiento: '', acepta: false })

  useEffect(() => {
    fetch(`/api/mantenciones/publico/${token}`).then(async r => { if (!r.ok) throw new Error((await r.json()).detail || 'QR inválido'); return r.json() })
      .then(setInfo).catch(e => setErr(e.message))
    try { const g = JSON.parse(localStorage.getItem('tecnico_datos') || 'null'); if (g) setF(x => ({ ...x, ...g })) } catch { }
  }, [token])

  async function enviar(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    if (!firma) { setErr('Falta tu firma.'); return }
    if (!f.acepta) { setErr('Debes confirmar la declaración.'); return }
    setEnviando(true)
    try {
      const r = await fetch(`/api/mantenciones/publico/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, proximo_mantenimiento: f.proximo_mantenimiento || null, firma_data: firma }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(d.detail || 'No se pudo enviar'); return }
      try { localStorage.setItem('tecnico_datos', JSON.stringify({ tecnico_nombre: f.tecnico_nombre, tecnico_rut: f.tecnico_rut, tecnico_email: f.tecnico_email, tecnico_telefono: f.tecnico_telefono, empresa: f.empresa })) } catch { }
      setFolio(d.folio)
    } catch { setErr('Error de conexión') } finally { setEnviando(false) }
  }

  if (err && !info) return <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6"><div className="bg-white rounded-2xl p-8 text-center max-w-sm shadow"><div className="text-4xl mb-3">❌</div><p className="font-semibold text-slate-800">{err}</p></div></div>
  if (!info) return <div className="min-h-screen bg-slate-100 flex items-center justify-center"><div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>

  if (folio) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-8 text-center max-w-sm shadow-lg">
        <div className="w-16 h-16 rounded-full bg-teal-100 text-teal-700 text-3xl flex items-center justify-center mx-auto mb-4">✓</div>
        <h1 className="text-xl font-bold text-slate-900">Reporte enviado</h1>
        <p className="text-slate-600 text-sm mt-2">Folio <b>#{folio}</b>. Administración de <b>{info.condominio}</b> ya recibió tu informe firmado del <b>{info.nombre}</b>.</p>
        <p className="text-slate-400 text-xs mt-4">Gracias, {f.tecnico_nombre.split(' ')[0]}. Puedes cerrar esta página.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <div className="bg-teal-700 text-white px-5 pt-7 pb-8">
        <div className="max-w-lg mx-auto">
          <p className="text-teal-200 text-[11px] font-semibold tracking-widest uppercase">{info.condominio}{info.direccion ? ` · ${info.direccion}` : ''}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-4xl">{ICON[info.tipo] || '🔧'}</span>
            <div><h1 className="text-2xl font-extrabold leading-tight">{info.nombre}</h1><p className="text-teal-100 text-sm">{info.tipo_label}{info.ubicacion ? ` · ${info.ubicacion}` : ''}{info.marca_modelo ? ` · ${info.marca_modelo}` : ''}</p></div>
          </div>
        </div>
      </div>

      <form onSubmit={enviar} className="max-w-lg mx-auto px-4 -mt-4 space-y-4">
        {info.ultimos.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Últimas mantenciones</p>
            {info.ultimos.map((u, i) => <p key={i} className="text-xs text-slate-600 py-1 border-t border-slate-100 first:border-0"><b>{fmtFecha(u.fecha)}</b> · {u.tecnico_nombre}{u.empresa ? ` (${u.empresa})` : ''} · {u.tipo_trabajo} — {u.resumen}</p>)}
          </div>
        )}

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-3">
          <h2 className="font-bold text-slate-900">1. ¿Quién realiza el trabajo?</h2>
          <input className={inp} placeholder="Nombre completo *" value={f.tecnico_nombre} onChange={e => setF({ ...f, tecnico_nombre: e.target.value })} required />
          <div className="grid grid-cols-2 gap-3">
            <input className={inp} placeholder="RUT *" value={f.tecnico_rut} onChange={e => setF({ ...f, tecnico_rut: e.target.value })} required />
            <input className={inp} placeholder="Teléfono" value={f.tecnico_telefono} onChange={e => setF({ ...f, tecnico_telefono: e.target.value })} />
          </div>
          <input className={inp} type="email" placeholder="Correo electrónico" value={f.tecnico_email} onChange={e => setF({ ...f, tecnico_email: e.target.value })} />
          <input className={inp} placeholder="Empresa" value={f.empresa} onChange={e => setF({ ...f, empresa: e.target.value })} />
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-3">
          <h2 className="font-bold text-slate-900">2. ¿Qué se hizo?</h2>
          <div className="grid grid-cols-2 gap-2">
            {TIPOS_TRABAJO.map(([v, t]) => <button type="button" key={v} onClick={() => setF({ ...f, tipo_trabajo: v })} className={`text-sm py-2.5 px-2 rounded-xl border-2 ${f.tipo_trabajo === v ? 'border-teal-600 bg-teal-50 text-teal-800 font-semibold' : 'border-slate-200 text-slate-600'}`}>{t}</button>)}
          </div>
          <textarea className={inp + ' h-28'} placeholder="Describe el trabajo realizado * (mínimo 10 caracteres)" value={f.descripcion} onChange={e => setF({ ...f, descripcion: e.target.value })} required />
          <textarea className={inp + ' h-20'} placeholder="Observaciones / recomendaciones para administración" value={f.observaciones} onChange={e => setF({ ...f, observaciones: e.target.value })} />
          <input className={inp} placeholder="Repuestos utilizados (opcional)" value={f.repuestos} onChange={e => setF({ ...f, repuestos: e.target.value })} />
          <div><label className="text-xs font-semibold text-slate-600">Próxima mantención sugerida</label><input type="date" className={inp} value={f.proximo_mantenimiento} onChange={e => setF({ ...f, proximo_mantenimiento: e.target.value })} /></div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-3">
          <h2 className="font-bold text-slate-900">3. Firma</h2>
          <FirmaPad onChange={setFirma} />
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" className="mt-1" checked={f.acepta} onChange={e => setF({ ...f, acepta: e.target.checked })} />
            <span>Declaro que la información es verídica y que el trabajo descrito fue realizado en el equipo indicado.</span>
          </label>
        </div>

        {err && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}
        <button type="submit" disabled={enviando} className="w-full bg-teal-700 hover:bg-teal-600 disabled:opacity-60 text-white font-bold py-4 rounded-2xl shadow-lg text-base">
          {enviando ? 'Enviando…' : 'Enviar reporte a administración'}
        </button>
        <p className="text-center text-[11px] text-slate-400">ConectaAI Condominios · Bitácora de mantención</p>
      </form>
    </div>
  )
}
