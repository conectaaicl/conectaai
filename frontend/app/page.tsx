'use client'
import React from 'react'
import { useState, useEffect, useRef, useCallback } from 'react'

/* ─── SVG Icons ─── */
const BuildingIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>
  </svg>
)
const MenuIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
)
const XIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)
const ChevronRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
)
const WAIcon = () => (
  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

type IconFC = () => React.ReactElement
const icons: Record<string, IconFC> = {
  door:      () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4H6a2 2 0 0 0-2 2v14h16V6a2 2 0 0 0-2-2h-5z"/><path d="M10 12h1"/></svg>,
  rfid:      () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M6.3 6.3a8 8 0 0 0 0 11.4"/><path d="M17.7 6.3a8 8 0 0 1 0 11.4"/></svg>,
  camera:    () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>,
  alarm:     () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  concierge: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  package:   () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  visitor:   () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  reserve:   () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  portal:    () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="12" y2="15"/></svg>,
  finance:   () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  wa:        () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>,
}

const WA_URL = "https://wa.me/56998101891?text=Hola%2C%20quiero%20consultar%20sobre%20ConectaAI%20Condominios"

/* ─── Navbar ─── */
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])
  const navLinks = [
    { label:'Funcionalidades', href:'#features' },
    { label:'Precios',         href:'#pricing'  },
    { label:'Contacto',        href:'#cta'      },
  ]
  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-xl' : 'bg-transparent'}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        <a href="#" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 group-hover:bg-indigo-500 transition-colors">
            <BuildingIcon/>
          </div>
          <span className="font-bold text-white text-lg tracking-tight">
            ConectaAI <span className="text-indigo-400 font-light">Condominios</span>
          </span>
        </a>
        <div className="hidden md:flex items-center gap-4">
          {navLinks.map(l => (
            <a key={l.label} href={l.href} onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-white text-sm font-medium transition-colors">{l.label}</a>
          ))}
          <a href={WA_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-all shadow-lg shadow-emerald-500/20 hover:-translate-y-px">
            <WAIcon/> WhatsApp
          </a>
          <a href="#cta"
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:-translate-y-px">
            Demo Gratis
          </a>
        </div>
        <button className="md:hidden text-slate-400 hover:text-white" onClick={() => setOpen(!open)}>
          {open ? <XIcon/> : <MenuIcon/>}
        </button>
      </div>
      {open && (
        <div className="md:hidden bg-slate-900/98 border-t border-slate-800 px-4 py-4 flex flex-col gap-3">
          {navLinks.map(l => (
            <a key={l.label} href={l.href} onClick={() => setOpen(false)}
              className="text-slate-300 hover:text-white py-2 text-sm font-medium border-b border-slate-800">{l.label}</a>
          ))}
          <a href={WA_URL} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-2 bg-emerald-600 text-white text-sm font-semibold px-4 py-3 rounded-lg text-center">
            <WAIcon/> Escribir por WhatsApp
          </a>
          <a href="#cta" onClick={() => setOpen(false)}
            className="bg-indigo-600 text-white text-sm font-semibold px-4 py-3 rounded-lg text-center">
            Solicitar Demo
          </a>
        </div>
      )}
    </nav>
  )
}

/* ─── Animated Counter ─── */
function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true
        let start = 0
        const step = Math.ceil(target / 60)
        const t = setInterval(() => {
          start += step
          if (start >= target) { setVal(target); clearInterval(t) } else setVal(start)
        }, 25)
      }
    }, { threshold: 0.5 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [target])
  return <span ref={ref}>{val.toLocaleString('es-CL')}{suffix}</span>
}

