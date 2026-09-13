'use client'
import { useEffect, useState, use } from 'react'

const clp = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-CL')

export default function PropuestaPublica({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [d, setD] = useState<any>(null)
  const [err, setErr] = useState('')
  useEffect(() => { fetch(`/api/ventas-terreno/p/${token}`).then(async r => { if (!r.ok) throw new Error('Propuesta no encontrada'); return r.json() }).then(x => { if (x.redirect) { location.replace(x.redirect); return } setD(x) }).catch(e => setErr(e.message)) }, [token])

  if (err) return <div className="min-h-screen flex items-center justify-center text-slate-600">{err}</div>
  if (!d) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-[#0F766E] border-t-transparent rounded-full animate-spin" /></div>
  const e = d.edificio; const c = d.credenciales; const wa = `${d.wa}?text=${encodeURIComponent(`Hola ${d.vendedor?.nombre || ''}, vi la propuesta para ${e.nombre} y quiero conversar.`)}`

  return (
    <div className="min-h-screen bg-[#F3F6F5] text-[#0B1F2A]">
      <div className="bg-[#0B1F2A] text-white">
        <div className="max-w-3xl mx-auto px-5 pt-10 pb-12">
          <p className="text-[11px] font-bold tracking-[.14em] uppercase text-[#7FD1C6]">Propuesta comercial · {d.marca}</p>
          <h1 className="text-3xl md:text-5xl font-extrabold mt-2 leading-tight">{e.nombre}</h1>
          <p className="text-white/70 mt-2">{[e.unidades ? `${e.unidades} unidades` : null, e.tipo, e.comuna].filter(Boolean).join(' · ')}</p>
          {d.mensaje && <p className="mt-6 text-white/90 text-lg leading-relaxed max-w-2xl">“{d.mensaje}”</p>}
          <p className="mt-4 text-sm text-white/60">— {d.vendedor?.nombre}, {d.marca}</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 -mt-6 space-y-5 pb-16">
        <div className="bg-white rounded-3xl border border-[#DDE4E6] shadow-xl p-6 flex flex-wrap items-center justify-between gap-4">
          <div><div className="text-3xl font-extrabold">{clp(d.precio_unidad)} <span className="text-base font-medium text-[#7A8F98]">por unidad / mes</span></div>
            <div className="text-sm text-[#35505C]">{d.unidades} unidades · <b>{clp(d.total_mensual)} mensuales</b> · implementación $0 · sin permanencia{d.descuento_pct ? ` · ${d.descuento_pct}% de descuento` : ''}{d.meses_gratis ? ` · ${d.meses_gratis} mes(es) gratis` : ''}</div></div>
          <div className="flex gap-2"><a href={d.pdf_url} className="bg-white border border-[#DDE4E6] font-bold px-4 py-3 rounded-xl text-sm">Descargar PDF</a><a href={wa} target="_blank" rel="noreferrer" className="bg-[#0F766E] text-white font-bold px-4 py-3 rounded-xl text-sm">Conversemos</a></div>
        </div>

        {c && d.demo && <section className="bg-white rounded-3xl border-2 border-[#0F766E] p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1"><h2 className="text-xl font-extrabold">Tu demo en vivo</h2><span className={`text-xs font-bold px-3 py-1 rounded-full ${d.demo.vencido ? 'bg-rose-100 text-rose-700' : 'bg-[#DDF4F0] text-[#0F766E]'}`}>{d.demo.vencido ? 'Finalizado · solo lectura' : `Activo · ${d.demo.dias_restantes} día${d.demo.dias_restantes === 1 ? '' : 's'} restantes`}</span></div>
          <p className="text-sm text-[#35505C] mb-4">Una copia completa del sistema con el nombre de <b>{e.nombre}</b> y datos de muestra. Entra con cualquiera de los tres perfiles y toca todo: nada de lo que hagas afecta a nadie.</p>
          <div className="grid md:grid-cols-3 gap-3">
            {[['Administración', c.admin, '👩‍💼'], ['Conserjería', c.conserje, '🛎️'], ['App de vecinos', c.residente, '🏠']].map(([l, cr, ic]: any) => cr && (
              <a key={l} href={cr.url} target="_blank" rel="noreferrer" className="block bg-[#F3F6F5] rounded-2xl p-4 border border-[#DDE4E6] hover:border-[#0F766E]">
                <div className="text-2xl">{ic}</div><b className="block mt-1">{l}</b>
                <div className="text-xs text-[#35505C] mt-1 break-all">{cr.rut ? 'RUT ' + cr.rut : cr.email}</div>
                <div className="text-xs text-[#35505C]">Clave <code className="bg-white px-1.5 py-0.5 rounded border border-[#DDE4E6] font-bold">{cr.password}</code></div>
                <div className="text-xs font-bold text-[#0F766E] mt-2">Entrar →</div></a>))}
          </div>
          <p className="text-[11px] text-[#7A8F98] mt-3">Las claves son personales y están ligadas a tu correo. Al terminar el plazo podrás seguir viendo el sistema, pero no modificarlo.</p>
        </section>}

        {d.dolores?.length > 0 && <section className="bg-white rounded-3xl border border-[#DDE4E6] p-6">
          <p className="text-[11px] font-bold tracking-[.12em] uppercase text-[#0F766E]">Lo que nos contaste</p><h2 className="text-xl font-extrabold mb-4">Tus prioridades y cómo las resolvemos</h2>
          <div className="space-y-3">{d.dolores.map((x: any) => <div key={x.key} className="bg-[#DDF4F0] rounded-2xl p-4"><b>{x.titulo}</b><p className="text-sm text-[#35505C] mt-1">{x.solucion}</p></div>)}</div>
        </section>}

        <section className="bg-white rounded-3xl border border-[#DDE4E6] p-6">
          <p className="text-[11px] font-bold tracking-[.12em] uppercase text-[#0F766E]">Qué incluye</p><h2 className="text-xl font-extrabold mb-4">Tres aplicaciones, una sola base</h2>
          <div className="grid md:grid-cols-3 gap-3 text-sm">
            <div className="bg-[#0B1F2A] text-white rounded-2xl p-4"><b>Administración</b><p className="text-white/75 mt-1 text-xs">Gastos comunes por unidad, morosidad y convenios, finanzas y presupuesto, visitas por aprobar, reservas, votaciones, mantenciones QR, vehículos y TAG.</p></div>
            <div className="bg-[#0F766E] text-white rounded-2xl p-4"><b>Conserjería</b><p className="text-white/75 mt-1 text-xs">Panel táctil: central en vivo, visitas y encomiendas, aprobación con clave, reservas, incidencias, escaneo de QR de invitados.</p></div>
            <div className="bg-[#2563EB] text-white rounded-2xl p-4"><b>Vecinos</b><p className="text-white/75 mt-1 text-xs">App instalable: estado de cuenta, invitaciones QR de un solo uso ligadas al celular del visitante, encomiendas, reservas, votaciones, convenio de pago.</p></div>
          </div>
          <div className="mt-5 divide-y divide-[#DDE4E6]">{d.modulos.map((m: any) => <div key={m.key} className="flex justify-between py-2 text-sm"><div><b>{m.nombre}</b><div className="text-xs text-[#7A8F98]">{m.detalle}</div></div><span className="text-[#0F766E] font-bold shrink-0">{m.base && d.modulos.length === 1 ? 'incluido' : clp(m.precio)}</span></div>)}</div>
          <p className="text-xs text-[#7A8F98] mt-3">Incluye hosting en servidor propio, respaldos, soporte por WhatsApp y capacitación. Hardware (RFID, TAG UHF, cámara LPR, facial) se cotiza aparte. Valores en CLP, IVA incluido.</p>
        </section>

        <section className="bg-white rounded-3xl border border-[#DDE4E6] p-6 text-center">
          <h2 className="text-xl font-extrabold">Operativo en menos de una semana</h2>
          <p className="text-sm text-[#35505C] mt-1">Cargamos tus unidades y vecinos, capacitamos al conserje en 30 minutos y entregamos las claves de la app. Sin obras, sin permanencia.</p>
          <a href={wa} target="_blank" rel="noreferrer" className="inline-block mt-4 bg-[#0F766E] text-white font-bold px-6 py-3.5 rounded-2xl">Agendar 20 minutos con {d.vendedor?.nombre?.split(' ')[0] || 'nosotros'}</a>
          <p className="text-[11px] text-[#7A8F98] mt-3">{d.vendedor?.nombre} · {d.vendedor?.telefono} · {d.vendedor?.email}</p>
        </section>
      </div>
    </div>
  )
}
