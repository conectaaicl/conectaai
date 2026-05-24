'use client'
import { useState, useEffect } from 'react'

interface IntegConfig {
  wa: { activo: boolean; phone_number_id: string | null; token_configured: boolean }
  flow: { activo: boolean; credentials_configured: boolean }
  mp: { activo: boolean; credentials_configured: boolean }
  mail: { activo: boolean; provider: string; key_configured: boolean }
}

type TabId = 'whatsapp' | 'flow' | 'mercadopago' | 'correo'

function StatusBadge({ ok, label }: { ok: boolean; label?: string }) {
  return (
    <span className={
      'inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ' +
      (ok ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500')
    }>
      <span className={'w-1.5 h-1.5 rounded-full ' + (ok ? 'bg-emerald-500' : 'bg-slate-400')} />
      {label || (ok ? 'Activo' : 'Inactivo')}
    </span>
  )
}

function ConfigCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-xl">{icon}</div>
        <h2 className="text-lg font-bold text-gray-800">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ' +
        (value ? 'bg-purple-600' : 'bg-gray-200') +
        (disabled ? ' opacity-50 cursor-not-allowed' : ' cursor-pointer')
      }
    >
      <span className={
        'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ' +
        (value ? 'translate-x-6' : 'translate-x-1')
      } />
    </button>
  )
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
      </svg>
    )
  }
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  )
}

function PasswordInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
        autoComplete="off"
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        tabIndex={-1}
      >
        <EyeIcon open={show} />
      </button>
    </div>
  )
}

