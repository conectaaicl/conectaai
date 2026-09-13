'use client'
import { useState } from 'react'

/** Formulario "Prueba el demo 5 días": crea el lead en Ventas Terreno, clona el demo y manda la propuesta + claves al correo. */
export default function DemoForm({ compact = false }: { compact?: boolean }) {
  const [f, setF] = useState({ edificio: '', unidades: '', nombre: '', email: '', telefono: '', comuna: '', tipo: 'departamentos' })
  const [busy, setBusy] = useState(false)
  const [ok, setOk] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const set = (k: string, v: string) => setF(s => ({ ...s, [k]: v }))
  const inp: React.CSSProperties = { width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 15, outline: 'none' }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      const r = await fetch('/api/ventas-terreno/publico/solicitar-demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, unidades: Number(f.unidades) || 20, origen: 'condo.conectaai.cl' }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(d.detail || 'No se pudo crear el demo. Escríbenos por WhatsApp.'); return }
      setOk(d.demo_url ? `https://${d.demo_url}` : '')
    } catch { setErr('Sin conexión. Intenta de nuevo.') } finally { setBusy(false) }
  }

  if (ok !== null) return (
    <div style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)', borderRadius: 18, padding: 28, textAlign: 'left' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#f8fafc', marginBottom: 8 }}>🎁 Tu demo está listo</div>
      <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, lineHeight: 1.6 }}>Te enviamos a <b style={{ color: '#fff' }}>{f.email}</b> la propuesta en PDF y las claves de las tres apps (administración, conserjería y vecinos), con el nombre de <b style={{ color: '#fff' }}>{f.edificio}</b>. Tienes 5 días para probar todo.</p>
      {ok && <a href={ok + '/login'} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 16, padding: '14px 24px', borderRadius: 12, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontWeight: 700, textDecoration: 'none' }}>Entrar ahora → {ok.replace('https://', '')}</a>}
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 14 }}>¿No llega el correo? Revisa spam o escríbenos por WhatsApp.</p>
    </div>
  )

  return (
    <form onSubmit={submit} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: compact ? 20 : 28, textAlign: 'left', backdropFilter: 'blur(8px)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: '#34d399', textTransform: 'uppercase', marginBottom: 6 }}>Demo gratis · 5 días · sin tarjeta</div>
      <div style={{ fontSize: compact ? 20 : 24, fontWeight: 800, color: '#f8fafc', marginBottom: 4 }}>Prueba el sistema con el nombre de tu edificio</div>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 18 }}>En 10 segundos creamos una copia completa (unidades, vecinos, gastos comunes, visitas) y te mandamos las claves de las tres apps.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
        <input style={inp} placeholder="Nombre del edificio o condominio *" value={f.edificio} onChange={e => set('edificio', e.target.value)} required />
        <input style={inp} placeholder="N° de unidades *" inputMode="numeric" value={f.unidades} onChange={e => set('unidades', e.target.value.replace(/\D/g, ''))} required />
        <input style={inp} placeholder="Tu nombre *" value={f.nombre} onChange={e => set('nombre', e.target.value)} required />
        <input style={inp} type="email" placeholder="Correo (ahí llegan las claves) *" value={f.email} onChange={e => set('email', e.target.value)} required />
        <input style={inp} placeholder="WhatsApp" inputMode="tel" value={f.telefono} onChange={e => set('telefono', e.target.value)} />
        <input style={inp} placeholder="Comuna" value={f.comuna} onChange={e => set('comuna', e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        {[['departamentos', 'Departamentos'], ['casas', 'Casas']].map(([k, l]) => <button type="button" key={k} onClick={() => set('tipo', k)} style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.14)', background: f.tipo === k ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{l}</button>)}
      </div>
      {err && <p style={{ color: '#fca5a5', fontSize: 13, marginTop: 12 }}>{err}</p>}
      <button type="submit" disabled={busy} style={{ marginTop: 16, width: '100%', padding: '16px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>{busy ? 'Creando tu demo…' : 'Crear mi demo gratis →'}</button>
      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 10, textAlign: 'center' }}>Al terminar los 5 días podrás seguir viendo el sistema, pero no modificarlo. Sin compromiso.</p>
    </form>
  )
}
