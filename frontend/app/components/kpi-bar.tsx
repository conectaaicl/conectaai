"use client"

export default function KPIBar() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="rounded-xl bg-white border p-4">
        <p className="text-xs text-slate-500">Usuarios activos</p>
        <p className="text-2xl font-bold text-slate-900">—</p>
      </div>

      <div className="rounded-xl bg-white border p-4">
        <p className="text-xs text-slate-500">Empresas activas</p>
        <p className="text-2xl font-bold text-slate-900">—</p>
      </div>

      <div className="rounded-xl bg-white border p-4">
        <p className="text-xs text-slate-500">Estado general</p>
        <p className="text-2xl font-bold text-green-600">OK</p>
      </div>
    </div>
  )
}
