'use client'
import { useState, useEffect } from 'react'
import { useSession } from '@/hooks/useSession'
import PushToggleButton from '@/components/PushToggleButton'

const API = '/api/push'

interface Stats {
  total: number
  activos_30d: number
  configurado: boolean
  vapid_public: string | null
}

interface BroadcastForm {
  titulo: string
  mensaje: string
  url: string
}

export default function PushNotificationsPage() {
  const { tenantId } = useSession()
  const tid = tenantId || 1

  const [stats, setStats] = useState<Stats | null>(null)
  const [form, setForm] = useState<BroadcastForm>({ titulo: '', mensaje: '', url: '/portal/avisos' })
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [templates] = useState([
    { label: 'Aviso nuevo', titulo: '📢 Nuevo aviso en el condominio', mensaje: 'Hay un nuevo comunicado para los residentes. Revísalo en el portal.', url: '/portal/avisos' },
    { label: 'Gastos vencidos', titulo: '⚠️ Gastos comunes por vencer', mensaje: 'Tienes gastos comunes pendientes de pago. Revisa tu estado de cuenta.', url: '/portal/cuenta' },
    { label: 'Incidencia resuelta', titulo: '✅ Incidencia resuelta', mensaje: 'Una incidencia reportada ha sido resuelta por el equipo de mantención.', url: '/portal/dashboard' },
    { label: 'Asamblea próxima', titulo: '📅 Asamblea próxima', mensaje: 'Recuerda que se acerca la asamblea de propietarios. Tu participación es importante.', url: '/portal/dashboard' },
    { label: 'Visita autorizada', titulo: '🔔 Visita en portería', mensaje: 'Hay una visita esperándote en la entrada del condominio.', url: '/portal/dashboard' },
  ])

  const loadStats = async () => {
    const res = await fetch(`${API}/stats?tenant_id=${tid}`)
    if (res.ok) setStats(await res.json())
  }

  useEffect(() => { loadStats() }, [tid])

  const sendBroadcast = async () => {
    if (!form.titulo || !form.mensaje) {
      setMsg({ type: 'err', text: 'Título y mensaje son requeridos' })
      return
    }
    setSending(true)
    setMsg(null)
    try {
      const r = await fetch(`${API}/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tid, ...form }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail || 'Error enviando')
      setMsg({ type: 'ok', text: `✓ Enviado a ${data.enviados} de ${data.total} dispositivos${data.fallidos > 0 ? ` (${data.fallidos} inactivos eliminados)` : ''}` })
      setForm({ titulo: '', mensaje: '', url: '/portal/avisos' })
      loadStats()
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Notificaciones Push</h1>
        <p className="text-slate-400 text-sm mt-1">
          Envía notificaciones push a los residentes inscritos vía Web Push (funciona sin app nativa).
        </p>
      </div>

      {/* Estado VAPID */}
      {stats && !stats.configurado && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-yellow-300 text-sm">
          ⚠️ Las claves VAPID no están configuradas. Agrega <code>VAPID_PUBLIC_KEY</code>, <code>VAPID_PRIVATE_KEY</code> y <code>VAPID_EMAIL</code> al docker-compose y rebuild el backend.
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Dispositivos inscritos', value: String(stats.total), color: 'text-blue-400' },
            { label: 'Activos (30 días)', value: String(stats.activos_30d), color: 'text-emerald-400' },
            { label: 'VAPID configurado', value: stats.configurado ? 'Sí ✓' : 'No', color: stats.configurado ? 'text-emerald-400' : 'text-red-400' },
            { label: 'Tu dispositivo', value: '↓ Abajo', color: 'text-slate-400' },
          ].map(s => (
            <div key={s.label} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <p className="text-xs text-slate-400">{s.label}</p>
              <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Suscripción admin */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h2 className="font-semibold text-slate-200 mb-3">Tu suscripción (este dispositivo)</h2>
        <p className="text-sm text-slate-400 mb-4">
          Suscríbete para recibir notificaciones push en este dispositivo y probar que funciona.
        </p>
        <PushToggleButton tenantId={tid} />
      </div>

      {/* Broadcast */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-slate-200">Enviar notificación a todos</h2>

        {/* Templates rápidos */}
        <div>
          <p className="text-xs text-slate-400 mb-2">Plantillas rápidas:</p>
          <div className="flex flex-wrap gap-2">
            {templates.map(t => (
              <button key={t.label} onClick={() => setForm({ titulo: t.titulo, mensaje: t.mensaje, url: t.url })}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs transition-colors">
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Título</label>
            <input type="text" placeholder="Ej: Aviso importante del condominio"
              value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
              maxLength={80}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Mensaje</label>
            <textarea placeholder="Ej: Recuerda que el próximo viernes habrá corte de agua..."
              value={form.mensaje} onChange={e => setForm(p => ({ ...p, mensaje: e.target.value }))}
              rows={3} maxLength={200}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 resize-none" />
            <p className="text-xs text-slate-500 mt-1">{form.mensaje.length}/200 caracteres</p>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">URL destino (al hacer clic)</label>
            <input type="text" placeholder="/portal/avisos"
              value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
          </div>
        </div>

        {msg && (
          <div className={`rounded-lg p-3 text-sm ${msg.type === 'ok' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-800' : 'bg-red-500/10 text-red-300 border border-red-800'}`}>
            {msg.text}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button onClick={sendBroadcast} disabled={sending || !form.titulo || !form.mensaje || (stats?.total === 0)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
            {sending ? (
              <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Enviando...</>
            ) : (
              <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              Enviar a {stats?.total || 0} dispositivos</>
            )}
          </button>
          {stats?.total === 0 && (
            <p className="text-xs text-slate-400">Sin dispositivos inscritos aún</p>
          )}
        </div>
      </div>

      {/* Cómo funciona */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
        <h3 className="font-medium text-slate-300 mb-3">¿Cómo funciona para residentes?</h3>
        <ol className="space-y-2 text-sm text-slate-400">
          <li className="flex gap-3"><span className="text-blue-400 font-bold flex-shrink-0">1.</span> El residente abre el portal en su celular o navegador</li>
          <li className="flex gap-3"><span className="text-blue-400 font-bold flex-shrink-0">2.</span> El sistema solicita permiso para enviar notificaciones</li>
          <li className="flex gap-3"><span className="text-blue-400 font-bold flex-shrink-0">3.</span> Al aceptar, el dispositivo queda inscrito (se guarda en la base de datos)</li>
          <li className="flex gap-3"><span className="text-blue-400 font-bold flex-shrink-0">4.</span> Cuando publicas un aviso o hay un evento, llega una notificación aunque no tengan el portal abierto</li>
          <li className="flex gap-3"><span className="text-blue-400 font-bold flex-shrink-0">5.</span> Funciona en Chrome, Edge, Firefox y Safari (iOS 16.4+) sin necesidad de instalar una app</li>
        </ol>
      </div>
    </div>
  )
}
