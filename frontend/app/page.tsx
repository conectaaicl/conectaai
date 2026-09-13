'use client'
import DemoForm from './components/DemoForm'
import React, { useState, useEffect, useRef, useCallback } from 'react'

const WA_URL = "https://wa.me/56998101891?text=Hola%2C%20quiero%20consultar%20sobre%20ConectaAI%20Condominios"

/* ─── LOGO SUPER PRO ─── */
function ConectaAILogo({ size = 40, dark = false }: { size?: number; dark?: boolean }) {
  const s = size
  return (
    <svg width={s} height={s} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lg1" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7c3aed"/>
          <stop offset="100%" stopColor="#4f46e5"/>
        </linearGradient>
        <linearGradient id="lg2" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34d399"/>
          <stop offset="100%" stopColor="#10b981"/>
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
      </defs>
      {/* Background rounded square */}
      <rect width="80" height="80" rx="20" fill="url(#lg1)"/>
      {/* Building silhouette — stylized */}
      {/* Main tower */}
      <rect x="24" y="26" width="14" height="36" rx="2" fill="white" fillOpacity="0.95"/>
      {/* Side wing */}
      <rect x="42" y="36" width="14" height="26" rx="2" fill="white" fillOpacity="0.7"/>
      {/* Windows grid on main tower */}
      <rect x="27" y="30" width="3" height="3" rx="0.5" fill="url(#lg1)" fillOpacity="0.5"/>
      <rect x="32" y="30" width="3" height="3" rx="0.5" fill="url(#lg1)" fillOpacity="0.5"/>
      <rect x="27" y="36" width="3" height="3" rx="0.5" fill="url(#lg1)" fillOpacity="0.5"/>
      <rect x="32" y="36" width="3" height="3" rx="0.5" fill="url(#lg1)" fillOpacity="0.5"/>
      <rect x="27" y="42" width="3" height="3" rx="0.5" fill="url(#lg1)" fillOpacity="0.5"/>
      <rect x="32" y="42" width="3" height="3" rx="0.5" fill="url(#lg2)" fillOpacity="0.8"/>
      {/* Windows on side wing */}
      <rect x="45" y="39" width="3" height="3" rx="0.5" fill="url(#lg1)" fillOpacity="0.4"/>
      <rect x="50" y="39" width="3" height="3" rx="0.5" fill="url(#lg1)" fillOpacity="0.4"/>
      <rect x="45" y="45" width="3" height="3" rx="0.5" fill="url(#lg2)" fillOpacity="0.7"/>
      <rect x="50" y="45" width="3" height="3" rx="0.5" fill="url(#lg1)" fillOpacity="0.4"/>
      {/* WiFi/connectivity arc top-right */}
      <circle cx="62" cy="18" r="2.5" fill="#34d399" filter="url(#glow)"/>
      <path d="M57 18 Q59.5 14 62 14 Q64.5 14 67 18" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.8"/>
      <path d="M55 18 Q58.5 11 62 11 Q65.5 11 69 18" stroke="#34d399" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.4"/>
      {/* Ground line */}
      <rect x="18" y="62" width="44" height="2.5" rx="1.25" fill="white" fillOpacity="0.3"/>
    </svg>
  )
}

function ConectaAIWordmark({ light = false }: { light?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
      <ConectaAILogo size={52} />
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 0 }}>
          <span style={{ fontSize: 18, fontWeight: 900, color: light ? '#0f172a' : '#f1f5f9', letterSpacing: '-0.03em', lineHeight: 1 }}>Conecta</span>
          <span style={{ fontSize: 18, fontWeight: 900, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.03em', lineHeight: 1 }}>AI</span>
        </div>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', color: light ? '#64748b' : 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginTop: 2 }}>Condominios</div>
      </div>
    </div>
  )
}

/* ─── SVG Icons ─── */
const WA = () => <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
const MenuIcon = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
const CloseIcon = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
const Check = ({ color = '#10b981' }: { color?: string }) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill={color + '18'}/><polyline points="7 13 10 16 17 9" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
const ArrowRight = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
const EyeIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>

