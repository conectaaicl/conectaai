'use client'
import { useState, useEffect, useCallback } from 'react'

const API = 'https://condo.conectaai.cl'

interface KeyStatus {
  has_keys: boolean
  card_count?: number
  created_at?: string
  updated_at?: string
}

interface CondoKey {
  condominio_id: number
  card_count: number
  created_at: string
  updated_at: string
}

export default function RFIDKeysPage() {
  const [allKeys, setAllKeys] = useState<CondoKey[]>([])
  const [loading, setLoading] = useState(true)
  const [genId, setGenId] = useState('')
  const [working, setWorking] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const fetchAll = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/rfid-keys/all`)
      if (r.ok) setAllKeys(await r.json())
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function generateKeys(condoId: number) {
    setWorking(`gen-${condoId}`)
    try {
      const r = await fetch(`${API}/api/rfid-keys/generate/${condoId}`, { method: 'POST' })
      const d = await r.json()
      if (r.ok) { showToast(`✅ Llaves generadas para condominio #${condoId} (16 sectores)`, true); await fetchAll() }
      else showToast(`❌ ${d.detail}`, false)
    } catch { showToast('❌ Error de conexión', false) }
    setWorking(null)
  }

  async function rotateKeys(condoId: number) {
    if (!confirm(`⚠️ ¿Rotar llaves del condominio #${condoId}?\nTodas las tarjetas existentes quedarán INVALIDADAS.`)) return
    setWorking(`rot-${condoId}`)
    try {
      const r = await fetch(`${API}/api/rfid-keys/rotate/${condoId}`, { method: 'POST' })
      const d = await r.json()
      if (r.ok) { showToast(`🔄 Llaves rotadas para #${condoId} — tarjetas previas invalidadas`, true); await fetchAll() }
      else showToast(`❌ ${d.detail}`, false)
    } catch { showToast('❌ Error de conexión', false) }
    setWorking(null)
  }

  return (
    <div style={{ padding: '28px 32px', background: '#06060a', minHeight: '100vh', color: '#e2e8f0', fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}`}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, padding: '12px 20px', borderRadius: 12, background: toast.ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${toast.ok ? '#10b981' : '#ef4444'}40`, color: toast.ok ? '#34d399' : '#f87171', fontSize: 14, fontWeight: 600, backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <span style={{ fontSize: 24 }}>🔐</span>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>Llaves RFID por Condominio</h1>
        </div>
        <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.35)' }}>Cada condominio tiene un juego único de 32 llaves Mifare Classic (16 sectores × Key A + Key B), cifradas con AES-256-GCM.</p>
      </div>

      {/* Info banner */}
      <div style={{ background: 'rgba(8,145,178,0.06)', border: '1px solid rgba(8,145,178,0.2)', borderRadius: 14, padding: '16px 20px', marginBottom: 28, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>📋</span>
        <div>
          <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>
            <strong style={{ color: '#67e8f9' }}>Cómo funciona:</strong> Al generar llaves para un condominio, el sistema crea 32 claves aleatorias (192 bytes de entropía) y las guarda cifradas.
            Para emitir una tarjeta nueva, usa el botón <strong style={{ color: '#22d3ee' }}>Ver sectores</strong> y programa el ACR122U con esas llaves.
            Las tarjetas sin las llaves correctas no pueden ser leídas ni clonadas.
          </p>
        </div>
      </div>

      {/* Generate new */}
      <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '20px 22px', marginBottom: 28 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#c4b5fd', marginBottom: 14 }}>Generar llaves para nuevo condominio</h3>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            type="number" placeholder="ID del condominio (ej: 3)"
            value={genId} onChange={e => setGenId(e.target.value)}
            style={{ flex: 1, maxWidth: 240, padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, color: '#e2e8f0', fontSize: 14, outline: 'none' }}
          />
          <button
            disabled={!genId || working !== null}
            onClick={() => genId && generateKeys(parseInt(genId))}
            style={{ padding: '10px 20px', borderRadius: 9, background: genId ? 'linear-gradient(135deg,#0891B2,#0e7490)' : 'rgba(255,255,255,0.04)', color: genId ? 'white' : 'rgba(255,255,255,0.25)', border: 'none', fontSize: 14, fontWeight: 700, cursor: genId ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}>
            {working === `gen-${genId}` ? 'Generando…' : '🔑 Generar llaves'}
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>Cargando…</div>
      ) : allKeys.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔓</div>
          Ningún condominio tiene llaves generadas aún.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {allKeys.map(k => (
            <div key={k.condominio_id} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '18px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 20, alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ background: 'rgba(8,145,178,0.15)', border: '1px solid rgba(8,145,178,0.3)', padding: '3px 10px', borderRadius: 100, fontSize: 12, fontWeight: 700, color: '#67e8f9' }}>
                    Condo #{k.condominio_id}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#34d399' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
                    Llaves activas
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)' }}>
                  Generadas: {new Date(k.created_at).toLocaleString('es-CL', { day:'2-digit', month:'short', year:'numeric' })}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#0891B2', letterSpacing: '-0.03em', lineHeight: 1 }}>{k.card_count}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', marginTop: 3 }}>tarjetas emitidas</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <a
                  href={`${API}/api/rfid-keys/sectors/${k.condominio_id}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ padding: '9px 16px', borderRadius: 9, background: 'rgba(8,145,178,0.12)', border: '1px solid rgba(8,145,178,0.3)', color: '#67e8f9', fontSize: 13, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap', transition: 'all 0.2s' }}>
                  🔍 Ver sectores
                </a>
                <button
                  onClick={() => rotateKeys(k.condominio_id)}
                  disabled={working === `rot-${k.condominio_id}`}
                  style={{ padding: '9px 16px', borderRadius: 9, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s', opacity: working === `rot-${k.condominio_id}` ? 0.5 : 1 }}>
                  {working === `rot-${k.condominio_id}` ? 'Rotando…' : '🔄 Rotar llaves'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