/* ─── ConserjeApp Mockup ─── */
function ConserjeMockup() {
  const blocks = [
    { label:'Puertas',          color:'bg-emerald-500/20 border-emerald-500/40', dot:'bg-emerald-400', n:'4',  sub:'2 abiertas'  },
    { label:'Visitas Hoy',      color:'bg-sky-500/20 border-sky-500/40',         dot:'bg-sky-400',     n:'12', sub:'3 esperando' },
    { label:'Paquetes',         color:'bg-orange-500/20 border-orange-500/40',   dot:'bg-orange-400',  n:'7',  sub:'Sin retirar' },
    { label:'Estacionamientos', color:'bg-violet-500/20 border-violet-500/40',   dot:'bg-violet-400',  n:'28', sub:'5 libres'    },
    { label:'Alertas',          color:'bg-rose-500/20 border-rose-500/40',       dot:'bg-rose-400',    n:'0',  sub:'Todo ok'     },
  ]
  return (
    <div className="rounded-xl bg-slate-800/80 border border-slate-700/60 overflow-hidden shadow-2xl">
      <div className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-900/80 border-b border-slate-700/50">
        <span className="w-2.5 h-2.5 rounded-full bg-rose-500/70"/>
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70"/>
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70"/>
        <span className="ml-2 text-xs text-slate-500 font-mono">Central del Conserje — En vivo</span>
        <span className="ml-auto flex items-center gap-1 text-xs text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/> Online
        </span>
      </div>
      <div className="p-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {blocks.map(b => (
          <div key={b.label} className={`rounded-lg border p-3 ${b.color}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`w-2 h-2 rounded-full ${b.dot} animate-pulse`}/>
              <span className="text-xs text-slate-400 font-medium">{b.label}</span>
            </div>
            <div className="text-2xl font-bold text-white">{b.n}</div>
            <div className="text-xs text-slate-500">{b.sub}</div>
          </div>
        ))}
      </div>
      <div className="px-3 pb-3 flex gap-2">
        <button className="flex-1 text-xs bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 rounded-lg py-2 hover:bg-emerald-600/50 transition-colors">
          Abrir Puerta Principal
        </button>
        <button className="flex-1 text-xs bg-sky-600/30 border border-sky-500/40 text-sky-300 rounded-lg py-2 hover:bg-sky-600/50 transition-colors">
          Registrar Visita
        </button>
      </div>
    </div>
  )
}

/* ─── Hero ─── */
function Hero() {
  return (
    <section id="hero" className="relative min-h-screen flex flex-col justify-center overflow-hidden bg-slate-950">
      <div className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage:'radial-gradient(circle, rgba(99,102,241,0.15) 1px, transparent 1px)', backgroundSize:'32px 32px' }}/>
      <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none"/>
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full bg-violet-600/10 blur-3xl pointer-events-none"/>
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-16 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 rounded-full px-4 py-1.5 text-xs text-indigo-400 font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"/>
            Plataforma IoT para edificios — Chile &amp; LATAM
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight tracking-tight mb-5">
            La plataforma más <span className="text-indigo-400">inteligente</span> para edificios del futuro
          </h1>
          <p className="text-lg text-slate-400 leading-relaxed mb-8">
            Control de acceso IoT, gestión completa y conserje inteligente — todo conectado en tiempo real. Puertas TCP/IP, RFID, cámaras y más.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mb-10">
            <a href={WA_URL} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-7 py-3.5 rounded-xl text-base transition-all shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5">
              <WAIcon/> Consultar por WhatsApp
            </a>
            <a href="#features"
              className="border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white font-semibold px-7 py-3.5 rounded-xl text-base transition-all text-center flex items-center justify-center gap-2">
              Ver funcionalidades <ChevronRightIcon/>
            </a>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { n:150, s:'+',   l:'edificios'  },
              { n:12000, s:'+', l:'residentes' },
              { n:99, s:'.9%',  l:'uptime'     },
              { n:24, s:'/7',   l:'soporte'    },
            ].map(({ n, s, l }) => (
              <div key={l} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 text-center">
                <div className="text-xl font-extrabold text-white"><Counter target={n} suffix={s}/></div>
                <div className="text-xs text-slate-500 mt-0.5">{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="hidden lg:block"><ConserjeMockup/></div>
      </div>
    </section>
  )
}

/* ─── Logos Bar ─── */
function LogosBar() {
  const logos = [
    { name:'Chilexpress',  color:'text-red-400',    bg:'bg-red-500/10'     },
    { name:'MercadoLibre', color:'text-yellow-400', bg:'bg-yellow-500/10'  },
    { name:'Bluexpress',   color:'text-blue-400',   bg:'bg-blue-500/10'    },
    { name:'Flow.cl',      color:'text-indigo-400', bg:'bg-indigo-500/10'  },
    { name:'WhatsApp',     color:'text-green-400',  bg:'bg-green-500/10'   },
    { name:'ZKTeco RFID',  color:'text-slate-300',  bg:'bg-slate-700/50'   },
    { name:'Hikvision',    color:'text-rose-400',   bg:'bg-rose-500/10'    },
    { name:'Mercado Pago', color:'text-cyan-400',   bg:'bg-cyan-500/10'    },
  ]
  return (
    <section className="bg-slate-900 border-y border-slate-800 py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <p className="text-center text-sm text-slate-500 font-medium uppercase tracking-widest mb-6">
          Integra con los sistemas que ya usas
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {logos.map(l => (
            <span key={l.name} className={`${l.color} ${l.bg} text-sm font-semibold px-4 py-2 rounded-full border border-white/5`}>
              {l.name}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Problem ─── */
function Problem() {
  const pains = [
    { icon:'📞', title:'Portería saturada',   desc:'El conserje atiende llamadas de visitas, deliveries y residentes al mismo tiempo. Caos constante.' },
    { icon:'📋', title:'Registros en papel',  desc:'Accesos, visitas y paquetes anotados en cuadernos. Sin historial digital, sin trazabilidad.' },
    { icon:'💰', title:'Cobranza manual',     desc:'Gastos comunes en planillas Excel enviadas por email. Morosidad alta, pagos sin comprobante.' },
    { icon:'🔑', title:'Acceso inseguro',     desc:'Llaves físicas duplicadas, tarjetas sin registro. Nadie sabe quién entró ni cuándo.' },
  ]
  return (
    <section className="bg-slate-900 py-20 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-rose-400 text-sm font-semibold uppercase tracking-widest mb-3">El problema actual</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">¿Te suena familiar?</h2>
          <p className="text-slate-400 mt-3 max-w-2xl mx-auto">La gestión de edificios en Chile sigue siendo manual, lenta y propensa a errores. Hay una mejor forma.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {pains.map(p => (
            <div key={p.title} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
              <div className="text-3xl mb-3">{p.icon}</div>
              <h3 className="font-bold text-white mb-2">{p.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Features ─── */
function Features() {
  const features = [
    { icon:'door',      label:'Control de Acceso TCP/IP', desc:'Puertas y barreras conectadas en red. Abre/cierra desde cualquier dispositivo en tiempo real.' },
    { icon:'rfid',      label:'RFID & QR Integrados',     desc:'Lectores ZKTeco, tarjetas RFID y códigos QR para residentes y visitas. Todo con historial.' },
    { icon:'camera',    label:'Cámaras IP en Dashboard',  desc:'Visualiza tus cámaras Hikvision y otras marcas directamente desde el panel de control.' },
    { icon:'concierge', label:'Conserje Digital',         desc:'Registro de visitas, paquetes, incidencias y control de puertas desde una sola pantalla táctil.' },
    { icon:'visitor',   label:'Gestión de Visitas',       desc:'El residente autoriza visitas desde su app. El conserje recibe notificación instantánea.' },
    { icon:'package',   label:'Paquetería 13+ Carriers',  desc:'Chilexpress, DHL, Bluexpress y más. Notificación al residente cuando llega su encomienda.' },
    { icon:'portal',    label:'Portal del Residente',     desc:'App PWA instalable. Pago en línea, avisos, reservas, documentos y acceso QR.' },
    { icon:'finance',   label:'Gastos Comunes Online',    desc:'Cobranza digital, pagos Flow y Mercado Pago, morosidad en tiempo real, presupuesto anual.' },
    { icon:'wa',        label:'Bot WhatsApp Nativo',      desc:'Responde consultas, acepta pagos y notifica eventos directamente por WhatsApp.' },
    { icon:'reserve',   label:'Reservas de Áreas',        desc:'Quinchos, piscinas, salas de eventos. Reserva online con calendario visual.' },
    { icon:'alarm',     label:'Alertas y Seguridad',      desc:'Detección de intrusos, alarmas integradas y notificaciones push en tiempo real.' },
    { icon:'rfid',      label:'Votaciones Online',        desc:'Asambleas y consultas a residentes con firma electrónica y resultados en tiempo real.' },
  ]
  return (
    <section id="features" className="bg-slate-950 py-20 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-indigo-400 text-sm font-semibold uppercase tracking-widest mb-3">Funcionalidades</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Todo lo que necesita tu edificio</h2>
          <p className="text-slate-400 mt-3 max-w-2xl mx-auto">Una plataforma completa, no un conjunto de herramientas dispersas.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(f => {
            const Icon = icons[f.icon]
            return (
              <div key={f.label} className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 hover:border-indigo-500/40 hover:bg-slate-800/70 transition-all group">
                <div className="w-11 h-11 bg-indigo-600/20 border border-indigo-500/30 rounded-xl flex items-center justify-center text-indigo-400 mb-4 group-hover:bg-indigo-600/30 transition-colors">
                  {Icon && <Icon/>}
                </div>
                <h3 className="font-bold text-white mb-2">{f.label}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ─── IoT Showcase ─── */
function IoTShowcase() {
  return (
    <section className="bg-slate-900 py-20 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-indigo-400 text-sm font-semibold uppercase tracking-widest mb-3">Hardware real</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">Compatible con tus lectores RFID actuales</h2>
          <p className="text-slate-400 leading-relaxed mb-6">
            Si ya tienes lectores ZKTeco, Hikvision o cualquier dispositivo TCP/IP instalado, ConectaAI se conecta directamente. Sin reemplazar hardware.
          </p>
          <ul className="space-y-3">
            {[
              'ZKTeco — lectores de tarjeta y biométricos',
              'Hikvision — cámaras IP y lectores QR',
              'Dispositivos TCP/IP genéricos (relés, barreras)',
              'Puertas magnéticas y electroimanes',
              'Control de estacionamientos',
            ].map(item => (
              <li key={item} className="flex items-center gap-3 text-sm text-slate-300">
                <span className="text-emerald-400 flex-shrink-0"><CheckIcon/></span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="hidden lg:block">
          <ConserjeMockup/>
        </div>
      </div>
    </section>
  )
}

/* ─── Conserje Section ─── */
function ConserjeSec() {
  return (
    <section className="bg-slate-950 py-20 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-emerald-400 text-sm font-semibold uppercase tracking-widest mb-3">Para el conserje</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Diseñado para pantallas táctiles</h2>
          <p className="text-slate-400 mt-3 max-w-2xl mx-auto">
            Botones grandes, respuesta instantánea. Coloca una pantalla en recepción y el conserje controla todo sin capacitación.
          </p>
        </div>
        <div className="max-w-md mx-auto">
          <ConserjeMockup/>
        </div>
        <div className="grid sm:grid-cols-3 gap-5 mt-10">
          {[
            { icon:'🚪', title:'Control puertas',   desc:'Abre, cierra o pulsa desde la pantalla. Historial de cada evento.' },
            { icon:'👤', title:'Registro visitas',  desc:'Alta de visitas en segundos. Notifica al residente automáticamente.' },
            { icon:'📦', title:'Paquetes y envíos', desc:'Registra con foto. El residente recibe push notification de inmediato.' },
          ].map(c => (
            <div key={c.title} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 text-center">
              <div className="text-4xl mb-3">{c.icon}</div>
              <h3 className="font-bold text-white mb-2">{c.title}</h3>
              <p className="text-slate-400 text-sm">{c.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Pricing ─── */
function Pricing() {
  const plans = [
    {
      name:'Básico', price:'Consultar', period:'',
      desc:'Ideal para un edificio o condominio pequeño',
      features:['1 edificio','Hasta 50 departamentos','Control de acceso TCP/IP','Paquetería básica','Portal del residente','Soporte email'],
      cta:'Consultar precio', highlight:false,
    },
    {
      name:'Profesional', price:'Consultar', period:'',
      desc:'Para complejos medianos con mayor exigencia',
      features:['Hasta 3 edificios','Hasta 150 departamentos','RFID + cámaras integradas','Bot WhatsApp incluido','Push notifications','Dashboard conserje avanzado','Soporte prioritario'],
      cta:'Consultar precio', highlight:true, badge:'Más popular',
    },
    {
      name:'Enterprise', price:'Consultar', period:'',
      desc:'Multi-edificio, multi-ciudad, SaaS white-label',
      features:['Edificios ilimitados','Residentes ilimitados','IoT custom (alarmas/RFID)','API pública + webhooks','SLA 99.9% garantizado','Onboarding dedicado','Soporte 24/7 directo'],
      cta:'Consultar', highlight:false,
    },
  ]
  return (
    <section id="pricing" className="bg-slate-950 py-20 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-indigo-400 text-sm font-semibold uppercase tracking-widest mb-3">Precios</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Planes a tu medida</h2>
          <p className="text-slate-400 mt-3">Precios según tu edificio y necesidades. Contáctanos para una cotización personalizada.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 items-stretch">
          {plans.map(p => (
            <div key={p.name} className={`relative rounded-2xl p-7 flex flex-col border transition-all ${p.highlight ? 'bg-indigo-600/10 border-indigo-500/60 shadow-2xl shadow-indigo-500/10' : 'bg-slate-800/40 border-slate-700/50'}`}>
              {p.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap">
                  {p.badge}
                </div>
              )}
              <div className="mb-5">
                <h3 className={`font-bold text-lg ${p.highlight ? 'text-indigo-300' : 'text-white'}`}>{p.name}</h3>
                <div className="flex items-end gap-1 mt-2 mb-1">
                  <span className="text-2xl font-extrabold text-white">{p.price}</span>
                </div>
                <p className="text-slate-500 text-xs">{p.desc}</p>
              </div>
              <ul className="flex-1 flex flex-col gap-2.5 mb-7">
                {p.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                    <span className="text-emerald-400 flex-shrink-0"><CheckIcon/></span>
                    {f}
                  </li>
                ))}
              </ul>
              <a href={WA_URL} target="_blank" rel="noopener noreferrer"
                className={`flex items-center justify-center gap-2 text-center py-3 px-6 rounded-xl font-semibold text-sm transition-all ${p.highlight ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white'}`}>
                <WAIcon/> {p.cta}
              </a>
            </div>
          ))}
        </div>
        <p className="text-center text-slate-500 text-sm mt-8">
          ¿Tienes un condominio grande o necesidades especiales?{' '}
          <a href={WA_URL} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">
            Escríbenos por WhatsApp
          </a>
        </p>
      </div>
    </section>
  )
}