/* ─── Animated counter ─── */
function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const animate = useCallback(() => {
    const start = Date.now()
    const duration = 2000
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

/* ─── NAVBAR ─── */
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])
  const links = ['Funcionalidades', 'Cómo funciona', 'Precios', 'Contacto']
  return (
    <>
      <nav style={{ position:'fixed', top:0, left:0, right:0, zIndex:100, backdropFilter:'blur(20px)', background: scrolled ? 'rgba(6,6,10,0.95)' : 'rgba(0,0,0,0.15)', borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent', transition:'all 0.4s ease' }}>
        <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 28px', height:68, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <a href="#" style={{ textDecoration:'none' }}><ConectaAIWordmark /></a>
          <div className="ca-nav-links" style={{ display:'flex', alignItems:'center', gap:36 }}>
            {links.map(l => (
              <a key={l} href={`#${l.toLowerCase().replace(/\s/g,'-').replace(/é/g,'e').replace(/ó/g,'o')}`}
                style={{ fontSize:13.5, color:'rgba(255,255,255,0.5)', textDecoration:'none', fontWeight:500, transition:'color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.color='#fff')} onMouseLeave={e => (e.currentTarget.style.color='rgba(255,255,255,0.5)')}>{l}</a>
            ))}
            <a href="/blog"
              style={{ fontSize:13.5, color:'rgba(255,255,255,0.5)', textDecoration:'none', fontWeight:500, transition:'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.color='#fff')} onMouseLeave={e => (e.currentTarget.style.color='rgba(255,255,255,0.5)')}>Blog</a>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <a href="/login" className="ca-login-btn" style={{ fontSize:13.5, color:'rgba(255,255,255,0.45)', textDecoration:'none', padding:'8px 16px', borderRadius:8, transition:'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.color='#fff'; e.currentTarget.style.background='rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { e.currentTarget.style.color='rgba(255,255,255,0.45)'; e.currentTarget.style.background='transparent' }}>Ingresar</a>
            <a href={WA_URL} target="_blank" rel="noopener noreferrer"
              style={{ display:'flex', alignItems:'center', gap:8, fontSize:13.5, fontWeight:700, color:'white', textDecoration:'none', padding:'10px 20px', borderRadius:10, background:'linear-gradient(135deg,#25d366,#128c3e)', boxShadow:'0 4px 20px rgba(37,211,102,0.3)', transition:'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 8px 28px rgba(37,211,102,0.4)' }}
              onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 4px 20px rgba(37,211,102,0.3)' }}>
              <WA /><span className="ca-wa-text">Cotizar</span>
            </a>
            <button onClick={() => setOpen(!open)} className="ca-menu-btn" style={{ display:'none', background:'none', border:'none', color:'rgba(255,255,255,0.7)', cursor:'pointer', padding:6 }}>
              {open ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>
        {open && (
          <div style={{ background:'rgba(6,6,10,0.99)', borderTop:'1px solid rgba(255,255,255,0.06)', padding:'20px 28px 28px' }}>
            {links.map(l => (
              <a key={l} href={`#${l.toLowerCase().replace(/\s/g,'-').replace(/é/g,'e').replace(/ó/g,'o')}`} onClick={() => setOpen(false)}
                style={{ display:'block', fontSize:16, color:'rgba(255,255,255,0.6)', textDecoration:'none', padding:'14px 0', borderBottom:'1px solid rgba(255,255,255,0.05)', fontWeight:500 }}>{l}</a>
            ))}
            <a href="/blog" onClick={() => setOpen(false)}
              style={{ display:'block', fontSize:16, color:'rgba(255,255,255,0.6)', textDecoration:'none', padding:'14px 0', borderBottom:'1px solid rgba(255,255,255,0.05)', fontWeight:500 }}>Blog</a>
            <a href={WA_URL} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginTop:20, padding:'14px', borderRadius:12, background:'linear-gradient(135deg,#25d366,#128c3e)', color:'white', fontSize:15, fontWeight:700, textDecoration:'none' }}>
              <WA /> Cotizar por WhatsApp
            </a>
          </div>
        )}
      </nav>
      <style>{`
        @media (max-width:820px) { .ca-nav-links{display:none!important} .ca-login-btn{display:none!important} .ca-menu-btn{display:flex!important} .ca-wa-text{display:none!important} }
      `}</style>
    </>
  )
}

/* ─── HERO ─── */
function Hero() {
  return (
    <section style={{ position:'relative', minHeight:'100vh', display:'flex', alignItems:'center', overflow:'hidden' }}>
      <div style={{ position:'absolute', inset:0, zIndex:0 }}>
        <img src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1920&q=85&auto=format&fit=crop" alt="Condominio moderno" style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 60%' }} />
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,rgba(6,6,10,0.93) 0%,rgba(30,10,60,0.82) 50%,rgba(6,6,10,0.78) 100%)' }} />
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(6,6,10,1) 0%,transparent 40%)' }} />
      </div>
      <div style={{ position:'absolute', top:'25%', left:'55%', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle,rgba(124,58,237,0.14) 0%,transparent 65%)', pointerEvents:'none', zIndex:1 }} />
      <div style={{ maxWidth:1200, margin:'0 auto', padding:'120px 28px 80px', width:'100%', position:'relative', zIndex:2 }}>
        <div style={{ maxWidth:720 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 16px', borderRadius:100, background:'rgba(124,58,237,0.12)', border:'1px solid rgba(124,58,237,0.28)', marginBottom:32, backdropFilter:'blur(8px)' }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'#10b981', boxShadow:'0 0 10px #10b981', display:'inline-block', animation:'pulse 2s infinite' }} />
            <span style={{ fontSize:11.5, fontWeight:700, color:'#c4b5fd', letterSpacing:'0.08em', textTransform:'uppercase' }}>Sistema integral para condominios en Latinoamérica</span>
          </div>
          <h1 style={{ fontSize:'clamp(40px,6vw,72px)', fontWeight:900, lineHeight:1.05, letterSpacing:'-0.03em', marginBottom:24, color:'#f8fafc' }}>
            Tu condominio,<br />
            <span style={{ background:'linear-gradient(135deg,#a78bfa 0%,#818cf8 50%,#34d399 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>gestionado por IA</span>
          </h1>
          <p style={{ fontSize:18, color:'rgba(255,255,255,0.55)', lineHeight:1.75, marginBottom:40, maxWidth:560 }}>
            Control de acceso RFID, duplicado de tarjetas, smart locks integrados, bot WhatsApp, portal del residente y gestión financiera — todo en una plataforma diseñada para edificios y condominios en Latinoamérica.
          </p>
          <div style={{ display:'flex', gap:16, flexWrap:'wrap', alignItems:'center', marginBottom:56 }}>
            <a href="#demo"
              style={{ display:'flex', alignItems:'center', gap:10, padding:'16px 32px', borderRadius:14, background:'linear-gradient(135deg,#25d366,#128c3e)', color:'white', textDecoration:'none', fontSize:16, fontWeight:700, boxShadow:'0 8px 32px rgba(37,211,102,0.35)', transition:'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 12px 40px rgba(37,211,102,0.45)' }}
              onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 8px 32px rgba(37,211,102,0.35)' }}>
              🎁 Prueba el demo 5 días gratis
            </a>
            <a href="#funcionalidades"
              style={{ display:'flex', alignItems:'center', gap:8, padding:'16px 28px', borderRadius:14, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', color:'rgba(255,255,255,0.8)', textDecoration:'none', fontSize:15, fontWeight:600, backdropFilter:'blur(8px)', transition:'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.1)'; e.currentTarget.style.color='#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.06)'; e.currentTarget.style.color='rgba(255,255,255,0.8)' }}>
              Ver funcionalidades <ArrowRight />
            </a>
          </div>
          <div style={{ display:'flex', gap:0, flexWrap:'wrap' }}>
            {[{v:'3',s:'',l:'apps: admin, conserje y vecinos'},{v:'5',s:' días',l:'demo gratis con tu edificio'},{v:'$0',s:'',l:'costo de implementación'}].map((s,i) => (
              <div key={s.l} style={{ paddingRight:28, marginRight:28, borderRight:i<2?'1px solid rgba(255,255,255,0.1)':'none' }}>
                <div style={{ fontSize:26, fontWeight:900, color:'#f8fafc', letterSpacing:'-0.03em', lineHeight:1 }}>{s.v}<span style={{ color:'#a78bfa' }}>{s.s}</span></div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.3)', fontWeight:500, marginTop:4 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ position:'absolute', bottom:32, left:'50%', transform:'translateX(-50%)', zIndex:2, display:'flex', flexDirection:'column', alignItems:'center', gap:8, animation:'float 2s ease-in-out infinite' }}>
        <span style={{ fontSize:11, color:'rgba(255,255,255,0.2)', fontWeight:500, letterSpacing:'0.1em', textTransform:'uppercase' }}>Descubrir</span>
        <div style={{ width:1, height:40, background:'linear-gradient(to bottom,rgba(167,139,250,0.5),transparent)' }} />
      </div>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes float{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(6px)}}
      `}</style>
    </section>
  )
}

/* ─── TRUST BAR ─── */
function TrustBar() {
  const items = ['Control de acceso TCP/IP','RFID + Biometría','Duplicado de tarjetas RFID','Tarjeta banco como llave','Bot WhatsApp integrado','Panel conserje táctil','Portal del residente','Gestión financiera','Reserva de espacios','Smart Locks API','Alertas IoT','ZKTeco · Hikvision API']
  return (
    <div style={{ background:'#0a0a12', borderTop:'1px solid rgba(255,255,255,0.04)', borderBottom:'1px solid rgba(255,255,255,0.04)', padding:'18px 0', overflow:'hidden' }}>
      <div style={{ display:'flex', gap:56, animation:'marquee 22s linear infinite', width:'max-content' }}>
        {[...items,...items].map((item,i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:10, whiteSpace:'nowrap' }}>
            <span style={{ width:5, height:5, borderRadius:'50%', background:'#7c3aed', display:'inline-block' }} />
            <span style={{ fontSize:13, color:'rgba(255,255,255,0.28)', fontWeight:500 }}>{item}</span>
          </div>
        ))}
      </div>
      <style>{`@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
    </div>
  )
}


/* ─── LEY 21.442 ─── */
function LeySection() {
  return (
    <section style={{ padding:'80px 28px', background:'rgba(245,158,11,0.025)', borderTop:'1px solid rgba(245,158,11,0.1)', borderBottom:'1px solid rgba(245,158,11,0.07)' }}>
      <div style={{ maxWidth:1200, margin:'0 auto', display:'grid', gridTemplateColumns:'1fr 1fr', gap:80, alignItems:'center' }} className="ley-grid">
        <div>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 16px', borderRadius:100, background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', marginBottom:28 }}>
            <span style={{ fontSize:14 }}>⚖️</span>
            <span style={{ fontSize:11, fontWeight:700, color:'#fbbf24', letterSpacing:'0.1em', textTransform:'uppercase' }}>Ley 21.442 · Copropiedad Inmobiliaria</span>
          </div>
          <h2 style={{ fontSize:'clamp(26px,3.5vw,40px)', fontWeight:800, letterSpacing:'-0.025em', color:'#f1f5f9', lineHeight:1.2, marginBottom:20 }}>
            ¿Tu condominio ya cumple<br />
            <span style={{ color:'#fbbf24' }}>la nueva Ley de Copropiedad?</span>
          </h2>
          <p style={{ fontSize:15, color:'rgba(255,255,255,0.45)', lineHeight:1.75, marginBottom:16 }}>
            La <strong style={{ color:'rgba(255,255,255,0.65)' }}>Ley 21.442</strong>, publicada el 13 de abril de 2022, exige que todos los condominios en Chile actualicen su reglamento interno y adopten nuevos estándares de administración, transparencia y participación.
          </p>
          <p style={{ fontSize:15, color:'rgba(255,255,255,0.38)', lineHeight:1.75, marginBottom:36 }}>
            Si tu comunidad aún no se ha regularizado, puede estar expuesta a conflictos legales y dificultades en la administración. ConectaAI te acompaña en todo el proceso — sin burocracia.
          </p>
          <a href={WA_URL} target="_blank" rel="noopener noreferrer"
            style={{ display:'inline-flex', alignItems:'center', gap:10, padding:'14px 28px', borderRadius:12, background:'linear-gradient(135deg,#f59e0b,#d97706)', color:'white', textDecoration:'none', fontSize:15, fontWeight:700, boxShadow:'0 8px 24px rgba(245,158,11,0.25)', transition:'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 12px 32px rgba(245,158,11,0.4)' }}
            onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(245,158,11,0.25)' }}>
            <WA /> Regulariza tu condominio
          </a>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {[
            { icon:'🏛️', title:'Asambleas virtuales con quórum', desc:'Convoca a los copropietarios en línea. Registra asistencia, quórum y acuerdos con respaldo legal.' },
            { icon:'🗳️', title:'Votaciones digitales', desc:'Votaciones transparentes con trazabilidad completa, actas generadas automáticamente.' },
            { icon:'📄', title:'Actualización del reglamento', desc:'Te guiamos paso a paso para adaptar el reglamento a los nuevos requisitos de la ley.' },
            { icon:'📢', title:'Notificaciones a copropietarios', desc:'Convocatorias y comunicados automáticos por WhatsApp o correo a todos los residentes.' },
          ].map((item, i) => (
            <div key={i} style={{ display:'flex', gap:16, alignItems:'flex-start', padding:'16px 20px', background:'rgba(255,255,255,0.025)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:14, transition:'border-color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor='rgba(245,158,11,0.2)'}
              onMouseLeave={e => e.currentTarget.style.borderColor='rgba(255,255,255,0.06)'}>
              <span style={{ fontSize:22, lineHeight:1, marginTop:2, flexShrink:0 }}>{item.icon}</span>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:'#e2e8f0', marginBottom:4 }}>{item.title}</div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,0.32)', lineHeight:1.65 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── HOW IT WORKS ─── */
function HowItWorks() {
  const steps = [
    {n:'01',title:'Instalación en tu edificio',desc:'Configuramos los módulos hardware (RFID, cámaras, sensores) e integramos con tu infraestructura existente. Sin obras mayores.'},
    {n:'02',title:'Capacitación del equipo',desc:'El conserje aprende en 30 minutos. El panel táctil está diseñado para operarse sin conocimientos técnicos.'},
    {n:'03',title:'Todos conectados',desc:'Residentes reciben acceso al portal web y app móvil. Visitas, paquetes y comunicados fluyen automáticamente.'},
  ]
  return (
    <section id="c-mo-funciona" style={{ padding:'100px 28px', background:'rgba(255,255,255,0.01)' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:64 }}>
          <div style={{ display:'inline-block', fontSize:11, fontWeight:700, letterSpacing:'0.14em', color:'#10b981', textTransform:'uppercase', marginBottom:16, padding:'5px 14px', background:'rgba(16,185,129,0.08)', borderRadius:100, border:'1px solid rgba(16,185,129,0.2)' }}>
            Cómo funciona
          </div>
          <h2 style={{ fontSize:'clamp(28px,4vw,44px)', fontWeight:800, letterSpacing:'-0.025em', color:'#f1f5f9', lineHeight:1.2 }}>Operativo en menos de una semana</h2>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:2 }} className="ca-steps-grid">
          {steps.map((s,i) => (
            <div key={i} style={{ position:'relative', padding:'36px 32px', borderRight:i<2?'1px solid rgba(255,255,255,0.05)':'none' }} className="ca-step">
              <div style={{ fontSize:52, fontWeight:900, background:'linear-gradient(135deg,rgba(124,58,237,0.4),transparent)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', lineHeight:1, marginBottom:20, letterSpacing:'-0.04em' }}>{s.n}</div>
              <h3 style={{ fontSize:18, fontWeight:700, color:'#e2e8f0', marginBottom:12 }}>{s.title}</h3>
              <p style={{ fontSize:14, color:'rgba(255,255,255,0.38)', lineHeight:1.7 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── FEATURE ROW ─── */
function FeatureRow({ img, tag, tagColor, title, desc, bullets, reverse }: any) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:80, alignItems:'center', maxWidth:1200, margin:'0 auto', padding:'0 28px' }} className="ca-feature-row">
      <div style={{ order:reverse?2:1, position:'relative', borderRadius:24, overflow:'hidden', aspectRatio:'4/3', boxShadow:'0 40px 80px rgba(0,0,0,0.5)' }}>
        <img src={img} alt={title} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,rgba(124,58,237,0.18) 0%,transparent 60%)' }} />
        <div style={{ position:'absolute', top:20, left:20, padding:'6px 14px', borderRadius:100, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(8px)', border:'1px solid rgba(255,255,255,0.1)' }}>
          <span style={{ fontSize:11, fontWeight:700, color:tagColor, textTransform:'uppercase', letterSpacing:'0.08em' }}>{tag}</span>
        </div>
      </div>
      <div style={{ order:reverse?1:2 }}>
        <div style={{ display:'inline-block', fontSize:11, fontWeight:700, letterSpacing:'0.14em', color:tagColor, textTransform:'uppercase', marginBottom:18, padding:'5px 14px', background:tagColor+'12', borderRadius:100, border:`1px solid ${tagColor}25` }}>{tag}</div>
        <h3 style={{ fontSize:'clamp(26px,3vw,38px)', fontWeight:800, letterSpacing:'-0.025em', color:'#f1f5f9', lineHeight:1.2, marginBottom:18 }}>{title}</h3>
        <p style={{ fontSize:16, color:'rgba(255,255,255,0.42)', lineHeight:1.8, marginBottom:28 }}>{desc}</p>
        <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:32 }}>
          {bullets.map((b: string,i: number) => (
            <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
              <Check color={tagColor} />
              <span style={{ fontSize:14, color:'rgba(255,255,255,0.55)', lineHeight:1.5 }}>{b}</span>
            </div>
          ))}
        </div>
        <a href={WA_URL} target="_blank" rel="noopener noreferrer"
          style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'12px 22px', borderRadius:10, background:'transparent', border:`1px solid ${tagColor}40`, color:tagColor, textDecoration:'none', fontSize:13.5, fontWeight:700, transition:'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.background=tagColor+'12'; e.currentTarget.style.borderColor=tagColor }}
          onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor=tagColor+'40' }}>
          Consultar más <ArrowRight />
        </a>
      </div>
    </div>
  )
}

/* ─── FEATURES SECTION ─── */
function Features() {
  return (
    <section id="funcionalidades" style={{ padding:'100px 0' }}>
      <div style={{ maxWidth:1200, margin:'0 auto 16px', padding:'0 28px', textAlign:'center' }}>
        <div style={{ display:'inline-block', fontSize:11, fontWeight:700, letterSpacing:'0.14em', color:'#7c3aed', textTransform:'uppercase', marginBottom:16, padding:'5px 14px', background:'rgba(124,58,237,0.08)', borderRadius:100, border:'1px solid rgba(124,58,237,0.2)' }}>Funcionalidades</div>
        <h2 style={{ fontSize:'clamp(28px,4vw,48px)', fontWeight:800, letterSpacing:'-0.025em', color:'#f1f5f9', lineHeight:1.2, marginBottom:16 }}>Todo lo que tu condominio<br />necesita, integrado</h2>
        <p style={{ fontSize:16, color:'rgba(255,255,255,0.38)', maxWidth:520, margin:'0 auto', lineHeight:1.7, marginBottom:80 }}>Desde el control de acceso hasta los estados financieros, una sola plataforma conecta a residentes, conserjes y administración.</p>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:100 }}>
        <FeatureRow img="https://images.unsplash.com/photo-1558002038-1055907df827?w=900&q=80&auto=format&fit=crop" tag="Control de Acceso" tagColor="#7c3aed" title="Acceso inteligente sin llaves físicas" desc="Controla puertas y portones remotamente desde cualquier dispositivo. Tarjetas RFID, llaveros, biometría de huella y apertura remota desde el celular." bullets={['Apertura TCP/IP desde panel web, tablet o smartphone','Acceso RFID, llaveros y huella dactilar biométrica','Historial completo de cada acceso con fecha y hora','Alertas de puertas forzadas o abiertas por tiempo excesivo']} reverse={false} />
        <FeatureRow img="https://images.unsplash.com/photo-1559137781-875af01c14bc?w=900&q=80&auto=format&fit=crop" tag="Panel Conserje" tagColor="#06b6d4" title="Interfaz táctil para conserjería" desc="Una tablet en recepción y el conserje tiene todo el control. Botones grandes, información clara, sin necesidad de capacitación técnica previa." bullets={['Registro de visitas con foto y pre-autorización del residente','Gestión de encomiendas con notificación automática por WhatsApp','Control de puertas y acceso a cámaras en vivo','Comunicación directa con residentes desde la pantalla']} reverse={true} />
        <FeatureRow img="https://images.unsplash.com/photo-1592890288564-76628a30a657?w=900&q=80&auto=format&fit=crop" tag="Portal del Residente" tagColor="#f97316" title="Los residentes conectados desde su celular" desc="App web y móvil para que cada residente gestione visitas, reciba notificaciones, vote en asambleas y acceda a todos los documentos del condominio." bullets={['Pre-autorización digital de visitas desde el celular','Notificaciones de paquetes, comunicados y alertas en tiempo real','Acceso a estados de cuenta y gastos comunes','Votaciones y asambleas virtuales integradas']} reverse={false} />
        <FeatureRow img="https://images.unsplash.com/photo-1613243555988-441166d4d6fd?w=900&q=80&auto=format&fit=crop" tag="RFID & Accesos" tagColor="#0891B2" title="Duplicado de tarjetas y enrolamiento inteligente" desc="¿Perdiste tu tarjeta de acceso? La clonamos en minutos. Tu tarjeta de débito también puede ser tu llave — los sistemas UID-only leen cualquier NFC a 13.56 MHz, incluyendo tarjetas bancarias." bullets={['Duplicado Mifare Classic 1K/4K y EM4100 125 kHz','Tarjeta débito Santander, BCI, Chile como llave de acceso','Integración ZKTeco ZKAccess API e Hikvision ISAPI','Diagnóstico gratuito — sabemos si es clonable antes de cobrar']} reverse={false} />
        <FeatureRow img="https://images.unsplash.com/photo-1589935447067-5531094415d1?w=900&q=80&auto=format&fit=crop" tag="Cámaras e IoT" tagColor="#10b981" title="Seguridad visual integrada al sistema" desc="Vincula las grabaciones de CCTV a cada evento. Cuando ocurre un incidente, accede directamente al video del momento exacto." bullets={['CCTV integrado con log de eventos del sistema','Alertas IoT por movimiento, intrusión o humo','Sensores de temperatura y humedad en áreas comunes','Acceso remoto a cámaras en vivo desde cualquier dispositivo']} reverse={true} />
      </div>
      <style>{`@media (max-width:860px){.ca-feature-row{grid-template-columns:1fr!important;gap:32px!important} .ca-feature-row>div{order:unset!important}}`}</style>
    </section>
  )
}


/* ─── RFID SERVICE ─── */
function RFIDService() {
  return (
    <section style={{ padding:'100px 28px', borderTop:'1px solid rgba(8,145,178,0.12)', background:'linear-gradient(180deg,rgba(8,145,178,0.04) 0%,rgba(0,0,0,0) 100%)' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:64 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 16px', borderRadius:100, background:'rgba(8,145,178,0.1)', border:'1px solid rgba(8,145,178,0.25)', marginBottom:20 }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'#22d3ee', boxShadow:'0 0 8px #22d3ee', display:'inline-block', animation:'pulse 2s infinite' }}/>
            <span style={{ fontSize:11, fontWeight:700, color:'#67e8f9', letterSpacing:'0.1em', textTransform:'uppercase' }}>Nuevo · Servicio RFID & Accesos</span>
          </div>
          <h2 style={{ fontSize:'clamp(28px,4vw,48px)', fontWeight:900, letterSpacing:'-0.03em', color:'#f1f5f9', lineHeight:1.15, marginBottom:16 }}>
            {'¿Perdiste tu tarjeta de acceso?'}<br/>
            <span style={{ background:'linear-gradient(135deg,#22d3ee,#0891B2)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>La duplicamos en minutos.</span>
          </h2>
          <p style={{ fontSize:16, color:'rgba(255,255,255,0.42)', maxWidth:580, margin:'0 auto', lineHeight:1.75 }}>
            Servicio profesional de duplicado de tarjetas RFID, enrolamiento en cerraduras inteligentes y gestión de accesos para condominios de Santiago.
          </p>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:40 }} className="ca-rfid-grid">
          <div style={{ background:'rgba(8,145,178,0.06)', border:'1px solid rgba(8,145,178,0.2)', borderRadius:20, padding:'28px 24px', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:0, right:0, width:140, height:140, background:'radial-gradient(circle,rgba(8,145,178,0.12),transparent)', borderRadius:'50%', transform:'translate(30%,-30%)' }}/>
            <div style={{ fontSize:32, marginBottom:16 }}>{'📋'}</div>
            <h3 style={{ fontSize:18, fontWeight:800, color:'#67e8f9', marginBottom:10 }}>Duplicado de tarjetas</h3>
            <p style={{ fontSize:13.5, color:'rgba(255,255,255,0.42)', lineHeight:1.7, marginBottom:18 }}>Clonamos tu tarjeta de acceso en una nueva. Compatible con los sistemas más comunes en condominios de Latinoamérica.</p>
            <ul style={{ listStyle:'none', padding:0, display:'flex', flexDirection:'column', gap:9 }}>
              {['Mifare Classic 1K/4K (13.56 MHz)','EM4100 / HID 125 kHz','Llaveros y tags RFID','Desde $3.000 / tarjeta'].map((item,idx) => (
                <li key={idx} style={{ display:'flex', gap:9, alignItems:'flex-start', fontSize:13, color:'rgba(255,255,255,0.5)' }}>
                  <Check color="#22d3ee" />{item}
                </li>
              ))}
            </ul>
          </div>
          <div style={{ background:'rgba(16,185,129,0.06)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:20, padding:'28px 24px', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:0, right:0, width:140, height:140, background:'radial-gradient(circle,rgba(16,185,129,0.12),transparent)', borderRadius:'50%', transform:'translate(30%,-30%)' }}/>
            <div style={{ fontSize:32, marginBottom:16 }}>{'💳'}</div>
            <h3 style={{ fontSize:18, fontWeight:800, color:'#34d399', marginBottom:10 }}>{'¿Tarjeta de banco como llave?'}</h3>
            <p style={{ fontSize:13.5, color:'rgba(255,255,255,0.42)', lineHeight:1.7, marginBottom:18 }}>En sistemas UID-only, tu tarjeta de débito o crédito puede ser tu llave de acceso. Sin costo de tarjeta nueva.</p>
            <ul style={{ listStyle:'none', padding:0, display:'flex', flexDirection:'column', gap:9 }}>
              {['Santander, BCI, Banco Chile y más','Visa y Mastercard con chip NFC','Compatible con ZKTeco, Hikvision','Enrolamiento incluido sin costo'].map((item,idx) => (
                <li key={idx} style={{ display:'flex', gap:9, alignItems:'flex-start', fontSize:13, color:'rgba(255,255,255,0.5)' }}>
                  <Check color="#34d399" />{item}
                </li>
              ))}
            </ul>
          </div>
          <div style={{ background:'rgba(124,58,237,0.06)', border:'1px solid rgba(124,58,237,0.2)', borderRadius:20, padding:'28px 24px', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:0, right:0, width:140, height:140, background:'radial-gradient(circle,rgba(124,58,237,0.12),transparent)', borderRadius:'50%', transform:'translate(30%,-30%)' }}/>
            <div style={{ fontSize:32, marginBottom:16 }}>{'🔓'}</div>
            <h3 style={{ fontSize:18, fontWeight:800, color:'#a78bfa', marginBottom:10 }}>{'Integración Smart Locks'}</h3>
            <p style={{ fontSize:13.5, color:'rgba(255,255,255,0.42)', lineHeight:1.7, marginBottom:18 }}>Conectamos cerraduras inteligentes vía API al panel del condominio. Apertura remota y gestión centralizada.</p>
            <ul style={{ listStyle:'none', padding:0, display:'flex', flexDirection:'column', gap:9 }}>
              {['ZKTeco ZKAccess API','Hikvision ISAPI','Samsung / Yale Smart Home','Apertura remota desde el panel'].map((item,idx) => (
                <li key={idx} style={{ display:'flex', gap:9, alignItems:'flex-start', fontSize:13, color:'rgba(255,255,255,0.5)' }}>
                  <Check color="#a78bfa" />{item}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:20, padding:'22px 28px', background:'rgba(8,145,178,0.05)', border:'1px solid rgba(8,145,178,0.15)', borderRadius:16 }}>
          <p style={{ fontSize:14, color:'rgba(255,255,255,0.48)', margin:0, lineHeight:1.6, flex:1 }}>
            <span style={{ color:'#22d3ee', fontWeight:700 }}>{'Diagnóstico GRATIS:'}</span> detectamos si tu tarjeta es clonable antes de cobrar. Si no se puede, te decimos por qué sin cobrarte nada.
          </p>
          <div style={{ display:'flex', gap:12, flexShrink:0 }}>
            <a href="https://conectaai.cl/rfid.html"
              style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'12px 22px', borderRadius:10, background:'linear-gradient(135deg,#0891B2,#0e7490)', color:'white', textDecoration:'none', fontSize:14, fontWeight:700, boxShadow:'0 4px 20px rgba(8,145,178,0.35)', whiteSpace:'nowrap', transition:'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 8px 28px rgba(8,145,178,0.45)' }}
              onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 4px 20px rgba(8,145,178,0.35)' }}>
              {'Ver servicio completo →'}
            </a>
            <a href={WA_URL} target="_blank" rel="noopener noreferrer"
              style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'12px 20px', borderRadius:10, background:'rgba(37,211,102,0.12)', border:'1px solid rgba(37,211,102,0.25)', color:'#25d366', textDecoration:'none', fontSize:14, fontWeight:600, whiteSpace:'nowrap', transition:'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(37,211,102,0.2)' }}
              onMouseLeave={e => { e.currentTarget.style.background='rgba(37,211,102,0.12)' }}>
              <WA /> Consultar
            </a>
          </div>
        </div>
      </div>
      <style>{'@media (max-width:860px){.ca-rfid-grid{grid-template-columns:1fr!important}}'}</style>
    </section>
  )
}

/* ─── MODULES GRID ─── */
const MODULES = [
  {color:'#7c3aed',label:'Control de Puertas TCP/IP',desc:'Abre y cierra puertas remotamente con historial completo.'},
  {color:'#10b981',label:'Acceso RFID y Biométrico',desc:'Tarjetas, llaveros y huella dactilar. Sin llaves que perder.'},
  {color:'#3b82f6',label:'Cámaras integradas',desc:'CCTV vinculado a eventos. Ve la grabación del incidente exacto.'},
  {color:'#f97316',label:'Alarmas y sensores IoT',desc:'Alertas en tiempo real por intrusión, humo o movimiento.'},
  {color:'#06b6d4',label:'Panel Conserje Táctil',desc:'Interfaz optimizada para tablet. Opera todo sin capacitación.'},
  {color:'#a78bfa',label:'Gestión de Paquetes',desc:'Registra con foto. Notifica al residente por WhatsApp.'},
  {color:'#34d399',label:'Control de Visitas',desc:'Pre-autorización digital. El residente aprueba desde su celular.'},
  {color:'#fbbf24',label:'Reserva de Espacios',desc:'Quincho, piscina, sala de eventos. Sin superposición.'},
  {color:'#f472b6',label:'Portal del Residente',desc:'App web y móvil. Comunicados, votaciones y solicitudes.'},
  {color:'#4ade80',label:'Gestión Financiera',desc:'Gastos comunes, morosidad y rendición de cuentas transparente.'},
  {color:'#25d366',label:'Bot WhatsApp',desc:'Notificaciones automáticas al residente directo en WhatsApp.'},
  {color:'#60a5fa',label:'Alertas y notificaciones',desc:'Push, email y WhatsApp. Nadie se pierde nada importante.'},
  {color:'#0891B2',label:'Duplicado RFID',desc:'Clonación Mifare Classic, EM4100. Tarjeta bancaria como llave.'},
  {color:'#34d399',label:'Smart Locks & ZKTeco',desc:'API ZKAccess + Hikvision ISAPI. Apertura remota centralizada.'},
  {color:'#fb923c',label:'Diagnóstico de tarjetas',desc:'Detectamos el tipo antes de cobrar. Mifare, DESFire, EM4100.'},
]

function Modules() {
  return (
    <section style={{ padding:'80px 28px', background:'linear-gradient(180deg,rgba(124,58,237,0.04) 0%,transparent 100%)' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:52 }}>
          <div style={{ display:'inline-block', fontSize:11, fontWeight:700, letterSpacing:'0.14em', color:'#a78bfa', textTransform:'uppercase', marginBottom:16, padding:'5px 14px', background:'rgba(167,139,250,0.08)', borderRadius:100, border:'1px solid rgba(167,139,250,0.2)' }}>15 módulos integrados</div>
          <h2 style={{ fontSize:'clamp(24px,3vw,36px)', fontWeight:800, letterSpacing:'-0.02em', color:'#f1f5f9' }}>15 módulos integrados para tu condominio</h2>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }} className="ca-modules-grid">
          {MODULES.map((m,i) => (
            <div key={i} style={{ background:'rgba(255,255,255,0.025)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:14, padding:'18px 20px', transition:'all 0.2s', cursor:'default' }}
              onMouseEnter={e => { e.currentTarget.style.background=m.color+'0a'; e.currentTarget.style.borderColor=m.color+'30'; e.currentTarget.style.transform='translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.025)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.05)'; e.currentTarget.style.transform='translateY(0)' }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:m.color, boxShadow:`0 0 8px ${m.color}80`, marginBottom:12 }} />
              <div style={{ fontSize:13.5, fontWeight:700, color:'#e2e8f0', marginBottom:6, lineHeight:1.3 }}>{m.label}</div>
              <div style={{ fontSize:12.5, color:'rgba(255,255,255,0.33)', lineHeight:1.6 }}>{m.desc}</div>
            </div>
          ))}
        </div>
      </div>
      <style>{`@media (max-width:1000px){.ca-modules-grid{grid-template-columns:repeat(3,1fr)!important}} @media (max-width:700px){.ca-modules-grid{grid-template-columns:repeat(2,1fr)!important}} @media (max-width:440px){.ca-modules-grid{grid-template-columns:1fr!important}}`}</style>
    </section>
  )
}

/* ─── STATS ─── */
function Stats() {
  return (
    <section style={{ position:'relative', padding:'80px 28px', overflow:'hidden' }}>
      <div style={{ position:'absolute', inset:0, zIndex:0 }}>
        <img src="https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1400&q=75&auto=format&fit=crop" alt="" style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 40%' }} />
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,rgba(6,6,10,0.93) 0%,rgba(30,10,60,0.9) 100%)' }} />
      </div>
      <div style={{ maxWidth:1000, margin:'0 auto', position:'relative', zIndex:1 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:0 }} className="ca-stats-grid">
          {[
            {to:50,suffix:'+',label:'Edificios activos',sub:'en Latinoamérica'},
            {to:8000,suffix:'+',label:'Residentes gestionados',sub:'en la plataforma'},
            {to:98,suffix:'%',label:'Satisfacción',sub:'clientes encuestados'},
            {to:15,suffix:'',label:'Módulos integrados',sub:'en una sola plataforma'},
          ].map((s,i) => (
            <div key={i} style={{ textAlign:'center', padding:'28px 20px', borderRight:i<3?'1px solid rgba(255,255,255,0.07)':'none' }}>
              <div style={{ fontSize:'clamp(36px,5vw,56px)', fontWeight:900, letterSpacing:'-0.03em', background:'linear-gradient(135deg,#a78bfa,#34d399)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', lineHeight:1 }}>
                <Counter to={s.to} suffix={s.suffix} />
              </div>
              <div style={{ fontSize:14, color:'#e2e8f0', fontWeight:700, marginTop:8 }}>{s.label}</div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.28)', marginTop:3 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>
      <style>{`@media (max-width:700px){.ca-stats-grid{grid-template-columns:repeat(2,1fr)!important}}`}</style>
    </section>
  )
}

/* ─── TESTIMONIALS ─── */
function Testimonials() {
  const testi = [
    {name:'Rodrigo Fuentes',role:'Administrador',building:'Edificio Andes, Santiago',text:'En 2 semanas digitalizamos todo el control de acceso. Los residentes están felices y el conserje no necesitó capacitación. Fue más fácil de lo esperado.',avatar:'https://ui-avatars.com/api/?name=Rodrigo+Fuentes&background=7c3aed&color=fff&size=88'},
    {name:'Carla Muñoz',role:'Presidenta Comité',building:'Torres del Parque, Las Condes',text:'Las notificaciones de paquetes y visitas por WhatsApp cambiaron la experiencia de vivir en el edificio. Cero reclamos de los vecinos.',avatar:'https://ui-avatars.com/api/?name=Carla+Munoz&background=10b981&color=fff&size=88'},
    {name:'Felipe Araya',role:'Gerente de Administración',building:'Grupo Inmobiliario, 8 edificios',text:'Manejamos 8 edificios desde un solo panel. El ahorro en tiempo y personal fue inmediato desde el primer mes. Muy recomendable.',avatar:'https://ui-avatars.com/api/?name=Felipe+Araya&background=4f46e5&color=fff&size=88'},
  ]
  return (
    <section style={{ padding:'100px 28px', borderTop:'1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ maxWidth:1100, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:56 }}>
          <div style={{ display:'inline-block', fontSize:11, fontWeight:700, letterSpacing:'0.14em', color:'#fbbf24', textTransform:'uppercase', marginBottom:16, padding:'5px 14px', background:'rgba(251,191,36,0.08)', borderRadius:100, border:'1px solid rgba(251,191,36,0.2)' }}>Testimonios</div>
          <h2 style={{ fontSize:'clamp(26px,3.5vw,40px)', fontWeight:800, letterSpacing:'-0.02em', color:'#f1f5f9' }}>Lo que dicen nuestros clientes</h2>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20 }} className="ca-testi-grid">
          {testi.map((t,i) => (
            <div key={i} style={{ background:'linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))', border:'1px solid rgba(255,255,255,0.06)', borderRadius:20, padding:'28px 26px', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:14, right:18, fontSize:80, color:'rgba(124,58,237,0.07)', fontFamily:'Georgia,serif', lineHeight:1 }}>"</div>
              <div style={{ display:'flex', gap:3, marginBottom:18 }}>{[1,2,3,4,5].map(s=><span key={s} style={{ color:'#fbbf24', fontSize:14 }}>★</span>)}</div>
              <p style={{ fontSize:14.5, color:'rgba(255,255,255,0.48)', lineHeight:1.75, marginBottom:24, fontStyle:'italic' }}>"{t.text}"</p>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <img src={t.avatar} alt={t.name} style={{ width:44, height:44, borderRadius:'50%', border:'2px solid rgba(124,58,237,0.35)', flexShrink:0 }} />
                <div>
                  <div style={{ fontSize:13.5, fontWeight:700, color:'#e2e8f0' }}>{t.name}</div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,0.28)', marginTop:2 }}>{t.role} · {t.building}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <style>{`@media (max-width:860px){.ca-testi-grid{grid-template-columns:1fr!important}}`}</style>
    </section>
  )
}

/* ─── PRICING ─── */
const PLANS = [
  {name:'Pro',highlight:false,desc:'Desde $800 por unidad al mes · mínimo $40.000',features:['Admin + Conserje + App de vecinos','Gastos comunes y convenios de pago','Visitas con QR de un solo uso','Encomiendas, reservas, votaciones y avisos','Incidencias y órdenes de trabajo','Soporte por WhatsApp'],cta:'Probar 5 días gratis'},
  {name:'Pro + Accesos',highlight:true,badge:'Más elegido',desc:'Desde $1.050 por unidad al mes',features:['Todo lo del plan Pro','Mantenciones con QR firmado por técnicos','Control de acceso RFID y puertas TCP/IP','TAG vehicular UHF/NFC y lector de patentes (opcional)','Panel conserje táctil avanzado','Soporte prioritario'],cta:'Probar 5 días gratis'},
  {name:'Empresas administradoras',highlight:false,desc:'Varios edificios, marca blanca',features:['Edificios ilimitados con tu marca','Reconocimiento facial y WhatsApp oficial','API pública + webhooks','Onboarding dedicado','Facturación centralizada','Soporte directo'],cta:'Conversemos'},
]

function Pricing() {
  return (
    <section id="precios" style={{ padding:'100px 28px', borderTop:'1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ maxWidth:1100, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:60 }}>
          <div style={{ display:'inline-block', fontSize:11, fontWeight:700, letterSpacing:'0.14em', color:'#10b981', textTransform:'uppercase', marginBottom:16, padding:'5px 14px', background:'rgba(16,185,129,0.08)', borderRadius:100, border:'1px solid rgba(16,185,129,0.2)' }}>Precios</div>
          <h2 style={{ fontSize:'clamp(28px,4vw,44px)', fontWeight:800, letterSpacing:'-0.025em', color:'#f1f5f9', lineHeight:1.2 }}>Planes a tu medida</h2>
          <p style={{ fontSize:15, color:'rgba(255,255,255,0.32)', marginTop:12 }}>Precio por unidad al mes, IVA incluido, sin costo de implementación y sin permanencia. El hardware se cotiza aparte.</p>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, alignItems:'stretch' }} className="ca-plans-grid">
          {PLANS.map(p => (
            <div key={p.name} style={{ position:'relative', background:p.highlight?'linear-gradient(160deg,rgba(124,58,237,0.12),rgba(79,70,229,0.06))':'rgba(255,255,255,0.02)', border:p.highlight?'1px solid rgba(124,58,237,0.35)':'1px solid rgba(255,255,255,0.06)', borderRadius:20, padding:'32px 26px', display:'flex', flexDirection:'column', boxShadow:p.highlight?'0 0 0 1px rgba(124,58,237,0.1),0 24px 48px rgba(0,0,0,0.3)':'none' }}>
              {(p as any).badge && (
                <div style={{ position:'absolute', top:-14, left:'50%', transform:'translateX(-50%)', background:'linear-gradient(135deg,#7c3aed,#4f46e5)', color:'white', fontSize:11, fontWeight:700, padding:'5px 18px', borderRadius:100, whiteSpace:'nowrap', boxShadow:'0 4px 16px rgba(124,58,237,0.4)' }}>{(p as any).badge}</div>
              )}
              <div style={{ marginBottom:24 }}>
                <div style={{ fontSize:20, fontWeight:800, color:p.highlight?'#c4b5fd':'#e2e8f0', marginBottom:8 }}>{p.name}</div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,0.32)', lineHeight:1.5 }}>{p.desc}</div>
              </div>
              <ul style={{ listStyle:'none', padding:0, flex:1, marginBottom:28, display:'flex', flexDirection:'column', gap:11 }}>
                {p.features.map(f => (
                  <li key={f} style={{ display:'flex', alignItems:'flex-start', gap:10, fontSize:13.5, color:'rgba(255,255,255,0.52)', lineHeight:1.4 }}>
                    <Check color={p.highlight?'#a78bfa':'#10b981'} />{f}
                  </li>
                ))}
              </ul>
              <a href="#demo"
                style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:9, padding:'14px', borderRadius:12, textDecoration:'none', fontSize:14, fontWeight:700, transition:'all 0.2s', background:p.highlight?'linear-gradient(135deg,#7c3aed,#4f46e5)':'transparent', color:p.highlight?'white':'rgba(255,255,255,0.52)', border:p.highlight?'none':'1px solid rgba(255,255,255,0.1)', boxShadow:p.highlight?'0 8px 24px rgba(124,58,237,0.35)':'none' }}
                onMouseEnter={e => { if(!p.highlight){e.currentTarget.style.borderColor='rgba(255,255,255,0.25)';e.currentTarget.style.color='#fff'} else{e.currentTarget.style.transform='translateY(-1px)'} }}
                onMouseLeave={e => { if(!p.highlight){e.currentTarget.style.borderColor='rgba(255,255,255,0.1)';e.currentTarget.style.color='rgba(255,255,255,0.52)'} e.currentTarget.style.transform='translateY(0)' }}>
                <WA />{p.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
      <style>{`@media (max-width:860px){.ca-plans-grid{grid-template-columns:1fr!important}}`}</style>
    </section>
  )
}


/* ------- BLOG PREVIEW ------- */
function BlogPreview() {
  const items = [
    { slug:'ley-21442-copropiedad-que-debes-saber', cat:'Legal', color:'#f59e0b', title:'Ley 21.442: Todo lo que tu condominio necesita para cumplir', img:'https://images.unsplash.com/photo-1589391886645-d51941baf7fb?w=600&q=80&auto=format&fit=crop' },
    { slug:'rfid-vs-llave-tradicional-condominio', cat:'Tecnología', color:'#7c3aed', title:'RFID vs llave tradicional: por qué el condominio moderno ya no usa llaves', img:'https://images.unsplash.com/photo-1558002038-1055907df827?w=600&q=80&auto=format&fit=crop' },
    { slug:'whatsapp-para-condominios-5-usos', cat:'Comunicaciones', color:'#25d366', title:'WhatsApp para condominios: 5 usos que transforman la convivencia', img:'https://images.unsplash.com/photo-1592890288564-76628a30a657?w=600&q=80&auto=format&fit=crop' },
  ]
  return (
    <section style={{ padding:'100px 28px', background:'rgba(255,255,255,0.01)' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:52, flexWrap:'wrap', gap:20 }}>
          <div>
            <div style={{ display:'inline-block', fontSize:11, fontWeight:700, letterSpacing:'0.14em', color:'#a78bfa', textTransform:'uppercase', marginBottom:14, padding:'5px 14px', background:'rgba(124,58,237,0.08)', borderRadius:100, border:'1px solid rgba(124,58,237,0.2)' }}>Blog</div>
            <h2 style={{ fontSize:'clamp(26px,4vw,40px)', fontWeight:800, letterSpacing:'-0.025em', color:'#f1f5f9', margin:0, lineHeight:1.15 }}>Guías para administradores modernos</h2>
          </div>
          <a href="/blog" style={{ fontSize:13.5, fontWeight:600, color:'#a78bfa', textDecoration:'none', display:'flex', alignItems:'center', gap:6, padding:'10px 20px', border:'1px solid rgba(124,58,237,0.3)', borderRadius:10, transition:'all 0.2s', whiteSpace:'nowrap' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background='rgba(124,58,237,0.1)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background='transparent' }}>
            Ver todos los artículos →
          </a>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20 }} className="ca-blog-grid">
          {items.map(p => (
            <a key={p.slug} href={`/blog/${p.slug}`}
              style={{ display:'block', border:'1px solid rgba(255,255,255,0.06)', borderRadius:16, overflow:'hidden', textDecoration:'none', transition:'border-color 0.2s, transform 0.2s', background:'rgba(255,255,255,0.01)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor='rgba(124,58,237,0.3)'; (e.currentTarget as HTMLElement).style.transform='translateY(-3px)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor='rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.transform='translateY(0)' }}>
              <div style={{ height:180, overflow:'hidden' }}>
                <img src={p.img} alt={p.title} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              </div>
              <div style={{ padding:'20px 20px 24px' }}>
                <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:p.color, background:`${p.color}18`, padding:'3px 10px', borderRadius:100, border:`1px solid ${p.color}35` }}>{p.cat}</span>
                <h3 style={{ fontSize:15, fontWeight:700, lineHeight:1.35, color:'#e2e8f0', margin:'12px 0 0' }}>{p.title}</h3>
              </div>
            </a>
          ))}
        </div>
      </div>
      <style>{"@media(max-width:860px){.ca-blog-grid{grid-template-columns:1fr!important}}"}</style>
    </section>
  )
}

/* ─── CTA FINAL ─── */
function CTA() {
  return (
    <section id="contacto" style={{ position:'relative', padding:'120px 28px', overflow:'hidden', textAlign:'center' }}>
      <div style={{ position:'absolute', inset:0, zIndex:0 }}>
        <img src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1400&q=80&auto=format&fit=crop" alt="" style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 30%' }} />
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,rgba(6,6,10,0.95) 0%,rgba(30,10,60,0.92) 50%,rgba(6,6,10,0.95) 100%)' }} />
      </div>
      <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:600, height:400, borderRadius:'50%', background:'radial-gradient(circle,rgba(124,58,237,0.15) 0%,transparent 70%)', pointerEvents:'none', zIndex:1 }} />
      <div style={{ maxWidth:680, margin:'0 auto', position:'relative', zIndex:2 }}>
        <div style={{ display:'inline-block', fontSize:11, fontWeight:700, letterSpacing:'0.14em', color:'#10b981', textTransform:'uppercase', marginBottom:24, padding:'5px 14px', background:'rgba(16,185,129,0.1)', borderRadius:100, border:'1px solid rgba(16,185,129,0.25)' }}>Comenzar ahora</div>
        <h2 style={{ fontSize:'clamp(32px,5vw,56px)', fontWeight:900, letterSpacing:'-0.03em', color:'#f8fafc', lineHeight:1.1, marginBottom:20 }}>
          ¿Listo para modernizar<br />
          <span style={{ background:'linear-gradient(135deg,#a78bfa,#34d399)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>tu condominio?</span>
        </h2>
        <p style={{ fontSize:17, color:'rgba(255,255,255,0.42)', marginBottom:32, lineHeight:1.7 }}>Crea tu demo gratis en 10 segundos: recibes la propuesta en PDF y las claves de las tres apps con el nombre de tu edificio.</p>
        <div id="demo" style={{ marginBottom:32 }}><DemoForm /></div>
        <div style={{ display:'flex', gap:16, justifyContent:'center', flexWrap:'wrap' }}>
          <a href={WA_URL} target="_blank" rel="noopener noreferrer"
            style={{ display:'inline-flex', alignItems:'center', gap:10, padding:'18px 36px', borderRadius:16, background:'linear-gradient(135deg,#25d366,#128c3e)', color:'white', textDecoration:'none', fontSize:16, fontWeight:700, boxShadow:'0 8px 36px rgba(37,211,102,0.4)', transition:'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 12px 44px rgba(37,211,102,0.5)' }}
            onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 8px 36px rgba(37,211,102,0.4)' }}>
            <WA /> Prefiero hablar por WhatsApp
          </a>
          <a href="/login" style={{ display:'inline-flex', alignItems:'center', gap:10, padding:'18px 32px', borderRadius:16, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', color:'rgba(255,255,255,0.72)', textDecoration:'none', fontSize:16, fontWeight:600, backdropFilter:'blur(8px)', transition:'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.1)'; e.currentTarget.style.color='#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.06)'; e.currentTarget.style.color='rgba(255,255,255,0.72)' }}>
            Ya tengo cuenta →
          </a>
        </div>
      </div>
    </section>
  )
}

/* ─── VISIT COUNTER ─── */
function VisitCounter() {
  const [count, setCount] = useState<number | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function track() {
      try {
        // Incrementar y obtener el conteo
        const res = await fetch('/api/visits', { method: 'POST' })
        if (!res.ok) throw new Error()
        const data = await res.json()
        setCount(data.visits)
      } catch {
        // Fallback: solo obtener sin incrementar
        try {
          const res = await fetch('/api/visits')
          if (!res.ok) throw new Error()
          const data = await res.json()
          setCount(data.visits)
        } catch {
          setError(true)
        }
      }
    }
    track()
  }, [])

  if (error || count === null) return null

  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <EyeIcon />
      <span style={{ fontSize:12, color:'rgba(255,255,255,0.25)' }}>
        {count.toLocaleString('es-CL')} visitas al sitio
      </span>
    </div>
  )
}

/* ─── FOOTER ─── */
function Footer() {
  return (
    <footer style={{ background:'#04040a', borderTop:'1px solid rgba(255,255,255,0.04)', padding:'40px 28px 32px' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:20, marginBottom:28 }}>
          <ConectaAIWordmark />
          <div style={{ display:'flex', gap:28 }}>
            {['Funcionalidades','Precios','Ingresar'].map(l => (
              <a key={l} href={l==='Ingresar'?'/login':`#${l.toLowerCase()}`} style={{ fontSize:13, color:'rgba(255,255,255,0.22)', textDecoration:'none', transition:'color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.color='rgba(255,255,255,0.6)')} onMouseLeave={e => (e.currentTarget.style.color='rgba(255,255,255,0.22)')}>{l}</a>
            ))}
          </div>
        </div>
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.04)', paddingTop:20, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:20, flexWrap:'wrap' }}>
            <p style={{ fontSize:12, color:'rgba(255,255,255,0.14)', margin:0 }}>© {new Date().getFullYear()} ConectaAI · Todos los derechos reservados</p>
            <VisitCounter />
          </div>
          <a href={WA_URL} target="_blank" rel="noopener noreferrer" style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#25d366', textDecoration:'none', opacity:0.65, transition:'opacity 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.opacity='1')} onMouseLeave={e => (e.currentTarget.style.opacity='0.65')}>
            <WA /> +56 9 9810 1891
          </a>
        </div>
      </div>
    </footer>
  )
}

/* ─── PAGE ─── */
export default function Page() {
  return (
    <div style={{ background:'#06060a', color:'#e2e8f0', fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,sans-serif", minHeight:'100vh' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        @media (max-width:860px) {
          .ca-steps-grid{grid-template-columns:1fr!important}
          .ca-step{border-right:none!important;border-bottom:1px solid rgba(255,255,255,0.05);padding:28px 0!important}
          .ca-stats-grid{grid-template-columns:repeat(2,1fr)!important}
          .ley-grid{grid-template-columns:1fr!important;gap:40px!important}
        }
      `}</style>
      <Navbar />
      <Hero />
      <TrustBar />
      <LeySection />
      <HowItWorks />
      <Features />
      <RFIDService />
      <Modules />
      <Stats />
      <Testimonials />
      <Pricing />
      <BlogPreview />
      <CTA />
      <Footer />
    </div>
  )
}
