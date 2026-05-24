'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from '@/hooks/useSession'

interface Zona {
  id: number
  nombre: string
  descripcion?: string
  tipo: string
  estado: string
  activa: boolean
  horario_auto_armar?: string
  horario_auto_desarmar?: string
}

interface Alerta {
  id: number
  zona_id?: number
  zona_nombre?: string
  tipo: string
  descripcion?: string
  nivel: string
  resuelta: boolean
  notificado: boolean
  created_at: string
}

const ESTADO_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  armada:    { label: 'Armada',    color: 'text-red-700',     bg: 'bg-red-50 border-red-200',      dot: 'bg-red-500' },
  desarmada: { label: 'Desarmada', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  parcial:   { label: 'Parcial',   color: 'text-yellow-700',  bg: 'bg-yellow-50 border-yellow-200',  dot: 'bg-yellow-500' },
}

const NIVEL_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  baja:    { label: 'Baja',    color: 'text-blue-700',    bg: 'bg-blue-50' },
  media:   { label: 'Media',   color: 'text-yellow-700',  bg: 'bg-yellow-50' },
  alta:    { label: 'Alta',    color: 'text-orange-700',  bg: 'bg-orange-50' },
  critica: { label: 'CRÍTICA', color: 'text-red-700',     bg: 'bg-red-50' },
}

const TIPO_ZONA = ['perimetro', 'interior', 'estacionamiento', 'entrada', 'comunes']
const TIPO_ALERTA = ['acceso_no_autorizado', 'movimiento', 'sensor_abierto', 'panico', 'fallo_energia', 'sabotaje', 'otro']

