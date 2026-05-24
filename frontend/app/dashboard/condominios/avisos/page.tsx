'use client'
import { useState, useEffect } from 'react'
import { useSession } from '@/hooks/useSession'

interface Aviso {
  id: number
  titulo: string
  contenido: string
  tipo: string
  created_at: string
  condominio_id: number | null
}

interface Condominio {
  id: number
  nombre: string
}

const TIPO_CONFIG = {
  informativo: {
    label: 'Informativo',
    badge: 'bg-blue-100 text-blue-700',
    border: 'border-blue-200',
    bg: 'bg-blue-50',
    icon: 'ℹ️',
  },
  urgente: {
    label: 'Urgente',
    badge: 'bg-red-100 text-red-700',
    border: 'border-red-200',
    bg: 'bg-red-50',
    icon: '🚨',
  },
  mantencion: {
    label: 'Mantención',
    badge: 'bg-amber-100 text-amber-700',
    border: 'border-amber-200',
    bg: 'bg-amber-50',
    icon: '🔧',
  },
  reserva: {
    label: 'Reserva',
    badge: 'bg-emerald-100 text-emerald-700',
    border: 'border-emerald-200',
    bg: 'bg-emerald-50',
    icon: '📅',
  },
} as const

export default function AvisosPage() {
  const { tenantId } = useSession()
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [condominios, setCondominios] = useState<Condominio[]>([])
  const [selectedCondominio, setSelectedCondominio] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [enviandoAviso, setEnviandoAviso] = useState<number|null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [lecturasMap, setLecturasMap] = useState<Record<number, number>>({})
  const [lecturasDetail, setLecturasDetail] = useState<{ id: number; data: any } | null>(null)
  const [formData, setFormData] = useState({
    titulo: '',
    contenido: '',
    tipo: 'informativo' as keyof typeof TIPO_CONFIG,
    notificarWA: false,
  })

  useEffect(() => {
    if (!tenantId) return
    fetch(`/api/condominios?tenant_id=${tenantId}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: Condominio[]) => {
        setCondominios(data)
        if (data.length > 0) setSelectedCondominio(data[0].id)
      })
      .catch(() => {})
  }, [tenantId])

  useEffect(() => {
    if (tenantId) fetchAvisos()
  }, [tenantId])

  async function fetchAvisos() {
    if (!tenantId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/avisos?tenant_id=${tenantId}`)
      if (!res.ok) return
      const data: Aviso[] = await res.json()
      setAvisos(data)
      const counts = await Promise.all(
        data.map(a =>
          fetch(`/api/condominios/avisos/${a.id}/lecturas`)
            .then(r => r.ok ? r.json() : { total: 0 })
            .then(d => ({ id: a.id, total: d.total || 0 }))
            .catch(() => ({ id: a.id, total: 0 }))
        )
      )
      const map: Record<number, number> = {}
      counts.forEach(c => { map[c.id] = c.total })
      setLecturasMap(map)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function viewLecturas(avisoId: number) {
    const r = await fetch(`/api/condominios/avisos/${avisoId}/lecturas`)
    if (r.ok) setLecturasDetail({ id: avisoId, data: await r.json() })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.titulo.trim() || !formData.contenido.trim()) {
      setMsg({ type: 'err', text: 'Completa el título y contenido.' })
      return
    }
    setEnviando(true)
    try {
      const payload = {
        titulo: formData.titulo,
        contenido: formData.contenido,
        tipo: formData.tipo,
        tenant_id: tenantId || 1,
        condominio_id: selectedCondominio,
      }
      const res = await fetch('/api/avisos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        if (formData.notificarWA && selectedCondominio) {
          fetch(`/api/condominios/${selectedCondominio}/whatsapp/broadcast`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mensaje: '📢 AVISO URGENTE: ' + formData.titulo + '\n\n' + formData.contenido,
              tenant_id: tenantId,
            }),
          }).catch(() => {})
        }
        setFormData({ titulo: '', contenido: '', tipo: 'informativo', notificarWA: false })
        fetchAvisos()
        setMsg({ type: 'ok', text: 'Aviso publicado. Los residentes lo verán en su portal.' })
      } else {
        const err = await res.json()
        setMsg({ type: 'err', text: 'Error: ' + (err.detail || 'No se pudo publicar') })
      }
    } catch {
      setMsg({ type: 'err', text: 'Error de conexión' })
    } finally {
      setEnviando(false)
    }
  }

  async function handleEliminar(id: number) {
    if (!confirm('¿Eliminar este aviso?')) return
    const res = await fetch(`/api/avisos/${id}`, { method: 'DELETE' })
    if (res.ok) { fetchAvisos(); setMsg({ type: 'ok', text: 'Aviso eliminado' }) }
  }

  const sortedAvisos = [...avisos].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  async function handleEnviarAviso(avisoId: number) {
    setEnviandoAviso(avisoId)
    try {
      const r = await fetch(`/api/avisos/${avisoId}/enviar?tenant_id=${tenantId}`, { method: 'POST' })
      const data = await r.json()
      if (r.ok) setMsg({ type: 'ok', text: `Aviso enviado a ${data.enviados}/${data.total} residentes` })
      else setMsg({ type: 'err', text: data.detail || 'Error al enviar' })
    } catch { setMsg({ type: 'err', text: 'Error de conexión' }) }
    finally { setEnviandoAviso(null) }
  }


  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Avisos y Comunicados</h1>
        <p className="text-sm text-slate-500">Publica información para los residentes del condominio</p>
      </div>

      {/* Portal info banner */}
      <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
        <span className="text-lg mt-0.5">📱</span>
        <div>
          <p className="text-sm font-medium text-indigo-800">Canal de distribución</p>
          <p className="text-xs text-indigo-600 mt-0.5">
            Los residentes ven estos avisos en su portal de residente:{' '}
            <a href="https://conectaai.cl/portal/avisos" target="_blank" rel="noreferrer"
              className="underline font-medium">conectaai.cl/portal/avisos</a>.
            También aparecen en la app al iniciar sesión. Los avisos <strong>urgentes</strong> pueden notificarse por WhatsApp.
          </p>
        </div>
      </div>

      {msg && (
        <div className={`rounded-lg p-3 text-sm flex items-center justify-between ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="ml-2 opacity-60 hover:opacity-100 text-lg leading-none">×</button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Form panel */}
        <div className="lg:w-96 shrink-0">
          <div className="bg-white rounded-xl border border-slate-200 p-5 lg:sticky lg:top-8 shadow-sm">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Nuevo Aviso</h2>
            <form onSubmit={handleSubmit} className="space-y-4">

              {condominios.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Condominio</label>
                  <select
                    value={selectedCondominio || ''}
                    onChange={e => setSelectedCondominio(Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    {condominios.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Título *</label>
                <input
                  type="text" value={formData.titulo} required maxLength={200}
                  onChange={e => setFormData({ ...formData, titulo: e.target.value })}
                  placeholder="Ej: Corte de agua programado el viernes"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tipo *</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(TIPO_CONFIG) as Array<keyof typeof TIPO_CONFIG>).map(tipo => (
                    <button
                      key={tipo} type="button"
                      onClick={() => setFormData({ ...formData, tipo, notificarWA: tipo === 'urgente' ? formData.notificarWA : false })}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-medium transition-all ${
                        formData.tipo === tipo
                          ? `${TIPO_CONFIG[tipo].bg} ${TIPO_CONFIG[tipo].border} border-2 ${TIPO_CONFIG[tipo].badge.split(' ')[1]}`
                          : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <span>{TIPO_CONFIG[tipo].icon}</span>
                      {TIPO_CONFIG[tipo].label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contenido *</label>
                <textarea
                  value={formData.contenido} required rows={4}
                  onChange={e => setFormData({ ...formData, contenido: e.target.value })}
                  placeholder="Escribe el mensaje para los residentes..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                />
              </div>

              {formData.tipo === 'urgente' && (
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={formData.notificarWA}
                    onChange={e => setFormData({ ...formData, notificarWA: e.target.checked })}
                    className="mt-0.5 w-4 h-4 rounded accent-indigo-600"
                  />
                  <span className="text-sm text-slate-700">
                    <span className="font-medium">Notificar por WhatsApp</span>
                    <span className="block text-xs text-slate-500 mt-0.5">Envía un mensaje de alerta a todos los residentes del condominio</span>
                  </span>
                </label>
              )}

              {formData.titulo && (
                <div className={`rounded-lg p-3 border ${TIPO_CONFIG[formData.tipo].bg} ${TIPO_CONFIG[formData.tipo].border}`}>
                  <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    {TIPO_CONFIG[formData.tipo].icon} {formData.titulo}
                  </p>
                  {formData.contenido && <p className="text-xs text-slate-600 mt-1 line-clamp-2">{formData.contenido}</p>}
                </div>
              )}

              <button
                type="submit" disabled={enviando}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-60 transition-colors"
              >
                {enviando ? 'Publicando...' : '📢 Publicar Aviso'}
              </button>
            </form>
          </div>
        </div>

        {/* List */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-700">
              Avisos Publicados
              <span className="text-slate-400 font-normal text-sm ml-1">({avisos.length})</span>
            </h2>
          </div>

          {loading ? (
            <div className="text-center py-12"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" /></div>
          ) : sortedAvisos.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-100">
              <p className="text-4xl mb-2">📋</p>
              <p className="text-slate-400 text-sm">No hay avisos publicados</p>
              <p className="text-slate-300 text-xs mt-1">Crea el primero con el formulario de la izquierda</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedAvisos.map(aviso => {
                const conf = TIPO_CONFIG[aviso.tipo as keyof typeof TIPO_CONFIG] || TIPO_CONFIG.informativo
                const lecturas = lecturasMap[aviso.id] || 0
                return (
                  <div key={aviso.id} className="bg-white rounded-xl border border-slate-100 p-5 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className="text-base">{conf.icon}</span>
                          <h3 className="font-bold text-slate-800 text-sm">{aviso.titulo}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${conf.badge}`}>{conf.label}</span>
                        </div>
                        <p className="text-slate-600 text-sm leading-relaxed">{aviso.contenido}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <p className="text-slate-400 text-xs">
                            {new Date(aviso.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <button
                          onClick={() => viewLecturas(aviso.id)}
                          className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600 transition-colors px-2 py-1 rounded-lg hover:bg-indigo-50"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                          </svg>
                          {lecturas} {lecturas === 1 ? 'lectura' : 'lecturas'}
                        </button>
                        <button
                          onClick={() => handleEnviarAviso(aviso.id)}
                          disabled={enviandoAviso === aviso.id}
                          className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 px-2 py-1 mr-1 rounded disabled:opacity-50"
                        >{enviandoAviso === aviso.id ? '...' : '📧 Enviar'}</button>
                        <button
                          onClick={() => handleEliminar(aviso.id)}
                          className="p-1.5 text-slate-300 hover:text-red-500 rounded transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Lecturas modal */}
      {lecturasDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-800">Lecturas del aviso</h3>
              <button onClick={() => setLecturasDetail(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <div className="p-5 max-h-64 overflow-y-auto">
              {lecturasDetail.data.total === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Ningún residente ha leído este aviso aún</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500 mb-3">{lecturasDetail.data.total} residente(s) han leído este aviso</p>
                  {lecturasDetail.data.lecturas?.map((l: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm border-b border-slate-50 pb-2">
                      <span className="text-slate-700 font-medium">{l.residente_rut || 'Anónimo'}</span>
                      <span className="text-xs text-slate-400">
                        {l.fecha_lectura ? new Date(l.fecha_lectura).toLocaleDateString('es-CL') : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
