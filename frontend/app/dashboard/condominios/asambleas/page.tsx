"use client"
import { useState, useEffect, useCallback } from "react"

const API = process.env.NEXT_PUBLIC_API_URL || ""

const TIPO_BADGE: Record<string, string> = {
  ordinaria: "bg-blue-100 text-blue-700",
  extraordinaria: "bg-purple-100 text-purple-700",
  emergencia: "bg-red-100 text-red-700",
}
const ESTADO_BADGE: Record<string, string> = {
  programada: "bg-slate-100 text-slate-600",
  en_curso: "bg-amber-100 text-amber-700",
  realizada: "bg-emerald-100 text-emerald-700",
  cancelada: "bg-red-100 text-red-500",
}

function quorumColor(pct: number, req: number) {
  return pct >= req ? "bg-emerald-500" : pct > req * 0.7 ? "bg-amber-500" : "bg-red-500"
}

export default function AsambleasPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showParticipantes, setShowParticipantes] = useState(false)
  const [showIniciar, setShowIniciar] = useState(false)
  const [selectedAsamblea, setSelectedAsamblea] = useState<any>(null)
  const [participantes, setParticipantes] = useState<any[]>([])
  const [ptLoading, setPtLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [estadoFilter, setEstadoFilter] = useState("")
  const [totalUnidades, setTotalUnidades] = useState("")
  const [newPt, setNewPt] = useState({ nombre: "", rut: "", tipo: "propietario", metodo: "presencial", poder_otorgado_por: "" })
  const tenantId = 1

  const [form, setForm] = useState({
    titulo: "", tipo: "ordinaria", descripcion: "",
    fecha_programada: "", quorum_requerido_pct: 50,
    link_videoconferencia: ""
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let url = `${API}/api/condominios/asambleas?tenant_id=${tenantId}`
      if (estadoFilter) url += `&estado=${estadoFilter}`
      const r = await fetch(url)
      const data = await r.json()
      setItems(Array.isArray(data) ? data : [])
    } catch {}
    setLoading(false)
  }, [tenantId, estadoFilter])

  useEffect(() => { load() }, [load])

  const stats = {
    programadas: items.filter(i => i.estado === "programada").length,
    en_curso: items.filter(i => i.estado === "en_curso").length,
    realizadas: items.filter(i => i.estado === "realizada").length,
    canceladas: items.filter(i => i.estado === "cancelada").length,
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch(`${API}/api/condominios/asambleas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, tenant_id: tenantId })
      })
      setShowModal(false)
      load()
    } catch {}
    setSaving(false)
  }

  const openParticipantes = async (a: any) => {
    setSelectedAsamblea(a)
    setPtLoading(true)
    setShowParticipantes(true)
    try {
      const r = await fetch(`${API}/api/condominios/asambleas/${a.id}/participantes`)
      const d = await r.json()
      setParticipantes(d.participantes || [])
    } catch {}
    setPtLoading(false)
    setNewPt({ nombre: "", rut: "", tipo: "propietario", metodo: "presencial", poder_otorgado_por: "" })
  }

  const addParticipante = async () => {
    if (!newPt.nombre.trim()) return
    await fetch(`${API}/api/condominios/asambleas/${selectedAsamblea.id}/participantes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newPt, tenant_id: tenantId })
    })
    openParticipantes(selectedAsamblea)
  }

  const removeParticipante = async (pid: number) => {
    await fetch(`${API}/api/condominios/asambleas/${selectedAsamblea.id}/participantes/${pid}`, { method: "DELETE" })
    openParticipantes(selectedAsamblea)
  }

  const iniciarAsamblea = async () => {
    setSaving(true)
    await fetch(`${API}/api/condominios/asambleas/${selectedAsamblea.id}/iniciar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ total_unidades: parseInt(totalUnidades) || 0 })
    })
    setSaving(false)
    setShowIniciar(false)
    load()
  }

  const cerrarAsamblea = async (a: any) => {
    if (!confirm("Cerrar la asamblea y calcular quorum?")) return
    const r = await fetch(`${API}/api/condominios/asambleas/${a.id}/cerrar`, { method: "POST" })
    const d = await r.json()
    load()
    if (d.quorum_ok) alert(`Quorum alcanzado: ${d.quorum}% (requerido: ${d.quorum_requerido}%)`)
    else alert(`Quorum NO alcanzado: ${d.quorum}% (requerido: ${d.quorum_requerido}%)`)
  }

  const deleteAsamblea = async (id: number) => {
    if (!confirm("Eliminar esta asamblea?")) return
    await fetch(`${API}/api/condominios/asambleas/${id}`, { method: "DELETE" })
    load()
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Asambleas Digitales</h1>
          <p className="text-slate-500 text-sm mt-1">Gestion de asambleas — Ley 21.442</p>
        </div>
        <button onClick={() => { setForm({ titulo: "", tipo: "ordinaria", descripcion: "", fecha_programada: "", quorum_requerido_pct: 50, link_videoconferencia: "" }); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nueva Asamblea
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Programadas", val: stats.programadas, color: "text-slate-700" },
          { label: "En Curso", val: stats.en_curso, color: "text-amber-600" },
          { label: "Realizadas", val: stats.realizadas, color: "text-emerald-600" },
          { label: "Canceladas", val: stats.canceladas, color: "text-red-500" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{s.label}</p>
            <p className={"text-3xl font-bold mt-1 " + s.color}>{s.val}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {["", "programada", "en_curso", "realizada", "cancelada"].map(e => (
          <button key={e} onClick={() => setEstadoFilter(e)}
            className={"px-4 py-2 rounded-xl text-sm font-medium transition " +
              (estadoFilter === e ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50")}>
            {e === "" ? "Todas" : e.replace("_", " ")}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">Cargando...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-slate-400">No hay asambleas registradas</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map(a => (
            <div key={a.id} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={"inline-flex px-2 py-0.5 rounded-full text-xs font-semibold " + (TIPO_BADGE[a.tipo] || "bg-slate-100 text-slate-600")}>{a.tipo}</span>
                    <span className={"inline-flex px-2 py-0.5 rounded-full text-xs font-semibold " + (ESTADO_BADGE[a.estado] || "bg-slate-100 text-slate-600")}>{a.estado?.replace("_"," ")}</span>
                  </div>
                  <h3 className="font-semibold text-slate-800 text-sm leading-tight">{a.titulo}</h3>
                  {a.fecha_programada && (
                    <p className="text-xs text-slate-400 mt-1">{new Date(a.fecha_programada).toLocaleString("es-CL")}</p>
                  )}
                </div>
              </div>
              {a.descripcion && <p className="text-xs text-slate-500 line-clamp-2">{a.descripcion}</p>}
              {a.estado === "realizada" && a.quorum_alcanzado_pct != null && (
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Quorum alcanzado</span>
                    <span className={a.quorum_alcanzado_pct >= a.quorum_requerido_pct ? "text-emerald-600 font-bold" : "text-red-500 font-bold"}>
                      {a.quorum_alcanzado_pct}% {a.quorum_alcanzado_pct >= a.quorum_requerido_pct ? "(OK)" : "(Insuficiente)"}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={"h-full rounded-full transition-all " + quorumColor(a.quorum_alcanzado_pct, a.quorum_requerido_pct)}
                      style={{ width: Math.min(100, a.quorum_alcanzado_pct) + "%" }} />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Requerido: {a.quorum_requerido_pct}% — {a.unidades_presentes}/{a.total_unidades} unidades</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {a.link_videoconferencia && (
                  <a href={a.link_videoconferencia} target="_blank"
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.868v6.264a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    Video
                  </a>
                )}
                <button onClick={() => openParticipantes(a)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200 transition">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  Participantes
                </button>
                {a.estado === "programada" && (
                  <button onClick={() => { setSelectedAsamblea(a); setTotalUnidades(""); setShowIniciar(true) }}
                    className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-200 transition">
                    Iniciar
                  </button>
                )}
                {a.estado === "en_curso" && (
                  <button onClick={() => cerrarAsamblea(a)}
                    className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-200 transition">
                    Cerrar
                  </button>
                )}
                {(a.estado === "programada" || a.estado === "cancelada") && (
                  <button onClick={() => deleteAsamblea(a.id)}
                    className="px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-medium hover:bg-red-100 transition">
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">Nueva Asamblea</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-slate-100 transition">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Titulo</label>
                <input value={form.titulo} onChange={e => setForm({...form, titulo: e.target.value})}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
                  <select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm">
                    <option value="ordinaria">Ordinaria</option>
                    <option value="extraordinaria">Extraordinaria</option>
                    <option value="emergencia">Emergencia</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Quorum requerido %</label>
                  <input type="number" value={form.quorum_requerido_pct} onChange={e => setForm({...form, quorum_requerido_pct: parseFloat(e.target.value)})}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Descripcion</label>
                <textarea value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} rows={2}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fecha programada</label>
                <input type="datetime-local" value={form.fecha_programada} onChange={e => setForm({...form, fecha_programada: e.target.value})}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Link videoconferencia (opcional)</label>
                <input value={form.link_videoconferencia} onChange={e => setForm({...form, link_videoconferencia: e.target.value})}
                  placeholder="https://meet.google.com/..." className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-slate-200">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.titulo}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50">
                {saving ? "Guardando..." : "Crear Asamblea"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showIniciar && selectedAsamblea && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-800">Iniciar Asamblea</h2>
            <p className="text-sm text-slate-600">{selectedAsamblea.titulo}</p>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Total de unidades del condominio</label>
              <input type="number" value={totalUnidades} onChange={e => setTotalUnidades(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" placeholder="Ej: 60" />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowIniciar(false)} className="px-4 py-2 border border-slate-300 rounded-xl text-sm text-slate-700 hover:bg-slate-50 transition">Cancelar</button>
              <button onClick={iniciarAsamblea} disabled={saving}
                className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 transition disabled:opacity-50">
                {saving ? "..." : "Iniciar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showParticipantes && selectedAsamblea && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Participantes</h2>
                <p className="text-xs text-slate-500">{selectedAsamblea.titulo}</p>
              </div>
              <button onClick={() => setShowParticipantes(false)} className="p-2 rounded-xl hover:bg-slate-100 transition">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {selectedAsamblea.total_unidades > 0 && (
              <div className="px-6 py-3 bg-slate-50 border-b border-slate-200">
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>{participantes.length} presentes de {selectedAsamblea.total_unidades} unidades</span>
                  <span className="font-bold">{((participantes.length / selectedAsamblea.total_unidades) * 100).toFixed(1)}% / {selectedAsamblea.quorum_requerido_pct}% requerido</span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className={"h-full rounded-full " + quorumColor(participantes.length / selectedAsamblea.total_unidades * 100, selectedAsamblea.quorum_requerido_pct)}
                    style={{ width: Math.min(100, (participantes.length / selectedAsamblea.total_unidades) * 100) + "%" }} />
                </div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-6 space-y-2">
              {ptLoading ? <p className="text-center text-slate-400 py-8">Cargando...</p> :
                participantes.length === 0 ? <p className="text-center text-slate-400 py-8">Sin participantes registrados</p> :
                participantes.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{p.nombre} <span className="text-xs text-slate-400">{p.rut}</span></p>
                      <p className="text-xs text-slate-500">{p.tipo} — {p.metodo}</p>
                    </div>
                    <button onClick={() => removeParticipante(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))
              }
            </div>
            <div className="p-6 border-t border-slate-200 bg-slate-50 space-y-3">
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Agregar Participante</h3>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Nombre" value={newPt.nombre} onChange={e => setNewPt({...newPt, nombre: e.target.value})}
                  className="border border-slate-300 rounded-xl px-3 py-2 text-sm" />
                <input placeholder="RUT" value={newPt.rut} onChange={e => setNewPt({...newPt, rut: e.target.value})}
                  className="border border-slate-300 rounded-xl px-3 py-2 text-sm" />
                <select value={newPt.tipo} onChange={e => setNewPt({...newPt, tipo: e.target.value})}
                  className="border border-slate-300 rounded-xl px-3 py-2 text-sm">
                  <option value="propietario">Propietario</option>
                  <option value="arrendatario">Arrendatario</option>
                  <option value="poder">Por poder</option>
                </select>
                <select value={newPt.metodo} onChange={e => setNewPt({...newPt, metodo: e.target.value})}
                  className="border border-slate-300 rounded-xl px-3 py-2 text-sm">
                  <option value="presencial">Presencial</option>
                  <option value="online">Online</option>
                  <option value="poder">Poder</option>
                </select>
              </div>
              <button onClick={addParticipante} disabled={!newPt.nombre.trim()}
                className="w-full py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50">
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
