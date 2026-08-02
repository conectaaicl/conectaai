'use client'
import { useState, useEffect, useCallback } from 'react'

const API = 'https://condo.conectaai.cl'

const ESTADOS = ['pendiente','confirmada','en_proceso','lista','entregada','cancelada'] as const
type Estado = typeof ESTADOS[number]

const ESTADO_COLOR: Record<Estado, string> = {
  pendiente:   '#fbbf24',
  confirmada:  '#60a5fa',
  en_proceso:  '#a78bfa',
  lista:       '#34d399',
  entregada:   '#10b981',
  cancelada:   '#ef4444',
}

const ESTADO_LABEL: Record<Estado, string> = {
  pendiente:   'Pendiente',
  confirmada:  'Confirmada',
  en_proceso:  'En proceso',
  lista:       '✅ Lista',
  entregada:   'Entregada',
  cancelada:   'Cancelada',
}

interface Solicitud {
  id: number
  nombre: string
  telefono: string
  email?: string
  tipo_servicio: string
  tipo_tarjeta?: string
  cantidad: number
  modo_atencion: string
  direccion?: string
  condominio?: string
  notas?: string
  estado: Estado
  created_at: string
}

export default function RFIDSolicitudesPage() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<string>('todas')
  const [updating, setUpdating] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const url = filtro === 'todas'
        ? `${API}/api/public/rfid/solicitudes`
        : `${API}/api/public/rfid/solicitudes?estado=${filtro}`
      const r = await fetch(url)
      const data = await r.json()
      setSolicitudes(data)
    } catch { /* silent */ }
    setLoading(false)
  }, [filtro])

  useEffect(() => { fetchData() }, [fetchData])

  async function cambiarEstado(id: number, estado: Estado) {
    setUpdating(id)
    try {
      await fetch(`${API}/api/public/rfid/solicitudes/${id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      })
      setSolicitudes(prev => prev.map(s => s.id === id ? { ...s, estado } : s))
    } catch { /* silent */ }
    setUpdating(null)
  }

  const visible = solicitudes.filter(s =>
    search === '' || s.nombre.toLowerCase().includes(search.toLowerCase()) ||
    s.telefono.includes(search) || (s.condominio || '').toLowerCase().includes(search.toLowerCase())
  )

  const counts = ESTADOS.reduce((acc, e) => {
    acc[e] = solicitudes.filter(s => s.estado === e).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div style={{ padding: '28px 32px', background: '#06060a', minHeight: '100vh', color: '#e2e8f0', fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        select{appearance:none;background:#111827;border:1px solid rgba(255,255,255,0.1);color:#e2e8f0;border-radius:8px;padding:6px 12px;font-size:13px;cursor:pointer;outline:none}
        select:hover{border-color:rgba(255,255,255,0.2)}
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <span style={{ fontSize: 24 }}>📡</span>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>Solicitudes RFID</h1>
        </div>
        <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.35)' }}>Gestión de duplicados, enrolamientos y servicios a domicilio</p>
      </div>

      {/* Stats pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        <button onClick={() => setFiltro('todas')}
          style={{ padding: '6px 14px', borderRadius: 100, border: filtro === 'todas' ? '1px solid rgba(167,139,250,0.5)' : '1px solid rgba(255,255,255,0.08)', background: filtro === 'todas' ? 'rgba(167,139,250,0.12)' : 'transparent', color: filtro === 'todas' ? '#c4b5fd' : 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
          Todas ({solicitudes.length})
        </button>
        {ESTADOS.map(e => (
          <button key={e} onClick={() => setFiltro(e)}
            style={{ padding: '6px 14px', borderRadius: 100, border: filtro === e ? `1px solid ${ESTADO_COLOR[e]}60` : '1px solid rgba(255,255,255,0.08)', background: filtro === e ? `${ESTADO_COLOR[e]}18` : 'transparent', color: filtro === e ? ESTADO_COLOR[e] : 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
            {ESTADO_LABEL[e]} ({counts[e] || 0})
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="text" placeholder="Buscar por nombre, teléfono o condominio…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', maxWidth: 400, padding: '10px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#e2e8f0', fontSize: 14, outline: 'none' }}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>Cargando…</div>
      ) : visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>Sin solicitudes</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.map(s => (
            <div key={s.id} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '18px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 16, alignItems: 'center' }}>
              {/* Left: client info */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.28)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 6 }}>#{s.id}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{s.nombre}</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.38)', lineHeight: 1.6 }}>
                  <a href={`https://wa.me/${s.telefono.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer" style={{ color: '#25d366', textDecoration: 'none' }}>📱 {s.telefono}</a>
                  {s.email && <span style={{ marginLeft: 12 }}>✉️ {s.email}</span>}
                  {s.condominio && <span style={{ marginLeft: 12 }}>🏢 {s.condominio}</span>}
                </div>
              </div>

              {/* Center: service info */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#c4b5fd', marginBottom: 4 }}>
                  {s.tipo_servicio === 'tarjeta' ? '🃏 Tarjeta nueva' : s.tipo_servicio === 'duplicado' ? '📋 Duplicado' : '🚗 Domicilio'}
                  {s.tipo_tarjeta && <span style={{ marginLeft: 8, color: 'rgba(255,255,255,0.38)', fontWeight: 400 }}>· {s.tipo_tarjeta}</span>}
                  <span style={{ marginLeft: 8, color: '#0891B2', fontWeight: 700 }}>×{s.cantidad}</span>
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                  {s.modo_atencion === 'domicilio' ? `📍 ${s.direccion || 'Sin dirección'}` : '🏢 Viene a oficina'}
                  {s.notas && <span style={{ marginLeft: 8, color: 'rgba(255,255,255,0.22)' }}>· {s.notas}</span>}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>
                  {new Date(s.created_at).toLocaleString('es-CL', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                </div>
              </div>

              {/* Right: status selector */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 100, background: `${ESTADO_COLOR[s.estado]}18`, border: `1px solid ${ESTADO_COLOR[s.estado]}40` }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: ESTADO_COLOR[s.estado], display: 'inline-block' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: ESTADO_COLOR[s.estado] }}>{ESTADO_LABEL[s.estado]}</span>
                </div>
                <select
                  disabled={updating === s.id}
                  value={s.estado}
                  onChange={e => cambiarEstado(s.id, e.target.value as Estado)}
                  style={{ fontSize: 12, padding: '5px 10px', borderRadius: 7, opacity: updating === s.id ? 0.5 : 1 }}>
                  {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 20, fontSize: 12, color: 'rgba(255,255,255,0.15)', textAlign: 'right' }}>
        {visible.length} de {solicitudes.length} solicitudes · Actualizado {new Date().toLocaleTimeString('es-CL')}
        <button onClick={fetchData} style={{ marginLeft: 12, background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 12 }}>↻ Refrescar</button>
      </div>
    </div>
  )
}
