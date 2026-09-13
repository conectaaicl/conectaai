'use client'
import { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, LogOut, Car, Home, User, X, Search, KeyRound, Clock } from 'lucide-react'
import { tid, conserjeUser } from '../tid'

interface Visita {
  id: number
  nombre_visitante: string
  rut_visitante?: string | null
  telefono_visitante?: string | null
  depto_destino?: string | null
  nombre_residente?: string | null
  motivo?: string | null
  patente?: string | null
  estado?: string | null
  aprobado_por?: string | null
  motivo_rechazo?: string | null
  entrada_at: string
  salida_at: string
  registrado_por_nombre?: string | null
  observaciones?: string | null
}
interface Depto { id: number; numero: string }
type Filtro = 'pendientes' | 'dentro' | 'salieron' | 'todas'

const MOTIVOS: [string, string][] = [['visita', 'Visita'], ['delivery', 'Delivery'], ['proveedor', 'Proveedor'], ['tecnico', 'Técnico'], ['otro', 'Otro']]
const inp = 'w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500'

function vacia(ts?: string | null) { return !ts || ts === 'None' || ts === '' }
function hora(ts: string) {
  if (vacia(ts)) return '—'
  const d = new Date(ts.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00'))
  return isNaN(d.getTime()) ? ts.slice(11, 16) : d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}
function fecha(ts: string) {
  if (vacia(ts)) return ''
  const d = new Date(ts.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00'))
  if (isNaN(d.getTime())) return ts.slice(0, 10)
  return d.toDateString() === new Date().toDateString() ? 'Hoy' : d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })
}

function Badge({ v }: { v: Visita }) {
  const dentro = vacia(v.salida_at)
  if (v.estado === 'pendiente') return <span className="shrink-0 text-[11px] font-bold px-2 py-1 rounded-lg border bg-amber-500/15 text-amber-300 border-amber-500/30 flex items-center gap-1"><Clock size={11} /> Esperando aprobación</span>
  if (v.estado === 'rechazado') return <span className="shrink-0 text-[11px] font-bold px-2 py-1 rounded-lg border bg-red-500/15 text-red-300 border-red-500/30">Rechazada</span>
  return <span className={`shrink-0 text-[11px] font-bold px-2 py-1 rounded-lg border ${dentro ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-slate-700/60 text-slate-300 border-slate-600'}`}>{dentro ? 'Dentro' : 'Salió'}</span>
}

