'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from '@/hooks/useSession'

const API = 'https://condo.conectaai.cl'
const BRIDGE = 'http://localhost:8765'

interface Condominio { id: number; nombre: string; direccion?: string }
interface Residente { id: number; nombre_completo?: string; nombre?: string; depto?: string; departamento_numero?: string }
interface Tarjeta { id: number; uid: string; nombre_titular: string; categoria: string; tipo_tarjeta: string; activa: boolean }
interface SectorKey { sector: number; key_a: string; key_b: string }

type Modo = 'leer' | 'grabar'
type Paso = 'condo' | 'residente' | 'accion' | 'operacion' | 'confirmar' | 'listo'

const TIPOS_CARD = [
  { value: 'bancaria',       label: 'Tarjeta bancaria',    icon: '💳', desc: 'Débito o crédito con NFC' },
  { value: 'bip',            label: 'Tarjeta Bip!',        icon: '🚇', desc: 'Metro de Santiago' },
  { value: 'mifare_classic', label: 'Tarjeta de acceso',   icon: '🔑', desc: 'MIFARE Classic' },
  { value: 'nfc_phone',      label: 'Teléfono NFC',        icon: '📱', desc: 'Android/iPhone' },
  { value: 'otro',           label: 'Otro',                 icon: '📡', desc: 'Tag RFID genérico' },
]

