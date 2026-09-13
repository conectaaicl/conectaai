'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'

type Tipo = 'condominio' | 'cowork' | 'gimnasio'
interface Personal { nombre: string; cargo: string; email: string; turno: string }
interface Residente { rut: string; nombre: string; depto: string }
interface Result {
  tenant_id: number; slug: string; dominio: string
  urls: { sitio: string; admin: string; conserje: string; portal: string; registro: string }
  admin: { nombre: string; email: string; password: string }
  personal: { nombre: string; cargo: string; email: string; password: string }[]
  residentes: { rut: string; nombre: string; depto: string; password: string }[]
  residentes_error: { rut: string; motivo: string }[]
  resumen: { departamentos: number; pisos: number; personal: number; residentes: number }
}

const STEPS = [
  { n: 1, t: 'El edificio', d: 'Nombre y dirección' },
  { n: 2, t: 'El administrador', d: 'Quién lo gestiona' },
  { n: 3, t: 'El personal', d: 'Conserjes y trabajadores' },
  { n: 4, t: 'Las unidades', d: 'Departamentos o casas' },
  { n: 5, t: 'Los vecinos', d: 'Cómo se registran' },
  { n: 6, t: '¡Listo!', d: 'Accesos y claves' },
]
const CARGOS = ['conserje', 'guardia', 'mantenimiento', 'limpieza', 'jardinero', 'administrador']
const CARGO_LABEL: Record<string, string> = { conserje: 'Conserje', guardia: 'Guardia', mantenimiento: 'Mantenimiento', limpieza: 'Aseo', jardinero: 'Jardinero', administrador: 'Administrador' }

function genPass() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let s = ''
  for (let i = 0; i < 8; i++) s += a[Math.floor(Math.random() * a.length)]
  return s.slice(0, 4) + '#' + s.slice(4) + Math.floor(Math.random() * 10)
}
function numDepto(piso: number, idx: number, porPiso: number, modo: string) {
  if (modo === 'consecutiva') return String((piso - 1) * porPiso + idx)
  if (modo === 'letras') return `${piso}${String.fromCharCode(64 + idx)}`
  return `${piso}${String(idx).padStart(2, '0')}`
}

const inp = 'w-full px-4 py-3 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition'
const lbl = 'block text-xs font-semibold text-slate-300 mb-1.5'

function Copy({ text, small }: { text: string; small?: boolean }) {
  const [ok, setOk] = useState(false)
  return (
    <button type="button" onClick={() => { navigator.clipboard?.writeText(text); setOk(true); setTimeout(() => setOk(false), 1400) }}
      className={`${small ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'} rounded-lg font-semibold transition ${ok ? 'bg-emerald-600 text-white' : 'bg-slate-700 hover:bg-teal-600 text-white'}`}>
      {ok ? '✓ Copiado' : 'Copiar'}
    </button>
  )
}

