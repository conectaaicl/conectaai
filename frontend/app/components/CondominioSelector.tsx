"use client"
import { useState, useEffect, useRef } from "react"
import { useSession } from "@/hooks/useSession"
import { useCondominio, CondominioBasico } from "@/hooks/useCondominio"

export default function CondominioSelector() {
  const { tenantId } = useSession()
  const { condominios, active, loading, setActive } = useCondominio(tenantId)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  if (loading || condominios.length <= 1) {
    return (
      <div className="px-3 py-2 text-xs text-slate-400 truncate">
        {active?.nombre || "Sin condominio"}
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors text-left"
      >
        {active?.logo_url ? (
          <img src={active.logo_url} alt={active.nombre} className="w-7 h-7 rounded-md object-cover flex-shrink-0 border border-slate-600/40" onError={e=>{(e.target as HTMLImageElement).style.display='none'}} />
        ) : (
          <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-white">{active?.nombre?.charAt(0) || "C"}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-200 truncate">{active?.nombre || "Seleccionar"}</p>
          <p className="text-xs text-slate-400 capitalize">{active?.tipo || "condominio"}</p>
        </div>
        <svg className={`w-3 h-3 text-slate-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-slate-800 border border-slate-600 rounded-xl shadow-xl overflow-hidden">
          <div className="px-3 py-2 text-xs text-slate-400 border-b border-slate-700">
            Seleccionar condominio
          </div>
          {condominios.map(c => (
            <button
              key={c.id}
              onClick={() => { setActive(c); setOpen(false) }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-700 transition-colors ${
                active?.id === c.id ? "bg-blue-600/20" : ""
              }`}
            >
              <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 text-xs font-bold text-white ${
                active?.id === c.id ? "bg-blue-600" : "bg-slate-600"
              }`}>
                {c.nombre.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium truncate ${active?.id === c.id ? "text-blue-300" : "text-slate-200"}`}>
                  {c.nombre}
                </p>
                <p className="text-xs text-slate-400 truncate">{c.direccion}</p>
              </div>
              {active?.id === c.id && (
                <svg className="w-3 h-3 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
          <div className="border-t border-slate-700 px-3 py-2">
            <a href="/dashboard/condominios/estructura"
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
              + Gestionar condominios
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
