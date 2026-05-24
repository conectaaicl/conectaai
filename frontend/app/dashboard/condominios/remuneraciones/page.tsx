"use client"
import { useState, useEffect, useCallback } from "react"

const API = process.env.NEXT_PUBLIC_API_URL || ""

function formatCLP(n: number | undefined | null) {
  if (!n && n !== 0) return "-"
  return "$" + Math.round(n).toLocaleString("es-CL")
}

const AFP_OPTIONS = [
  { label: "Capital", value: "capital", tasa: 11.44 },
  { label: "Cuprum", value: "cuprum", tasa: 11.44 },
  { label: "Habitat", value: "habitat", tasa: 11.27 },
  { label: "Modelo", value: "modelo", tasa: 10.58 },
  { label: "Planvital", value: "planvital", tasa: 11.16 },
  { label: "Provida", value: "provida", tasa: 11.45 },
  { label: "Uno", value: "uno", tasa: 10.49 },
]

const ESTADO_BADGE: Record<string, string> = {
  borrador: "bg-slate-100 text-slate-600",
  aprobado: "bg-blue-100 text-blue-700",
  pagado: "bg-emerald-100 text-emerald-700",
}

interface Calc {
  total_haberes?: number
  sueldo_imponible?: number
  afp_monto?: number
  salud_monto?: number
  cesantia_trabajador?: number
  cesantia_empleador?: number
  impuesto_unico?: number
  total_descuentos?: number
  liquido_pagar?: number
}

