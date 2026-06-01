'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'

const WA_URL = "https://wa.me/56998101891?text=Hola%2C%20quiero%20consultar%20sobre%20ConectaAI%20Condominios"

/* ─── Icons ─── */
const Check = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
const WA = () => <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
const Menu = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
const X = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>

const MODULES = [
  { key:'door',      color:'#7c3aed', label:'Control de Puertas TCP/IP',  desc:'Abre y cierra puertas remotamente. Historial completo de cada acceso.' },
  { key:'rfid',      color:'#10b981', label:'Acceso RFID y Biométrico',   desc:'Tarjetas, llaveros y huella dactilar. Sin llaves físicas que perder.' },
  { key:'camera',    color:'#3b82f6', label:'Cámaras integradas',         desc:'CCTV vinculado a eventos. Ver grabación del momento exacto de un incidente.' },
  { key:'alarm',     color:'#f97316', label:'Alarmas y sensores IoT',     desc:'Alertas en tiempo real por intrusión, humo o movimiento sospechoso.' },
  { key:'concierge', color:'#06b6d4', label:'Panel Conserje Táctil',      desc:'Interfaz optimizada para tablet. El conserje opera todo sin capacitación.' },
  { key:'package',   color:'#a78bfa', label:'Gestión de Paquetes',        desc:'Registra con foto. Notifica al residente por WhatsApp de inmediato.' },
  { key:'visitor',   color:'#34d399', label:'Control de Visitas',         desc:'Pre-autorización digital. El residente aprueba desde su celular.' },
  { key:'reserve',   color:'#fbbf24', label:'Reserva de Espacios',        desc:'Quincho, piscina, sala de eventos. Sin superposición, sin conflictos.' },
  { key:'portal',    color:'#f472b6', label:'Portal del Residente',       desc:'App móvil y web. Comunicados, votaciones, solicitudes y pagos.' },
  { key:'finance',   color:'#4ade80', label:'Gestión Financiera',         desc:'Gastos comunes, morosidad, rendición de cuentas. Transparente y auditable.' },
  { key:'wa',        color:'#25d366', label:'Bot WhatsApp',               desc:'Notificaciones automáticas. El residente consulta estado de su visita por chat.' },
  { key:'alert',     color:'#60a5fa', label:'Alertas y notificaciones',   desc:'Push, email y WhatsApp. Nadie se pierde nada importante en el edificio.' },
]

const ICONS: Record<string, React.ReactNode> = {
  door:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4H6a2 2 0 0 0-2 2v14h16V6a2 2 0 0 0-2-2h-5z"/><path d="M10 12h1"/></svg>,
  rfid:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M6.3 6.3a8 8 0 0 0 0 11.4"/><path d="M17.7 6.3a8 8 0 0 1 0 11.4"/></svg>,
  camera:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>,
  alarm:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  concierge: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  package:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  visitor:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  reserve:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  portal:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="12" y2="15"/></svg>,
  finance:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  wa:        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>,
  alert:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
}

const PLANS = [
  {
    name: 'Básico', highlight: false,
    desc: 'Ideal para un edificio o condominio pequeño',
    features: ['1 edificio', 'Hasta 50 departamentos', 'Control de acceso TCP/IP', 'Paquetería básica', 'Portal del residente', 'Soporte email'],
    cta: 'Consultar precio',
  },
  {
    name: 'Profesional', highlight: true, badge: 'Más popular',
    desc: 'Para complejos medianos con mayor exigencia',
    features: ['Hasta 3 edificios', 'Hasta 150 departamentos', 'RFID + cámaras integradas', 'Bot WhatsApp incluido', 'Push notifications', 'Dashboard conserje avanzado', 'Soporte prioritario'],
    cta: 'Consultar precio',
  },
  {
    name: 'Enterprise', highlight: false,
    desc: 'Multi-edificio, multi-ciudad, SaaS white-label',
    features: ['Edificios ilimitados', 'Residentes ilimitados', 'IoT custom (alarmas/RFID)', 'API pública + webhooks', 'SLA 99.9% garantizado', 'Onboarding dedicado', 'Soporte 24/7 directo'],
    cta: 'Consultar',
  },
]

