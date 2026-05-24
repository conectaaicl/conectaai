'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from '@/hooks/useSession'

interface Condominio { id: number; nombre: string }
interface Espacio { id: number; nombre: string; descripcion: string | null; capacidad: number; precio_hora: number; requiere_pago: string; horario_inicio: string; horario_fin: string; activo: string; condominio_id: number }
interface Reserva { id: number; espacio_id: number; persona_id: number | null; departamento_id: number | null; fecha_inicio: string; fecha_fin: string; estado: string; monto_cobrado: number; notas: string | null; espacio_nombre: string | null; persona_nombre: string | null; persona_rut: string | null; persona_telefono: string | null; solicitado_por?: string; requiere_aprobacion?: boolean }
interface Persona { id: number; nombre_completo: string; rut: string; roles: string[] }

const estadoBadge = (e: string) => {
  if (e === 'rechazada') return 'text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700'
  if (e === 'aprobada') return 'text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700'
  if (e === 'confirmada') return 'px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700'
  if (e === 'pendiente') return 'px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700'
  return 'px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700'
}

const fmtDt = (s: string) => { try { return new Date(s).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) } catch { return s } }

export default function ReservasPage() {
  const { tenantId } = useSession()
  const [condominios, setCondominios] = useState<Condominio[]>([])
  const [condominioId, setCondominioId] = useState<number | null>(null)
  const [espacios, setEspacios] = useState<Espacio[]>([])
  const [selectedEspacio, setSelectedEspacio] = useState<Espacio | null>(null)
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])
  const [fechaFiltro, setFechaFiltro] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviando, setEnviando] = useState<number | null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Modals
  const [showModalEspacio, setShowModalEspacio] = useState(false)
  const [showModalReserva, setShowModalReserva] = useState(false)

  // Forms
  const [formEspacio, setFormEspacio] = useState({ nombre: '', descripcion: '', capacidad: 10, precio_hora: 0, requiere_pago: 'no', horario_inicio: '08:00', horario_fin: '22:00' })
  const [formReserva, setFormReserva] = useState({ persona_id: '', fecha_inicio: '', fecha_fin: '', monto_cobrado: 0, notas: '' })
  const [saving, setSaving] = useState(false)

  // Load condominios + personas on mount
  useEffect(() => {
    if (!tenantId) return
    Promise.all([
      fetch('/api/condominios?tenant_id=' + tenantId).then(r => r.ok ? r.json() : []),
      fetch('/api/personas?tenant_id=' + tenantId).then(r => r.ok ? r.json() : [])
    ]).then(([conds, pers]) => {
      setCondominios(conds)
      if (conds.length > 0) setCondominioId(conds[0].id)
      setPersonas(pers.filter((p: Persona) => p.roles.some(r => ['propietario', 'residente', 'arrendatario'].includes(r))))
    })
  }, [tenantId])

  // Load espacios when condominio changes
  useEffect(() => {
    if (!condominioId) return
    setSelectedEspacio(null)
    setReservas([])
    fetch('/api/reservas/espacios?condominio_id=' + condominioId)
      .then(r => r.ok ? r.json() : [])
      .then(setEspacios)
  }, [condominioId])

  // Load reservas when espacio selected or fecha changes
  const fetchReservas = useCallback(async (espacio: Espacio) => {
    setLoading(true)
    let url = '/api/reservas?espacio_id=' + espacio.id
    if (fechaFiltro) url += '&fecha=' + fechaFiltro
    const r = await fetch(url)
    if (r.ok) setReservas(await r.json())
    setLoading(false)
  }, [fechaFiltro])

  function selectEspacio(e: Espacio) {
    setSelectedEspacio(e)
    fetchReservas(e)
    setFormReserva(prev => ({ ...prev, monto_cobrado: e.precio_hora }))
  }

  async function handleCrearEspacio(ev: React.FormEvent) {
    ev.preventDefault()
    if (!condominioId) return
    setSaving(true)
    try {
      const r = await fetch('/api/reservas/espacios', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formEspacio, condominio_id: condominioId })
      })
      if (r.ok) {
        setShowModalEspacio(false)
        const updated = await fetch('/api/reservas/espacios?condominio_id=' + condominioId).then(x => x.json())
        setEspacios(updated)
        setFormEspacio({ nombre: '', descripcion: '', capacidad: 10, precio_hora: 0, requiere_pago: 'no', horario_inicio: '08:00', horario_fin: '22:00' })
        setMsg({ type: 'ok', text: 'Espacio creado' })
      } else {
        const e = await r.json(); setMsg({ type: 'err', text: e.detail || 'Error al crear' })
      }
    } catch { setMsg({ type: 'err', text: 'Error de conexión' }) } finally { setSaving(false) }
  }

  async function handleCrearReserva(ev: React.FormEvent) {
    ev.preventDefault()
    if (!selectedEspacio) return
    if (!formReserva.fecha_inicio || !formReserva.fecha_fin) { setMsg({ type: 'err', text: 'Ingresa fechas de inicio y fin' }); return }
    setSaving(true)
    try {
      const body: any = {
        espacio_id: selectedEspacio.id,
        fecha_inicio: formReserva.fecha_inicio,
        fecha_fin: formReserva.fecha_fin,
        monto_cobrado: formReserva.monto_cobrado,
        notas: formReserva.notas || null
      }
      if (formReserva.persona_id) body.persona_id = parseInt(formReserva.persona_id)
      const r = await fetch('/api/reservas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      })
      if (r.ok) {
        setShowModalReserva(false)
        fetchReservas(selectedEspacio)
        setFormReserva({ persona_id: '', fecha_inicio: '', fecha_fin: '', monto_cobrado: selectedEspacio.precio_hora, notas: '' })
        setMsg({ type: 'ok', text: 'Reserva creada' })
      } else {
        const e = await r.json(); setMsg({ type: 'err', text: e.detail || 'Error al crear reserva' })
      }
    } catch { setMsg({ type: 'err', text: 'Error de conexión' }) } finally { setSaving(false) }
  }

  async function handleEstado(id: number, estado: string) {
    const r = await fetch('/api/reservas/' + id + '/estado', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado })
    })
    if (r.ok && selectedEspacio) { fetchReservas(selectedEspacio); setMsg({ type: 'ok', text: 'Estado actualizado' }) }
  }

  async function handleAprobar(id: number) {
    const r = await fetch('/api/reservas/' + id + '/aprobar?tenant_id=' + tenantId, { method: 'PATCH' })
    if (r.ok) { setMsg({ type: 'ok', text: 'Reserva aprobada' }); if (selectedEspacio) fetchReservas(selectedEspacio) }
    else { const d = await r.json(); setMsg({ type: 'err', text: d.detail || 'Error' }) }
  }
  async function handleRechazar(id: number) {
    const motivo = prompt('Motivo del rechazo (opcional):') ?? ''
    const r = await fetch('/api/reservas/' + id + '/rechazar?tenant_id=' + tenantId + '&motivo=' + encodeURIComponent(motivo), { method: 'PATCH' })
    if (r.ok) { setMsg({ type: 'ok', text: 'Reserva rechazada' }); if (selectedEspacio) fetchReservas(selectedEspacio) }
    else { const d = await r.json(); setMsg({ type: 'err', text: d.detail || 'Error' }) }
  }
  async function handleEliminarReserva(id: number) {
    if (!confirm('¿Eliminar esta reserva?')) return
    const r = await fetch('/api/reservas/' + id, { method: 'DELETE' })
    if (r.ok && selectedEspacio) fetchReservas(selectedEspacio)
  }

  async function handleEliminarEspacio(id: number) {
    if (!confirm('¿Eliminar este espacio? Se perderán sus reservas.')) return
    const r = await fetch('/api/reservas/espacios/' + id, { method: 'DELETE' })
    if (r.ok) {
      const updated = await fetch('/api/reservas/espacios?condominio_id=' + condominioId).then(x => x.json())
      setEspacios(updated)
      if (selectedEspacio?.id === id) { setSelectedEspacio(null); setReservas([]) }
      setMsg({ type: 'ok', text: 'Espacio eliminado' })
    }
  }

  async function handleEnviar(id: number) {
    setEnviando(id)
    try {
      const r = await fetch('/api/reservas/' + id + '/enviar', { method: 'POST' })
      const d = await r.json()
      if (r.ok) setMsg({ type: 'ok', text: 'Email enviado a ' + d.enviado_a })
      else setMsg({ type: 'err', text: d.detail || 'Error al enviar' })
    } catch { setMsg({ type: 'err', text: 'Error de conexión' }) } finally { setEnviando(null) }
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reservas</h1>
          <p className="text-sm text-slate-500">Espacios comunes y reservas de residentes</p>
        </div>
        {condominios.length > 1 && (
          <select value={condominioId || ''} onChange={e => setCondominioId(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white">
            {condominios.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        )}
      </div>

      {msg && (
        <div className={`rounded-lg p-3 text-sm flex items-center justify-between ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="ml-2 opacity-60 hover:opacity-100 text-lg leading-none">×</button>
        </div>
      )}

      {/* ── SECTION 1: Espacios Comunes ──────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800">Espacios Comunes</h2>
          <button onClick={() => setShowModalEspacio(true)}
            className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-1.5">
            <span className="text-base leading-none">+</span> Agregar Espacio
          </button>
        </div>
        {espacios.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">No hay espacios registrados para este condominio</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {espacios.map(esp => (
              <div key={esp.id} onClick={() => selectEspacio(esp)}
                className={`relative rounded-xl border-2 p-4 cursor-pointer transition-all ${selectedEspacio?.id === esp.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-100 hover:border-indigo-200 bg-white'}`}>
                <button onClick={ev => { ev.stopPropagation(); handleEliminarEspacio(esp.id) }}
                  className="absolute top-2 right-2 text-slate-300 hover:text-red-500 text-lg leading-none">×</button>
                <h3 className="font-semibold text-slate-800 pr-5">{esp.nombre}</h3>
                {esp.descripcion && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{esp.descripcion}</p>}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">👥 {esp.capacidad} pers.</span>
                  {esp.precio_hora > 0 && <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700">${esp.precio_hora}/h</span>}
                  <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">🕐 {esp.horario_inicio}–{esp.horario_fin}</span>
                  {esp.activo === 'si' ? <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">Activo</span> : <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">Inactivo</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── SECTION 2: Reservas del Espacio ──────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        {!selectedEspacio ? (
          <p className="text-slate-400 text-sm text-center py-12">← Selecciona un espacio para ver sus reservas</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="font-semibold text-slate-800">Reservas — {selectedEspacio.nombre}</h2>
                <p className="text-xs text-slate-500">{reservas.length} reserva{reservas.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex gap-2 items-center">
                <input type="date" value={fechaFiltro} onChange={e => { setFechaFiltro(e.target.value); fetchReservas({ ...selectedEspacio }) }}
                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700" />
                {fechaFiltro && <button onClick={() => { setFechaFiltro(''); fetchReservas(selectedEspacio) }} className="text-slate-400 hover:text-slate-700 text-sm">✕ Limpiar</button>}
                <button onClick={() => { setFormReserva({ persona_id: '', fecha_inicio: '', fecha_fin: '', monto_cobrado: selectedEspacio.precio_hora, notas: '' }); setShowModalReserva(true) }}
                  className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-1">
                  <span className="text-base leading-none">+</span> Nueva Reserva
                </button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-10"><div className="w-7 h-7 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" /></div>
            ) : reservas.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-10">No hay reservas para este espacio{fechaFiltro ? ' en esta fecha' : ''}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>{['Residente', 'Desde', 'Hasta', 'Estado', 'Monto', 'Notas', 'Acciones'].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 text-xs font-medium text-slate-500">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {reservas.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-slate-800">{r.persona_nombre || <span className="text-slate-400 italic">Sin asignar</span>}</p>
                          {r.persona_rut && <p className="text-xs text-slate-400 font-mono">{r.persona_rut}</p>}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap text-xs">{fmtDt(r.fecha_inicio)}</td>
                        <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap text-xs">{fmtDt(r.fecha_fin)}</td>
                        <td className="px-3 py-2.5"><span className={estadoBadge(r.estado)}>{r.estado}</span></td>
                        <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">${(r.monto_cobrado || 0).toLocaleString('es-CL')}</td>
                        <td className="px-3 py-2.5 text-slate-500 text-xs max-w-[100px] truncate">{r.notas || '—'}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-1 flex-wrap">
                            {r.estado === 'pendiente' && r.solicitado_por === 'conserje' && (
                              <>
                                <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full border border-amber-200 font-medium">Conserje</span>
                                <button onClick={() => handleAprobar(r.id)}
                                  className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-medium">
                                  ✓ Aprobar
                                </button>
                                <button onClick={() => handleRechazar(r.id)}
                                  className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 border border-red-200">
                                  ✕ Rechazar
                                </button>
                              </>
                            )}
                            {r.estado === 'pendiente' && r.solicitado_por !== 'conserje' && (
                              <button onClick={() => handleEstado(r.id, 'confirmada')}
                                className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200">
                                ✓ Confirmar
                              </button>
                            )}
                            {r.estado !== 'cancelada' && (
                              <button onClick={() => handleEstado(r.id, 'cancelada')}
                                className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 border border-red-200">
                                Cancelar
                              </button>
                            )}
                            <button onClick={() => handleEnviar(r.id)} disabled={enviando === r.id}
                              className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 disabled:opacity-50"
                              title="Enviar confirmación por email">
                              {enviando === r.id ? '⏳' : '📧'}
                            </button>
                            <button onClick={() => handleEliminarReserva(r.id)}
                              className="text-xs px-2 py-1 rounded bg-slate-50 text-slate-500 hover:bg-red-50 hover:text-red-600 border border-slate-200">
                              🗑
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── MODAL: Nuevo Espacio ─────────────────────────────────────────────── */}
      {showModalEspacio && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Nuevo Espacio Común</h3>
              <button onClick={() => setShowModalEspacio(false)} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
            </div>
            <form onSubmit={handleCrearEspacio} className="p-5 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
                <input required type="text" value={formEspacio.nombre} onChange={e => setFormEspacio({ ...formEspacio, nombre: e.target.value })}
                  placeholder="Quincho, Sala de eventos, Piscina..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                <textarea rows={2} value={formEspacio.descripcion} onChange={e => setFormEspacio({ ...formEspacio, descripcion: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Capacidad (pers.)</label>
                  <input type="number" min={1} value={formEspacio.capacidad} onChange={e => setFormEspacio({ ...formEspacio, capacidad: parseInt(e.target.value) })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Precio/hora ($)</label>
                  <input type="number" min={0} value={formEspacio.precio_hora} onChange={e => setFormEspacio({ ...formEspacio, precio_hora: parseFloat(e.target.value) })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Horario inicio</label>
                  <input type="time" value={formEspacio.horario_inicio} onChange={e => setFormEspacio({ ...formEspacio, horario_inicio: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Horario fin</label>
                  <input type="time" value={formEspacio.horario_fin} onChange={e => setFormEspacio({ ...formEspacio, horario_fin: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Requiere pago</label>
                <select value={formEspacio.requiere_pago} onChange={e => setFormEspacio({ ...formEspacio, requiere_pago: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                  <option value="no">No</option>
                  <option value="si">Sí</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModalEspacio(false)}
                  className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Crear Espacio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Nueva Reserva ─────────────────────────────────────────────── */}
      {showModalReserva && selectedEspacio && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-800">Nueva Reserva</h3>
                <p className="text-xs text-slate-500">{selectedEspacio.nombre} · {selectedEspacio.horario_inicio}–{selectedEspacio.horario_fin}</p>
              </div>
              <button onClick={() => setShowModalReserva(false)} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
            </div>
            <form onSubmit={handleCrearReserva} className="p-5 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Residente</label>
                <select value={formReserva.persona_id} onChange={e => setFormReserva({ ...formReserva, persona_id: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                  <option value="">Sin asignar</option>
                  {personas.map(p => <option key={p.id} value={p.id}>{p.nombre_completo} · {p.rut}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha y hora inicio *</label>
                <input required type="datetime-local" value={formReserva.fecha_inicio} onChange={e => setFormReserva({ ...formReserva, fecha_inicio: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha y hora fin *</label>
                <input required type="datetime-local" value={formReserva.fecha_fin} onChange={e => setFormReserva({ ...formReserva, fecha_fin: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Monto cobrado ($)</label>
                <input type="number" min={0} value={formReserva.monto_cobrado} onChange={e => setFormReserva({ ...formReserva, monto_cobrado: parseFloat(e.target.value) })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
                <textarea rows={2} value={formReserva.notas} onChange={e => setFormReserva({ ...formReserva, notas: e.target.value })}
                  placeholder="Motivo, instrucciones especiales..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModalReserva(false)}
                  className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Crear Reserva'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