export default function RemuneracionesPage() {
  const [items, setItems] = useState<any[]>([])
  const [stats, setStats] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [periodo, setPeriodo] = useState("")
  const [estado, setEstado] = useState("")
  const [calc, setCalc] = useState<Calc>({})
  const [calcLoading, setCalcLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const tenantId = 1

  const defaultForm = {
    rut_trabajador: "", nombre_trabajador: "", cargo: "",
    periodo: new Date().toISOString().slice(0, 7),
    sueldo_base: "", gratificacion: "", horas_extra: 0, horas_extra_monto: "",
    bono_colacion: "", bono_movilizacion: "", otros_haberes: "",
    afp_nombre: "habitat", afp_tasa: 11.27,
    salud_tipo: "fonasa", salud_nombre: "", salud_tasa: 7.0,
    otros_descuentos: "", observaciones: "", estado: "borrador"
  }
  const [form, setForm] = useState<any>(defaultForm)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let url = `${API}/api/condominios/remuneraciones?tenant_id=${tenantId}`
      if (periodo) url += `&periodo=${periodo}`
      if (estado) url += `&estado=${estado}`
      const [r, s] = await Promise.all([
        fetch(url).then(r => r.json()),
        fetch(`${API}/api/condominios/remuneraciones/stats?tenant_id=${tenantId}${periodo ? "&periodo=" + periodo : ""}`).then(r => r.json())
      ])
      setItems(Array.isArray(r) ? r : [])
      setStats(s)
    } catch {}
    setLoading(false)
  }, [tenantId, periodo, estado])

  useEffect(() => { load() }, [load])

  const runCalc = useCallback(async (f: any) => {
    setCalcLoading(true)
    try {
      const r = await fetch(`${API}/api/condominios/remuneraciones/calcular`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f)
      })
      const data = await r.json()
      setCalc(data)
    } catch {}
    setCalcLoading(false)
  }, [])

  const handleFormChange = (key: string, value: any) => {
    const updated = { ...form, [key]: value }
    if (key === "afp_nombre") {
      const afp = AFP_OPTIONS.find(a => a.value === value)
      if (afp) updated.afp_tasa = afp.tasa
    }
    setForm(updated)
    runCalc(updated)
  }

  const openNew = () => {
    setEditing(null)
    setCalc({})
    setForm(defaultForm)
    setShowModal(true)
  }

  const openEdit = (item: any) => {
    setEditing(item)
    setForm({ ...item })
    setCalc({
      total_haberes: item.total_haberes,
      sueldo_imponible: item.sueldo_imponible,
      afp_monto: item.afp_monto,
      salud_monto: item.salud_monto,
      cesantia_trabajador: item.cesantia_trabajador,
      cesantia_empleador: item.cesantia_empleador,
      impuesto_unico: item.impuesto_unico,
      total_descuentos: item.total_descuentos,
      liquido_pagar: item.liquido_pagar
    })
    setShowModal(true)
  }

  const handleSave = async (estadoOverride?: string) => {
    setSaving(true)
    try {
      const payload = { ...form, tenant_id: tenantId, ...(estadoOverride ? { estado: estadoOverride } : {}) }
      const url = editing
        ? `${API}/api/condominios/remuneraciones/${editing.id}`
        : `${API}/api/condominios/remuneraciones`
      await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      setShowModal(false)
      load()
    } catch {}
    setSaving(false)
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Eliminar esta liquidacion?")) return
    await fetch(`${API}/api/condominios/remuneraciones/${id}`, { method: "DELETE" })
    load()
  }

  const handleEstado = async (id: number, nuevoEstado: string) => {
    await fetch(`${API}/api/condominios/remuneraciones/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: nuevoEstado })
    })
    load()
  }

  const exportPrevired = () => {
    if (!periodo) { alert("Selecciona un periodo para exportar Previred"); return }
    window.open(`${API}/api/condominios/remuneraciones/previred/${periodo}?tenant_id=${tenantId}`)
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Remuneraciones</h1>
          <p className="text-slate-500 text-sm mt-1">Liquidaciones de sueldo y exportacion Previred</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportPrevired} className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Exportar Previred
          </button>
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Nueva Liquidacion
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total", val: stats.total || 0, color: "text-slate-800" },
          { label: "Pagadas", val: stats.pagadas || 0, color: "text-emerald-600" },
          { label: "Pendientes", val: stats.pendientes || 0, color: "text-amber-600" },
          { label: "Monto Total", val: formatCLP(stats.monto_total), color: "text-indigo-600" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{s.label}</p>
            <p className={"text-2xl font-bold mt-1 " + s.color}>{s.val}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)}
          className="border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <select value={estado} onChange={e => setEstado(e.target.value)}
          className="border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">Todos los estados</option>
          <option value="borrador">Borrador</option>
          <option value="aprobado">Aprobado</option>
          <option value="pagado">Pagado</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {["Trabajador","RUT","Periodo","Sueldo Base","Total Haberes","Descuentos","Liquido","Estado",""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={9} className="text-center py-10 text-slate-400">Cargando...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-10 text-slate-400">No hay liquidaciones</td></tr>
              ) : items.map(item => (
                <tr key={item.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3 font-medium text-slate-800">{item.nombre_trabajador}<div className="text-xs text-slate-400">{item.cargo}</div></td>
                  <td className="px-4 py-3 text-slate-600 font-mono text-xs">{item.rut_trabajador}</td>
                  <td className="px-4 py-3 text-slate-600">{item.periodo}</td>
                  <td className="px-4 py-3 text-slate-600">{formatCLP(item.sueldo_base)}</td>
                  <td className="px-4 py-3 text-slate-700 font-medium">{formatCLP(item.total_haberes)}</td>
                  <td className="px-4 py-3 text-red-600">{formatCLP(item.total_descuentos)}</td>
                  <td className="px-4 py-3 font-bold text-emerald-700">{formatCLP(item.liquido_pagar)}</td>
                  <td className="px-4 py-3">
                    <span className={"inline-flex px-2 py-1 rounded-full text-xs font-semibold " + (ESTADO_BADGE[item.estado] || "bg-slate-100 text-slate-600")}>
                      {item.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      {item.estado === "borrador" && (
                        <button onClick={() => handleEstado(item.id, "aprobado")} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                      )}
                      {item.estado === "aprobado" && (
                        <button onClick={() => handleEstado(item.id, "pagado")} className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-500 transition">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        </button>
                      )}
                      <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-4">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">{editing ? "Editar Liquidacion" : "Nueva Liquidacion"}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-slate-100 transition">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
              <div>
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">1. Trabajador</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">RUT</label>
                    <input value={form.rut_trabajador} onChange={e => handleFormChange("rut_trabajador", e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" placeholder="12.345.678-9" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Nombre completo</label>
                    <input value={form.nombre_trabajador} onChange={e => handleFormChange("nombre_trabajador", e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Cargo</label>
                    <input value={form.cargo} onChange={e => handleFormChange("cargo", e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Periodo</label>
                    <input type="month" value={form.periodo} onChange={e => handleFormChange("periodo", e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">2. Haberes</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[
                    { label: "Sueldo Base", key: "sueldo_base" },
                    { label: "Gratificacion", key: "gratificacion" },
                    { label: "Horas Extra Monto", key: "horas_extra_monto" },
                    { label: "Bono Colacion", key: "bono_colacion" },
                    { label: "Bono Movilizacion", key: "bono_movilizacion" },
                    { label: "Otros Haberes", key: "otros_haberes" },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                      <input type="number" value={form[f.key]} onChange={e => handleFormChange(f.key, e.target.value)}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" placeholder="0" />
                    </div>
                  ))}
                </div>
                {calc.total_haberes != null && (
                  <div className="mt-3 p-3 bg-slate-50 rounded-xl text-sm">
                    <span className="text-slate-600">Total Haberes: </span>
                    <span className="font-bold text-slate-800">{formatCLP(calc.total_haberes)}</span>
                    <span className="text-slate-400 ml-3">Imponible: {formatCLP(calc.sueldo_imponible)}</span>
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">3. Prevision</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">AFP</label>
                    <select value={form.afp_nombre} onChange={e => handleFormChange("afp_nombre", e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm">
                      {AFP_OPTIONS.map(a => <option key={a.value} value={a.value}>{a.label} ({a.tasa}%)</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Tasa AFP %</label>
                    <input type="number" step="0.01" value={form.afp_tasa} onChange={e => handleFormChange("afp_tasa", e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Salud</label>
                    <select value={form.salud_tipo} onChange={e => handleFormChange("salud_tipo", e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm">
                      <option value="fonasa">Fonasa (7%)</option>
                      <option value="isapre">Isapre</option>
                    </select>
                  </div>
                  {form.salud_tipo === "isapre" && (
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Nombre Isapre</label>
                      <input value={form.salud_nombre} onChange={e => handleFormChange("salud_nombre", e.target.value)}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Tasa Salud %</label>
                    <input type="number" step="0.01" value={form.salud_tasa} onChange={e => handleFormChange("salud_tasa", e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Otros Descuentos</label>
                    <input type="number" value={form.otros_descuentos} onChange={e => handleFormChange("otros_descuentos", e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" placeholder="0" />
                  </div>
                </div>
              </div>
              {calc.liquido_pagar != null && (
                <div className="bg-slate-900 text-white rounded-2xl p-5">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Resumen Liquidacion</h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                    <div className="flex justify-between text-slate-300"><span>AFP {form.afp_nombre}</span><span>{formatCLP(calc.afp_monto)}</span></div>
                    <div className="flex justify-between text-slate-300"><span>Salud</span><span>{formatCLP(calc.salud_monto)}</span></div>
                    <div className="flex justify-between text-slate-300"><span>Cesantia Trabajador</span><span>{formatCLP(calc.cesantia_trabajador)}</span></div>
                    <div className="flex justify-between text-slate-300"><span>Cesantia Empleador</span><span>{formatCLP(calc.cesantia_empleador)}</span></div>
                    <div className="flex justify-between text-slate-300"><span>Impuesto Unico</span><span>{formatCLP(calc.impuesto_unico)}</span></div>
                    <div className="flex justify-between text-red-400 font-semibold"><span>Total Descuentos</span><span>{formatCLP(calc.total_descuentos)}</span></div>
                  </div>
                  <div className="border-t border-slate-700 pt-3 mt-3 flex justify-between items-center">
                    <span className="text-slate-300 text-sm">Liquido a Pagar</span>
                    <span className="text-3xl font-bold text-emerald-400">{formatCLP(calc.liquido_pagar)}</span>
                  </div>
                </div>
              )}
              {calcLoading && <p className="text-xs text-slate-400 text-center">Calculando...</p>}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Observaciones</label>
                <textarea value={form.observaciones} onChange={e => handleFormChange("observaciones", e.target.value)} rows={2}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-slate-200">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition">Cancelar</button>
              <button onClick={() => handleSave()} disabled={saving}
                className="px-4 py-2 bg-slate-700 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition disabled:opacity-50">
                {saving ? "Guardando..." : "Guardar Borrador"}
              </button>
              <button onClick={() => handleSave("aprobado")} disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50">
                {saving ? "..." : "Aprobar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
