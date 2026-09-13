'use client'
import { useCallback, useEffect, useState } from 'react'

interface Vehiculo { id: number; departamento_id: number | null; depto_numero: string | null; persona_nombre: string | null; patente: string; marca?: string | null; modelo?: string | null; color?: string | null; tipo: string; estacionamiento?: string | null; estado: string; registrado_por: string; created_at: string }
interface Depto { id: number; numero: string }
interface Puerta { id: number; nombre: string; tipo?: string; ubicacion?: string; webhook_url?: string | null }

const inp = 'w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600'
const EST: Record<string, string> = { aprobado: 'bg-emerald-100 text-emerald-700', pendiente: 'bg-amber-100 text-amber-700', bloqueado: 'bg-red-100 text-red-700' }

export default function VehiculosPage() {
  const [items, setItems] = useState<Vehiculo[]>([])
  const [deptos, setDeptos] = useState<Depto[]>([])
  const [puertas, setPuertas] = useState<Puerta[]>([])
  const [q, setQ] = useState('')
  const [show, setShow] = useState(false)
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({ patente: '', departamento_id: '', persona_nombre: '', marca: '', modelo: '', color: '', tipo: 'residente', estacionamiento: '' })
  const [conectar, setConectar] = useState<Puerta | null>(null)
  const [secret, setSecret] = useState('')
  const [pruebaPat, setPruebaPat] = useState('')
  const [pruebaRes, setPruebaRes] = useState('')

  const load = useCallback(async () => {
    const r = await fetch('/api/vehiculos' + (q ? `?q=${encodeURIComponent(q)}` : ''), { credentials: 'include' })
    setItems(r.ok ? await r.json() : [])
  }, [q])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    fetch('/api/condominios/departamentos', { credentials: 'include' }).then(r => r.ok ? r.json() : []).then(d => setDeptos(Array.isArray(d) ? d : [])).catch(() => {})
    fetch('/api/condominios/puertas', { credentials: 'include' }).then(r => r.ok ? r.json() : []).then(d => setPuertas(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  async function crear(e: React.FormEvent) {
    e.preventDefault(); setMsg('')
    const r = await fetch('/api/vehiculos', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, departamento_id: form.departamento_id ? Number(form.departamento_id) : null }) })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { setMsg(d.detail || 'No se pudo guardar'); return }
    setShow(false); setForm({ patente: '', departamento_id: '', persona_nombre: '', marca: '', modelo: '', color: '', tipo: 'residente', estacionamiento: '' }); load()
  }
  async function accion(id: number, a: 'aprobar' | 'bloquear' | 'eliminar') {
    if (a === 'eliminar') { await fetch('/api/vehiculos/' + id, { method: 'DELETE', credentials: 'include' }) }
    else { await fetch(`/api/vehiculos/${id}/${a}`, { method: 'PATCH', credentials: 'include' }) }
    load()
  }
  async function generarSecreto(p: Puerta) {
    const r = await fetch(`/api/condominios/puertas/${p.id}/generar-secreto`, { method: 'POST', credentials: 'include' })
    const d = await r.json().catch(() => ({})); if (r.ok) setSecret(d.secret)
  }
  async function probar() {
    if (!conectar || !secret) return
    setPruebaRes('…')
    const r = await fetch(`/api/condominios/puertas/${conectar.id}/evento`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Device-Secret': secret }, body: JSON.stringify({ tipo: 'patente', patente: pruebaPat }) })
    const d = await r.json().catch(() => ({}))
    setPruebaRes(r.ok ? (d.autorizado ? `✅ Autorizada → portón "${d.puerta}" abierto (Depto ${d.depto})` : `⛔ Denegada: ${d.motivo}`) : (d.detail || 'Error'))
  }

  const pendientes = items.filter(v => v.estado === 'pendiente')
  const base = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vehículos y lector de patentes</h1>
          <p className="text-sm text-gray-500">Patentes autorizadas por departamento. La cámara del portón las lee y abre sola.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setConectar(puertas[0] || null)} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50">📷 Conectar cámara / citófono</button>
          <button onClick={() => setShow(true)} className="px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-sm font-semibold">+ Registrar patente</button>
        </div>
      </div>

      {pendientes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h2 className="font-semibold text-gray-900 mb-2">Patentes por aprobar <span className="ml-1 inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-full bg-amber-500 text-white text-xs font-bold">{pendientes.length}</span> <span className="text-xs font-normal text-gray-500">— inscritas por los vecinos desde su app</span></h2>
          <div className="grid gap-2 md:grid-cols-2">
            {pendientes.map(v => (
              <div key={v.id} className="bg-white border border-amber-200 rounded-lg p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0"><p className="font-bold text-gray-900 font-mono">{v.patente}</p><p className="text-xs text-gray-600">Depto {v.depto_numero} · {v.persona_nombre}{v.marca ? ` · ${v.marca} ${v.modelo || ''} ${v.color || ''}` : ''}</p></div>
                <button onClick={() => accion(v.id, 'eliminar')} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-700">Rechazar</button>
                <button onClick={() => accion(v.id, 'aprobar')} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white">Aprobar</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-semibold text-gray-900">Patentes registradas <span className="text-gray-400 font-normal text-sm">({items.length})</span></h2>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar patente, depto o nombre" className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-64 text-gray-800" />
        </div>
        {items.length === 0 ? <p className="text-sm text-gray-500 py-8 text-center">Aún no hay patentes. Regístralas aquí o pide a los vecinos que las inscriban desde su app (Vehículos).</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50"><tr><th className="text-left px-3 py-2">Patente</th><th className="text-left px-3 py-2">Depto</th><th className="text-left px-3 py-2">Persona</th><th className="text-left px-3 py-2">Vehículo</th><th className="text-left px-3 py-2">Tipo</th><th className="text-left px-3 py-2">Estac.</th><th className="text-left px-3 py-2">Estado</th><th className="px-3 py-2"></th></tr></thead>
              <tbody>
                {items.map(v => (
                  <tr key={v.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-mono font-bold text-gray-900">{v.patente}</td>
                    <td className="px-3 py-2 text-gray-800">{v.depto_numero || '—'}</td>
                    <td className="px-3 py-2 text-gray-800">{v.persona_nombre || '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{[v.marca, v.modelo, v.color].filter(Boolean).join(' ') || '—'}</td>
                    <td className="px-3 py-2 text-gray-600 capitalize">{v.tipo}</td>
                    <td className="px-3 py-2 text-gray-600">{v.estacionamiento || '—'}</td>
                    <td className="px-3 py-2"><span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${EST[v.estado] || 'bg-gray-100 text-gray-600'}`}>{v.estado}</span></td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {v.estado !== 'aprobado' && <button onClick={() => accion(v.id, 'aprobar')} className="text-xs text-emerald-700 font-semibold mr-2">Aprobar</button>}
                      {v.estado === 'aprobado' && <button onClick={() => accion(v.id, 'bloquear')} className="text-xs text-amber-700 font-semibold mr-2">Bloquear</button>}
                      <button onClick={() => accion(v.id, 'eliminar')} className="text-xs text-red-600">Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {show && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShow(false)}>
          <form onSubmit={crear} onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-6 w-full max-w-md space-y-3 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">Registrar patente</h3>
            {msg && <p className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{msg}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-semibold text-gray-600">Patente *</label><input className={inp + ' font-mono uppercase'} placeholder="ABCD12" value={form.patente} onChange={e => setForm({ ...form, patente: e.target.value.toUpperCase() })} required /></div>
              <div><label className="text-xs font-semibold text-gray-600">Departamento</label>
                <select className={inp} value={form.departamento_id} onChange={e => setForm({ ...form, departamento_id: e.target.value })}><option value="">Sin depto (proveedor/visita)</option>{deptos.map(d => <option key={d.id} value={d.id}>{d.numero}</option>)}</select></div>
            </div>
            <div><label className="text-xs font-semibold text-gray-600">Persona / conductor</label><input className={inp} placeholder="Se toma del depto si lo dejas vacío" value={form.persona_nombre} onChange={e => setForm({ ...form, persona_nombre: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <input className={inp} placeholder="Marca" value={form.marca} onChange={e => setForm({ ...form, marca: e.target.value })} />
              <input className={inp} placeholder="Modelo" value={form.modelo} onChange={e => setForm({ ...form, modelo: e.target.value })} />
              <input className={inp} placeholder="Color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-semibold text-gray-600">Tipo</label><select className={inp} value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}><option value="residente">Residente</option><option value="propietario">Propietario</option><option value="visita">Visita frecuente</option><option value="proveedor">Proveedor</option></select></div>
              <div><label className="text-xs font-semibold text-gray-600">Estacionamiento</label><input className={inp} placeholder="E-12" value={form.estacionamiento} onChange={e => setForm({ ...form, estacionamiento: e.target.value })} /></div>
            </div>
            <div className="flex gap-2 pt-1"><button type="button" onClick={() => setShow(false)} className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm">Cancelar</button><button type="submit" className="flex-1 py-2 rounded-xl bg-teal-700 text-white text-sm font-semibold">Guardar</button></div>
          </form>
        </div>
      )}

      {conectar !== null && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setConectar(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900">Conectar hardware a una puerta</h3>
            <p className="text-sm text-gray-600">Cada puerta tiene su propio <b>secreto</b>. El citófono, el controlador o la cámara lectora de patentes envían sus eventos a la dirección de <b>esa</b> puerta, así conserjería sabe exactamente dónde tocaron o qué portón se abrió.</p>
            {puertas.length === 0 ? <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3">Primero crea las puertas en <b>Seguridad y Acceso → Puertas y Accesos</b> (ej: "Puerta principal", "Portón visitas", "Portón estacionamiento").</p> : (
              <>
                <div className="flex gap-2 flex-wrap">{puertas.map(p => <button key={p.id} onClick={() => { setConectar(p); setSecret(''); setPruebaRes('') }} className={`px-3 py-1.5 rounded-lg text-sm border ${conectar?.id === p.id ? 'border-teal-600 bg-teal-50 text-teal-800 font-semibold' : 'border-gray-200 text-gray-700'}`}>{p.nombre}</button>)}</div>
                {conectar && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2"><button onClick={() => generarSecreto(conectar)} className="px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-semibold">{secret ? 'Rotar secreto' : 'Generar secreto para esta puerta'}</button>{secret && <code className="text-xs bg-gray-100 px-2 py-1 rounded">{secret}</code>}</div>
                    <div className="bg-gray-900 text-gray-100 rounded-xl p-4 text-xs font-mono space-y-2 overflow-x-auto">
                      <p className="text-gray-400"># Citófono / botón del portón (tocaron el timbre)</p>
                      <p>POST {base}/api/condominios/puertas/{conectar.id}/evento<br />Header: X-Device-Secret: {secret || '<secreto>'}<br />Body: {'{"tipo":"timbre"}'}</p>
                      <p className="text-gray-400 pt-2"># Cámara lectora de patentes (Hikvision/Dahua/ESP32-CAM + ALPR)</p>
                      <p>POST … /evento &nbsp; Body: {'{"tipo":"patente","patente":"ABCD12"}'} → responde {'{"accion":"abrir"|"denegar"}'}</p>
                      <p className="text-gray-400 pt-2"># Dispositivos simples (solo GET)</p>
                      <p>GET {base}/api/condominios/puertas/{conectar.id}/evento?secret={secret || '<secreto>'}&tipo=timbre</p>
                    </div>
                    <p className="text-xs text-gray-500">Para <b>abrir</b> el portón cuando la patente es autorizada, configura además el "Webhook URL del controlador" en la puerta (Puertas y Accesos): el sistema le envía <code>{'{"accion":"abrir"}'}</code>.</p>
                    <div className="border border-gray-200 rounded-xl p-3">
                      <p className="text-xs font-semibold text-gray-700 mb-2">Probar ahora (simula la cámara)</p>
                      <div className="flex gap-2"><input className={inp + ' font-mono uppercase max-w-[180px]'} placeholder="ABCD12" value={pruebaPat} onChange={e => setPruebaPat(e.target.value.toUpperCase())} /><button onClick={probar} disabled={!secret} className="px-3 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold disabled:opacity-50">Simular lectura</button></div>
                      {pruebaRes && <p className="text-sm mt-2 text-gray-800">{pruebaRes}</p>}
                      {!secret && <p className="text-[11px] text-gray-400 mt-1">Genera el secreto primero.</p>}
                    </div>
                  </div>
                )}
              </>
            )}
            <div className="text-right"><button onClick={() => setConectar(null)} className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm">Cerrar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