const TESTIMONIALS = [
  { name: 'Rodrigo Fuentes', role: 'Administrador, Edificio Andes', text: 'En 2 semanas digitalizamos todo el control de acceso. Los residentes están felices y el conserje no necesitó capacitación.' },
  { name: 'Carla Muñoz', role: 'Comité de Propietarios, Torres del Parque', text: 'Las notificaciones de paquetes y visitas por WhatsApp cambiaron la experiencia de vivir en el edificio. Cero reclamos.' },
  { name: 'Felipe Araya', role: 'Gerente de Administración, Grupo Inmobiliario', text: 'Manejamos 8 edificios desde un solo panel. El ahorro en tiempo y personal fue inmediato.' },
]

/* ─── Animated counter ─── */
function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const animate = useCallback(() => {
    const start = Date.now()
    const duration = 1800
    const tick = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setVal(Math.round(eased * to))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [to])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { obs.disconnect(); animate() } }, { threshold: 0.5 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [animate])
  return <span ref={ref}>{val.toLocaleString('es-CL')}{suffix}</span>
}

/* ─── Navbar ─── */
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])
  return (
    <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent', backdropFilter: 'blur(16px)', background: scrolled ? 'rgba(7,9,15,0.92)' : 'transparent', transition: 'all 0.3s' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 22px rgba(124,58,237,0.45)', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="white" strokeWidth="2"/><path d="M9 3v18M3 9h18M3 15h18" stroke="white" strokeWidth="1.5"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em', lineHeight: 1.2 }}>ConectaAI</div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', background: 'linear-gradient(90deg,#a78bfa,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>CONDOMINIOS</div>
          </div>
        </div>
        {/* Desktop links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }} className="ca-nav-desktop">
          {['Funcionalidades', 'Precios', 'Contacto'].map(l => (
            <a key={l} href={`#${l.toLowerCase()}`} style={{ fontSize: 13, color: '#64748b', textDecoration: 'none', fontWeight: 500, transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#e2e8f0')} onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}>{l}</a>
          ))}
        </div>
        {/* CTAs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a href="/login" style={{ fontSize: 13, color: '#64748b', textDecoration: 'none', padding: '8px 16px', borderRadius: 8, transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#e2e8f0'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = 'transparent' }}>Ingresar</a>
          <a href={WA_URL} target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: 'white', textDecoration: 'none', padding: '9px 18px', borderRadius: 8, background: '#10b981', boxShadow: '0 4px 16px rgba(16,185,129,0.35)', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#059669'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.transform = 'translateY(0)' }}>
            <WA /> Cotizar ahora
          </a>
          <button onClick={() => setOpen(!open)} style={{ display: 'none', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }} className="ca-menu-btn">
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      {/* Mobile menu */}
      {open && (
        <div style={{ background: 'rgba(7,9,15,0.98)', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {['Funcionalidades', 'Precios', 'Contacto'].map(l => (
            <a key={l} href={`#${l.toLowerCase()}`} onClick={() => setOpen(false)} style={{ fontSize: 14, color: '#94a3b8', textDecoration: 'none', padding: '10px 0' }}>{l}</a>
          ))}
          <a href={WA_URL} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', borderRadius: 10, background: '#10b981', color: 'white', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
            <WA /> Cotizar por WhatsApp
          </a>
        </div>
      )}
      <style>{`
        @media (max-width: 768px) { .ca-nav-desktop { display: none !important; } .ca-menu-btn { display: flex !important; } }
      `}</style>
    </nav>
  )
}

/* ─── Hero ─── */
function Hero() {
  return (
    <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', padding: '120px 24px 80px', position: 'relative', overflow: 'hidden' }}>
      {/* BG */}
      <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 700, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '10%', right: '5%', width: 300, height: 300, borderRadius: '50%', background: 'rgba(16,185,129,0.06)', filter: 'blur(60px)', pointerEvents: 'none' }} />
      <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
        {/* Left */}
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 14px', borderRadius: 100, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', marginBottom: 28 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981', display: 'inline-block' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Sistema integral de condominios</span>
          </div>
          <h1 style={{ fontSize: 52, fontWeight: 900, lineHeight: 1.08, letterSpacing: '-0.03em', marginBottom: 24, color: '#f1f5f9' }}>
            Tu condominio,<br />
            <span style={{ background: 'linear-gradient(135deg,#a78bfa 0%,#34d399 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>inteligente</span> y{' '}
            <span style={{ background: 'linear-gradient(135deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>seguro</span>
          </h1>
          <p style={{ fontSize: 17, color: '#475569', lineHeight: 1.7, marginBottom: 36, maxWidth: 480 }}>
            Control de acceso RFID, cámaras, bot WhatsApp, portal del residente y gestión financiera — todo conectado en una sola plataforma.
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <a href={WA_URL} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 28px', borderRadius: 12, background: '#10b981', color: 'white', textDecoration: 'none', fontSize: 15, fontWeight: 700, boxShadow: '0 6px 24px rgba(16,185,129,0.4)', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#059669'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.transform = 'translateY(0)' }}>
              <WA /> Cotizar por WhatsApp
            </a>
            <a href="#funcionalidades" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '14px 24px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', textDecoration: 'none', fontSize: 15, fontWeight: 500, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#e2e8f0' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#94a3b8' }}>
              Ver funcionalidades →
            </a>
          </div>
          <div style={{ display: 'flex', gap: 24, marginTop: 32 }}>
            {[{ v: '500', s: '+', l: 'edificios' }, { v: '98', s: '%', l: 'satisfacción' }, { v: '24', s: '/7', l: 'soporte' }].map(s => (
              <div key={s.l}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0', letterSpacing: '-0.02em' }}>{s.v}<span style={{ color: '#7c3aed' }}>{s.s}</span></div>
                <div style={{ fontSize: 11, color: '#475569', fontWeight: 500 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Right — dashboard preview */}
        <div style={{ position: 'relative' }}>
          <div style={{ background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: 20, boxShadow: '0 40px 100px rgba(0,0,0,0.5), 0 0 0 1px rgba(124,58,237,0.06)' }}>
            {/* Browser bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
              {['#ef4444','#f59e0b','#22c55e'].map((c, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.6 }} />)}
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 6, height: 22, marginLeft: 8, display: 'flex', alignItems: 'center', paddingLeft: 10 }}>
                <span style={{ fontSize: 10, color: '#334155' }}>conectaai.cl/dashboard</span>
              </div>
            </div>
            {/* KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
              {[{l:'Puertas',v:'12',c:'#7c3aed'},{l:'Residentes',v:'248',c:'#10b981'},{l:'Visitas hoy',v:'34',c:'#3b82f6'}].map(k => (
                <div key={k.l} style={{ background: `linear-gradient(135deg,rgba(${k.c==='#7c3aed'?'124,58,237':k.c==='#10b981'?'16,185,129':'59,130,246'},0.08),transparent)`, border: `1px solid rgba(${k.c==='#7c3aed'?'124,58,237':k.c==='#10b981'?'16,185,129':'59,130,246'},0.12)`, borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 9, color: '#475569', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{k.l}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: k.c }}>{k.v}</div>
                </div>
              ))}
            </div>
            {/* Access log */}
            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: '#334155', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Últimos accesos</div>
              {[
                { name: 'Carlos Mendoza', unit: 'Dpto 502', time: '08:34', icon: '🟢' },
                { name: 'Visita — Laura Soto', unit: 'Dpto 301', time: '08:21', icon: '🔵' },
                { name: 'Delivery — Chilexpress', unit: 'Conserjería', time: '08:05', icon: '📦' },
                { name: 'María González', unit: 'Dpto 802', time: '07:58', icon: '🟢' },
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                  <span style={{ fontSize: 12 }}>{r.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>{r.name}</div>
                    <div style={{ fontSize: 10, color: '#334155' }}>{r.unit}</div>
                  </div>
                  <div style={{ fontSize: 10, color: '#334155' }}>{r.time}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Glow */}
          <div style={{ position: 'absolute', bottom: -20, left: '50%', transform: 'translateX(-50%)', width: '50%', height: 50, background: 'rgba(124,58,237,0.2)', filter: 'blur(30px)', pointerEvents: 'none' }} />
        </div>
      </div>
      <style>{`@media (max-width: 900px) { .ca-hero-grid { grid-template-columns: 1fr !important; } .ca-hero-right { display: none !important; } }`}</style>
    </section>
  )
}

/* ─── Stats ─── */
function Stats() {
  return (
    <section style={{ padding: '48px 24px', borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 2 }}>
        {[
          { to: 500, suffix: '+', label: 'edificios activos' },
          { to: 50000, suffix: '+', label: 'residentes gestionados' },
          { to: 98, suffix: '%', label: 'satisfacción clientes' },
          { to: 12, suffix: ' módulos', label: 'integrados' },
        ].map((s, i) => (
          <div key={i} style={{ textAlign: 'center', padding: '20px 16px', borderRight: i < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
            <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: '-0.03em', background: 'linear-gradient(135deg,#a78bfa,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>
              <Counter to={s.to} suffix={s.suffix} />
            </div>
            <div style={{ fontSize: 12, color: '#475569', marginTop: 6, fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ─── Features ─── */
function Features() {
  return (
    <section id="funcionalidades" style={{ padding: '100px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
          <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', color: '#7c3aed', textTransform: 'uppercase', marginBottom: 16, padding: '4px 12px', background: 'rgba(124,58,237,0.08)', borderRadius: 100, border: '1px solid rgba(124,58,237,0.15)' }}>12 módulos integrados</div>
          <h2 style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.02em', color: '#f1f5f9', lineHeight: 1.2, marginBottom: 16 }}>Todo lo que necesita<br /><span style={{ color: '#475569' }}>tu condominio</span></h2>
          <p style={{ fontSize: 16, color: '#475569', maxWidth: 500, margin: '0 auto', lineHeight: 1.7 }}>Una plataforma que centraliza acceso, comunicación, seguridad y administración.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {MODULES.map((m) => (
            <div key={m.key} style={{ background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: '20px 22px', transition: 'all 0.2s', cursor: 'default' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = m.color + '30'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.transform = 'translateY(0)' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: m.color + '14', border: `1px solid ${m.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: m.color, marginBottom: 14 }}>
                {ICONS[m.key]}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>{m.label}</div>
              <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>{m.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Conserje section ─── */
function Conserje() {
  return (
    <section style={{ padding: '100px 24px', background: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
        <div>
          <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', color: '#06b6d4', textTransform: 'uppercase', marginBottom: 20, padding: '4px 12px', background: 'rgba(6,182,212,0.08)', borderRadius: 100, border: '1px solid rgba(6,182,212,0.15)' }}>Panel conserje</div>
          <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em', color: '#f1f5f9', marginBottom: 18, lineHeight: 1.2 }}>Diseñado para<br />pantallas táctiles</h2>
          <p style={{ fontSize: 15, color: '#475569', lineHeight: 1.7, marginBottom: 28 }}>Botones grandes, respuesta instantánea. Coloca una tablet en recepción y el conserje controla todo sin necesitar capacitación previa.</p>
          {[
            { icon: '🚪', title: 'Control puertas', desc: 'Abre o cierra desde la pantalla. Historial de cada evento.' },
            { icon: '👤', title: 'Registro visitas', desc: 'Alta en segundos. Notifica al residente automáticamente.' },
            { icon: '📦', title: 'Paquetes y envíos', desc: 'Registra con foto. Push al residente de inmediato.' },
          ].map(c => (
            <div key={c.title} style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{c.icon}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 3 }}>{c.title}</div>
                <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>{c.desc}</div>
              </div>
            </div>
          ))}
        </div>
        {/* Tablet mockup */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 300, background: '#0d0d1a', borderRadius: 20, padding: 20, border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>Conserjería</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e', display: 'inline-block' }} />
                  <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600 }}>Online</span>
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#475569' }}>08:34</div>
            </div>
            {/* Door buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              <button style={{ padding: '14px 10px', borderRadius: 10, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>🚪 Abrir entrada</button>
              <button style={{ padding: '14px 10px', borderRadius: 10, background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.25)', color: '#38bdf8', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>📹 Ver cámaras</button>
            </div>
            {/* Recent */}
            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 10, color: '#334155', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Actividad reciente</div>
              {['Carlos M. — Dpto 502 ✓', 'Visita — Laura S. 🔵', 'Delivery 📦 — 08:05'].map((l, i) => (
                <div key={i} style={{ fontSize: 11, color: '#475569', padding: '6px 0', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>{l}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 900px) { .ca-conserje-grid { grid-template-columns: 1fr !important; } }`}</style>
    </section>
  )
}

/* ─── Pricing ─── */
function Pricing() {
  return (
    <section id="precios" style={{ padding: '100px 24px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', color: '#10b981', textTransform: 'uppercase', marginBottom: 16, padding: '4px 12px', background: 'rgba(16,185,129,0.08)', borderRadius: 100, border: '1px solid rgba(16,185,129,0.15)' }}>Precios</div>
          <h2 style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.02em', color: '#f1f5f9', lineHeight: 1.2 }}>Planes a tu medida</h2>
          <p style={{ fontSize: 15, color: '#475569', marginTop: 12 }}>Precios según tu edificio. Contáctanos para una cotización personalizada.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, alignItems: 'stretch' }}>
          {PLANS.map(p => (
            <div key={p.name} style={{ position: 'relative', background: p.highlight ? 'linear-gradient(135deg,rgba(124,58,237,0.08),rgba(79,70,229,0.04))' : '#0d0d1a', border: p.highlight ? '1px solid rgba(124,58,237,0.3)' : '1px solid rgba(255,255,255,0.05)', borderRadius: 16, padding: '28px 24px', display: 'flex', flexDirection: 'column', boxShadow: p.highlight ? '0 0 0 1px rgba(124,58,237,0.1), 0 20px 40px rgba(0,0,0,0.3)' : 'none' }}>
              {p.badge && (
                <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: 'white', fontSize: 11, fontWeight: 700, padding: '4px 16px', borderRadius: 100, whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(124,58,237,0.4)' }}>{p.badge}</div>
              )}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: p.highlight ? '#a78bfa' : '#e2e8f0', marginBottom: 6 }}>{p.name}</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#f1f5f9', marginBottom: 4 }}>Consultar</div>
                <div style={{ fontSize: 12, color: '#475569' }}>{p.desc}</div>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, flex: 1, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {p.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#94a3b8' }}>
                    <Check />{f}
                  </li>
                ))}
              </ul>
              <a href={WA_URL} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px', borderRadius: 10, textDecoration: 'none', fontSize: 13, fontWeight: 700, transition: 'all 0.15s', background: p.highlight ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : 'transparent', color: p.highlight ? 'white' : '#94a3b8', border: p.highlight ? 'none' : '1px solid rgba(255,255,255,0.1)', boxShadow: p.highlight ? '0 6px 20px rgba(124,58,237,0.35)' : 'none' }}
                onMouseEnter={e => { if (!p.highlight) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; e.currentTarget.style.color = '#e2e8f0' }}}
                onMouseLeave={e => { if (!p.highlight) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#94a3b8' }}}>
                <WA />{p.cta}
              </a>
            </div>
          ))}
        </div>
        <p style={{ textAlign: 'center', fontSize: 13, color: '#334155', marginTop: 28 }}>
          ¿Necesidades especiales?{' '}
          <a href={WA_URL} target="_blank" rel="noopener noreferrer" style={{ color: '#a78bfa', textDecoration: 'none' }}>Escríbenos por WhatsApp →</a>
        </p>
      </div>
    </section>
  )
}

/* ─── Testimonials ─── */
function Testimonials() {
  return (
    <section style={{ padding: '80px 24px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', color: '#f1f5f9' }}>Lo que dicen nuestros clientes</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {TESTIMONIALS.map((t, i) => (
            <div key={i} style={{ background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: '24px 22px' }}>
              <div style={{ display: 'flex', gap: 2, marginBottom: 14 }}>
                {[1,2,3,4,5].map(s => <span key={s} style={{ color: '#fbbf24', fontSize: 13 }}>★</span>)}
              </div>
              <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, marginBottom: 18, fontStyle: 'italic' }}>"{t.text}"</p>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{t.name}</div>
                <div style={{ fontSize: 12, color: '#334155', marginTop: 2 }}>{t.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── CTA final ─── */
function CTA() {
  return (
    <section id="contacto" style={{ padding: '100px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 400, borderRadius: '50%', background: 'radial-gradient(circle,rgba(16,185,129,0.08) 0%,transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ maxWidth: 600, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <h2 style={{ fontSize: 44, fontWeight: 900, letterSpacing: '-0.03em', color: '#f1f5f9', lineHeight: 1.1, marginBottom: 18 }}>
          ¿Listo para modernizar<br />
          <span style={{ background: 'linear-gradient(135deg,#a78bfa,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>tu condominio?</span>
        </h2>
        <p style={{ fontSize: 16, color: '#475569', marginBottom: 36, lineHeight: 1.6 }}>Cotiza en menos de 5 minutos. Nuestro equipo te responde hoy.</p>
        <a href={WA_URL} target="_blank" rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '16px 36px', borderRadius: 14, background: '#10b981', color: 'white', textDecoration: 'none', fontSize: 16, fontWeight: 700, boxShadow: '0 8px 32px rgba(16,185,129,0.4)', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#059669'; e.currentTarget.style.transform = 'translateY(-2px)' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.transform = 'translateY(0)' }}>
          <WA /> Cotizar por WhatsApp →
        </a>
      </div>
    </section>
  )
}

/* ─── Footer ─── */
function Footer() {
  return (
    <footer style={{ padding: '32px 24px', borderTop: '1px solid rgba(255,255,255,0.04)', textAlign: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="white" strokeWidth="2"/><path d="M9 3v18M3 9h18M3 15h18" stroke="white" strokeWidth="1.2"/></svg>
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#334155' }}>ConectaAI Condominios</span>
      </div>
      <p style={{ fontSize: 12, color: '#1e293b' }}>© {new Date().getFullYear()} ConectaAI · Sistema Integral de Condominios · Chile</p>
    </footer>
  )
}

/* ─── Page ─── */
export default function Page() {
  return (
    <div style={{ background: '#07090f', color: '#e2e8f0', fontFamily: "'Inter',-apple-system,sans-serif", minHeight: '100vh' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        @media (max-width: 900px) {
          .ca-hero-grid, .ca-conserje-grid, .ca-features-grid, .ca-plans-grid, .ca-testi-grid { grid-template-columns: 1fr !important; }
          .ca-stats-grid { grid-template-columns: repeat(2,1fr) !important; }
          .ca-hero-title { font-size: 38px !important; }
        }
      `}</style>
      <Navbar />
      <Hero />
      <Stats />
      <Features />
      <Conserje />
      <Pricing />
      <Testimonials />
      <CTA />
      <Footer />
    </div>
  )
}