export default function RFIDEnrollPage() {
  const { user, tenantId } = useSession()
  const hdr = { 'Content-Type': 'application/json' }

  // Bridge status
  const [bridgeOk, setBridgeOk] = useState<boolean | null>(null)
  const [bridgeReader, setBridgeReader] = useState<string | null>(null)

  // Flow state
  const [paso, setPaso] = useState<Paso>('condo')
  const [modo, setModo] = useState<Modo>('leer')
  const [condos, setCondos] = useState<Condominio[]>([])
  const [residentes, setResidentes] = useState<Residente[]>([])
  const [tarjetasReg, setTarjetasReg] = useState<Tarjeta[]>([])
  const [sectorKeys, setSectorKeys] = useState<SectorKey[] | null>(null)

  const [condo, setCondo] = useState<Condominio | null>(null)
  const [residente, setResidente] = useState<Residente | null>(null)
  const [uid, setUid] = useState('')
  const [tipoCard, setTipoCard] = useState('bancaria')
  const [searchRes, setSearchRes] = useState('')

  // Operation state
  const [working, setWorking] = useState(false)
  const [opMsg, setOpMsg] = useState('')
  const [opResult, setOpResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)

  const abortRef = useRef(false)

  const showToast = (ok: boolean, msg: string) => {
    setToast({ ok, msg }); setTimeout(() => setToast(null), 4000)
  }

  // Check bridge every 3s
  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch(`${BRIDGE}/status`, { signal: AbortSignal.timeout(1500) })
        const d = await r.json()
        setBridgeOk(true)
        setBridgeReader(d.reader || null)
      } catch {
        setBridgeOk(false)
        setBridgeReader(null)
      }
    }
    check()
    const iv = setInterval(check, 3000)
    return () => clearInterval(iv)
  }, [])

  // Load condos
  useEffect(() => {
    if (!user) return
    fetch(`${API}/api/condominios?tenant_id=${tenantId}`, { headers: hdr, credentials: 'include' })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setCondos(d) }).catch(() => {})
  }, [user])

  async function selectCondo(c: Condominio) {
    setCondo(c)
    setError(null)
    try {
      const [rRes, tRes] = await Promise.all([
        fetch(`${API}/api/condominios/personas?condominio_id=${c.id}&tenant_id=${tenantId}`, { headers: hdr, credentials: 'include' }).then(r => r.json()),
        fetch(`${API}/api/condominios/rfid?condominio_id=${c.id}&tenant_id=${tenantId}`, { headers: hdr, credentials: 'include' }).then(r => r.json()),
      ])
      if (Array.isArray(rRes)) setResidentes(rRes)
      if (Array.isArray(tRes)) setTarjetasReg(tRes)
    } catch {}
    setPaso('residente')
  }

  async function fetchSectorKeys(condoId: number): Promise<SectorKey[] | null> {
    try {
      const r = await fetch(`${API}/api/rfid-keys/sectors/${condoId}`, { headers: hdr, credentials: 'include' })
      const d = await r.json()
      if (!r.ok) { setError(d.detail || 'Error al obtener llaves del condominio'); return null }
      return d.sectors
    } catch { setError('Error de conexión'); return null }
  }

  async function doRead() {
    if (!bridgeOk) { setError('Inicia el bridge primero'); return }
    setWorking(true)
    setOpMsg('Acerca la tarjeta al ACR122U…')
    setError(null)
    abortRef.current = false
    try {
      const r = await fetch(`${BRIDGE}/read-uid?timeout=30`)
      const d = await r.json()
      if (d.ok && d.uid) {
        setUid(d.uid)
        setOpResult(d)
        setPaso('confirmar')
      } else {
        setError(d.error || 'Sin lectura')
      }
    } catch { setError('Error conectando con el bridge local') }
    setWorking(false)
    setOpMsg('')
  }

  async function doWrite() {
    if (!condo) return
    if (!bridgeOk) { setError('Inicia el bridge primero'); return }
    setWorking(true)
    setError(null)
    setOpMsg('Obteniendo llaves del condominio…')

    const keys = await fetchSectorKeys(condo.id)
    if (!keys) { setWorking(false); setOpMsg(''); return }
    setSectorKeys(keys)

    setOpMsg('Pon una tarjeta virgen MIFARE Classic en el lector y espera…')
    try {
      const r = await fetch(`${BRIDGE}/write-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectors: keys, timeout: 30 }),
      })
      const d = await r.json()
      if (d.ok) {
        setUid(d.uid || '')
        setOpResult(d)
        setPaso('confirmar')
      } else {
        setError(d.error || `Fallo en sectores: ${(d.sectors_failed || []).join(', ')}`)
      }
    } catch { setError('Error conectando con el bridge local') }
    setWorking(false)
    setOpMsg('')
  }

  async function registrarEnSistema() {
    if (!uid || !condo) return
    setWorking(true)
    setError(null)
    try {
      const nombre = residente?.nombre_completo || residente?.nombre || ''
      const depto = residente?.depto || residente?.departamento_numero || ''
      const body = {
        uid: uid.trim().toUpperCase(),
        tipo_tarjeta: modo === 'grabar' ? 'mifare_classic' : tipoCard,
        nombre_titular: nombre,
        descripcion: depto ? `Depto ${depto}` : (modo === 'grabar' ? 'Tarjeta grabada' : 'Registrada via panel'),
        categoria: 'residente',
        tenant_id: tenantId,
        condominio_id: condo.id,
      }
      const r = await fetch(`${API}/api/condominios/rfid`, {
        method: 'POST', headers: hdr, body: JSON.stringify(body),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.detail || 'Error al registrar'); return }
      setTarjetasReg(p => [d, ...p])
      showToast(true, `✅ UID ${uid} registrado — acceso habilitado`)
      setPaso('listo')
    } catch { setError('Error de conexión') }
    setWorking(false)
  }

  function reset(mantenerCondo = false) {
    setUid(''); setResidente(null); setSearchRes(''); setError(null)
    setOpResult(null); setSectorKeys(null); setWorking(false); setOpMsg('')
    setPaso(mantenerCondo ? 'residente' : 'condo')
    if (!mantenerCondo) setCondo(null)
  }

  const resFiltrados = residentes.filter(r => {
    const q = searchRes.toLowerCase()
    return (r.nombre_completo || r.nombre || '').toLowerCase().includes(q) ||
           (r.depto || r.departamento_numero || '').toLowerCase().includes(q)
  })

  const yaRegistrado = tarjetasReg.some(t => t.uid.toUpperCase() === uid.toUpperCase())

  // ─── Render ───
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a12', color: '#e2e8f0', fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}button{cursor:pointer}input{outline:none}
      @keyframes spin{to{transform:rotate(360deg)}}
      @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
      @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      .card{background:#111120;border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:20px}
      .btn-primary{background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;border-radius:12px;color:white;font-weight:700;font-size:15px;padding:14px 24px;width:100%;transition:opacity .15s}
      .btn-primary:hover{opacity:.9} .btn-primary:disabled{opacity:.4}
      .btn-secondary{background:#111120;border:1px solid #1e293b;border-radius:12px;color:#94a3b8;font-weight:600;font-size:14px;padding:12px 20px;width:100%}
      .btn-secondary:hover{border-color:#334155}
      `}</style>

      {toast && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 999, padding: '12px 20px', borderRadius: 12, background: toast.ok ? '#059669' : '#dc2626', color: 'white', fontSize: 14, fontWeight: 600, animation: 'fadeIn .2s' }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ background: '#0d0d1a', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>📡</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>ConectaAI RFID</div>
          <div style={{ fontSize: 11, color: '#475569' }}>Lectura y grabación de tarjetas de acceso</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Bridge status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0d0d1a', border: `1px solid ${bridgeOk ? '#166534' : '#7f1d1d'}`, borderRadius: 20, padding: '5px 12px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: bridgeOk ? '#4ade80' : '#ef4444', display: 'inline-block', animation: bridgeOk ? 'pulse 2s infinite' : 'none' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: bridgeOk ? '#4ade80' : '#ef4444' }}>
              {bridgeOk === null ? 'Verificando…' : bridgeOk ? (bridgeReader ? `ACR122U: ${bridgeReader.slice(0, 20)}` : 'Bridge OK') : 'Bridge desconectado'}
            </span>
          </div>
          {condo && (
            <>
              <span style={{ fontSize: 12, color: '#64748b', background: '#111120', padding: '4px 10px', borderRadius: 20, border: '1px solid #1e293b' }}>{condo.nombre}</span>
              <button onClick={() => reset()} style={{ fontSize: 12, color: '#6366f1', background: 'none', border: 'none' }}>cambiar</button>
            </>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 580, margin: '0 auto', padding: '28px 20px' }}>

        {/* Bridge offline warning */}
        {bridgeOk === false && (
          <div style={{ background: '#1a0a00', border: '1px solid #7c2d12', borderRadius: 14, padding: 16, marginBottom: 20, animation: 'fadeIn .2s' }}>
            <p style={{ fontWeight: 700, color: '#fb923c', marginBottom: 8, fontSize: 14 }}>⚠️ Bridge RFID no detectado</p>
            <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>Descarga y ejecuta el script para que el navegador pueda usar el ACR122U:</p>
            <a href={`${API}/api/rfid/bridge-download`} download="rfid_bridge.py"
              style={{ display: 'inline-block', fontSize: 12, background: '#7c2d12', color: '#fed7aa', padding: '6px 14px', borderRadius: 8, fontWeight: 600, textDecoration: 'none', marginRight: 8 }}>
              ⬇ Descargar rfid_bridge.py
            </a>
            <code style={{ fontSize: 11, color: '#64748b', display: 'block', marginTop: 8 }}>pip install pyscard &amp;&amp; python3 rfid_bridge.py</code>
          </div>
        )}

        {error && (
          <div style={{ background: '#1a0808', border: '1px solid #7f1d1d', borderRadius: 12, padding: '12px 16px', marginBottom: 16, color: '#fca5a5', fontSize: 13, animation: 'fadeIn .2s' }}>
            {error}
          </div>
        )}

        {/* PASO 1 — Condominio */}
        {paso === 'condo' && (
          <div style={{ animation: 'fadeIn .2s' }}>
            <h2 style={{ fontWeight: 800, fontSize: 22, marginBottom: 6 }}>¿Qué condominio?</h2>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>Selecciona el edificio para el que vas a operar la tarjeta.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {condos.length === 0 && <p style={{ color: '#475569', fontSize: 13 }}>Cargando…</p>}
              {condos.map(c => (
                <button key={c.id} onClick={() => selectCondo(c)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', background: '#111120', border: '2px solid #1e293b', borderRadius: 14, color: 'white', textAlign: 'left', transition: 'border-color .15s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#6366f1')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e293b')}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{c.nombre}</div>
                    {c.direccion && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{c.direccion}</div>}
                  </div>
                  <span style={{ color: '#6366f1', fontSize: 20 }}>→</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* PASO 2 — Residente */}
        {paso === 'residente' && (
          <div style={{ animation: 'fadeIn .2s' }}>
            <h2 style={{ fontWeight: 800, fontSize: 22, marginBottom: 6 }}>¿A quién le asignas?</h2>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>Busca al residente o salta este paso.</p>
            <input value={searchRes} onChange={e => setSearchRes(e.target.value)} placeholder="Nombre o número de depto…"
              style={{ width: '100%', background: '#111120', border: '1px solid #1e293b', borderRadius: 12, padding: '12px 16px', color: 'white', fontSize: 14, marginBottom: 10 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto', marginBottom: 12 }}>
              {resFiltrados.slice(0, 25).map(r => {
                const nombre = r.nombre_completo || r.nombre || '—'
                const depto = r.depto || r.departamento_numero || ''
                const tiene = tarjetasReg.some(t => t.nombre_titular === nombre)
                return (
                  <button key={r.id} onClick={() => { setResidente(r); setPaso('accion') }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', background: '#111120', border: '2px solid #1e293b', borderRadius: 11, color: 'white', textAlign: 'left' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#6366f1')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e293b')}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{nombre}</span>
                      {depto && <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>Depto {depto}</span>}
                    </div>
                    {tiene && <span style={{ fontSize: 10, background: '#0c4a6e', color: '#7dd3fc', padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>ya tiene</span>}
                  </button>
                )
              })}
            </div>
            <button onClick={() => { setResidente(null); setPaso('accion') }} className="btn-secondary">
              Continuar sin asignar →
            </button>
          </div>
        )}

        {/* PASO 3 — Acción: Leer o Grabar */}
        {paso === 'accion' && (
          <div style={{ animation: 'fadeIn .2s' }}>
            <h2 style={{ fontWeight: 800, fontSize: 22, marginBottom: 6 }}>¿Qué quieres hacer?</h2>
            {residente && <p style={{ color: '#34d399', fontSize: 13, marginBottom: 16 }}>Residente: {residente.nombre_completo || residente.nombre}</p>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <button onClick={() => { setModo('leer'); setPaso('operacion') }}
                style={{ padding: '24px 16px', background: '#111120', border: `2px solid ${modo === 'leer' ? '#6366f1' : '#1e293b'}`, borderRadius: 16, color: 'white', textAlign: 'center', transition: 'all .15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#6366f1')}
                onMouseLeave={e => { if (modo !== 'leer') e.currentTarget.style.borderColor = '#1e293b' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📖</div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Leer UID</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>El residente ya tiene una tarjeta. La registras en el sistema (bancaria, bip!, etc.)</div>
              </button>
              <button onClick={() => { setModo('grabar'); setPaso('operacion') }}
                style={{ padding: '24px 16px', background: '#111120', border: `2px solid ${modo === 'grabar' ? '#8b5cf6' : '#1e293b'}`, borderRadius: 16, color: 'white', textAlign: 'center', transition: 'all .15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#8b5cf6')}
                onMouseLeave={e => { if (modo !== 'grabar') e.currentTarget.style.borderColor = '#1e293b' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>✏️</div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Grabar tarjeta</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Programa una tarjeta virgen MIFARE Classic con las llaves del condominio.</div>
              </button>
            </div>
          </div>
        )}

        {/* PASO 4 — Operación */}
        {paso === 'operacion' && (
          <div style={{ animation: 'fadeIn .2s' }}>
            <h2 style={{ fontWeight: 800, fontSize: 22, marginBottom: 4 }}>
              {modo === 'leer' ? '📖 Leer UID' : '✏️ Grabar tarjeta'}
            </h2>
            {residente && <p style={{ color: '#34d399', fontSize: 13, marginBottom: 16 }}>Residente: {residente.nombre_completo || residente.nombre}</p>}

            {/* Tipo de tarjeta (solo para leer) */}
            {modo === 'leer' && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 13, color: '#64748b', marginBottom: 10 }}>¿Qué tipo de tarjeta presenta?</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {TIPOS_CARD.map(t => (
                    <button key={t.value} onClick={() => setTipoCard(t.value)}
                      style={{ padding: '12px', background: '#111120', border: `2px solid ${tipoCard === t.value ? '#6366f1' : '#1e293b'}`, borderRadius: 12, color: 'white', textAlign: 'left', transition: 'border-color .15s' }}>
                      <div style={{ fontSize: 20, marginBottom: 4 }}>{t.icon}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: tipoCard === t.value ? '#818cf8' : '#94a3b8' }}>{t.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Action */}
            <div className="card" style={{ textAlign: 'center', marginBottom: 16 }}>
              {!working ? (
                <>
                  <div style={{ fontSize: 52, marginBottom: 12 }}>{modo === 'leer' ? '📡' : '💾'}</div>
                  <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 20 }}>
                    {modo === 'leer'
                      ? 'Haz clic y acerca la tarjeta al ACR122U cuando el lector esté listo.'
                      : 'Haz clic, luego pon una tarjeta virgen MIFARE Classic 1K en el lector. Se grabarán las llaves del condominio.'}
                  </p>
                  <button className="btn-primary" onClick={modo === 'leer' ? doRead : doWrite} disabled={!bridgeOk}>
                    {bridgeOk ? (modo === 'leer' ? '📡 Leer con ACR122U' : '✏️ Grabar con ACR122U') : '⚠️ Bridge no disponible'}
                  </button>
                </>
              ) : (
                <>
                  <div style={{ width: 60, height: 60, borderRadius: '50%', border: '5px solid #6366f1', borderTopColor: 'transparent', animation: 'spin 0.9s linear infinite', margin: '0 auto 16px' }} />
                  <p style={{ fontWeight: 700, color: '#818cf8', fontSize: 15 }}>{opMsg}</p>
                  <p style={{ color: '#475569', fontSize: 12, marginTop: 8 }}>No retires la tarjeta del lector…</p>
                </>
              )}
            </div>

            {/* Manual UID fallback */}
            <div style={{ borderTop: '1px solid #1e293b', paddingTop: 16 }}>
              <p style={{ fontSize: 12, color: '#475569', marginBottom: 8 }}>O ingresa el UID manualmente:</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={uid} onChange={e => setUid(e.target.value.toUpperCase().replace(/[^0-9A-F]/g, ''))} placeholder="A1B2C3D4"
                  style={{ flex: 1, background: '#111120', border: '1px solid #1e293b', borderRadius: 10, padding: '10px 14px', color: '#4ade80', fontSize: 15, fontFamily: 'monospace', letterSpacing: '0.1em' }} />
                <button onClick={() => { if (uid.length >= 4) setPaso('confirmar') }} disabled={uid.length < 4}
                  style={{ padding: '10px 16px', background: uid.length >= 4 ? '#6366f1' : '#1e293b', border: 'none', borderRadius: 10, color: 'white', fontWeight: 700, opacity: uid.length >= 4 ? 1 : 0.5 }}>
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PASO 5 — Confirmar */}
        {paso === 'confirmar' && (
          <div style={{ animation: 'fadeIn .2s' }}>
            <h2 style={{ fontWeight: 800, fontSize: 22, marginBottom: 20 }}>Confirmar registro</h2>

            <div className="card" style={{ marginBottom: 16 }}>
              {/* UID */}
              <div style={{ textAlign: 'center', padding: '20px 0', borderBottom: '1px solid #1e293b', marginBottom: 16 }}>
                <p style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: '0.08em', marginBottom: 6 }}>UID LEÍDO</p>
                <div style={{ fontFamily: 'monospace', fontSize: 28, fontWeight: 900, color: '#4ade80', letterSpacing: '0.15em' }}>{uid}</div>
                {opResult?.sectors_ok && (
                  <div style={{ fontSize: 12, color: '#34d399', marginTop: 6 }}>✅ {opResult.sectors_ok} sectores grabados</div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Row label="Operación" value={modo === 'leer' ? '📖 Registro de UID existente' : '✏️ Tarjeta grabada'} />
                <Row label="Tipo" value={`${TIPOS_CARD.find(t => t.value === (modo === 'grabar' ? 'mifare_classic' : tipoCard))?.icon} ${TIPOS_CARD.find(t => t.value === (modo === 'grabar' ? 'mifare_classic' : tipoCard))?.label}`} />
                <Row label="Condominio" value={condo?.nombre || '—'} />
                {residente && <Row label="Residente" value={`${residente.nombre_completo || residente.nombre} ${residente.depto || residente.departamento_numero ? `· Depto ${residente.depto || residente.departamento_numero}` : ''}`} />}
              </div>
            </div>

            {yaRegistrado && (
              <div style={{ background: '#1c1206', border: '1px solid #78350f', borderRadius: 12, padding: 12, marginBottom: 12, fontSize: 13, color: '#fbbf24' }}>
                ⚠️ Este UID ya está registrado en este condominio.
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setPaso('operacion')} className="btn-secondary" style={{ flex: 1 }}>← Volver</button>
              <button onClick={registrarEnSistema} disabled={working} className="btn-primary" style={{ flex: 2 }}>
                {working ? 'Registrando…' : '✅ Registrar acceso en sistema'}
              </button>
            </div>
          </div>
        )}

        {/* PASO 6 — Listo */}
        {paso === 'listo' && (
          <div style={{ textAlign: 'center', padding: '48px 0', animation: 'fadeIn .3s' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontWeight: 900, fontSize: 24, marginBottom: 8 }}>¡Acceso habilitado!</h2>
            <div style={{ background: '#0b1f10', border: '1px solid #166534', borderRadius: 14, padding: '16px 28px', display: 'inline-block', margin: '16px 0' }}>
              <div style={{ fontFamily: 'monospace', fontSize: 24, fontWeight: 900, color: '#4ade80', letterSpacing: '0.12em' }}>{uid}</div>
              <div style={{ fontSize: 12, color: '#86efac', marginTop: 4 }}>{condo?.nombre}</div>
            </div>
            {residente && (
              <p style={{ color: '#64748b', fontSize: 13, marginBottom: 4 }}>
                Asignado a <strong style={{ color: '#e2e8f0' }}>{residente.nombre_completo || residente.nombre}</strong>
              </p>
            )}
            <p style={{ color: '#475569', fontSize: 12, marginBottom: 28 }}>El residente puede acceder con su tarjeta ahora mismo.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => reset(true)} className="btn-primary" style={{ maxWidth: 220 }}>
                Siguiente tarjeta
              </button>
              <button onClick={() => reset(false)} className="btn-secondary" style={{ maxWidth: 180 }}>
                Cambiar edificio
              </button>
            </div>
          </div>
        )}

        {/* Lista de tarjetas registradas */}
        {tarjetasReg.length > 0 && !['condo','residente'].includes(paso) && (
          <div style={{ marginTop: 32, borderTop: '1px solid #1e293b', paddingTop: 20 }}>
            <p style={{ fontSize: 11, color: '#334155', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 10 }}>REGISTRADAS EN {condo?.nombre?.toUpperCase()}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {tarjetasReg.slice(0, 8).map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', background: '#0d0d1a', borderRadius: 10, fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: 'monospace', color: '#34d399', fontWeight: 700 }}>{t.uid}</span>
                    {t.nombre_titular && <span style={{ color: '#475569', marginLeft: 10 }}>{t.nombre_titular}</span>}
                  </div>
                  <span style={{ fontSize: 10, color: t.activa ? '#4ade80' : '#ef4444' }}>{t.activa ? '● activa' : '○ inactiva'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
      <span style={{ color: '#64748b', fontSize: 13, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  )
}
