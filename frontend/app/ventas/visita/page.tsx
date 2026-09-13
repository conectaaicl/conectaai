'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Mic, MicOff, Search } from 'lucide-react'
import { vjson, RESULTADOS, TIPOS } from '../lib'

const Seg = ({ opts, value, onChange, multi = false }: { opts: [string, string][]; value: any; onChange: (v: any) => void; multi?: boolean }) => (
  <div className="flex flex-wrap gap-2">{opts.map(([k, l]) => {
    const on = multi ? (value as string[]).includes(k) : value === k
    return <button type="button" key={k} onClick={() => onChange(multi ? (on ? value.filter((x: string) => x !== k) : [...value, k]) : k)}
      className={`px-4 py-2.5 rounded-xl border text-sm font-semibold transition ${on ? 'bg-[#0F766E] border-[#0F766E] text-white' : 'bg-white border-[#DDE4E6] text-[#35505C]'}`}>{l}</button>
  })}</div>)

const F = ({ label, children, full = false }: any) => <label className={`block ${full ? 'md:col-span-2' : ''}`}><span className="text-[11px] font-bold uppercase tracking-wide text-[#7A8F98]">{label}</span><div className="mt-1">{children}</div></label>
const inp = 'w-full bg-white border border-[#DDE4E6] rounded-xl px-4 py-3 text-base text-[#0B1F2A] focus:outline-none focus:ring-2 focus:ring-[#14B8A6]'

