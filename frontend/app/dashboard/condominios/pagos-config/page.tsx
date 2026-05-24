'use client'
import { useState, useEffect } from 'react'
import { useSession } from '@/hooks/useSession'

interface PaymentConfig {
  flow_activo: boolean
  flow_configured: boolean
  mp_activo: boolean
  mp_configured: boolean
  mp_public_key: string
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-slate-600'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

export default function PagosConfigPage() {
  const { tenantId } = useSession()
  const [config, setConfig] = useState<PaymentConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Flow form
  const [flowActivo, setFlowActivo] = useState(false)
  const [flowApiKey, setFlowApiKey] = useState('')
  const [flowSecret, setFlowSecret] = useState('')

  // MP form
  const [mpActivo, setMpActivo] = useState(false)
  const [mpToken, setMpToken] = useState('')
  const [mpPublicKey, setMpPublicKey] = useState('')

  useEffect(() => {
    if (!tenantId) return
    fetch('/api/pagos/config?tenant_id=' + tenantId, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setConfig(d)
          setFlowActivo(d.flow_activo)
          setMpActivo(d.mp_activo)
          setMpPublicKey(d.mp_public_key || '')
        }
      })
      .finally(() => setLoading(false))
  }, [tenantId])

  async function save(section: 'flow' | 'mp') {
    setSaving(true)
    const body: any = { ...(section === 'flow'
      ? { flow_activo: flowActivo, ...(flowApiKey ? { flow_api_key: flowApiKey } : {}), ...(flowSecret ? { flow_secret: flowSecret } : {}) }
      : { mp_activo: mpActivo, ...(mpToken ? { mp_access_token: mpToken } : {}), ...(mpPublicKey ? { mp_public_key: mpPublicKey } : {}) }
    ) }
    try {
      const r = await fetch('/api/pagos/config?tenant_id=' + tenantId, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await r.json()
      if (r.ok) {
        setMsg({ type: 'ok', text: 'Configuración guardada correctamente' })
        if (section === 'flow') { setFlowApiKey(''); setFlowSecret('') }
        if (section === 'mp') { setMpToken('') }
        // Refetch
        const cr = await fetch('/api/pagos/config?tenant_id=' + tenantId, { credentials: 'include' })
        if (cr.ok) setConfig(await cr.json())
      } else {
        setMsg({ type: 'err', text: d.detail || 'Error al guardar' })
      }
    } catch {
      setMsg({ type: 'err', text: 'Error de red' })
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(null), 5000)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const cardBase = 'bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5'
  const inp = 'w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition font-mono'
  const lbl = 'block text-xs font-semibold text-slate-400 mb-1.5'

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Configuración de Pagos</h1>
        <p className="text-sm text-slate-400 mt-1">Configura las API keys de Flow y MercadoPago para recibir cobros en línea. Las claves se guardan cifradas.</p>
      </div>

      {msg && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 ${msg.type === 'ok' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border border-red-500/30 text-red-300'}`}>
          {msg.type === 'ok' ? '✓' : '✗'} {msg.text}
        </div>
      )}

      {/* Flow */}
      <div className={cardBase}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-white text-lg">Flow.cl</h2>
              <p className="text-xs text-slate-400">Pagos con tarjeta, débito y transferencia</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {config?.flow_configured && (
              <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">✓ Configurado</span>
            )}
            <ToggleSwitch checked={flowActivo} onChange={setFlowActivo} />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className={lbl}>API Key de Flow</label>
            <input
              type="password"
              value={flowApiKey}
              onChange={e => setFlowApiKey(e.target.value)}
              placeholder={config?.flow_configured ? '••••••••••••••• (dejar vacío para no cambiar)' : 'Pega tu Flow API Key aquí'}
              className={inp}
              autoComplete="off"
            />
          </div>
          <div>
            <label className={lbl}>Secret Key de Flow</label>
            <input
              type="password"
              value={flowSecret}
              onChange={e => setFlowSecret(e.target.value)}
              placeholder={config?.flow_configured ? '••••••••••••••• (dejar vacío para no cambiar)' : 'Pega tu Flow Secret Key aquí'}
              className={inp}
              autoComplete="off"
            />
          </div>
          <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl text-xs text-blue-300/80 space-y-1">
            <p className="font-semibold">Dónde obtener las claves:</p>
            <p>1. Ingresa a tu panel en flow.cl</p>
            <p>2. Ve a Configuración → Credenciales</p>
            <p>3. Copia el API Key y Secret Key de producción</p>
          </div>
          <button
            onClick={() => save('flow')}
            disabled={saving}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl transition text-sm"
          >
            {saving ? 'Guardando...' : 'Guardar configuración Flow'}
          </button>
        </div>
      </div>

      {/* MercadoPago */}
      <div className={cardBase}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sky-500/20 rounded-xl flex items-center justify-center text-sky-400 font-bold text-lg">MP</div>
            <div>
              <h2 className="font-bold text-white text-lg">MercadoPago</h2>
              <p className="text-xs text-slate-400">Pagos con tarjeta y cuentas MP</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {config?.mp_configured && (
              <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">✓ Configurado</span>
            )}
            <ToggleSwitch checked={mpActivo} onChange={setMpActivo} />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className={lbl}>Access Token (producción)</label>
            <input
              type="password"
              value={mpToken}
              onChange={e => setMpToken(e.target.value)}
              placeholder={config?.mp_configured ? '••••••••••••••• (dejar vacío para no cambiar)' : 'APP_USR-...'}
              className={inp}
              autoComplete="off"
            />
          </div>
          <div>
            <label className={lbl}>Public Key</label>
            <input
              value={mpPublicKey}
              onChange={e => setMpPublicKey(e.target.value)}
              placeholder="APP_USR-..."
              className={inp}
              autoComplete="off"
            />
          </div>
          <div className="p-3 bg-sky-500/5 border border-sky-500/20 rounded-xl text-xs text-sky-300/80 space-y-1">
            <p className="font-semibold">Dónde obtener las claves:</p>
            <p>1. Ve a mercadopago.cl → Tu negocio → Credenciales</p>
            <p>2. Activa el modo Producción</p>
            <p>3. Copia el Access Token y Public Key</p>
          </div>
          <button
            onClick={() => save('mp')}
            disabled={saving}
            className="w-full py-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold rounded-xl transition text-sm"
          >
            {saving ? 'Guardando...' : 'Guardar configuración MercadoPago'}
          </button>
        </div>
      </div>

      {/* Webhooks info */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          URLs de Webhook
        </h3>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-slate-400 mb-1">Flow — Notificación de pago:</p>
            <code className="block bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-indigo-300 font-mono break-all">
              {typeof window !== 'undefined' ? window.location.origin : 'https://conectaai.cl'}/api/pagos/flow/confirm
            </code>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">MercadoPago — IPN Webhook:</p>
            <code className="block bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-sky-300 font-mono break-all">
              {typeof window !== 'undefined' ? window.location.origin : 'https://conectaai.cl'}/api/pagos/mp/webhook
            </code>
          </div>
        </div>
      </div>
    </div>
  )
}
