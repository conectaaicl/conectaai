"use client"
import { useState, useEffect } from "react"
import { useSession } from "@/hooks/useSession"

const MODULE_COLORS: Record<string,string> = {
  puertas: "bg-slate-100 text-slate-700",
  rfid: "bg-violet-100 text-violet-700",
  finanzas: "bg-emerald-100 text-emerald-700",
  auth: "bg-blue-100 text-blue-700",
  paquetes: "bg-amber-100 text-amber-700",
}

function getBadge(modulo: string) {
  return MODULE_COLORS[modulo] || "bg-gray-100 text-gray-700"
}

export default function HistorialPage() {
  const { tenantId } = useSession()
  const [items, setItems] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [modulos, setModulos] = useState<string[]>([])
  const [filtros, setFiltros] = useState({ modulo: "", accion: "", usuario: "" })
  const [msg, setMsg] = useState("")
  const [claveNueva, setClaveNueva] = useState("")
  const [claveConfirm, setClaveConfirm] = useState("")
  const [claveBorrar, setClaveBorrar] = useState("")
  const [moduloBorrar, setModuloBorrar] = useState("")
  const LIMIT = 50

  const load = (p = page) => {
    if (!tenantId) return
    setLoading(true)
    const params = new URLSearchParams({ tenant_id: String(tenantId), page: String(p), limit: String(LIMIT) })
    if (filtros.modulo) params.set("modulo", filtros.modulo)
    if (filtros.accion) params.set("accion", filtros.accion)
    if (filtros.usuario) params.set("usuario", filtros.usuario)
    fetch("/api/historial?" + params)
      .then(r => r.json())
      .then(d => { setItems(d.items || []); setTotal(d.total || 0) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!tenantId) return
    fetch("/api/historial/modulos?tenant_id=" + tenantId)
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setModulos(d) }).catch(() => {})
  }, [tenantId])

  useEffect(() => { load() }, [tenantId])

  const handleBuscar = () => { setPage(1); load(1) }
  const totalPages = Math.ceil(total / LIMIT)

  const configurarClave = async () => {
    if (!claveNueva || claveNueva.length < 6) { setMsg("La clave debe tener al menos 6 caracteres"); return }
    if (claveNueva !== claveConfirm) { setMsg("Las claves no coinciden"); return }
    const res = await fetch("/api/historial/configurar-clave", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ tenant_id: tenantId, nueva_clave: claveNueva }) })
    const d = await res.json()
    if (res.ok) { setMsg("Clave configurada correctamente"); setClaveNueva(""); setClaveConfirm("") }
    else setMsg(d.detail || "Error al configurar clave")
  }

  const borrarHistorial = async () => {
    if (!claveBorrar) { setMsg("Ingrese la clave de borrado"); return }
    const res = await fetch("/api/historial/borrar", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ tenant_id: tenantId, clave: claveBorrar, modulo: moduloBorrar || undefined }) })
    const d = await res.json()
    if (res.ok) { setMsg("Se eliminaron " + d.eliminados + " registros"); setClaveBorrar(""); load(1) }
    else setMsg(d.detail || "Error al borrar")
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Historial del Sistema</h1>
        <p className="text-slate-500 text-sm mt-1">Registro de todas las acciones realizadas en el sistema.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Modulo</label>
            <select value={filtros.modulo} onChange={e=>setFiltros({...filtros,modulo:e.target.value})}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Todos</option>
              {modulos.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Accion</label>
            <input value={filtros.accion} onChange={e=>setFiltros({...filtros,accion:e.target.value})}
              placeholder="Buscar accion..." className="border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Usuario</label>
            <input value={filtros.usuario} onChange={e=>setFiltros({...filtros,usuario:e.target.value})}
              placeholder="Nombre usuario..." className="border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"/>
          </div>
          <button onClick={handleBuscar} className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700">Buscar</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Fecha/Hora</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Modulo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Accion</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Descripcion</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Usuario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && (
                <tr><td colSpan={5} className="text-center py-8 text-slate-400">Cargando...</td></tr>
              )}
              {!loading && items.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-slate-400">Sin registros</td></tr>
              )}
              {items.map(item => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                    {item.fecha ? new Date(item.fecha).toLocaleString("es-CL") : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={"text-xs px-2 py-0.5 rounded-full font-medium " + getBadge(item.modulo)}>{item.modulo}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 font-medium">{item.accion}</td>
                  <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{item.descripcion}</td>
                  <td className="px-4 py-3 text-slate-600">{item.usuario_nombre || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
          <p className="text-xs text-slate-500">{total} registros totales</p>
          <div className="flex items-center gap-2">
            <button onClick={()=>{ const p=page-1; setPage(p); load(p) }} disabled={page<=1}
              className="px-3 py-1 rounded-lg border border-slate-200 text-sm disabled:opacity-40 hover:bg-slate-50">Anterior</button>
            <span className="text-xs text-slate-500">Pagina {page} de {totalPages||1}</span>
            <button onClick={()=>{ const p=page+1; setPage(p); load(p) }} disabled={page>=totalPages}
              className="px-3 py-1 rounded-lg border border-slate-200 text-sm disabled:opacity-40 hover:bg-slate-50">Siguiente</button>
          </div>
        </div>
      </div>

      {msg && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700 mb-4">{msg}</div>
      )}

      <div className="mt-8 border border-red-200 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-red-600 mb-4">Zona de peligro</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-slate-700 mb-3">Configurar clave de borrado</h3>
            <div className="space-y-2">
              <input type="password" value={claveNueva} onChange={e=>setClaveNueva(e.target.value)} placeholder="Nueva clave (min 6 chars)"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-400"/>
              <input type="password" value={claveConfirm} onChange={e=>setClaveConfirm(e.target.value)} placeholder="Confirmar clave"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-400"/>
              <button onClick={configurarClave} className="w-full bg-slate-700 text-white py-2 rounded-xl text-sm font-semibold hover:bg-slate-800">Guardar clave</button>
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-slate-700 mb-3">Borrar historial</h3>
            <div className="space-y-2">
              <select value={moduloBorrar} onChange={e=>setModuloBorrar(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-400">
                <option value="">Todos los modulos</option>
                {modulos.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <input type="password" value={claveBorrar} onChange={e=>setClaveBorrar(e.target.value)} placeholder="Clave de borrado"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-400"/>
              <button onClick={borrarHistorial} className="w-full bg-red-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-red-700">Borrar registros</button>
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-4">Esta accion es irreversible. Asegurese de tener una clave configurada antes de borrar registros.</p>
      </div>
    </div>
  )
}