function VisitasInner() {
  const search = useSearchParams()
  const [visitas, setVisitas] = useState<Visita[]>([])
  const [deptos, setDeptos] = useState<Depto[]>([])
  const [condominioId, setCondominioId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>('pendientes')
  const [q, setQ] = useState('')
  const [acting, setActing] = useState<number | null>(null)
  const [open, setOpen] = useState(search.get('nueva') === '1')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [claveFor, setClaveFor] = useState<Visita | null>(null)
  const [clave, setClave] = useState('')
  const [claveErr, setClaveErr] = useState('')
  const [claveConfigurada, setClaveConfigurada] = useState<boolean | null>(null)
  const vacio = { nombre_visitante: '', rut_visitante: '', telefono_visitante: '', depto_destino: '', nombre_residente: '', motivo: 'visita', patente: '', observaciones: '' }
  const [form, setForm] = useState(vacio)

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ tenant_id: tid(), limit: '100' })
      if (filtro === 'pendientes') params.set('estado', 'pendiente')
      if (filtro === 'dentro') { params.set('activas', 'true'); params.set('estado', 'aprobado') }
      if (filtro === 'salieron') params.set('activas', 'false')
      const r = await fetch('/api/visitas?' + params, { credentials: 'include' })
      if (r.ok) setVisitas(await r.json())
    } finally { setLoading(false) }
  }, [filtro])

  useEffect(() => { setLoading(true); load(); const iv = setInterval(load, 15000); return () => clearInterval(iv) }, [load])

  useEffect(() => {
    fetch('/api/condominios/departamentos', { credentials: 'include' }).then(r => r.ok ? r.json() : []).then(d => setDeptos(Array.isArray(d) ? d : [])).catch(() => {})
    fetch('/api/condominios', { credentials: 'include' }).then(r => r.ok ? r.json() : []).then(d => { if (Array.isArray(d) && d[0]) setCondominioId(d[0].id) }).catch(() => {})
    fetch('/api/visitas/clave-autorizacion', { credentials: 'include' }).then(r => r.ok ? r.json() : null).then(d => setClaveConfigurada(!!d?.configurada)).catch(() => {})
  }, [])

  const lista = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return visitas
    return visitas.filter(v => [v.nombre_visitante, v.rut_visitante, v.depto_destino, v.patente, v.nombre_residente].some(x => (x || '').toLowerCase().includes(s)))
  }, [visitas, q])

  async function registrarSalida(id: number) {
    setActing(id)
    try { const r = await fetch('/api/visitas/' + id + '/salida', { method: 'PATCH', credentials: 'include' }); if (r.ok) load() }
    finally { setActing(null) }
  }

  async function autorizar(e: React.FormEvent) {
    e.preventDefault()
    if (!claveFor) return
    setClaveErr('')
    const r = await fetch('/api/visitas/' + claveFor.id + '/autorizar-clave', {
      method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clave }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { setClaveErr(d.detail || 'Clave incorrecta'); return }
    setClaveFor(null); setClave(''); setFiltro('dentro'); load()
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault()
    if (form.nombre_visitante.trim().length < 2) { setError('Escribe el nombre de la visita.'); return }
    setSaving(true); setError('')
    try {
      const u = conserjeUser()
      const r = await fetch('/api/visitas', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: Number(tid()) || 0, condominio_id: condominioId,
          nombre_visitante: form.nombre_visitante.trim(), rut_visitante: form.rut_visitante || null,
          telefono_visitante: form.telefono_visitante || null, depto_destino: form.depto_destino || null,
          nombre_residente: form.nombre_residente || null, motivo: form.motivo,
          patente: form.patente ? form.patente.toUpperCase() : null, observaciones: form.observaciones || null,
          registrado_por: u?.id ?? null, registrado_por_nombre: u?.nombre_completo ?? null,
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setError(d.detail || 'No se pudo registrar la visita'); return }
      setOpen(false); setForm(vacio); setFiltro('pendientes'); load()
    } catch { setError('Error de conexión') }
    finally { setSaving(false) }
  }

  const pendientesCount = filtro === 'pendientes' ? visitas.length : null

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex gap-1.5 flex-1 overflow-x-auto">
          {([['pendientes', 'Por aprobar'], ['dentro', 'En el edificio'], ['salieron', 'Ya salieron'], ['todas', 'Todas']] as const).map(([f, t]) => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`flex-1 whitespace-nowrap px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${filtro === f ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
              {t}{f === 'pendientes' && pendientesCount ? ` (${pendientesCount})` : ''}
            </button>
          ))}
        </div>
        <button onClick={() => setOpen(true)}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-brand-700 hover:bg-brand-600 border border-brand-500/40">
          <Plus size={16} /> Registrar visita
        </button>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input className={inp + ' pl-9'} placeholder="Buscar por nombre, RUT, depto o patente" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {filtro === 'pendientes' && claveConfigurada === false && (
        <p className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
          Administración todavía no define la clave de conserjería. Las visitas solo podrán aprobarse desde el panel de administración.
        </p>
      )}

      {loading ? <p className="text-center text-slate-400 py-12">Cargando…</p>
        : lista.length === 0 ? (
          <div className="text-center py-14 text-slate-400">
            <p>{filtro === 'pendientes' ? 'No hay visitas esperando aprobación.' : filtro === 'dentro' ? 'No hay visitas dentro del edificio ahora.' : 'Sin visitas en este filtro.'}</p>
            <button onClick={() => setOpen(true)} className="mt-3 text-brand-400 text-sm font-semibold hover:underline">+ Registrar una visita</button>
          </div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {lista.map(v => {
              const dentro = vacia(v.salida_at)
              return (
                <div key={v.id} className={`bg-slate-800/70 border rounded-2xl p-4 ${v.estado === 'pendiente' ? 'border-amber-500/40' : 'border-slate-700'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-white font-semibold truncate">{v.nombre_visitante}</p>
                      <p className="text-xs text-slate-400 truncate">{v.rut_visitante || 'sin RUT'} · {MOTIVOS.find(m => m[0] === v.motivo)?.[1] || v.motivo || 'Visita'}</p>
                    </div>
                    <Badge v={v} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300">
                    {v.depto_destino && <span className="flex items-center gap-1"><Home size={12} /> Depto {v.depto_destino}{v.nombre_residente ? ` · ${v.nombre_residente}` : ''}</span>}
                    {v.patente && <span className="flex items-center gap-1"><Car size={12} /> {v.patente}</span>}
                    <span>{fecha(v.entrada_at)} {hora(v.entrada_at)}{!dentro ? ` → ${hora(v.salida_at)}` : ''}</span>
                    {v.registrado_por_nombre && <span className="flex items-center gap-1 text-slate-500"><User size={12} /> {v.registrado_por_nombre}</span>}
                    {v.estado === 'aprobado' && v.aprobado_por && <span className="text-slate-500">Aprobó: {v.aprobado_por}</span>}
                    {v.estado === 'rechazado' && v.motivo_rechazo && <span className="text-red-300/80">Motivo: {v.motivo_rechazo}</span>}
                  </div>
                  {v.estado === 'pendiente' && (
                    <button onClick={() => { setClaveFor(v); setClave(''); setClaveErr('') }}
                      className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-amber-200 bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25">
                      <KeyRound size={13} /> Autorizar con clave de administración
                    </button>
                  )}
                  {v.estado === 'aprobado' && dentro && (
                    <button onClick={() => registrarSalida(v.id)} disabled={acting === v.id}
                      className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-slate-200 bg-slate-700 hover:bg-slate-600 disabled:opacity-50">
                      <LogOut size={13} /> {acting === v.id ? 'Registrando…' : 'Registrar salida'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

      {claveFor && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setClaveFor(null)}>
          <form onSubmit={autorizar} onClick={e => e.stopPropagation()} className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-3">
            <h2 className="text-white font-bold flex items-center gap-2"><KeyRound size={18} className="text-amber-300" /> Autorizar visita</h2>
            <p className="text-sm text-slate-300">Vas a autorizar el ingreso de <b className="text-white">{claveFor.nombre_visitante}</b>{claveFor.depto_destino ? ` al depto ${claveFor.depto_destino}` : ''} sin administración presente. Ingresa la clave que te dejó administración.</p>
            {claveErr && <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">{claveErr}</p>}
            <input type="password" autoFocus className={inp + ' text-center tracking-widest text-lg'} placeholder="••••" value={clave} onChange={e => setClave(e.target.value)} />
            <div className="flex gap-2">
              <button type="button" onClick={() => setClaveFor(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700">Cancelar</button>
              <button type="submit" className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-900 bg-amber-400 hover:bg-amber-300">Autorizar ingreso</button>
            </div>
          </form>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => !saving && setOpen(false)}>
          <form onSubmit={crear} onClick={e => e.stopPropagation()}
            className="w-full sm:max-w-lg bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-2xl p-5 space-y-3 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">Registrar visita</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            <p className="text-xs text-slate-400">La visita quedará <b className="text-amber-300">esperando aprobación</b> de administración. Si no hay nadie, podrás autorizarla con la clave.</p>
            {error && <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">{error}</p>}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre de la visita *</label>
              <input className={inp} autoFocus placeholder="Juan Pérez" value={form.nombre_visitante} onChange={e => setForm({ ...form, nombre_visitante: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-semibold text-slate-300 mb-1">RUT</label><input className={inp} placeholder="12.345.678-9" value={form.rut_visitante} onChange={e => setForm({ ...form, rut_visitante: e.target.value })} /></div>
              <div><label className="block text-xs font-semibold text-slate-300 mb-1">Teléfono</label><input className={inp} placeholder="+56 9…" value={form.telefono_visitante} onChange={e => setForm({ ...form, telefono_visitante: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">¿A qué depto va?</label>
                {deptos.length > 0 ? (
                  <select className={inp} value={form.depto_destino} onChange={e => setForm({ ...form, depto_destino: e.target.value })}>
                    <option value="">Elegir…</option>
                    {deptos.map(d => <option key={d.id} value={d.numero}>{d.numero}</option>)}
                  </select>
                ) : <input className={inp} placeholder="101" value={form.depto_destino} onChange={e => setForm({ ...form, depto_destino: e.target.value })} />}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Motivo</label>
                <select className={inp} value={form.motivo} onChange={e => setForm({ ...form, motivo: e.target.value })}>
                  {MOTIVOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-semibold text-slate-300 mb-1">Residente que recibe</label><input className={inp} placeholder="Opcional" value={form.nombre_residente} onChange={e => setForm({ ...form, nombre_residente: e.target.value })} /></div>
              <div><label className="block text-xs font-semibold text-slate-300 mb-1">Patente</label><input className={inp + ' uppercase'} placeholder="ABCD12" value={form.patente} onChange={e => setForm({ ...form, patente: e.target.value })} /></div>
            </div>
            <div><label className="block text-xs font-semibold text-slate-300 mb-1">Observaciones</label><input className={inp} placeholder="Opcional" value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} /></div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700">Cancelar</button>
              <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-brand-600 hover:bg-brand-500 disabled:opacity-60">{saving ? 'Guardando…' : 'Registrar'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default function ConserjeVisitas() {
  return <Suspense fallback={<p className="p-6 text-slate-400">Cargando…</p>}><VisitasInner /></Suspense>
}