/* ─── Testimonials ─── */
function Testimonials() {
  const testimonials = [
    {
      init:'MA', name:'María Angélica Torres', building:'Administradora Torre Parque Las Condes',
      quote:'Antes el conserje llamaba a golpes en el vidrio para avisar visitas. Ahora solo mira la pantalla y hace click. El cambio fue total desde el primer día.',
    },
    {
      init:'JP', name:'Juan Pablo Riquelme', building:'Comité Condominio Los Álamos, Vitacura',
      quote:'Con ConectaAI pudimos conectar nuestros lectores RFID de ZKTeco que teníamos instalados y dormidos. Ahora tenemos historial real de accesos y alertas en tiempo real.',
    },
    {
      init:'CG', name:'Carolina González', building:'Administradora Edificio Central, Providencia',
      quote:'Los residentes pueden ver en la app cuándo llegó su paquete de Chilexpress. Cero llamadas al conserje preguntando.',
    },
  ]
  return (
    <section className="bg-slate-900 py-20 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-indigo-400 text-sm font-semibold uppercase tracking-widest mb-3">Testimonios</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Lo que dicen nuestros administradores</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map(card => (
            <div key={card.name} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-7 flex flex-col gap-5">
              <p className="text-slate-300 text-sm leading-relaxed italic">&ldquo;{card.quote}&rdquo;</p>
              <div className="flex items-center gap-3 mt-auto">
                <div className="w-10 h-10 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-bold text-sm flex-shrink-0">
                  {card.init}
                </div>
                <div>
                  <div className="text-white text-sm font-semibold">{card.name}</div>
                  <div className="text-slate-500 text-xs">{card.building}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── CTA Final ─── */
function CTAFinal() {
  const [form, setForm] = useState({ nombre:'', email:'', telefono:'', edificio:'' })
  const [status, setStatus] = useState<'idle'|'loading'|'done'>('idle')
  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    try {
      await fetch('/api/leads', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ ...form, source:'landing_condominios' }),
      })
    } catch {}
    setStatus('done')
  }, [form])

  return (
    <section id="cta" className="bg-slate-950 py-20 px-4 sm:px-6 border-t border-slate-800">
      <div className="max-w-2xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-4 py-1.5 text-xs text-emerald-400 font-medium mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/> Configuración en 24 horas
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">¿Listo para modernizar tu edificio?</h2>
        <p className="text-slate-400 mb-6">Solicita una demo gratuita — te configuramos todo en 24 horas. Sin compromiso.</p>

        {/* WhatsApp CTA prominente */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
          <a href={WA_URL} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-7 py-3.5 rounded-xl text-sm transition-all shadow-xl shadow-emerald-500/25">
            <WAIcon/> Escribir por WhatsApp
          </a>
          <a href="#cta-form"
            className="inline-flex items-center justify-center gap-2 border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white font-semibold px-7 py-3.5 rounded-xl text-sm transition-all">
            Solicitar Demo por email
          </a>
        </div>

        {status === 'done' ? (
          <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-2xl px-8 py-10">
            <div className="text-5xl mb-4">🎉</div>
            <div className="text-white font-bold text-xl mb-2">¡Solicitud enviada!</div>
            <div className="text-slate-400">Te contactaremos en las próximas horas.</div>
          </div>
        ) : (
          <form id="cta-form" onSubmit={submit} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-7 text-left flex flex-col gap-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 text-xs font-medium mb-1.5">Tu nombre</label>
                <input type="text" required placeholder="Juan Pérez"
                  value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre:e.target.value }))}
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"/>
              </div>
              <div>
                <label className="block text-slate-400 text-xs font-medium mb-1.5">Email</label>
                <input type="email" required placeholder="juan@edificio.cl"
                  value={form.email} onChange={e => setForm(f => ({ ...f, email:e.target.value }))}
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"/>
              </div>
              <div>
                <label className="block text-slate-400 text-xs font-medium mb-1.5">Teléfono</label>
                <input type="tel" placeholder="+56 9 9810 1891"
                  value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono:e.target.value }))}
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"/>
              </div>
              <div>
                <label className="block text-slate-400 text-xs font-medium mb-1.5">Nombre del edificio</label>
                <input type="text" placeholder="Torre El Parque"
                  value={form.edificio} onChange={e => setForm(f => ({ ...f, edificio:e.target.value }))}
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"/>
              </div>
            </div>
            <button type="submit" disabled={status === 'loading'}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/25">
              {status === 'loading' ? 'Enviando...' : 'Solicitar Demo Gratis'}
            </button>
            <p className="text-center text-slate-600 text-xs">Sin compromiso. Sin tarjeta de crédito. Te respondemos en menos de 24 horas.</p>
          </form>
        )}
      </div>
    </section>
  )
}