export default function AlarmasPage() {
  const { tenantId } = useSession()
  const [zonas, setZonas] = useState<Zona[]>([])
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [tab, setTab] = useState<'zonas' | 'alertas'>('zonas')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [showZonaForm, setShowZonaForm] = useState(false)
  const [showAlertaForm, setShowAlertaForm] = useState(false)
  const [armandoId, setArmandoId] = useState<number | null>(null)
  const [filtroResuelta, setFiltroResuelta] = useState<boolean | null>(false)
  const [zonaForm, setZonaForm] = useState({ nombre: '', descripcion: '', tipo: 'perimetro', horario_auto_armar: '', horario_auto_desarmar: '' })
  const [alertaForm, setAlertaForm] = useState({ tipo: 'movimiento', descripcion: '', nivel: 'media', zona_id: '' })

  const fetchZonas = useCallback(async () => {
    if (!tenantId) return
    const r = await fetch('/api/alarmas/zonas?tenant_id=' + tenantId)
    if (r.ok) setZonas(await r.json())
  }, [tenantId])

  const fetchAlertas = useCallback(async () => {
    if (!tenantId) return
    let url = '/api/alarmas/alertas?tenant_id=' + tenantId + '&limit=100'
    if (filtroResuelta !== null) url += '&resuelta=' + filtroResuelta
    const r = await fetch(url)
    if (r.ok) setAlertas(await r.json())
  }, [tenantId, filtroResuelta])

  useEffect(() => {
    if (!tenantId) return
    Promise.all([fetchZonas(), fetchAlertas()]).finally(() => setLoading(false))
  }, [fetchZonas, fetchAlertas, tenantId])

  function showMsg(type: 'ok' | 'err', text: string) {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 4000)
  }

  async function handleCreateZona(e: React.FormEvent) {
    e.preventDefault()
    if (!tenantId) return
    const r = await fetch('/api/alarmas/zonas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...zonaForm, tenant_id: tenantId }),
    })
    if (r.ok) {
      showMsg('ok', 'Zona creada')
      setShowZonaForm(false)
      setZonaForm({ nombre: '', descripcion: '', tipo: 'perimetro', horario_auto_armar: '', horario_auto_desarmar: '' })
      fetchZonas()
    } else {
      showMsg('err', 'Error al crear zona')
    }
  }

  async function handleDeleteZona(id: number) {
    if (!confirm('¿Eliminar zona?')) return
    await fetch('/api/alarmas/zonas/' + id, { method: 'DELETE' })
    fetchZonas()
  }

  async function handleArmar(id: number, estado: string) {
    if (!tenantId) return
    setArmandoId(id)
    const r = await fetch('/api/alarmas/zonas/' + id + '/estado', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado, tenant_id: tenantId }),
    })
    const d = await r.json()
    if (r.ok) showMsg('ok', 'Zona ' + d.zona + ': ' + d.estado)
    else showMsg('err', d.detail || 'Error')
    setArmandoId(null)
    fetchZonas()
  }

  async function handleCreateAlerta(e: React.FormEvent) {
    e.preventDefault()
    if (!tenantId) return
    const r = await fetch('/api/alarmas/alertas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...alertaForm,
        tenant_id: tenantId,
        zona_id: alertaForm.zona_id ? parseInt(alertaForm.zona_id) : null,
      }),
    })
    if (r.ok) {
      showMsg('ok', 'Alerta creada')
      setShowAlertaForm(false)
      setAlertaForm({ tipo: 'movimiento', descripcion: '', nivel: 'media', zona_id: '' })
      fetchAlertas()
    } else {
      showMsg('err', 'Error al crear alerta')
    }
  }

  async function handleResolver(id: number) {
    await fetch('/api/alarmas/alertas/' + id + '/resolver', { method: 'PATCH' })
    fetchAlertas()
  }

  async function handlePanico() {
    if (!tenantId) return
    if (!confirm('¿Activar BOTÓN DE PÁNICO? Se notificará a todos los administradores.')) return
    const r = await fetch('/api/alarmas/panico?tenant_id=' + tenantId, { method: 'POST' })
    const d = await r.json()
    if (r.ok) showMsg('ok', d.mensaje)
    else showMsg('err', d.detail || 'Error')
    fetchAlertas()
  }

  const pendientes = alertas.filter(a => !a.resuelta).length
  const criticas = alertas.filter(a => !a.resuelta && a.nivel === 'critica').length

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Sistema de Alarmas</h1>
          <p className="text-sm text-slate-500 mt-0.5">Zonas de seguridad, alertas y notificaciones</p>
        </div>
        <button onClick={handlePanico}
          className="flex items-center gap-2 bg-red-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-red-700 shadow-lg shadow-red-200 text-sm">
          🚨 Botón de Pánico
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-2xl font-bold text-slate-800">{zonas.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Zonas totales</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className={'text-2xl font-bold ' + (zonas.filter(z => z.estado === 'armada').length > 0 ? 'text-red-600' : 'text-emerald-600')}>
            {zonas.filter(z => z.estado === 'armada').length}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Zonas armadas</div>
        </div>
        <div className={'bg-white border rounded-xl p-4 ' + (pendientes > 0 ? 'border-orange-200' : 'border-slate-200')}>
          <div className={'text-2xl font-bold ' + (pendientes > 0 ? 'text-orange-600' : 'text-slate-800')}>{pendientes}</div>
          <div className="text-xs text-slate-500 mt-0.5">Alertas pendientes</div>
        </div>
        <div className={'bg-white border rounded-xl p-4 ' + (criticas > 0 ? 'border-red-300 bg-red-50' : 'border-slate-200')}>
          <div className={'text-2xl font-bold ' + (criticas > 0 ? 'text-red-700' : 'text-slate-800')}>{criticas}</div>
          <div className="text-xs text-slate-500 mt-0.5">Alertas críticas</div>
        </div>
      </div>

      {msg && (
        <div className={'px-4 py-3 rounded-lg text-sm font-medium ' + (msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200')}>
          {msg.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-1">
        {([['zonas', 'Zonas de Seguridad'], ['alertas', 'Historial de Alertas']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ' + (tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700')}>
            {label}
            {key === 'alertas' && pendientes > 0 && (
              <span className="ml-1.5 bg-orange-100 text-orange-700 text-xs px-1.5 py-0.5 rounded-full">{pendientes}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Cargando...</div>
      ) : tab === 'zonas' ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowZonaForm(!showZonaForm)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
              + Nueva Zona
            </button>
          </div>

          {showZonaForm && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-4">Nueva Zona de Alarma</h3>
              <form onSubmit={handleCreateZona} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
                  <input required value={zonaForm.nombre} onChange={e => setZonaForm(p => ({ ...p, nombre: e.target.value }))}
                    placeholder="Ej: Perímetro Norte" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
                  <select value={zonaForm.tipo} onChange={e => setZonaForm(p => ({ ...p, tipo: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {TIPO_ZONA.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
                  <input value={zonaForm.descripcion} onChange={e => setZonaForm(p => ({ ...p, descripcion: e.target.value }))}
                    placeholder="Descripción opcional" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Auto-armar a las</label>
                  <input type="time" value={zonaForm.horario_auto_armar} onChange={e => setZonaForm(p => ({ ...p, horario_auto_armar: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Auto-desarmar a las</label>
                  <input type="time" value={zonaForm.horario_auto_desarmar} onChange={e => setZonaForm(p => ({ ...p, horario_auto_desarmar: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="md:col-span-2 flex gap-2 pt-1">
                  <button type="submit" className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Crear Zona</button>
                  <button type="button" onClick={() => setShowZonaForm(false)} className="border border-slate-200 text-slate-600 px-5 py-2 rounded-lg text-sm hover:bg-slate-50">Cancelar</button>
                </div>
              </form>
            </div>
          )}

          {zonas.length === 0 ? (
            <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-xl">
              <div className="text-4xl mb-2">🔔</div>
              <p className="text-slate-500 font-medium">No hay zonas de alarma registradas</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {zonas.map(zona => {
                const cfg = ESTADO_CONFIG[zona.estado] || ESTADO_CONFIG.desarmada
                return (
                  <div key={zona.id} className={'bg-white border rounded-xl p-4 shadow-sm ' + (zona.activa ? 'border-slate-200' : 'border-slate-100 opacity-60')}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-slate-800 text-sm">{zona.nombre}</h3>
                        <span className="text-xs text-slate-400">{zona.tipo}</span>
                      </div>
                      <span className={'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border ' + cfg.bg + ' ' + cfg.color}>
                        <span className={'w-1.5 h-1.5 rounded-full ' + cfg.dot}></span>
                        {cfg.label}
                      </span>
                    </div>
                    {zona.descripcion && <p className="text-xs text-slate-500 mb-2">{zona.descripcion}</p>}
                    {(zona.horario_auto_armar || zona.horario_auto_desarmar) && (
                      <div className="text-xs text-slate-400 mb-3">
                        {zona.horario_auto_armar && <span>Armar: {zona.horario_auto_armar}</span>}
                        {zona.horario_auto_armar && zona.horario_auto_desarmar && <span className="mx-1">·</span>}
                        {zona.horario_auto_desarmar && <span>Desarmar: {zona.horario_auto_desarmar}</span>}
                      </div>
                    )}
                    <div className="flex gap-1.5 mt-3">
                      {zona.estado !== 'armada' && (
                        <button onClick={() => handleArmar(zona.id, 'armada')} disabled={armandoId === zona.id}
                          className="flex-1 text-xs bg-red-50 border border-red-200 text-red-600 px-2 py-1.5 rounded-lg hover:bg-red-100 disabled:opacity-50">
                          🔒 Armar
                        </button>
                      )}
                      {zona.estado !== 'desarmada' && (
                        <button onClick={() => handleArmar(zona.id, 'desarmada')} disabled={armandoId === zona.id}
                          className="flex-1 text-xs bg-emerald-50 border border-emerald-200 text-emerald-600 px-2 py-1.5 rounded-lg hover:bg-emerald-100 disabled:opacity-50">
                          🔓 Desarmar
                        </button>
                      )}
                      {zona.estado !== 'parcial' && (
                        <button onClick={() => handleArmar(zona.id, 'parcial')} disabled={armandoId === zona.id}
                          className="flex-1 text-xs bg-yellow-50 border border-yellow-200 text-yellow-600 px-2 py-1.5 rounded-lg hover:bg-yellow-100 disabled:opacity-50">
                          ◑ Parcial
                        </button>
                      )}
                      <button onClick={() => handleDeleteZona(zona.id)} className="text-xs border border-red-100 text-red-400 px-2 py-1.5 rounded-lg hover:bg-red-50">
                        🗑
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-2">
              {([
                [null, 'Todas'],
                [false, 'Pendientes'],
                [true, 'Resueltas'],
              ] as const).map(([val, label]) => (
                <button key={String(val)} onClick={() => setFiltroResuelta(val)}
                  className={'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ' + (filtroResuelta === val ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50')}>
                  {label}
                </button>
              ))}
            </div>
            <button onClick={() => setShowAlertaForm(!showAlertaForm)} className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700">
              + Registrar Alerta
            </button>
          </div>

          {showAlertaForm && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-4">Registrar Alerta Manual</h3>
              <form onSubmit={handleCreateAlerta} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Tipo *</label>
                  <select value={alertaForm.tipo} onChange={e => setAlertaForm(p => ({ ...p, tipo: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {TIPO_ALERTA.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nivel</label>
                  <select value={alertaForm.nivel} onChange={e => setAlertaForm(p => ({ ...p, nivel: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {['baja', 'media', 'alta', 'critica'].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Zona</label>
                  <select value={alertaForm.zona_id} onChange={e => setAlertaForm(p => ({ ...p, zona_id: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Sin zona</option>
                    {zonas.map(z => <option key={z.id} value={z.id}>{z.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
                  <input value={alertaForm.descripcion} onChange={e => setAlertaForm(p => ({ ...p, descripcion: e.target.value }))}
                    placeholder="Detalles adicionales" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="md:col-span-2 flex gap-2 pt-1">
                  <button type="submit" className="bg-orange-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-orange-700">Registrar</button>
                  <button type="button" onClick={() => setShowAlertaForm(false)} className="border border-slate-200 text-slate-600 px-5 py-2 rounded-lg text-sm hover:bg-slate-50">Cancelar</button>
                </div>
              </form>
            </div>
          )}

          {alertas.length === 0 ? (
            <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-xl">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-slate-500 font-medium">Sin alertas en este período</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Fecha', 'Tipo', 'Zona', 'Nivel', 'Estado', 'Acciones'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {alertas.map(alerta => {
                    const nivel = NIVEL_CONFIG[alerta.nivel] || NIVEL_CONFIG.media
                    return (
                      <tr key={alerta.id} className={'hover:bg-slate-50 ' + (alerta.nivel === 'critica' && !alerta.resuelta ? 'bg-red-50/40' : '')}>
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                          {new Date(alerta.created_at).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">{alerta.tipo.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-3 text-slate-500">{alerta.zona_nombre || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={'text-xs font-medium px-2 py-0.5 rounded-full ' + nivel.bg + ' ' + nivel.color}>
                            {nivel.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {alerta.resuelta ? (
                            <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Resuelta</span>
                          ) : (
                            <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">Pendiente</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {!alerta.resuelta && (
                            <button onClick={() => handleResolver(alerta.id)}
                              className="text-xs text-emerald-600 hover:text-emerald-800 border border-emerald-200 px-2 py-1 rounded-lg hover:bg-emerald-50">
                              ✓ Resolver
                            </button>
                          )}
                          {alerta.notificado && (
                            <span className="ml-1 text-xs text-blue-400" title="Notificado por email">📧</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