export default function NuevaVisita() {
  const router = useRouter()
  const [dolores, setDolores] = useState<Record<string, [string, string]>>({})
  const [f, setF] = useState<any>({ nombre: '', tipo: 'departamentos', direccion: '', comuna: '', unidades: '', administrador_nombre: '', administrador_email: '', administrador_telefono: '', empresa_admin: '', resultado: 'interesado', dolores: [], nota_visita: '', proxima_accion: 'Enviar propuesta + demo', proxima_fecha: new Date().toISOString().slice(0, 10) })
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsMsg, setGpsMsg] = useState('Buscando ubicación…')
  const [existentes, setExistentes] = useState<any[]>([])
  const [usar, setUsar] = useState<any>(null)
  const [rec, setRec] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const recRef = useRef<any>(null)
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }))

  useEffect(() => { vjson('/modulos').then(d => setDolores(d.dolores)).catch(() => {}) }, [])

  useEffect(() => {
    if (!navigator.geolocation) { setGpsMsg('Sin GPS en este dispositivo'); return }
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude: lat, longitude: lng } = pos.coords
      setGps({ lat, lng }); setGpsMsg(`${lat.toFixed(5)}, ${lng.toFixed(5)}`)
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=es`, { headers: { Accept: 'application/json' } })
        const d = await r.json(); const a = d.address || {}
        const calle = [a.road, a.house_number].filter(Boolean).join(' ')
        const comuna = a.city_district || a.suburb || a.town || a.city || a.municipality || ''
        setF((s: any) => ({ ...s, direccion: s.direccion || calle, comuna: s.comuna || comuna }))
        setGpsMsg(`${calle || 'Ubicación detectada'}${comuna ? ' · ' + comuna : ''}`)
      } catch { /* sin internet: queda lat/lng */ }
    }, () => setGpsMsg('No se pudo obtener la ubicación (revisa permisos)'), { enableHighAccuracy: true, timeout: 8000 })
  }, [])

  // evita duplicados: busca edificios parecidos mientras escribes
  useEffect(() => {
    if (f.nombre.length < 3 && f.direccion.length < 5) { setExistentes([]); return }
    const t = setTimeout(() => vjson(`/edificios?q=${encodeURIComponent(f.nombre.length >= 3 ? f.nombre : f.direccion)}`).then(l => setExistentes(l.slice(0, 4))).catch(() => {}), 350)
    return () => clearTimeout(t)
  }, [f.nombre, f.direccion])

  function voz() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { setErr('Este navegador no dicta por voz; escribe la nota.'); return }
    if (rec) { recRef.current?.stop(); setRec(false); return }
    const r = new SR(); r.lang = 'es-CL'; r.continuous = true; r.interimResults = false
    r.onresult = (ev: any) => { let t = ''; for (let i = ev.resultIndex; i < ev.results.length; i++) t += ev.results[i][0].transcript; set('nota_visita', (f.nota_visita ? f.nota_visita + ' ' : '') + t.trim()) }
    r.onend = () => setRec(false); r.start(); recRef.current = r; setRec(true)
  }

  async function guardar(ir: 'propuesta' | 'lista') {
    setErr('')
    if (!usar && !f.nombre.trim()) { setErr('Ponle nombre al edificio (o su dirección)'); return }
    setSaving(true)
    try {
      let id: number
      if (usar) {
        await vjson(`/edificios/${usar.id}/visitas`, { method: 'POST', body: JSON.stringify({ resultado: f.resultado, nota: f.nota_visita, lat: gps?.lat, lng: gps?.lng, proxima_accion: f.proxima_accion, proxima_fecha: f.proxima_fecha, dolores: f.dolores.length ? f.dolores : undefined }) })
        const patch: any = {}
        for (const k of ['unidades', 'administrador_nombre', 'administrador_email', 'administrador_telefono', 'empresa_admin']) if (f[k] && !usar[k]) patch[k] = k === 'unidades' ? Number(f[k]) : f[k]
        if (Object.keys(patch).length) await vjson(`/edificios/${usar.id}`, { method: 'PATCH', body: JSON.stringify(patch) })
        id = usar.id
      } else {
        const e = await vjson('/edificios', { method: 'POST', body: JSON.stringify({ ...f, unidades: f.unidades ? Number(f.unidades) : null, lat: gps?.lat, lng: gps?.lng, proxima_fecha: f.proxima_fecha || null }) })
        id = e.id
      }
      router.push(`/ventas/edificios/${id}${ir === 'propuesta' ? '?propuesta=1' : ''}`)
    } catch (e: any) { setErr(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div><p className="text-xs font-bold tracking-widest text-[#0F766E] uppercase">Nueva visita</p><h1 className="text-2xl font-extrabold">Estoy en un edificio</h1></div>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white border border-[#DDE4E6] rounded-full px-3 py-1.5 text-[#35505C]"><MapPin size={14} className={gps ? 'text-[#0F766E]' : 'text-slate-400'} />{gpsMsg}</span>
      </div>

      {existentes.length > 0 && !usar && <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-4 text-sm">
        <p className="font-semibold text-amber-900 flex items-center gap-1.5 mb-2"><Search size={14} /> ¿Es alguno de estos? Tócalo para registrar la visita ahí y no duplicar.</p>
        <div className="flex flex-wrap gap-2">{existentes.map(e => <button key={e.id} type="button" onClick={() => setUsar(e)} className="bg-white border border-amber-300 rounded-xl px-3 py-2 text-left"><b className="block text-sm">{e.nombre}</b><span className="text-xs text-[#7A8F98]">{e.direccion || ''} · {e.visitas} visita(s)</span></button>)}</div>
      </div>}
      {usar && <div className="bg-[#DDF4F0] border border-teal-200 rounded-2xl p-3 mb-4 text-sm flex items-center justify-between gap-2"><span>Registrando visita en <b>{usar.nombre}</b></span><button type="button" onClick={() => setUsar(null)} className="text-[#0F766E] font-semibold underline">Es otro edificio</button></div>}

      <div className="grid md:grid-cols-2 gap-3">
        {!usar && <>
          <F label="Edificio / condominio" full><input className={inp} placeholder="Ej: Edificio Alto Providencia" value={f.nombre} onChange={e => set('nombre', e.target.value)} /></F>
          <F label="Tipo"><Seg opts={TIPOS as any} value={f.tipo} onChange={v => set('tipo', v)} /></F>
          <F label="N° de unidades (define el precio)"><input className={inp} inputMode="numeric" placeholder="84" value={f.unidades} onChange={e => set('unidades', e.target.value.replace(/\D/g, ''))} /></F>
          <F label="Dirección"><input className={inp} value={f.direccion} onChange={e => set('direccion', e.target.value)} /></F>
          <F label="Comuna"><input className={inp} value={f.comuna} onChange={e => set('comuna', e.target.value)} /></F>
        </>}
        <F label="Administrador/a"><input className={inp} value={f.administrador_nombre} onChange={e => set('administrador_nombre', e.target.value)} placeholder={usar?.administrador_nombre || ''} /></F>
        <F label="Empresa administradora"><input className={inp} value={f.empresa_admin} onChange={e => set('empresa_admin', e.target.value)} placeholder={usar?.empresa_admin || 'Independiente'} /></F>
        <F label="Correo (a dónde llega la propuesta y el demo)"><input className={inp} type="email" inputMode="email" autoCapitalize="none" value={f.administrador_email} onChange={e => set('administrador_email', e.target.value)} placeholder={usar?.administrador_email || ''} /></F>
        <F label="WhatsApp"><input className={inp} inputMode="tel" value={f.administrador_telefono} onChange={e => set('administrador_telefono', e.target.value)} placeholder={usar?.administrador_telefono || '+56 9'} /></F>
        {usar && <F label="N° de unidades"><input className={inp} inputMode="numeric" value={f.unidades} onChange={e => set('unidades', e.target.value.replace(/\D/g, ''))} placeholder={String(usar.unidades || '')} /></F>}
        <F label="Resultado de la visita" full><Seg opts={Object.entries(RESULTADOS) as any} value={f.resultado} onChange={v => set('resultado', v)} /></F>
        <F label="Dolores que mencionó (arman la propuesta)" full><Seg multi opts={Object.entries(dolores).map(([k, v]) => [k, v[0]]) as any} value={f.dolores} onChange={v => set('dolores', v)} /></F>
        <F label="Nota" full>
          <div className="relative"><textarea className={inp + ' h-24 pr-14'} placeholder="Lo que te dijo, quién decide, cuándo es el comité…" value={f.nota_visita} onChange={e => set('nota_visita', e.target.value)} />
            <button type="button" onClick={voz} className={`absolute right-2 top-2 w-11 h-11 rounded-xl flex items-center justify-center ${rec ? 'bg-rose-600 text-white animate-pulse' : 'bg-[#DDF4F0] text-[#0F766E]'}`} title="Dictar por voz">{rec ? <MicOff size={20} /> : <Mic size={20} />}</button></div></F>
        <F label="Próxima acción"><Seg opts={[['Enviar propuesta + demo', 'Enviar propuesta + demo'], ['Llamar', 'Llamar'], ['Reunión con comité', 'Reunión con comité'], ['Volver a pasar', 'Volver a pasar']]} value={f.proxima_accion} onChange={v => set('proxima_accion', v)} /></F>
        <F label="¿Cuándo?"><input type="date" className={inp} value={f.proxima_fecha} onChange={e => set('proxima_fecha', e.target.value)} /></F>
      </div>

      {err && <p className="mt-4 text-sm text-rose-700 bg-rose-50 rounded-xl px-3 py-2">{err}</p>}
      <div className="flex flex-wrap gap-3 mt-5">
        <button disabled={saving} onClick={() => guardar('propuesta')} className="bg-[#0F766E] disabled:opacity-60 text-white font-bold px-6 py-4 rounded-2xl text-base shadow-lg shadow-teal-900/10 active:scale-95">{saving ? 'Guardando…' : 'Guardar y armar propuesta →'}</button>
        <button disabled={saving} onClick={() => guardar('lista')} className="bg-white border border-[#DDE4E6] text-[#0B1F2A] font-bold px-6 py-4 rounded-2xl text-base">Solo guardar la visita</button>
      </div>
    </div>
  )
}
