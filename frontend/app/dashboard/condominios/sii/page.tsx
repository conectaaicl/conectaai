'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from '@/hooks/useSession'

const API = '/api/sii'

interface SIIConfig {
  configurado: boolean
  rut_emisor?: string
  razon_social?: string
  giro?: string
  direccion?: string
  comuna?: string
  ciudad?: string
  resolucion_num?: number
  resolucion_fecha?: string
  ambiente?: string
  proximo_folio_boleta?: number
  proximo_folio_factura?: number
}

interface DocSII {
  id: number
  tipo_dte: string
  folio: number
  rut_receptor: string | null
  razon_receptor: string | null
  departamento: string
  fecha_emision: string
  monto_total: number
  estado: string
  periodo: string
  track_id: string | null
  created_at: string
}

interface Cobro {
  id: number
  depto_numero: string
  nombre_residente: string
  concepto: string
  monto: number
  estado: string
}

interface Stats {
  total_documentos: number
  documentos_mes: number
  monto_mes: number
  boletas: number
  facturas: number
  periodo: string
}

const TIPO_LABEL: Record<string, string> = {
  '39': 'Boleta Electrónica',
  '33': 'Factura Electrónica',
  '41': 'Boleta No Afecta',
  '61': 'Nota Crédito',
}

const ESTADO_COLOR: Record<string, string> = {
  generado: 'bg-blue-500/20 text-blue-300',
  enviado_sii: 'bg-emerald-500/20 text-emerald-300',
  rechazado: 'bg-red-500/20 text-red-300',
  anulado: 'bg-slate-500/20 text-slate-400',
  pendiente: 'bg-yellow-500/20 text-yellow-300',
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

export default function SIIPage() {
  const { tenantId } = useSession()
  const tid = tenantId || 1

  const [tab, setTab] = useState<'config' | 'emitir' | 'documentos'>('config')
  const [config, setConfig] = useState<SIIConfig>({ configurado: false })
  const [stats, setStats] = useState<Stats | null>(null)
  const [docs, setDocs] = useState<DocSII[]>([])
  const [docsTotal, setDocsTotal] = useState(0)
  const [cobros, setCobros] = useState<Cobro[]>([])
  const [selectedCobros, setSelectedCobros] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [emitting, setEmitting] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Formulario config
  const [cfgForm, setCfgForm] = useState({
    rut_emisor: '', razon_social: '', giro: 'Administración de Condominios',
    direccion: '', comuna: '', ciudad: '', resolucion_num: '',
    resolucion_fecha: '', ambiente: 'certificacion', api_token: '',
  })

  // Formulario emisión
  const [emitForm, setEmitForm] = useState({
    tipo_dte: '39', rut_receptor: '', razon_receptor: '',
    departamento: '', periodo: new Date().toISOString().slice(0, 7),
  })

  const loadData = useCallback(async () => {
    const [cfgRes, statsRes, docsRes] = await Promise.all([
      fetch(`${API}/config?tenant_id=${tid}`).then(r => r.json()),
      fetch(`${API}/stats?tenant_id=${tid}`).then(r => r.json()),
      fetch(`${API}/documentos?tenant_id=${tid}&limit=20`).then(r => r.json()),
    ])
    setConfig(cfgRes)
    if (cfgRes.configurado) {
      setCfgForm({
        rut_emisor: cfgRes.rut_emisor || '',
        razon_social: cfgRes.razon_social || '',
        giro: cfgRes.giro || 'Administración de Condominios',
        direccion: cfgRes.direccion || '',
        comuna: cfgRes.comuna || '',
        ciudad: cfgRes.ciudad || '',
        resolucion_num: String(cfgRes.resolucion_num || ''),
        resolucion_fecha: cfgRes.resolucion_fecha || '',
        ambiente: cfgRes.ambiente || 'certificacion',
        api_token: '',
      })
    }
    setStats(statsRes)
    setDocs(docsRes.items || [])
    setDocsTotal(docsRes.total || 0)
  }, [tid])

  useEffect(() => { loadData() }, [loadData])

  const loadCobros = async () => {
    if (!emitForm.periodo || !emitForm.departamento) return
    const res = await fetch(
      `/api/gastos-comunes/cobros?tenant_id=${tid}&estado=pendiente&depto=${encodeURIComponent(emitForm.departamento)}&periodo=${emitForm.periodo}`
    ).then(r => r.ok ? r.json() : [])
    setCobros(Array.isArray(res) ? res : (res.items || []))
    setSelectedCobros([])
  }

  useEffect(() => { loadCobros() }, [emitForm.periodo, emitForm.departamento])

  const saveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMsg(null)
    try {
      const r = await fetch(`${API}/config?tenant_id=${tid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cfgForm, resolucion_num: Number(cfgForm.resolucion_num) }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail || 'Error guardando configuración')
      setMsg({ type: 'ok', text: 'Configuración SII guardada correctamente' })
      await loadData()
    } catch (err: any) {
      setMsg({ type: 'err', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  const emitirDocumento = async () => {
    if (selectedCobros.length === 0) {
      setMsg({ type: 'err', text: 'Selecciona al menos un cobro para emitir' })
      return
    }
    setEmitting(true)
    setMsg(null)
    try {
      const r = await fetch(`${API}/emitir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tid,
          tipo_dte: emitForm.tipo_dte,
          rut_receptor: emitForm.rut_receptor || null,
          razon_receptor: emitForm.razon_receptor || null,
          departamento: emitForm.departamento,
          periodo: emitForm.periodo,
          cobros_ids: selectedCobros,
        }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail || 'Error emitiendo documento')
      setMsg({ type: 'ok', text: `✓ ${data.mensaje}` })
      setSelectedCobros([])
      await loadData()
      setTab('documentos')
    } catch (err: any) {
      setMsg({ type: 'err', text: err.message })
    } finally {
      setEmitting(false)
    }
  }

  const descargarXML = async (docId: number) => {
    const r = await fetch(`${API}/documento/${docId}/xml?tenant_id=${tid}`)
    const blob = await r.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `DTE_${docId}.xml`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const anularDoc = async (docId: number) => {
    if (!confirm('¿Anular este documento?')) return
    await fetch(`${API}/documento/${docId}?tenant_id=${tid}`, { method: 'DELETE' })
    loadData()
  }

  const tabs = [
    { id: 'config', label: 'Configuración' },
    { id: 'emitir', label: 'Emitir Documento' },
    { id: 'documentos', label: `Documentos (${docsTotal})` },
  ]

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Facturación SII Electrónica</h1>
        <p className="text-slate-400 text-sm mt-1">
          Genera boletas y facturas electrónicas DTE para gastos comunes según normativa SII Chile.
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Total documentos', value: String(stats.total_documentos), color: 'text-slate-200' },
            { label: 'Boletas', value: String(stats.boletas), color: 'text-blue-400' },
            { label: 'Facturas', value: String(stats.facturas), color: 'text-purple-400' },
            { label: 'Docs este mes', value: String(stats.documentos_mes), color: 'text-slate-200' },
            { label: `Monto ${stats.periodo}`, value: fmt(stats.monto_mes), color: 'text-emerald-400' },
          ].map(s => (
            <div key={s.label} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <p className="text-xs text-slate-400">{s.label}</p>
              <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Alerta no configurado */}
      {!config.configurado && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
          </svg>
          <div>
            <p className="text-yellow-300 font-medium">SII no configurado</p>
            <p className="text-yellow-200/70 text-sm">Complete los datos del emisor en la pestaña Configuración para comenzar a emitir documentos.</p>
          </div>
        </div>
      )}

      {/* Mensaje */}
      {msg && (
        <div className={`rounded-xl p-4 ${msg.type === 'ok' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border border-red-500/30 text-red-300'}`}>
          {msg.text}
          <button onClick={() => setMsg(null)} className="ml-3 text-current opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB: Config */}
      {tab === 'config' && (
        <form onSubmit={saveConfig} className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-slate-200 text-lg">Datos del Emisor</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'rut_emisor', label: 'RUT Emisor', placeholder: '12345678-9' },
              { key: 'razon_social', label: 'Razón Social', placeholder: 'Condominio XYZ' },
              { key: 'giro', label: 'Giro', placeholder: 'Administración de Condominios' },
              { key: 'direccion', label: 'Dirección', placeholder: 'Av. Principal 123' },
              { key: 'comuna', label: 'Comuna', placeholder: 'Las Condes' },
              { key: 'ciudad', label: 'Ciudad', placeholder: 'Santiago' },
              { key: 'resolucion_num', label: 'N° Resolución SII', placeholder: '80' },
              { key: 'resolucion_fecha', label: 'Fecha Resolución', type: 'date' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs text-slate-400 mb-1">{f.label}</label>
                <input
                  type={f.type || 'text'}
                  placeholder={f.placeholder}
                  value={(cfgForm as any)[f.key]}
                  onChange={e => setCfgForm(p => ({ ...p, [f.key]: e.target.value }))}
                  required
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Ambiente</label>
              <select value={cfgForm.ambiente} onChange={e => setCfgForm(p => ({ ...p, ambiente: e.target.value }))}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200">
                <option value="certificacion">Certificación (pruebas)</option>
                <option value="produccion">Producción</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Token API SII (opcional)</label>
              <input type="password" placeholder="Token para envío automático"
                value={cfgForm.api_token}
                onChange={e => setCfgForm(p => ({ ...p, api_token: e.target.value }))}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          {config.configurado && (
            <div className="flex gap-4 text-sm text-slate-400 pt-2 border-t border-slate-700">
              <span>Próximo folio boleta: <strong className="text-slate-200">{config.proximo_folio_boleta}</strong></span>
              <span>Próximo folio factura: <strong className="text-slate-200">{config.proximo_folio_factura}</strong></span>
            </div>
          )}
          <button type="submit" disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
            {saving ? 'Guardando...' : 'Guardar Configuración SII'}
          </button>
        </form>
      )}

      {/* TAB: Emitir */}
      {tab === 'emitir' && (
        <div className="space-y-4">
          {!config.configurado && (
            <div className="text-center py-8 text-slate-400">
              Configure primero los datos del emisor en la pestaña Configuración.
            </div>
          )}
          {config.configurado && (
            <>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
                <h2 className="font-semibold text-slate-200">Datos del Documento</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Tipo Documento</label>
                    <select value={emitForm.tipo_dte} onChange={e => setEmitForm(p => ({ ...p, tipo_dte: e.target.value }))}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200">
                      <option value="39">Boleta Electrónica (39)</option>
                      <option value="33">Factura Electrónica (33)</option>
                      <option value="41">Boleta No Afecta (41)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Período</label>
                    <input type="month" value={emitForm.periodo} onChange={e => setEmitForm(p => ({ ...p, periodo: e.target.value }))}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">N° Departamento</label>
                    <input type="text" placeholder="101" value={emitForm.departamento}
                      onChange={e => setEmitForm(p => ({ ...p, departamento: e.target.value }))}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200" />
                  </div>
                  {emitForm.tipo_dte === '33' && (
                    <>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">RUT Receptor</label>
                        <input type="text" placeholder="12345678-9" value={emitForm.rut_receptor}
                          onChange={e => setEmitForm(p => ({ ...p, rut_receptor: e.target.value }))}
                          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-slate-400 mb-1">Razón Social Receptor</label>
                        <input type="text" placeholder="Nombre propietario" value={emitForm.razon_receptor}
                          onChange={e => setEmitForm(p => ({ ...p, razon_receptor: e.target.value }))}
                          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200" />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Cobros */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-slate-200">Cobros Pendientes</h2>
                  <button onClick={loadCobros} className="text-xs text-blue-400 hover:text-blue-300">
                    Actualizar
                  </button>
                </div>
                {cobros.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-4">
                    {emitForm.departamento ? 'No hay cobros pendientes para este depto/período.' : 'Ingresa el departamento y período para ver los cobros.'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                      <input type="checkbox"
                        checked={selectedCobros.length === cobros.length}
                        onChange={e => setSelectedCobros(e.target.checked ? cobros.map(c => c.id) : [])}
                        className="rounded" />
                      <span>Seleccionar todos</span>
                    </div>
                    {cobros.map(c => (
                      <label key={c.id} className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-700">
                        <input type="checkbox"
                          checked={selectedCobros.includes(c.id)}
                          onChange={e => setSelectedCobros(prev =>
                            e.target.checked ? [...prev, c.id] : prev.filter(x => x !== c.id)
                          )}
                          className="rounded flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-200">{c.concepto}</p>
                          <p className="text-xs text-slate-400">Depto {c.depto_numero} — {c.nombre_residente}</p>
                        </div>
                        <span className="text-sm font-semibold text-emerald-400">{fmt(c.monto)}</span>
                      </label>
                    ))}
                  </div>
                )}

                {selectedCobros.length > 0 && (
                  <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center justify-between">
                    <span className="text-sm text-blue-300">
                      {selectedCobros.length} cobro(s) seleccionado(s) —
                      Total: <strong>{fmt(cobros.filter(c => selectedCobros.includes(c.id)).reduce((s, c) => s + c.monto, 0))}</strong>
                    </span>
                    <button onClick={emitirDocumento} disabled={emitting}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                      {emitting ? 'Emitiendo...' : `Emitir ${TIPO_LABEL[emitForm.tipo_dte]}`}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB: Documentos */}
      {tab === 'documentos' && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-xs">
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Folio</th>
                <th className="px-4 py-3 text-left">Depto</th>
                <th className="px-4 py-3 text-left">Período</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {docs.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No hay documentos emitidos</td></tr>
              )}
              {docs.map(d => (
                <tr key={d.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="px-4 py-3 text-slate-300">{TIPO_LABEL[d.tipo_dte] || d.tipo_dte}</td>
                  <td className="px-4 py-3 font-mono text-slate-200">#{d.folio}</td>
                  <td className="px-4 py-3 text-slate-300">{d.departamento}</td>
                  <td className="px-4 py-3 text-slate-400">{d.periodo}</td>
                  <td className="px-4 py-3 text-right font-medium text-emerald-400">{fmt(d.monto_total)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${ESTADO_COLOR[d.estado] || 'bg-slate-500/20 text-slate-400'}`}>
                      {d.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{d.fecha_emision}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => descargarXML(d.id)} title="Descargar XML"
                        className="text-blue-400 hover:text-blue-300 text-xs">XML</button>
                      {d.estado !== 'anulado' && d.estado !== 'enviado_sii' && (
                        <button onClick={() => anularDoc(d.id)} title="Anular"
                          className="text-red-400 hover:text-red-300 text-xs">Anular</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