export default function WizardPage() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [prep, setPrep] = useState(-1)   // -1 = oculto; 0..5 = etapa de la pantalla 'preparando'

  const [ed, setEd] = useState({ nombre: '', direccion: '', ciudad: '', tipo: 'condominio' as Tipo, anio: '', telefono: '' })
  const [slug, setSlug] = useState<{ slug: string; disponible: boolean; url: string | null } | null>(null)
  const [ad, setAd] = useState({ nombre: '', email: '', rut: '', telefono: '', password: genPass() })
  const [personal, setPersonal] = useState<Personal[]>([{ nombre: '', cargo: 'conserje', email: '', turno: '' }])
  const [est, setEst] = useState({ tipo_unidad: 'departamentos', pisos: 10, deptos_por_piso: 4, numeracion: 'piso', subterraneos: 1, cantidad_casas: 30, casa_desde: 1, casa_prefijo: 'Casa ' })
  const [resTab, setResTab] = useState<'link' | 'lista'>('link')
  const [resTexto, setResTexto] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // slug en vivo
  useEffect(() => {
    if (ed.nombre.trim().length < 3) { setSlug(null); return }
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`/api/superadmin/wizard/check-slug?nombre=${encodeURIComponent(ed.nombre)}`, { credentials: 'include' })
        if (r.ok) setSlug(await r.json())
      } catch { }
    }, 350)
    return () => clearTimeout(id)
  }, [ed.nombre])

  const residentes: Residente[] = useMemo(() =>
    resTexto.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
      const p = l.split(/[;,\t]/).map(x => x.trim())
      return { rut: p[0] || '', nombre: p[1] || '', depto: p[2] || '' }
    }).filter(r => r.rut && r.nombre), [resTexto])

  const esGym = ed.tipo === 'gimnasio'
  const esCasas = est.tipo_unidad === 'casas'
  const totalDeptos = esGym ? 0 : esCasas ? est.cantidad_casas : est.pisos * est.deptos_por_piso

  function validar(s: number): string {
    if (s === 1) {
      if (ed.nombre.trim().length < 3) return 'Escribe el nombre del edificio.'
      if (slug && !slug.disponible) return 'Ese nombre ya está en uso. Cambia el nombre.'
    }
    if (s === 2) {
      if (ad.nombre.trim().length < 3) return 'Escribe el nombre del administrador.'
      if (!/.+@.+\..+/.test(ad.email)) return 'Escribe un correo válido para el administrador.'
      if (ad.password.length < 8) return 'La clave debe tener al menos 8 caracteres.'
    }
    if (s === 3) {
      for (const p of personal) if (p.nombre.trim() && p.nombre.trim().length < 2) return 'Revisa los nombres del personal.'
    }
    return ''
  }
  function next() {
    const e = validar(step); if (e) { setError(e); return }
    setError(''); setStep(s => Math.min(6, s + 1)); window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function prev() { setError(''); setStep(s => Math.max(1, s - 1)) }

  const etapas = useMemo(() => [
    `Reservando la dirección web ${slug?.slug || 'del edificio'}.conectaai.cl`,
    esGym ? 'Preparando el control de acceso de socios' : esCasas ? `Construyendo ${est.cantidad_casas} casas` : `Construyendo ${est.pisos} pisos con ${est.pisos * est.deptos_por_piso} departamentos`,
    `Creando el acceso del administrador ${ad.nombre.split(' ')[0] || ''}`,
    personal.filter(p => p.nombre.trim()).length ? `Dando de alta a ${personal.filter(p => p.nombre.trim()).length} trabajador${personal.filter(p => p.nombre.trim()).length === 1 ? '' : 'es'}` : 'Preparando la app de conserjería',
    'Preparando la app de los vecinos y su código QR',
    '¡Todo listo!',
  ], [slug, esGym, esCasas, est, ad.nombre, personal])

  async function crear() {
    setError(''); setLoading(true); setPrep(0)
    const espera = (ms: number) => new Promise(r => setTimeout(r, ms))
    const secuencia = (async () => { for (let i = 1; i <= 4; i++) { await espera(850); setPrep(i) } })()
    try {
      const body = {
        edificio: { nombre: ed.nombre.trim(), direccion: ed.direccion || null, ciudad: ed.ciudad || null, tipo: ed.tipo, anio: ed.anio ? parseInt(ed.anio) : null, telefono: ed.telefono || null },
        admin: { nombre: ad.nombre.trim(), email: ad.email.trim(), rut: ad.rut || null, telefono: ad.telefono || null, password: ad.password },
        personal: personal.filter(p => p.nombre.trim()).map(p => ({ nombre: p.nombre.trim(), cargo: p.cargo, email: p.email.trim() || null, turno: p.turno || null })),
        estructura: { ...est, nombre_torre: 'A' },
        residentes: resTab === 'lista' ? residentes : [],
        enviar_emails: true,
      }
      const r = await fetch('/api/superadmin/wizard/crear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) })
      const d = await r.json()
      await secuencia
      if (!r.ok) { setPrep(-1); setError(d.detail || 'No se pudo crear el condominio'); return }
      setPrep(5); await espera(1100)
      setResult(d); setStep(6); setPrep(-1); window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch { setPrep(-1); setError('Error de conexión con el servidor') }
    finally { setLoading(false) }
  }

  function leerArchivo(f: File) {
    const fr = new FileReader()
    fr.onload = () => setResTexto(String(fr.result || ''))
    fr.readAsText(f)
  }

  const preview = useMemo(() => {
    const rows: { label: string; units: string[] }[] = []
    const show = Math.min(est.pisos, 6)
    for (let p = show; p >= 1; p--) {
      const units = []
      for (let i = 1; i <= Math.min(est.deptos_por_piso, 6); i++) units.push(numDepto(p, i, est.deptos_por_piso, est.numeracion))
      if (est.deptos_por_piso > 6) units.push(`+${est.deptos_por_piso - 6}`)
      rows.push({ label: `Piso ${p}`, units })
    }
    return rows
  }, [est])

  return (
    <div className="max-w-5xl mx-auto">
      {prep >= 0 && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-md text-center">
            <div className="relative w-24 h-24 mx-auto mb-8">
              <div className={`absolute inset-0 rounded-full border-4 ${prep === 5 ? 'border-teal-500' : 'border-slate-800 border-t-teal-500 animate-spin'}`} />
              <div className="absolute inset-0 flex items-center justify-center text-4xl">{prep === 5 ? '✓' : '🏢'}</div>
            </div>
            <p className="text-[11px] font-bold tracking-widest uppercase text-teal-400 mb-2">{prep === 5 ? 'Listo' : 'Preparando tu condominio'}</p>
            <h2 className="text-2xl font-extrabold text-white mb-1">{ed.nombre || 'Tu edificio'}</h2>
            <p className="text-slate-400 text-sm mb-8">{prep === 5 ? 'Ya puedes compartir los accesos.' : 'Esto toma unos segundos. No cierres esta ventana.'}</p>
            <ul className="text-left space-y-2.5 bg-slate-900 border border-slate-800 rounded-2xl p-5">
              {etapas.slice(0, 5).map((t, i) => (
                <li key={i} className={`flex items-center gap-3 text-sm transition ${i < prep || prep === 5 ? 'text-slate-300' : i === prep ? 'text-white font-semibold' : 'text-slate-600'}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] shrink-0 ${i < prep || prep === 5 ? 'bg-teal-600 text-white' : i === prep ? 'bg-teal-500/20 text-teal-400 animate-pulse' : 'bg-slate-800 text-slate-600'}`}>{i < prep || prep === 5 ? '✓' : '•'}</span>
                  {t}
                </li>
              ))}
            </ul>
            <div className="h-1.5 bg-slate-800 rounded-full mt-6 overflow-hidden"><div className="h-full bg-teal-500 transition-all duration-700" style={{ width: `${prep === 5 ? 100 : 8 + prep * 20}%` }} /></div>
          </div>
        </div>
      )}
      {/* header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/superadmin/tenants" className="text-slate-400 hover:text-white transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">Crear condominio</h1>
          <p className="text-slate-400 text-sm">5 pasos. Menos de 3 minutos.</p>
        </div>
      </div>

      <div className="h-1 bg-slate-800 rounded-full mb-8 overflow-hidden">
        <div className="h-full bg-teal-500 transition-all duration-500" style={{ width: `${(step / 6) * 100}%` }} />
      </div>

      <div className="grid lg:grid-cols-[230px_1fr] gap-10 items-start">
        {/* sidebar pasos */}
        <aside className="lg:sticky lg:top-6 flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0">
          {STEPS.map((s, i) => {
            const done = s.n < step, active = s.n === step
            return (
              <button key={s.n} type="button" disabled={s.n > step || !!result} onClick={() => { setError(''); setStep(s.n) }}
                className="relative flex lg:flex-row flex-col items-center lg:items-start gap-2 lg:gap-3 text-left px-2 py-2 min-w-[76px] rounded-xl hover:bg-slate-900 disabled:hover:bg-transparent transition">
                {i < STEPS.length - 1 && <span className={`hidden lg:block absolute left-[25px] top-[42px] w-0.5 h-[calc(100%-26px)] ${done ? 'bg-teal-500' : 'bg-slate-800'}`} />}
                <span className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition ${active ? 'bg-teal-500 text-white ring-4 ring-teal-500/20' : done ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                  {done ? '✓' : s.n}
                </span>
                <span className="lg:pt-1.5 text-center lg:text-left">
                  <span className={`block text-xs lg:text-sm font-bold ${active ? 'text-teal-400' : done ? 'text-slate-300' : 'text-slate-500'}`}>{s.t}</span>
                  <span className="hidden lg:block text-[11px] text-slate-500">{s.d}</span>
                </span>
              </button>
            )
          })}
        </aside>

        {/* contenido */}
        <div className="min-w-0">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-300 text-sm mb-5">{error}</div>
          )}

          {step === 1 && (
            <section>
              <p className="text-[11px] font-bold tracking-widest uppercase text-teal-400 mb-2">Paso 1 de 5</p>
              <h2 className="text-3xl font-extrabold text-white leading-tight mb-2">¿Cómo se llama el edificio?</h2>
              <p className="text-slate-400 text-sm mb-7 max-w-lg">Con el nombre creamos automáticamente su dirección web. Los vecinos y trabajadores entrarán por ahí.</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={lbl}>Nombre del edificio</label>
                  <input className={inp} value={ed.nombre} onChange={e => setEd({ ...ed, nombre: e.target.value })} placeholder="Ej: Edificio Los Álamos" autoFocus />
                  {slug && (
                    <p className={`mt-2 text-xs font-medium ${slug.disponible ? 'text-teal-400' : 'text-red-400'}`}>
                      {slug.disponible ? <>✓ Su dirección será <span className="font-mono">{slug.url}</span></> : '✗ Ese nombre ya está en uso'}
                    </p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className={lbl}>Dirección</label>
                  <input className={inp} value={ed.direccion} onChange={e => setEd({ ...ed, direccion: e.target.value })} placeholder="Ej: Av. Las Condes 1234, Las Condes" />
                </div>
                <div>
                  <label className={lbl}>Ciudad</label>
                  <input className={inp} value={ed.ciudad} onChange={e => setEd({ ...ed, ciudad: e.target.value })} placeholder="Santiago" />
                </div>
                <div>
                  <label className={lbl}>Teléfono del edificio <span className="text-slate-500 font-normal">(opcional)</span></label>
                  <input className={inp} value={ed.telefono} onChange={e => setEd({ ...ed, telefono: e.target.value })} placeholder="+56 2 2345 6789" />
                </div>
              </div>
              <p className="text-[11px] font-bold tracking-widest uppercase text-slate-500 mt-7 mb-3">¿Qué tipo de lugar es?</p>
              <div className="grid sm:grid-cols-3 gap-3">
                {([['condominio', '🏢', 'Condominio', 'Departamentos y vecinos'], ['cowork', '🏗️', 'Cowork / Oficinas', 'Empresas y puestos'], ['gimnasio', '🏋️', 'Gimnasio', 'Socios y membresías']] as const).map(([v, ico, t, d]) => (
                  <button key={v} type="button" onClick={() => setEd({ ...ed, tipo: v })}
                    className={`text-left p-4 rounded-2xl border-2 transition ${ed.tipo === v ? 'border-teal-500 bg-teal-500/10' : 'border-slate-800 bg-slate-900 hover:border-slate-600'}`}>
                    <div className="text-2xl mb-2">{ico}</div>
                    <div className="text-sm font-bold text-white">{t}</div>
                    <div className="text-[11px] text-slate-400">{d}</div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {step === 2 && (
            <section>
              <p className="text-[11px] font-bold tracking-widest uppercase text-teal-400 mb-2">Paso 2 de 5</p>
              <h2 className="text-3xl font-extrabold text-white leading-tight mb-2">¿Quién administra el edificio?</h2>
              <p className="text-slate-400 text-sm mb-7 max-w-lg">Esta persona verá todo: pagos, vecinos, reportes y configuración. Recibirá su clave por correo.</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><label className={lbl}>Nombre completo</label><input className={inp} value={ad.nombre} onChange={e => setAd({ ...ad, nombre: e.target.value })} placeholder="María González Rojas" autoFocus /></div>
                <div><label className={lbl}>RUT <span className="text-slate-500 font-normal">(opcional)</span></label><input className={inp} value={ad.rut} onChange={e => setAd({ ...ad, rut: e.target.value })} placeholder="12.345.678-9" /></div>
                <div className="sm:col-span-2"><label className={lbl}>Correo electrónico</label><input type="email" className={inp} value={ad.email} onChange={e => setAd({ ...ad, email: e.target.value })} placeholder="admin@miedificio.cl" /></div>
                <div><label className={lbl}>Teléfono</label><input className={inp} value={ad.telefono} onChange={e => setAd({ ...ad, telefono: e.target.value })} placeholder="+56 9 1234 5678" /></div>
                <div>
                  <label className={lbl}>Clave inicial</label>
                  <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5">
                    <input className="flex-1 bg-transparent font-mono text-teal-300 font-bold text-sm outline-none" value={ad.password} onChange={e => setAd({ ...ad, password: e.target.value })} />
                    <button type="button" onClick={() => setAd({ ...ad, password: genPass() })} className="text-xs text-slate-400 hover:text-white">🔄</button>
                    <Copy text={ad.password} small />
                  </div>
                </div>
              </div>
            </section>
          )}

          {step === 3 && (
            <section>
              <p className="text-[11px] font-bold tracking-widest uppercase text-teal-400 mb-2">Paso 3 de 5</p>
              <h2 className="text-3xl font-extrabold text-white leading-tight mb-2">¿Quién trabaja en el edificio?</h2>
              <p className="text-slate-400 text-sm mb-5 max-w-lg">Conserjes, guardias, aseo, mantenimiento. Todos entran a la app de conserjería. Puedes dejarlo vacío y agregar después.</p>
              <div className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-full px-3 py-1.5 text-xs text-slate-300 mb-5">💡 Si no pones correo, le creamos uno automático y la clave aparece al final.</div>
              <div className="space-y-2">
                {personal.map((p, i) => (
                  <div key={i} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1.3fr_1fr_1.3fr_auto_auto] gap-2 items-center bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                    <input className="bg-transparent px-2 py-1.5 text-sm text-white outline-none placeholder-slate-500 col-span-1" placeholder="Nombre completo" value={p.nombre} onChange={e => setPersonal(l => l.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x))} />
                    <select className="bg-slate-800 rounded-lg px-2 py-1.5 text-sm text-slate-200 outline-none" value={p.cargo} onChange={e => setPersonal(l => l.map((x, j) => j === i ? { ...x, cargo: e.target.value } : x))}>
                      {CARGOS.map(c => <option key={c} value={c}>{CARGO_LABEL[c]}</option>)}
                    </select>
                    <input className="bg-transparent px-2 py-1.5 text-sm text-white outline-none placeholder-slate-500 col-span-2 sm:col-span-1" placeholder="Correo (opcional)" value={p.email} onChange={e => setPersonal(l => l.map((x, j) => j === i ? { ...x, email: e.target.value } : x))} />
                    <select className="bg-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 outline-none" value={p.turno} onChange={e => setPersonal(l => l.map((x, j) => j === i ? { ...x, turno: e.target.value } : x))}>
                      <option value="">Turno</option><option value="dia">Día</option><option value="noche">Noche</option><option value="rotativo">Rotativo</option>
                    </select>
                    <button type="button" onClick={() => setPersonal(l => l.filter((_, j) => j !== i))} className="text-slate-500 hover:text-red-400 text-lg px-1">×</button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setPersonal(l => [...l, { nombre: '', cargo: 'conserje', email: '', turno: '' }])}
                className="mt-3 w-full py-2.5 rounded-xl border border-dashed border-slate-700 text-slate-300 text-sm font-semibold hover:border-teal-500 hover:text-teal-400 transition">
                + Agregar otro trabajador
              </button>
            </section>
          )}

          {step === 4 && (
            <section>
              <p className="text-[11px] font-bold tracking-widest uppercase text-teal-400 mb-2">Paso 4 de 5</p>
              <h2 className="text-3xl font-extrabold text-white leading-tight mb-2">{esGym ? 'Espacios del gimnasio' : '¿Cómo está organizado?'}</h2>
              <p className="text-slate-400 text-sm mb-6 max-w-lg">{esGym ? 'Un gimnasio no necesita departamentos. Los socios se registran directo con su RUT.' : 'Primero dinos si son departamentos o casas. Después creamos todas las unidades de una vez con su número.'}</p>
              {!esGym && (
                <div className="grid sm:grid-cols-2 gap-3 mb-6">
                  {([['departamentos', '🏢', 'Departamentos', 'Edificio con pisos'], ['casas', '🏡', 'Casas', 'Condominio de casas o parcelas']] as const).map(([v, ico, t, d]) => (
                    <button key={v} type="button" onClick={() => setEst({ ...est, tipo_unidad: v })}
                      className={`text-left p-4 rounded-2xl border-2 transition flex items-center gap-3 ${est.tipo_unidad === v ? 'border-teal-500 bg-teal-500/10' : 'border-slate-800 bg-slate-900 hover:border-slate-600'}`}>
                      <span className="text-2xl">{ico}</span>
                      <span><span className="block text-sm font-bold text-white">{t}</span><span className="text-[11px] text-slate-400">{d}</span></span>
                    </button>
                  ))}
                </div>
              )}
              {!esGym && esCasas && (
                <div className="grid md:grid-cols-2 gap-5">
                  <div className="space-y-4">
                    <div><label className={lbl}>¿Cuántas casas hay?</label><input type="number" min={1} max={2000} className={inp} value={est.cantidad_casas} onChange={e => setEst({ ...est, cantidad_casas: Math.max(1, parseInt(e.target.value) || 1) })} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className={lbl}>Empiezan en el N°</label><input type="number" min={0} className={inp} value={est.casa_desde} onChange={e => setEst({ ...est, casa_desde: Math.max(0, parseInt(e.target.value) || 0) })} /></div>
                      <div><label className={lbl}>Cómo se llaman</label>
                        <select className={inp} value={est.casa_prefijo} onChange={e => setEst({ ...est, casa_prefijo: e.target.value })}>
                          <option value="Casa ">Casa 1, Casa 2…</option>
                          <option value="">Solo número: 1, 2, 3…</option>
                          <option value="Parcela ">Parcela 1, Parcela 2…</option>
                          <option value="Sitio ">Sitio 1, Sitio 2…</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                    <p className="text-[10px] font-bold tracking-widest uppercase text-slate-500 mb-3">Así quedará</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from({ length: Math.min(est.cantidad_casas, 24) }, (_, i) => <span key={i} className="px-2 py-1 rounded bg-teal-500/15 text-teal-300 text-[11px] font-bold">{est.casa_prefijo}{est.casa_desde + i}</span>)}
                      {est.cantidad_casas > 24 && <span className="px-2 py-1 text-[11px] text-slate-500">··· +{est.cantidad_casas - 24}</span>}
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800 text-sm text-white font-bold">🏡 {est.cantidad_casas} casas</div>
                  </div>
                </div>
              )}
              {!esGym && !esCasas && (
                <div className="grid md:grid-cols-2 gap-5">
                  <div className="space-y-4">
                    <div><label className={lbl}>Número de pisos</label><input type="number" min={1} max={99} className={inp} value={est.pisos} onChange={e => setEst({ ...est, pisos: Math.max(1, parseInt(e.target.value) || 1) })} /></div>
                    <div><label className={lbl}>Departamentos por piso</label><input type="number" min={1} max={30} className={inp} value={est.deptos_por_piso} onChange={e => setEst({ ...est, deptos_por_piso: Math.max(1, parseInt(e.target.value) || 1) })} /></div>
                    <div>
                      <label className={lbl}>Numeración</label>
                      <select className={inp} value={est.numeracion} onChange={e => setEst({ ...est, numeracion: e.target.value })}>
                        <option value="piso">Por piso: 101, 102… 201, 202…</option>
                        <option value="consecutiva">Seguida: 1, 2, 3, 4…</option>
                        <option value="letras">Con letras: 1A, 1B… 2A, 2B…</option>
                      </select>
                    </div>
                    <div><label className={lbl}>Subterráneos <span className="text-slate-500 font-normal">(estacionamientos/bodegas)</span></label><input type="number" min={0} max={10} className={inp} value={est.subterraneos} onChange={e => setEst({ ...est, subterraneos: Math.max(0, parseInt(e.target.value) || 0) })} /></div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                    <p className="text-[10px] font-bold tracking-widest uppercase text-slate-500 mb-3">Así quedará</p>
                    <div className="space-y-1.5">
                      {preview.map(r => (
                        <div key={r.label} className="flex items-center gap-2 border-b border-slate-800 pb-1.5 last:border-0">
                          <span className="text-[10px] font-bold text-slate-500 w-12 shrink-0">{r.label}</span>
                          <div className="flex flex-wrap gap-1">{r.units.map(u => <span key={u} className="px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-300 text-[10px] font-bold tabular-nums">{u}</span>)}</div>
                        </div>
                      ))}
                      {est.pisos > 6 && <p className="text-center text-[10px] text-slate-500 pt-1">··· {est.pisos - 6} pisos más</p>}
                      {est.subterraneos > 0 && <p className="text-[10px] text-slate-500 pt-2 border-t border-slate-800">+ {est.subterraneos} subterráneo{est.subterraneos > 1 ? 's' : ''}</p>}
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800 text-sm text-white font-bold">🏠 {totalDeptos} departamentos <span className="text-slate-500 font-normal">en {est.pisos} pisos</span></div>
                  </div>
                </div>
              )}
            </section>
          )}

          {step === 5 && (
            <section>
              <p className="text-[11px] font-bold tracking-widest uppercase text-teal-400 mb-2">Paso 5 de 5</p>
              <h2 className="text-3xl font-extrabold text-white leading-tight mb-2">¿Cómo entran los vecinos?</h2>
              <p className="text-slate-400 text-sm mb-6 max-w-lg">Cada vecino usa la app desde su teléfono con su RUT y una clave. Elige cómo los sumamos.</p>
              <div className="flex gap-1 bg-slate-900 p-1 rounded-xl mb-5">
                {([['link', '🔗 Se registran solos'], ['lista', '📋 Los cargo yo ahora']] as const).map(([v, t]) => (
                  <button key={v} type="button" onClick={() => setResTab(v)} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${resTab === v ? 'bg-slate-800 text-teal-400 shadow' : 'text-slate-400 hover:text-white'}`}>{t}</button>
                ))}
              </div>
              {resTab === 'link' ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center">
                  <div className="text-4xl mb-3">📱</div>
                  <p className="text-white font-bold mb-1">Lo más fácil</p>
                  <p className="text-slate-400 text-sm max-w-md mx-auto">Al terminar te damos un link y un QR. Lo pegas en el ascensor o lo mandas por WhatsApp. Cada vecino entra, pone su RUT, nombre, elige su {esCasas ? 'casa' : 'depto'} y listo.</p>
                  {slug?.url && <p className="mt-4 font-mono text-teal-300 text-sm">{slug.url.replace('https://', '')}/portal/registro</p>}
                </div>
              ) : (
                <div>
                  <p className="text-xs text-slate-400 mb-2">Una persona por línea: <span className="font-mono text-slate-300">RUT ; Nombre ; {esCasas ? 'N° casa' : 'Depto'}</span> — o sube un archivo CSV / Excel guardado como CSV.</p>
                  <textarea className={`${inp} font-mono text-xs min-h-[160px]`} value={resTexto} onChange={e => setResTexto(e.target.value)}
                    placeholder={`12.345.678-9 ; Ana Torres ; 101\n9.876.543-2 ; Pedro Soto ; 102`} />
                  <div className="flex items-center justify-between mt-2">
                    <button type="button" onClick={() => fileRef.current?.click()} className="text-xs text-teal-400 font-semibold hover:underline">📄 Subir archivo CSV</button>
                    <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={e => e.target.files?.[0] && leerArchivo(e.target.files[0])} />
                    <span className="text-xs text-slate-400">{residentes.length} vecino{residentes.length === 1 ? '' : 's'} listos</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-3">A cada uno le creamos una clave temporal que aparece al final. También pueden recuperarla con su RUT.</p>
                </div>
              )}
            </section>
          )}

          {step === 6 && result && (
            <section>
              <div className="text-center py-4">
                <div className="w-20 h-20 rounded-full bg-teal-500/15 flex items-center justify-center text-4xl mx-auto mb-4">🎉</div>
                <h2 className="text-2xl font-extrabold text-teal-400">{ed.nombre}</h2>
                <p className="text-slate-400 text-sm mt-1">Ya está funcionando en <a href={result.urls.sitio} target="_blank" className="font-mono text-white underline">{result.dominio}</a></p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6">
                {[[result.resumen.departamentos, esCasas ? 'Casas' : 'Departamentos'], [result.resumen.personal, 'Trabajadores'], [result.resumen.residentes, 'Vecinos cargados'], ['✓', 'Activo']].map(([v, l]) => (
                  <div key={String(l)} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
                    <div className="text-2xl font-extrabold text-teal-400 tabular-nums">{v}</div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-1">{l}</div>
                  </div>
                ))}
              </div>

              <p className="text-[10px] font-bold tracking-widest uppercase text-slate-500 mb-3">Accesos — guarda esto</p>
              <div className="space-y-2 mb-6">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-slate-800 flex items-center justify-center text-xl shrink-0">👔</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white">Administrador · {result.admin.nombre}</div>
                    <div className="text-xs text-slate-400 font-mono truncate">{result.urls.admin}</div>
                    <div className="text-xs text-slate-300 mt-1">Correo <span className="font-mono">{result.admin.email}</span> · Clave <span className="font-mono text-teal-300 font-bold">{result.admin.password}</span></div>
                  </div>
                  <Copy text={`${ed.nombre} — Panel administrador\n${result.urls.admin}\nCorreo: ${result.admin.email}\nClave: ${result.admin.password}`} />
                </div>
                {result.personal.map(p => (
                  <div key={p.email} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-slate-800 flex items-center justify-center text-xl shrink-0">🧑‍💼</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white">{CARGO_LABEL[p.cargo] || p.cargo} · {p.nombre}</div>
                      <div className="text-xs text-slate-400 font-mono truncate">{result.urls.conserje}</div>
                      <div className="text-xs text-slate-300 mt-1">Correo <span className="font-mono">{p.email}</span> · Clave <span className="font-mono text-teal-300 font-bold">{p.password}</span></div>
                    </div>
                    <Copy text={`${ed.nombre} — App conserjería\n${result.urls.conserje}\nCorreo: ${p.email}\nClave: ${p.password}`} />
                  </div>
                ))}
                <div className="bg-slate-900 border border-teal-500/40 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4">
                  <img alt="QR registro vecinos" width={120} height={120} className="rounded-lg bg-white p-1 shrink-0"
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=4&data=${encodeURIComponent(result.urls.registro)}`} />
                  <div className="flex-1 min-w-0 text-center sm:text-left">
                    <div className="text-sm font-bold text-white">📱 App de los vecinos</div>
                    <div className="text-xs text-slate-300 mt-1">Comparte este link o pega el QR en el ascensor. Cada vecino se registra con su RUT.</div>
                    <div className="text-xs text-teal-300 font-mono mt-2 break-all">{result.urls.registro}</div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Copy text={`Hola vecino/a de ${ed.nombre} 👋\nRegístrate en la app del edificio con tu RUT aquí:\n${result.urls.registro}`} />
                    <a className="px-3 py-1.5 text-xs rounded-lg font-semibold bg-slate-700 hover:bg-teal-600 text-white text-center" target="_blank"
                      href={`https://api.qrserver.com/v1/create-qr-code/?size=800x800&margin=10&data=${encodeURIComponent(result.urls.registro)}`}>QR grande</a>
                  </div>
                </div>
              </div>

              {result.residentes.length > 0 && (
                <div className="mb-6">
                  <p className="text-[10px] font-bold tracking-widest uppercase text-slate-500 mb-2">Vecinos cargados · claves temporales</p>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-slate-500 uppercase text-[10px]"><tr><th className="text-left p-3">{esCasas ? 'Casa' : 'Depto'}</th><th className="text-left p-3">Nombre</th><th className="text-left p-3">RUT</th><th className="text-left p-3">Clave</th></tr></thead>
                      <tbody>{result.residentes.map(r => <tr key={r.rut} className="border-t border-slate-800 text-slate-200"><td className="p-3 font-bold">{r.depto}</td><td className="p-3">{r.nombre}</td><td className="p-3 font-mono">{r.rut}</td><td className="p-3 font-mono text-teal-300">{r.password}</td></tr>)}</tbody>
                    </table>
                  </div>
                  <div className="mt-2 text-right"><Copy text={result.residentes.map(r => `${r.depto}\t${r.nombre}\t${r.rut}\t${r.password}`).join('\n')} /></div>
                  {result.residentes_error.length > 0 && <p className="text-xs text-amber-400 mt-2">No se pudieron cargar: {result.residentes_error.map(e => `${e.rut} (${e.motivo})`).join(', ')}</p>}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-end pt-4 border-t border-slate-800">
                <Link href="/superadmin/tenants" className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm text-center">Ver todos los condominios</Link>
                <a href={result.urls.admin} target="_blank" className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold text-center">Abrir {result.dominio} →</a>
              </div>
            </section>
          )}

          {step < 6 && (
            <div className="flex items-center justify-between mt-8 pt-5 border-t border-slate-800">
              {step > 1 ? <button type="button" onClick={prev} className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-sm">← Volver</button>
                : <Link href="/superadmin/tenants" className="text-sm text-slate-500 hover:text-slate-300">Cancelar</Link>}
              {step < 5
                ? <button type="button" onClick={next} className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold shadow-lg shadow-teal-500/20">Continuar →</button>
                : <button type="button" onClick={crear} disabled={loading} className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white text-sm font-semibold shadow-lg shadow-teal-500/20">{loading ? 'Creando…' : 'Crear condominio ✓'}</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