// ── Flow credential panel ──────────────────────────────────────────────────
function FlowCredentialPanel({
  configured,
  onSaved,
  onDeleted,
  showToast,
}: {
  configured: boolean
  onSaved: () => void
  onDeleted: () => void
  showToast: (msg: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSave() {
    if (!apiKey.trim() || !secretKey.trim()) {
      showToast('Completa ambos campos')
      return
    }
    setSaving(true)
    try {
      const r = await fetch('/api/admin/integraciones/credenciales/flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey.trim(), secret_key: secretKey.trim() }),
      })
      const d = await r.json()
      if (r.ok && d.ok) {
        showToast('Credenciales Flow guardadas')
        setApiKey('')
        setSecretKey('')
        setOpen(false)
        onSaved()
      } else {
        showToast(d.detail || 'Error al guardar credenciales')
      }
    } catch {
      showToast('Error de conexión')
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm('Eliminar credenciales Flow? Esto desactivara los pagos con Flow.')) return
    setDeleting(true)
    try {
      const r = await fetch('/api/admin/integraciones/credenciales/flow', { method: 'DELETE' })
      if (r.ok) {
        showToast('Credenciales Flow eliminadas')
        onDeleted()
      } else {
        const d = await r.json()
        showToast(d.detail || 'Error al eliminar')
      }
    } catch {
      showToast('Error de conexión')
    }
    setDeleting(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 text-sm font-semibold text-purple-700 hover:text-purple-900 transition-colors"
        >
          <svg
            className={'w-4 h-4 transition-transform ' + (open ? 'rotate-90' : '')}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {configured ? 'Actualizar credenciales' : 'Configurar credenciales'}
        </button>
        {configured && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50 transition-colors"
          >
            {deleting ? 'Eliminando...' : 'Eliminar credenciales'}
          </button>
        )}
      </div>

      {open && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Flow API Key</label>
            <PasswordInput
              value={apiKey}
              onChange={setApiKey}
              placeholder="Tu API Key de Flow.cl"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Flow Secret Key</label>
            <PasswordInput
              value={secretKey}
              onChange={setSecretKey}
              placeholder="Tu Secret Key de Flow.cl"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
            >
              {saving ? 'Guardando...' : 'Guardar credenciales'}
            </button>
            <button
              onClick={() => { setOpen(false); setApiKey(''); setSecretKey('') }}
              className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-white transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── MP credential panel ────────────────────────────────────────────────────
function MpCredentialPanel({
  configured,
  onSaved,
  onDeleted,
  showToast,
}: {
  configured: boolean
  onSaved: () => void
  onDeleted: () => void
  showToast: (msg: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [accessToken, setAccessToken] = useState('')
  const [publicKey, setPublicKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSave() {
    if (!accessToken.trim() || !publicKey.trim()) {
      showToast('Completa ambos campos')
      return
    }
    setSaving(true)
    try {
      const r = await fetch('/api/admin/integraciones/credenciales/mp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken.trim(), public_key: publicKey.trim() }),
      })
      const d = await r.json()
      if (r.ok && d.ok) {
        showToast('Credenciales Mercado Pago guardadas')
        setAccessToken('')
        setPublicKey('')
        setOpen(false)
        onSaved()
      } else {
        showToast(d.detail || 'Error al guardar credenciales')
      }
    } catch {
      showToast('Error de conexión')
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm('Eliminar credenciales Mercado Pago? Esto desactivara los pagos con MP.')) return
    setDeleting(true)
    try {
      const r = await fetch('/api/admin/integraciones/credenciales/mp', { method: 'DELETE' })
      if (r.ok) {
        showToast('Credenciales Mercado Pago eliminadas')
        onDeleted()
      } else {
        const d = await r.json()
        showToast(d.detail || 'Error al eliminar')
      }
    } catch {
      showToast('Error de conexión')
    }
    setDeleting(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 text-sm font-semibold text-purple-700 hover:text-purple-900 transition-colors"
        >
          <svg
            className={'w-4 h-4 transition-transform ' + (open ? 'rotate-90' : '')}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {configured ? 'Actualizar credenciales' : 'Configurar credenciales'}
        </button>
        {configured && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50 transition-colors"
          >
            {deleting ? 'Eliminando...' : 'Eliminar credenciales'}
          </button>
        )}
      </div>

      {open && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Access Token
              <span className="text-gray-400 font-normal ml-1.5 text-xs">empieza con APP_USR o TEST</span>
            </label>
            <PasswordInput
              value={accessToken}
              onChange={setAccessToken}
              placeholder="APP_USR-..."
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Public Key
              <span className="text-gray-400 font-normal ml-1.5 text-xs">empieza con APP_USR o TEST</span>
            </label>
            <PasswordInput
              value={publicKey}
              onChange={setPublicKey}
              placeholder="APP_USR-..."
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
            >
              {saving ? 'Guardando...' : 'Guardar credenciales'}
            </button>
            <button
              onClick={() => { setOpen(false); setAccessToken(''); setPublicKey('') }}
              className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-white transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function IntegracionesPage() {
  const [config, setConfig] = useState<IntegConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('whatsapp')
  const [toast, setToast] = useState('')
  const [waPhoneId, setWaPhoneId] = useState('')
  const [testingWa, setTestingWa] = useState(false)
  const [mailStatus, setMailStatus] = useState<{ connected: boolean; provider: string; from_email: string } | null>(null)

  async function fetchConfig() {
    const r = await fetch('/api/admin/integraciones')
    if (r.ok) {
      const d = await r.json()
      setConfig(d)
      setWaPhoneId(d.wa.phone_number_id || '')
    }
  }

  useEffect(() => {
    Promise.all([
      fetchConfig(),
      fetch('/api/mail').then(r => r.ok ? r.json() : null),
    ]).then(([, mail]) => {
      if (mail) setMailStatus(mail)
      setLoading(false)
    })
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 4000)
  }

  async function patchConfig(fields: Partial<{
    wa_activo: boolean
    wa_phone_number_id: string
    flow_activo: boolean
    mp_activo: boolean
  }>) {
    setSaving(true)
    try {
      const r = await fetch('/api/admin/integraciones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      if (r.ok) {
        await fetchConfig()
        showToast('Guardado correctamente')
      } else {
        showToast('Error al guardar')
      }
    } catch {
      showToast('Error de conexion')
    }
    setSaving(false)
  }

  async function testWa() {
    setTestingWa(true)
    try {
      const r = await fetch('/api/wa/config/test', { method: 'POST' })
      const d = await r.json()
      showToast(d.detail || d.message || (d.ok ? 'Mensaje de prueba enviado' : 'Error al enviar'))
    } catch {
      showToast('Error de conexion')
    }
    setTestingWa(false)
  }

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'whatsapp', label: 'WhatsApp', icon: '💬' },
    { id: 'flow', label: 'Flow.cl', icon: '💳' },
    { id: 'mercadopago', label: 'Mercado Pago', icon: '🛒' },
    { id: 'correo', label: 'Correo', icon: '✉️' },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-purple-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-700 to-indigo-900 px-6 sm:px-8 py-6 mb-6">
        <h1 className="text-2xl font-bold text-white">🔌 Integraciones</h1>
        <p className="text-purple-200 text-sm mt-1">WhatsApp, pagos y notificaciones de la plataforma</p>
      </div>

      <div className="px-4 sm:px-8 max-w-4xl">
        {/* Tab bar */}
        <div className="flex gap-1 bg-white rounded-xl border border-gray-200 p-1 mb-6 shadow-sm overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ' +
                (activeTab === tab.id
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-gray-600 hover:bg-gray-100')
              }
            >
              <span>{tab.icon}</span>
              {tab.label}
              {tab.id === 'whatsapp' && config && (
                <span className={'w-2 h-2 rounded-full ml-1 ' + (config.wa.activo ? 'bg-emerald-400' : 'bg-gray-300')} />
              )}
              {tab.id === 'flow' && config && (
                <span className={'w-2 h-2 rounded-full ml-1 ' + (config.flow.activo ? 'bg-emerald-400' : 'bg-gray-300')} />
              )}
              {tab.id === 'mercadopago' && config && (
                <span className={'w-2 h-2 rounded-full ml-1 ' + (config.mp.activo ? 'bg-emerald-400' : 'bg-gray-300')} />
              )}
              {tab.id === 'correo' && mailStatus && (
                <span className={'w-2 h-2 rounded-full ml-1 ' + (mailStatus.connected ? 'bg-emerald-400' : 'bg-red-400')} />
              )}
            </button>
          ))}
        </div>

        {/* ── WhatsApp ── */}
        {activeTab === 'whatsapp' && config && (
          <ConfigCard title="WhatsApp — Meta Cloud API" icon="💬">
            <div className="space-y-5">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-800">Estado</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {config.wa.token_configured
                      ? 'Token de plataforma configurado'
                      : 'Token de plataforma no configurado — contacta soporte'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge ok={config.wa.token_configured} label={config.wa.token_configured ? 'Token OK' : 'Sin token'} />
                  <Toggle
                    value={config.wa.activo}
                    onChange={v => patchConfig({ wa_activo: v })}
                    disabled={saving || !config.wa.token_configured}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Phone Number ID
                  <span className="text-gray-400 font-normal ml-2">(asignado por ConectaAI)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={waPhoneId}
                    onChange={e => setWaPhoneId(e.target.value)}
                    placeholder="ej. 123456789012345"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={() => patchConfig({ wa_phone_number_id: waPhoneId })}
                    disabled={saving}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    {saving ? '...' : 'Guardar'}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  Solicita tu numero en el portal de ConectaAI o contacta a soporte tecnico.
                </p>
              </div>

              {config.wa.activo && config.wa.phone_number_id && (
                <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div>
                    <p className="font-semibold text-emerald-800">Prueba de envio</p>
                    <p className="text-sm text-emerald-600 mt-0.5">Envia un mensaje al telefono del condominio</p>
                  </div>
                  <button
                    onClick={testWa}
                    disabled={testingWa}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    {testingWa ? 'Enviando...' : 'Enviar prueba'}
                  </button>
                </div>
              )}

              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-sm font-semibold text-blue-800 mb-1">¿Como funciona?</p>
                <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                  <li>ConectaAI gestiona una cuenta de Tech Provider Meta con multiples numeros</li>
                  <li>Tu condominio tiene un numero asignado exclusivo</li>
                  <li>Los residentes reciben notificaciones de multas, paquetes y avisos por WhatsApp</li>
                  <li>Los mensajes entrantes se registran automaticamente</li>
                </ul>
              </div>
            </div>
          </ConfigCard>
        )}

        {/* ── Flow ── */}
        {activeTab === 'flow' && config && (
          <ConfigCard title="Flow.cl — Pagos en linea" icon="💳">
            <div className="space-y-5">
              {/* Status + toggle row */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-800">Estado</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {config.flow.credentials_configured
                      ? 'Credenciales Flow configuradas'
                      : 'Sin credenciales — ingresa tus claves para activar'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge
                    ok={config.flow.credentials_configured}
                    label={config.flow.credentials_configured ? 'Credenciales guardadas ✓' : 'Sin credenciales'}
                  />
                  <Toggle
                    value={config.flow.activo}
                    onChange={v => patchConfig({ flow_activo: v })}
                    disabled={saving || !config.flow.credentials_configured}
                  />
                </div>
              </div>

              {/* Credential input section */}
              <div className="p-4 bg-white rounded-xl border border-gray-200">
                <FlowCredentialPanel
                  configured={config.flow.credentials_configured}
                  onSaved={fetchConfig}
                  onDeleted={fetchConfig}
                  showToast={showToast}
                />
              </div>

              {/* Info box */}
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-sm font-semibold text-blue-800 mb-2">¿Como obtener las claves?</p>
                <p className="text-sm text-blue-700">
                  Crea tu cuenta en <strong>Flow.cl</strong>, activa tu comercio, y copia las claves desde
                  el panel de desarrolladores. Los pagos de tus residentes iran directo a tu cuenta bancaria
                  registrada en Flow.
                </p>
              </div>

              {config.flow.activo && (
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <p className="text-sm font-semibold text-emerald-800">Flow activo — los residentes pueden pagar en linea</p>
                  </div>
                  <p className="text-xs text-emerald-600 mt-1">Los gastos comunes mostraran el boton "Pagar con Flow" en el portal del residente</p>
                </div>
              )}
            </div>
          </ConfigCard>
        )}

        {/* ── Mercado Pago ── */}
        {activeTab === 'mercadopago' && config && (
          <ConfigCard title="Mercado Pago" icon="🛒">
            <div className="space-y-5">
              {/* Status + toggle row */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-800">Estado</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {config.mp.credentials_configured
                      ? 'Credenciales Mercado Pago configuradas'
                      : 'Sin credenciales — ingresa tu Access Token y Public Key'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge
                    ok={config.mp.credentials_configured}
                    label={config.mp.credentials_configured ? 'Credenciales guardadas ✓' : 'Sin credenciales'}
                  />
                  <Toggle
                    value={config.mp.activo}
                    onChange={v => patchConfig({ mp_activo: v })}
                    disabled={saving || !config.mp.credentials_configured}
                  />
                </div>
              </div>

              {/* Credential input section */}
              <div className="p-4 bg-white rounded-xl border border-gray-200">
                <MpCredentialPanel
                  configured={config.mp.credentials_configured}
                  onSaved={fetchConfig}
                  onDeleted={fetchConfig}
                  showToast={showToast}
                />
              </div>

              {/* Info box */}
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-sm font-semibold text-blue-800 mb-2">¿Como obtener las credenciales?</p>
                <p className="text-sm text-blue-700">
                  Accede a <strong>mercadopago.com/developers</strong>, crea una aplicacion y copia las
                  credenciales de produccion. Los pagos van directamente a tu cuenta Mercado Pago.
                </p>
              </div>

              {config.mp.activo && (
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <p className="text-sm font-semibold text-emerald-800">Mercado Pago activo</p>
                  </div>
                  <p className="text-xs text-emerald-600 mt-1">Los gastos comunes mostraran el boton "Pagar con Mercado Pago" en el portal</p>
                </div>
              )}
            </div>
          </ConfigCard>
        )}

        {/* ── Correo ── */}
        {activeTab === 'correo' && (
          <ConfigCard title="Correo — mail.conectaai.cl" icon="✉️">
            <div className="space-y-5">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-800">Estado del servidor</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {mailStatus
                      ? mailStatus.from_email + ' — ' + mailStatus.provider
                      : 'Verificando...'}
                  </p>
                </div>
                <StatusBadge ok={mailStatus?.connected ?? false} label={mailStatus?.connected ? 'Conectado' : 'Sin conexion'} />
              </div>

              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-sm font-semibold text-blue-800 mb-1">Notificaciones automaticas por correo</p>
                <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                  <li>Gastos comunes vencidos → residente afectado</li>
                  <li>Confirmacion de pago → residente</li>
                  <li>Nuevas multas → residente</li>
                  <li>Avisos del condominio → todos los residentes activos</li>
                  <li>Resumen mensual → administrador</li>
                </ul>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Proveedor</p>
                <p className="text-sm font-bold text-gray-800">mail.conectaai.cl</p>
                <p className="text-xs text-gray-500 mt-0.5">Servicio propio — no requiere configuracion adicional</p>
              </div>
            </div>
          </ConfigCard>
        )}

        <div className="h-8" />
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-5 py-3 rounded-xl shadow-xl z-50 font-medium whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  )
}