/* ─── Footer ─── */
function Footer() {
  return (
    <footer className="bg-slate-900 border-t border-slate-800 py-12 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-8">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white"><BuildingIcon/></div>
              <span className="font-bold text-white tracking-tight">ConectaAI <span className="text-indigo-400 font-light">Condominios</span></span>
            </div>
            <p className="text-slate-500 text-xs leading-relaxed">
              La plataforma más inteligente para edificios del futuro. IoT real, conserje digital y gestión completa.
            </p>
          </div>
          <div className="flex flex-wrap gap-8">
            <div>
              <h4 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Producto</h4>
              <div className="flex flex-col gap-2">
                {['Funcionalidades','Precios','Soporte'].map(l => (
                  <a key={l} href="#" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">{l}</a>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Legal</h4>
              <div className="flex flex-col gap-2">
                {['Términos de uso','Privacidad'].map(l => (
                  <a key={l} href="#" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">{l}</a>
                ))}
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Contacto</h4>
            <a href={WA_URL} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors text-sm font-semibold mb-2 block">
              <WAIcon/> +56 9 9810 1891
            </a>
            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-400 transition-colors text-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              LinkedIn
            </a>
          </div>
        </div>
        <div className="border-t border-slate-800 pt-6 text-center text-slate-600 text-xs">
          &copy; 2026 ConectaAI — Edificios Inteligentes. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  )
}

/* ─── Root Page ─── */
export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar/>
      <Hero/>
      <LogosBar/>
      <Problem/>
      <Features/>
      <IoTShowcase/>
      <ConserjeSec/>
      <Pricing/>
      <Testimonials/>
      <CTAFinal/>
      <Footer/>
    </div>
  )
}
