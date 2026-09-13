'use client'
import { useCallback, useEffect, useState, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Phone, MessageCircle, Mail, FileText, Gift, Flame, Clock, ExternalLink, RefreshCw, Pencil, Check } from 'lucide-react'
import { vjson, clp, ETAPAS, RESULTADOS, fecha, hace, diasRestantes, telLink, waLink } from '../../lib'

const inp = 'w-full bg-white border border-[#DDE4E6] rounded-xl px-3 py-2.5 text-sm text-[#0B1F2A] focus:outline-none focus:ring-2 focus:ring-[#14B8A6]'
const Card = ({ title, icon: I, children, right }: any) => (
  <section className="bg-white border border-[#DDE4E6] rounded-2xl p-4 md:p-5"><div className="flex items-center justify-between mb-3"><h2 className="font-bold flex items-center gap-2 text-sm">{I && <I size={16} className="text-[#0F766E]" />}{title}</h2>{right}</div>{children}</section>)

export default function EdificioDetalle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const sp = useSearchParams()
  const [e, setE] = useState<any>(null)
  const [cat, setCat] = useState<any>(null)
  const [tab, setTab] = useState<'propuesta' | 'visita' | 'editar' | null>(sp.get('propuesta') ? 'propuesta' : null)
  const [msg, setMsg] = useState<{ ok: boolean; t: string; wa?: string } | null>(null)
  const [busy, setBusy] = useState(false)
  // propuesta
  const [mods, setMods] = useState<string[]>([])
  const [pu, setPu] = useState<string>('')
  const [desc, setDesc] = useState(0)
  const [gratis, setGratis] = useState(0)
  const [texto, setTexto] = useState('')
  const [conDemo, setConDemo] = useState(true)
  const [mail, setMail] = useState(true)
  const [wa, setWa] = useState(false)
  const [cot, setCot] = useState<any>(null)
  // visita
  const [res, setRes] = useState('seguimiento'); const [nota, setNota] = useState(''); const [pa, setPa] = useState(''); const [pf, setPf] = useState('')
  // editar
  const [ed, setEd] = useState<any>({})

  const load = useCallback(() => vjson(`/edificios/${id}`).then(x => { setE(x); setEd({ nombre: x.nombre, unidades: x.unidades || '', administrador_nombre: x.administrador_nombre || '', administrador_email: x.administrador_email || '', administrador_telefono: x.administrador_telefono || '', empresa_admin: x.empresa_admin || '', direccion: x.direccion || '', comuna: x.comuna || '', notas: x.notas || '' }) }).catch(err => setMsg({ ok: false, t: err.message })), [id])
  useEffect(() => { load(); vjson('/modulos').then(setCat).catch(() => {}) }, [load])
  useEffect(() => {
    if (!e?.unidades) return
    vjson('/cotizar', { method: 'POST', body: JSON.stringify({ modulos: mods, unidades: e.unidades, precio_unidad: pu ? Number(pu) : null, descuento_pct: desc }) }).then(setCot).catch(() => {})
  }, [mods, pu, desc, e?.unidades])

  async function cambiarEtapa(et: string) { setBusy(true); try { await vjson(`/edificios/${id}`, { method: 'PATCH', body: JSON.stringify({ etapa: et }) }); load() } finally { setBusy(false) } }
  async function guardarEdicion() { setBusy(true); try { await vjson(`/edificios/${id}`, { method: 'PATCH', body: JSON.stringify({ ...ed, unidades: ed.unidades ? Number(ed.unidades) : null }) }); setTab(null); load(); setMsg({ ok: true, t: 'Datos guardados' }) } catch (er: any) { setMsg({ ok: false, t: er.message }) } finally { setBusy(false) } }
  async function registrarVisita() { setBusy(true); try { await vjson(`/edificios/${id}/visitas`, { method: 'POST', body: JSON.stringify({ resultado: res, nota, proxima_accion: pa || null, proxima_fecha: pf || null }) }); setTab(null); setNota(''); load(); setMsg({ ok: true, t: 'Visita registrada' }) } catch (er: any) { setMsg({ ok: false, t: er.message }) } finally { setBusy(false) } }
  async function enviarPropuesta() {
    setBusy(true); setMsg(null)
    try {
      const r = await vjson(`/edificios/${id}/propuestas`, { method: 'POST', body: JSON.stringify({ modulos: mods, precio_unidad: pu ? Number(pu) : null, descuento_pct: desc, meses_gratis: gratis, mensaje: texto || null, con_demo: conDemo, enviar_email: mail, enviar_whatsapp: wa }) })
      const partes = [r.envio.email === 'enviado' ? 'correo enviado' : r.envio.email ? 'correo: ' + r.envio.email : null, r.envio.whatsapp === 'enviado' ? 'WhatsApp enviado' : null, r.demo ? `demo ${r.demo.dominio} listo` : null].filter(Boolean)
      setMsg({ ok: true, t: 'Propuesta creada · ' + partes.join(' · '), wa: r.envio.wa_link }); setTab(null); load()
    } catch (er: any) { setMsg({ ok: false, t: er.message }) } finally { setBusy(false) }
  }
  async function reenviar(pid: number, canal: string) { setBusy(true); try { const r = await vjson(`/propuestas/${pid}/reenviar?canal=${canal}`, { method: 'POST' }); setMsg({ ok: true, t: `Reenvío: ${r.email || ''} ${r.whatsapp || ''}`.trim(), wa: r.wa_link }); load() } catch (er: any) { setMsg({ ok: false, t: er.message }) } finally { setBusy(false) } }
  async function demoAccion(did: number, acc: 'extender' | 'convertir' | 'eliminar') {
    if (acc !== 'extender' && !confirm(acc === 'convertir' ? '¿Convertir este demo en el condominio real del cliente?' : '¿Desactivar este demo? El cliente no podrá entrar.')) return
    setBusy(true); try { const r = await vjson(`/demos/${did}/${acc}`, { method: 'POST', body: acc === 'extender' ? JSON.stringify({ dias: 5 }) : undefined }); setMsg({ ok: true, t: acc === 'extender' ? `Demo extendido hasta ${fecha(r.vence)}` : acc === 'convertir' ? '¡Cliente! ' + (r.siguiente || '') : 'Demo desactivado' }); load() } catch (er: any) { setMsg({ ok: false, t: er.message }) } finally { setBusy(false) }
  }

  if (!e) return <div className="p-8 text-sm text-[#7A8F98]">{msg?.t || 'Cargando…'}</div>
  const et = ETAPAS[e.etapa] || ETAPAS.visitado
  const demo = e.demos?.[0]; const tel = e.telemetria || demo?.telemetria
  const dol = Array.isArray(e.dolores) ? e.dolores : []
  const temp = e.temperatura

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/ventas/edificios" className="text-xs text-[#7A8F98]">← Edificios</Link>
          <h1 className="text-2xl md:text-3xl font-extrabold leading-tight flex items-center gap-2 flex-wrap">{e.nombre}{temp === 'caliente' && <span className="inline-flex items-center gap-1 text-xs font-bold bg-orange-100 text-orange-700 px-2 py-1 rounded-full"><Flame size={12} /> Caliente</span>}</h1>
          <p className="text-sm text-[#7A8F98]">{[e.direccion, e.comuna].filter(Boolean).join(', ')}{e.unidades ? ` · ${e.unidades} ${e.tipo || 'unidades'}` : ' · sin N° de unidades'}{e.empresa_admin ? ` · ${e.empresa_admin}` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={e.etapa} disabled={busy} onChange={ev => cambiarEtapa(ev.target.value)} className={`text-sm font-bold rounded-xl px-3 py-2 border-0 ${et.color}`}>{Object.entries(ETAPAS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
          <button onClick={() => setTab(tab === 'editar' ? null : 'editar')} className="w-10 h-10 rounded-xl bg-white border border-[#DDE4E6] flex items-center justify-center"><Pencil size={16} /></button>
        </div>
      </div>
      <p className="text-xs text-[#35505C] -mt-2">Siguiente paso: {et.hint}{e.proxima_accion ? ` · Agendado: ${e.proxima_accion}${e.proxima_fecha ? ' el ' + fecha(e.proxima_fecha) : ''}` : ''}</p>

      {msg && <div className={`rounded-2xl px-4 py-3 text-sm flex flex-wrap items-center gap-3 ${msg.ok ? 'bg-[#DDF4F0] text-[#0F766E]' : 'bg-rose-50 text-rose-700'}`}><span className="flex-1">{msg.t}</span>{msg.wa && <a href={msg.wa} target="_blank" rel="noreferrer" className="bg-[#25D366] text-white font-bold px-3 py-2 rounded-xl text-xs inline-flex items-center gap-1"><MessageCircle size={14} /> Mandar por mi WhatsApp</a>}</div>}

      {/* Contacto */}
      <div className="grid grid-cols-3 gap-2">
        <a href={telLink(e.administrador_telefono)} className={`bg-white border border-[#DDE4E6] rounded-2xl p-3 text-center ${!e.administrador_telefono && 'opacity-40 pointer-events-none'}`}><Phone className="mx-auto text-[#0F766E]" size={20} /><div className="text-xs font-bold mt-1 truncate">{e.administrador_nombre || 'Llamar'}</div><div className="text-[10px] text-[#7A8F98]">{e.administrador_telefono || 'sin teléfono'}</div></a>
        <a href={waLink(e.administrador_telefono, `Hola ${e.administrador_nombre || ''}, te escribe ${e.vendedor_nombre || ''} de ConectaAI Condominios.`)} target="_blank" rel="noreferrer" className={`bg-white border border-[#DDE4E6] rounded-2xl p-3 text-center ${!e.administrador_telefono && 'opacity-40 pointer-events-none'}`}><MessageCircle className="mx-auto text-[#25D366]" size={20} /><div className="text-xs font-bold mt-1">WhatsApp</div><div className="text-[10px] text-[#7A8F98]">mensaje directo</div></a>
        <a href={e.administrador_email ? `mailto:${e.administrador_email}` : undefined} className={`bg-white border border-[#DDE4E6] rounded-2xl p-3 text-center ${!e.administrador_email && 'opacity-40 pointer-events-none'}`}><Mail className="mx-auto text-blue-600" size={20} /><div className="text-xs font-bold mt-1">Correo</div><div className="text-[10px] text-[#7A8F98] truncate">{e.administrador_email || 'sin correo'}</div></a>
      </div>

      {/* Acciones */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setTab(tab === 'propuesta' ? null : 'propuesta')} className={`font-bold px-5 py-3 rounded-2xl text-sm flex items-center gap-2 ${tab === 'propuesta' ? 'bg-[#0B1F2A] text-white' : 'bg-[#0F766E] text-white'}`}><FileText size={16} /> {e.propuestas?.length ? 'Nueva propuesta' : 'Armar propuesta + demo'}</button>
        <button onClick={() => setTab(tab === 'visita' ? null : 'visita')} className="bg-white border border-[#DDE4E6] font-bold px-5 py-3 rounded-2xl text-sm">＋ Registrar visita / llamada</button>
      </div>

      {tab === 'editar' && <Card title="Editar datos" icon={Pencil} right={<button onClick={guardarEdicion} disabled={busy} className="bg-[#0F766E] text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1"><Check size={14} /> Guardar</button>}>
        <div className="grid md:grid-cols-2 gap-2">
          {[['nombre', 'Nombre'], ['unidades', 'N° unidades'], ['administrador_nombre', 'Administrador/a'], ['administrador_email', 'Correo'], ['administrador_telefono', 'WhatsApp'], ['empresa_admin', 'Empresa administradora'], ['direccion', 'Dirección'], ['comuna', 'Comuna']].map(([k, l]) => (
            <label key={k} className="block"><span className="text-[11px] font-bold uppercase text-[#7A8F98]">{l}</span><input className={inp} value={ed[k] ?? ''} onChange={ev => setEd({ ...ed, [k]: ev.target.value })} /></label>))}
          <label className="block md:col-span-2"><span className="text-[11px] font-bold uppercase text-[#7A8F98]">Notas</span><textarea className={inp + ' h-20'} value={ed.notas} onChange={ev => setEd({ ...ed, notas: ev.target.value })} /></label>
        </div></Card>}

      {tab === 'visita' && <Card title="Registrar visita o llamada" icon={Clock}>
        <div className="flex flex-wrap gap-2 mb-3">{Object.entries(RESULTADOS).map(([k, l]) => <button key={k} onClick={() => setRes(k)} className={`px-3 py-2 rounded-xl border text-sm font-semibold ${res === k ? 'bg-[#0F766E] border-[#0F766E] text-white' : 'bg-white border-[#DDE4E6] text-[#35505C]'}`}>{l}</button>)}</div>
        <textarea className={inp + ' h-20 mb-2'} placeholder="¿Qué pasó?" value={nota} onChange={ev => setNota(ev.target.value)} />
        <div className="grid grid-cols-2 gap-2 mb-3"><input className={inp} placeholder="Próxima acción" value={pa} onChange={ev => setPa(ev.target.value)} /><input type="date" className={inp} value={pf} onChange={ev => setPf(ev.target.value)} /></div>
        <button onClick={registrarVisita} disabled={busy} className="bg-[#0F766E] text-white font-bold px-5 py-3 rounded-xl text-sm">Guardar</button></Card>}

      {tab === 'propuesta' && cat && <Card title={`Propuesta para ${e.unidades || '?'} unidades`} icon={FileText}>
        {!e.unidades && <p className="text-sm text-amber-800 bg-amber-50 rounded-xl px-3 py-2 mb-3">Falta el N° de unidades: edítalo arriba (lápiz) para calcular el precio.</p>}
        {!e.administrador_email && <p className="text-sm text-amber-800 bg-amber-50 rounded-xl px-3 py-2 mb-3">Sin correo del administrador no se puede crear el demo ni enviar la propuesta.</p>}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-3">
          {cat.modulos.map((m: any) => { const on = m.base || mods.includes(m.key); return (
            <button key={m.key} type="button" disabled={m.base} onClick={() => setMods(on ? mods.filter(x => x !== m.key) : [...mods, m.key])} className={`text-left rounded-xl border-2 p-3 ${on ? 'border-[#0F766E] bg-[#DDF4F0]' : 'border-[#DDE4E6] bg-white'}`}>
              <div className="flex justify-between text-sm font-bold"><span>{m.nombre}</span><span className="text-[#0F766E]">{m.base ? 'base' : '+' + clp(m.precio)}</span></div><div className="text-[11px] text-[#7A8F98] mt-0.5">{m.detalle}</div></button>) })}
        </div>
        <div className="grid sm:grid-cols-3 gap-2 mb-3">
          <label className="block"><span className="text-[11px] font-bold uppercase text-[#7A8F98]">Precio/unidad (opcional)</span><input className={inp} inputMode="numeric" placeholder={cot ? String(cot.precio_unidad) : ''} value={pu} onChange={ev => setPu(ev.target.value.replace(/\D/g, ''))} /></label>
          <label className="block"><span className="text-[11px] font-bold uppercase text-[#7A8F98]">Descuento %</span><input className={inp} inputMode="numeric" value={desc} onChange={ev => setDesc(Math.min(50, Number(ev.target.value.replace(/\D/g, '')) || 0))} /></label>
          <label className="block"><span className="text-[11px] font-bold uppercase text-[#7A8F98]">Meses gratis</span><input className={inp} inputMode="numeric" value={gratis} onChange={ev => setGratis(Math.min(3, Number(ev.target.value.replace(/\D/g, '')) || 0))} /></label>
        </div>
        {cot && <div className="bg-[#0B1F2A] text-white rounded-2xl p-4 mb-3 flex flex-wrap items-center justify-between gap-2"><div><div className="text-2xl font-extrabold">{clp(cot.precio_unidad)} <span className="text-sm font-medium text-white/70">/ unidad / mes</span></div><div className="text-xs text-white/70">{cot.unidades} unidades · {clp(cot.total_mensual)} mensuales{desc ? ` · ${desc}% dcto` : ''}{gratis ? ` · ${gratis} mes(es) gratis` : ''} · sin implementación</div></div></div>}
        <textarea className={inp + ' h-20 mb-3'} placeholder="Mensaje personal para el correo (opcional). Ej: Gracias por recibirme hoy, te dejo el demo para que lo vea el comité el jueves." value={texto} onChange={ev => setTexto(ev.target.value)} />
        <div className="flex flex-wrap gap-4 text-sm mb-4">
          <label className="flex items-center gap-2"><input type="checkbox" checked={conDemo} onChange={ev => setConDemo(ev.target.checked)} className="w-5 h-5 accent-[#0F766E]" /> Crear demo de {cat.demo_dias} días con el nombre del edificio</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={mail} onChange={ev => setMail(ev.target.checked)} className="w-5 h-5 accent-[#0F766E]" /> Enviar por correo (PDF adjunto)</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={wa} onChange={ev => setWa(ev.target.checked)} className="w-5 h-5 accent-[#0F766E]" /> Enviar por WhatsApp automático</label>
        </div>
        <button onClick={enviarPropuesta} disabled={busy || !e.unidades} className="bg-[#D97706] disabled:opacity-50 text-white font-bold px-6 py-4 rounded-2xl text-base shadow-lg active:scale-95">{busy ? 'Creando propuesta y demo… (10 s)' : 'Generar y enviar ahora'}</button>
      </Card>}

      {/* Demos */}
      {e.demos?.length > 0 && <Card title="Demo" icon={Gift}>
        {e.demos.map((d: any) => { const est = d.estado_actual; const cr = typeof d.credenciales === 'string' ? JSON.parse(d.credenciales) : d.credenciales || {}; const dias = diasRestantes(d.vence); return (
          <div key={d.id} className="mb-3 last:mb-0">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <a href={`https://${d.dominio}/login`} target="_blank" rel="noreferrer" className="font-bold text-sm text-[#0F766E] inline-flex items-center gap-1">{d.dominio} <ExternalLink size={12} /></a>
              <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${d.estado === 'convertido' ? 'bg-emerald-100 text-emerald-800' : d.estado === 'eliminado' ? 'bg-slate-100 text-slate-500' : est?.vencido ? 'bg-rose-100 text-rose-700' : 'bg-teal-100 text-teal-800'}`}>{d.estado === 'convertido' ? 'Convertido en cliente' : d.estado === 'eliminado' ? 'Desactivado' : est?.vencido ? 'Vencido · modo vitrina' : `Activo · vence en ${dias} día${dias === 1 ? '' : 's'}`}</span>
            </div>
            <div className="grid sm:grid-cols-3 gap-2 text-xs mb-2">
              {[['Administración', cr.admin], ['Conserjería', cr.conserje], ['App vecinos', cr.residente]].map(([l, c]: any) => c && <div key={l} className="bg-slate-50 rounded-xl p-2"><b>{l}</b><div className="text-[#35505C] break-all">{c.email || c.rut} · <code>{c.password}</code></div></div>)}
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-xs">
              <b>Telemetría:</b> {d.telemetria.ingresos} ingreso(s){d.telemetria.ultimo ? ` · último ${hace(d.telemetria.ultimo)}` : ''}{d.telemetria.modulos.length ? ' · vio: ' + d.telemetria.modulos.map((m: any) => `${m.detalle} (${m.n})`).join(', ') : ' · aún no entra'}
              {d.telemetria.eventos?.length > 0 && <ul className="mt-2 space-y-0.5 max-h-32 overflow-auto">{d.telemetria.eventos.slice(0, 12).map((ev: any, i: number) => <li key={i} className="text-[#7A8F98]"><span className="tabular-nums">{new Date(ev.created_at).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span> · {ev.rol} · {ev.detalle}{ev.tipo === 'demo_accion' ? ' (modificó)' : ''}</li>)}</ul>}
            </div>
            {d.estado === 'activo' && <div className="flex flex-wrap gap-2 mt-2">
              <button onClick={() => demoAccion(d.id, 'extender')} disabled={busy} className="bg-white border border-[#DDE4E6] text-xs font-bold px-3 py-2 rounded-xl">+5 días</button>
              <button onClick={() => demoAccion(d.id, 'convertir')} disabled={busy} className="bg-emerald-600 text-white text-xs font-bold px-3 py-2 rounded-xl">Convertir en cliente</button>
              <button onClick={() => demoAccion(d.id, 'eliminar')} disabled={busy} className="text-rose-600 text-xs font-bold px-3 py-2">Desactivar</button></div>}
          </div>) })}
      </Card>}

      {/* Propuestas */}
      {e.propuestas?.length > 0 && <Card title="Propuestas" icon={FileText}>
        {e.propuestas.map((p: any) => (
          <div key={p.id} className="flex flex-wrap items-center gap-2 py-2 border-b border-[#DDE4E6] last:border-0 text-sm">
            <div className="flex-1 min-w-[200px]"><b>{clp(p.precio_unidad)}/unidad · {clp(p.total_mensual)}/mes</b><div className="text-xs text-[#7A8F98]">{fecha(p.created_at)} · {p.enviado_email ? 'correo ✓' : 'sin correo'}{p.enviado_wa ? ' · WhatsApp ✓' : ''} · {p.aperturas ? `abierta ${p.aperturas} vez/veces, primera ${hace(p.abierto_en)}` : 'aún no la abre'}</div></div>
            <a href={p.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#0F766E] bg-[#DDF4F0] px-3 py-2 rounded-xl">Ver web</a>
            <a href={p.pdf_url} target="_blank" rel="noreferrer" className="text-xs font-bold bg-white border border-[#DDE4E6] px-3 py-2 rounded-xl">PDF</a>
            <button onClick={() => reenviar(p.id, 'email')} disabled={busy} className="text-xs font-bold bg-white border border-[#DDE4E6] px-3 py-2 rounded-xl inline-flex items-center gap-1"><RefreshCw size={12} /> Reenviar correo</button>
            <button onClick={() => reenviar(p.id, 'whatsapp')} disabled={busy} className="text-xs font-bold bg-[#25D366] text-white px-3 py-2 rounded-xl">WhatsApp</button>
          </div>))}
      </Card>}

      {/* Dolores + historial */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Lo que le duele">
          {dol.length === 0 ? <p className="text-sm text-[#7A8F98]">Sin dolores registrados. Anótalos en la próxima visita: arman la propuesta.</p> :
            <ul className="space-y-2">{dol.map((k: string) => e.catalogo_dolores?.[k] && <li key={k} className="text-sm"><b>{e.catalogo_dolores[k][0]}</b><div className="text-xs text-[#35505C]">{e.catalogo_dolores[k][1]}</div></li>)}</ul>}
          {e.notas && <p className="mt-3 text-xs text-[#35505C] bg-slate-50 rounded-xl p-3 whitespace-pre-wrap">{e.notas}</p>}
        </Card>
        <Card title="Historial" icon={Clock}>
          {e.visitas.length === 0 && <p className="text-sm text-[#7A8F98]">Sin visitas.</p>}
          <ul className="space-y-2">{e.visitas.map((v: any) => <li key={v.id} className="text-sm flex gap-3"><span className="text-xs text-[#7A8F98] tabular-nums w-14 shrink-0">{fecha(v.fecha)}</span><div><b>{RESULTADOS[v.resultado] || v.resultado}</b>{v.nota && <div className="text-xs text-[#35505C]">{v.nota}</div>}<div className="text-[10px] text-[#7A8F98]">{v.vendedor_nombre}{v.lat ? ' · con GPS' : ''}</div></div></li>)}</ul>
        </Card>
      </div>
    </div>
  )
}
