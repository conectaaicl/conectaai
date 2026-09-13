'use client'
import { useCallback, useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

interface Activo { id: number; nombre: string; tipo: string; tipo_label: string; ubicacion?: string | null; marca_modelo?: string | null; frecuencia_dias?: number | null; proveedor?: string | null; qr_token: string; url: string; activo: boolean; total_reportes: number; ultimo_reporte: string | null; sin_revisar: number }
interface Reporte { id: number; activo_id: number; activo_nombre: string; activo_tipo: string; tecnico_nombre: string; tecnico_rut?: string; tecnico_email?: string; tecnico_telefono?: string; empresa?: string; tipo_trabajo: string; descripcion: string; observaciones?: string; repuestos?: string; proximo_mantenimiento?: string | null; estado: string; revisado_por?: string; created_at: string; firma_data?: string; ubicacion?: string }

const ICON: Record<string, string> = { ascensor: '🛗', bomba_agua: '💧', porton: '🚧', caldera: '🔥', generador: '⚡', piscina: '🏊', citofonia: '📞', camaras: '📷', extintores: '🧯', otro: '🔧' }
const TT: Record<string, string> = { preventiva: 'Preventiva', correctiva: 'Correctiva', inspeccion: 'Inspección', emergencia: 'Emergencia' }
const qr = (url: string, size = 220) => `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=6&data=${encodeURIComponent(url)}`
const fmt = (s?: string | null) => { if (!s) return '—'; const d = new Date(s.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')); return isNaN(d.getTime()) ? s.slice(0, 16) : d.toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
const inp = 'w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600'

function Inner() {
  const search = useSearchParams()
  const [activos, setActivos] = useState<Activo[]>([])
  const [reportes, setReportes] = useState<Reporte[]>([])
  const [tipos, setTipos] = useState<{ value: string; label: string }[]>([])
  const [filtroActivo, setFiltroActivo] = useState<number | null>(null)
  const [showNuevo, setShowNuevo] = useState(false)
  const [qrDe, setQrDe] = useState<Activo | null>(null)
  const [ver, setVer] = useState<Reporte | null>(null)
  const [form, setForm] = useState({ nombre: '', tipo: 'ascensor', ubicacion: '', marca_modelo: '', frecuencia_dias: '', proveedor: '' })
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const [a, r] = await Promise.all([
      fetch('/api/mantenciones/activos', { credentials: 'include' }).then(x => x.ok ? x.json() : []),
      fetch('/api/mantenciones/reportes?limit=200' + (filtroActivo ? `&activo_id=${filtroActivo}` : ''), { credentials: 'include' }).then(x => x.ok ? x.json() : []),
    ])
    setActivos(Array.isArray(a) ? a : []); setReportes(Array.isArray(r) ? r : [])
  }, [filtroActivo])

  useEffect(() => { load(); const iv = setInterval(load, 30000); return () => clearInterval(iv) }, [load])
  useEffect(() => { fetch('/api/mantenciones/tipos').then(r => r.json()).then(setTipos).catch(() => {}) }, [])
  useEffect(() => {
    const rid = search.get('reporte'); if (!rid) return
    fetch('/api/mantenciones/reportes/' + rid, { credentials: 'include' }).then(r => r.ok ? r.json() : null).then(d => d && setVer(d)).catch(() => {})
  }, [search])

  async function crear(e: React.FormEvent) {
    e.preventDefault(); setMsg('')
    const r = await fetch('/api/mantenciones/activos', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, frecuencia_dias: form.frecuencia_dias ? parseInt(form.frecuencia_dias) : null }) })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { setMsg(d.detail || 'No se pudo crear'); return }
    setShowNuevo(false); setForm({ nombre: '', tipo: 'ascensor', ubicacion: '', marca_modelo: '', frecuencia_dias: '', proveedor: '' }); await load()
    const nuevo = (await fetch('/api/mantenciones/activos', { credentials: 'include' }).then(x => x.json())).find((a: Activo) => a.id === d.id)
    if (nuevo) setQrDe(nuevo)
  }
  async function abrirReporte(id: number) {
    const d = await fetch('/api/mantenciones/reportes/' + id, { credentials: 'include' }).then(r => r.ok ? r.json() : null); if (d) setVer(d)
  }
  async function crearOrden(r: Reporte) {
    const titulo = `Seguimiento ${r.activo_nombre}: ${(r.observaciones || r.descripcion).slice(0, 80)}`
    const res = await fetch('/api/condominios/ordenes', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo, descripcion: `Origen: reporte de mantención #${r.id} (${r.tecnico_nombre}${r.empresa ? ', ' + r.empresa : ''}).\n\nTrabajo realizado: ${r.descripcion}\n\nObservaciones: ${r.observaciones || '-'}${r.proximo_mantenimiento ? '\n\nPróxima mantención sugerida: ' + r.proximo_mantenimiento : ''}`,
        tipo: 'mantencion', prioridad: r.tipo_trabajo === 'emergencia' ? 'urgente' : 'media', proveedor: r.empresa || null, estado: 'abierta' }) })
    if (res.ok) { alert('Orden de trabajo creada. La ves en Operaciones → Órdenes de Trabajo.'); } else { alert('No se pudo crear la orden') }
  }
  async function revisar(id: number) {
    await fetch(`/api/mantenciones/reportes/${id}/revisar`, { method: 'PATCH', credentials: 'include' }); setVer(null); load()
  }
  function imprimir(a: Activo) {
    const w = window.open('', '_blank'); if (!w) return
    w.document.write(`<html><head><title>QR ${a.nombre}</title><style>body{font-family:Arial;text-align:center;padding:30px}h1{margin:0;font-size:26px}p{color:#475569;margin:6px 0}.box{display:inline-block;border:3px solid #0F766E;border-radius:18px;padding:24px 28px}.small{font-size:12px;color:#94a3b8;margin-top:12px}</style></head><body><div class="box"><h1>${ICON[a.tipo] || '🔧'} ${a.nombre}</h1><p>${a.tipo_label}${a.ubicacion ? ' · ' + a.ubicacion : ''}</p><img src="${qr(a.url, 320)}" width="320" height="320"/><p><b>Técnico:</b> escanea este código al terminar la mantención<br>y completa el reporte para administración.</p><p class="small">${a.url}</p></div><script>setTimeout(()=>window.print(),600)</script></body></html>`)
    w.document.close()
  }

  const sinRevisar = reportes.filter(r => r.estado === 'recibido')

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mantenciones por QR</h1>
          <p className="text-sm text-gray-500">Un QR por equipo. El técnico lo escanea, reporta lo que hizo y firma. Te llega aquí y por correo.</p>
        </div>
        <button onClick={() => setShowNuevo(true)} className="px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-sm font-semibold">+ Nuevo equipo con QR</button>
      </div>

      {sinRevisar.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h2 className="font-semibold text-gray-900 mb-2">Reportes nuevos sin revisar <span className="ml-1 inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-full bg-amber-500 text-white text-xs font-bold">{sinRevisar.length}</span></h2>
          <div className="grid gap-2 md:grid-cols-2">
            {sinRevisar.map(r => (
              <button key={r.id} onClick={() => abrirReporte(r.id)} className="text-left bg-white border border-amber-200 rounded-lg p-3 hover:border-amber-400">
                <p className="font-semibold text-gray-900">{ICON[r.activo_tipo] || '🔧'} {r.activo_nombre} <span className="text-xs font-normal text-gray-400">#{r.id}</span></p>
                <p className="text-xs text-gray-600">{TT[r.tipo_trabajo] || r.tipo_trabajo} · {r.tecnico_nombre}{r.empresa ? ` (${r.empresa})` : ''} · {fmt(r.created_at)}</p>
                <p className="text-xs text-gray-500 truncate">{r.descripcion}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-6">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="font-semibold text-gray-900 mb-3">Equipos del edificio</h2>
          {activos.length === 0 ? (
            <div className="text-center py-10 text-gray-500 text-sm">
              <div className="text-4xl mb-2">🛗</div>
              Aún no hay equipos. Crea el primero (por ejemplo, el ascensor) y pega su QR junto al equipo.
            </div>
          ) : (
            <div className="space-y-2">
              {activos.map(a => (
                <div key={a.id} className={`flex items-center gap-3 border rounded-lg p-3 ${filtroActivo === a.id ? 'border-teal-500 bg-teal-50' : 'border-gray-100'} ${!a.activo ? 'opacity-50' : ''}`}>
                  <img src={qr(a.url, 64)} alt="QR" width={56} height={56} className="rounded border border-gray-200 bg-white cursor-pointer" onClick={() => setQrDe(a)} />
                  <button className="flex-1 text-left min-w-0" onClick={() => setFiltroActivo(filtroActivo === a.id ? null : a.id)}>
                    <p className="font-semibold text-gray-900 truncate">{ICON[a.tipo] || '🔧'} {a.nombre} {a.sin_revisar > 0 && <span className="ml-1 text-[10px] bg-amber-500 text-white rounded-full px-1.5 py-0.5">{a.sin_revisar} nuevo{a.sin_revisar > 1 ? 's' : ''}</span>}</p>
                    <p className="text-xs text-gray-500">{a.tipo_label}{a.ubicacion ? ` · ${a.ubicacion}` : ''}{a.proveedor ? ` · ${a.proveedor}` : ''}</p>
                    <p className="text-[11px] text-gray-400">{a.total_reportes} reporte{a.total_reportes === 1 ? '' : 's'}{a.ultimo_reporte ? ` · último ${fmt(a.ultimo_reporte)}` : ''}{a.frecuencia_dias ? ` · cada ${a.frecuencia_dias} días` : ''}</p>
                  </button>
                  <button onClick={() => setQrDe(a)} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50">QR</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Historial de reportes {filtroActivo ? <span className="text-xs font-normal text-gray-500">· {activos.find(a => a.id === filtroActivo)?.nombre}</span> : ''}</h2>
            {filtroActivo && <button onClick={() => setFiltroActivo(null)} className="text-xs text-teal-700 underline">Ver todos</button>}
          </div>
          {reportes.length === 0 ? <p className="text-sm text-gray-500 py-6 text-center">Todavía no llegan reportes.</p> : (
            <div className="space-y-2 max-h-[560px] overflow-y-auto">
              {reportes.map(r => (
                <button key={r.id} onClick={() => abrirReporte(r.id)} className="w-full text-left border border-gray-100 rounded-lg p-3 hover:border-teal-400">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-gray-900 truncate">{ICON[r.activo_tipo] || '🔧'} {r.activo_nombre}</p>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${r.estado === 'recibido' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{r.estado === 'recibido' ? 'Nuevo' : 'Revisado'}</span>
                  </div>
                  <p className="text-xs text-gray-600">{TT[r.tipo_trabajo] || r.tipo_trabajo} · {r.tecnico_nombre}{r.empresa ? ` (${r.empresa})` : ''} · {fmt(r.created_at)}</p>
                  <p className="text-xs text-gray-500 truncate">{r.descripcion}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {showNuevo && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowNuevo(false)}>
          <form onSubmit={crear} onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-6 w-full max-w-md space-y-3 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">Nuevo equipo</h3>
            <p className="text-xs text-gray-500">Al guardar te damos el QR listo para imprimir y pegar en el equipo. La misma dirección sirve para grabar un tag NFC.</p>
            {msg && <p className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{msg}</p>}
            <div><label className="text-xs font-semibold text-gray-600">Nombre *</label><input className={inp} placeholder="Ascensor Torre A" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-semibold text-gray-600">Tipo</label><select className={inp} value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>{tipos.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
              <div><label className="text-xs font-semibold text-gray-600">Ubicación</label><input className={inp} placeholder="Hall piso 1" value={form.ubicacion} onChange={e => setForm({ ...form, ubicacion: e.target.value })} /></div>
            </div>
            <div><label className="text-xs font-semibold text-gray-600">Marca / modelo</label><input className={inp} placeholder="Otis Gen2" value={form.marca_modelo} onChange={e => setForm({ ...form, marca_modelo: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-semibold text-gray-600">Cada cuántos días</label><input type="number" className={inp} placeholder="30" value={form.frecuencia_dias} onChange={e => setForm({ ...form, frecuencia_dias: e.target.value })} /></div>
              <div><label className="text-xs font-semibold text-gray-600">Empresa mantenedora</label><input className={inp} placeholder="Ascensores Ltda." value={form.proveedor} onChange={e => setForm({ ...form, proveedor: e.target.value })} /></div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowNuevo(false)} className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm">Cancelar</button>
              <button type="submit" className="flex-1 py-2 rounded-xl bg-teal-700 text-white text-sm font-semibold">Crear y generar QR</button>
            </div>
          </form>
        </div>
      )}

      {qrDe && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setQrDe(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-6 w-full max-w-sm text-center shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">{ICON[qrDe.tipo] || '🔧'} {qrDe.nombre}</h3>
            <p className="text-xs text-gray-500 mb-3">Pégalo junto al equipo. El técnico lo escanea con la cámara del teléfono.</p>
            <img src={qr(qrDe.url, 260)} alt="QR" width={260} height={260} className="mx-auto rounded-lg border border-gray-200" />
            <p className="text-[11px] text-gray-400 font-mono mt-2 break-all">{qrDe.url}</p>
            <div className="flex gap-2 mt-4">
              <button onClick={() => navigator.clipboard?.writeText(qrDe.url)} className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm">Copiar link (NFC)</button>
              <button onClick={() => imprimir(qrDe)} className="flex-1 py-2 rounded-xl bg-teal-700 text-white text-sm font-semibold">Imprimir etiqueta</button>
            </div>
          </div>
        </div>
      )}

      {ver && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setVer(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-teal-700">Reporte #{ver.id} · {TT[ver.tipo_trabajo] || ver.tipo_trabajo}</p>
                <h3 className="text-lg font-bold text-gray-900">{ICON[ver.activo_tipo] || '🔧'} {ver.activo_nombre}</h3>
                <p className="text-xs text-gray-500">{fmt(ver.created_at)}{ver.ubicacion ? ` · ${ver.ubicacion}` : ''}</p>
              </div>
              <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${ver.estado === 'recibido' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{ver.estado === 'recibido' ? 'Nuevo' : `Revisado${ver.revisado_por ? ' por ' + ver.revisado_por : ''}`}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div><p className="text-[11px] text-gray-500 uppercase">Técnico</p><p className="font-semibold text-gray-900">{ver.tecnico_nombre}</p><p className="text-xs text-gray-600">{ver.tecnico_rut}</p></div>
              <div><p className="text-[11px] text-gray-500 uppercase">Empresa / contacto</p><p className="text-gray-900">{ver.empresa || '—'}</p><p className="text-xs text-gray-600">{ver.tecnico_email || ''} {ver.tecnico_telefono || ''}</p></div>
            </div>
            <div className="mt-3"><p className="text-[11px] text-gray-500 uppercase">Trabajo realizado</p><p className="text-sm text-gray-900 whitespace-pre-wrap">{ver.descripcion}</p></div>
            {ver.observaciones && <div className="mt-3"><p className="text-[11px] text-gray-500 uppercase">Observaciones</p><p className="text-sm text-gray-900 whitespace-pre-wrap">{ver.observaciones}</p></div>}
            <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
              {ver.repuestos && <div><p className="text-[11px] text-gray-500 uppercase">Repuestos</p><p className="text-gray-900">{ver.repuestos}</p></div>}
              {ver.proximo_mantenimiento && <div><p className="text-[11px] text-gray-500 uppercase">Próxima mantención</p><p className="text-gray-900">{ver.proximo_mantenimiento}</p></div>}
            </div>
            {ver.firma_data && <div className="mt-4"><p className="text-[11px] text-gray-500 uppercase mb-1">Firma del técnico</p><img src={ver.firma_data} alt="Firma" className="border border-gray-200 rounded-lg bg-white max-h-32" /></div>}
            <div className="flex gap-2 mt-5">
              <button onClick={() => window.print()} className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm">Imprimir</button>
              <button onClick={() => crearOrden(ver)} className="flex-1 py-2 rounded-xl border border-teal-300 text-teal-800 text-sm font-semibold">Crear orden de trabajo</button>
              {ver.estado === 'recibido' && <button onClick={() => revisar(ver.id)} className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold">Marcar como revisado</button>}
              <button onClick={() => setVer(null)} className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MantencionesPage() {
  return <Suspense fallback={<div className="p-8 text-gray-500">Cargando…</div>}><Inner /></Suspense>
}
