"use client"
import { usePushNotifications } from "@/hooks/usePushNotifications"

interface Props {
  tenantId: number
  personaId?: number
  className?: string
}

const STATE_UI = {
  loading: { label: "Cargando...", disabled: true, icon: "⏳", cls: "bg-slate-700 text-slate-400" },
  unsupported: { label: "No soportado", disabled: true, icon: "🚫", cls: "bg-slate-700 text-slate-400" },
  denied: { label: "Bloqueado por el navegador", disabled: true, icon: "🔕", cls: "bg-red-900/30 text-red-400 border border-red-800" },
  granted: { label: "Activar notificaciones", disabled: false, icon: "🔔", cls: "bg-blue-600 hover:bg-blue-700 text-white" },
  subscribed: { label: "Notificaciones activas", disabled: false, icon: "✓", cls: "bg-emerald-700/30 text-emerald-400 border border-emerald-800" },
}

export default function PushToggleButton({ tenantId, personaId, className = "" }: Props) {
  const { state, error, subscribe, unsubscribe } = usePushNotifications(tenantId, personaId)
  const ui = STATE_UI[state]

  const handleClick = () => {
    if (state === "subscribed") unsubscribe()
    else if (state === "granted" || state === "unsupported") subscribe()
  }

  return (
    <div className={className}>
      <button
        onClick={handleClick}
        disabled={ui.disabled}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${ui.cls} disabled:opacity-60 disabled:cursor-not-allowed`}
      >
        <span>{ui.icon}</span>
        <span>{ui.label}</span>
      </button>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      {state === "denied" && (
        <p className="text-xs text-slate-400 mt-1">
          Activa las notificaciones en Configuración del navegador → Permisos del sitio.
        </p>
      )}
    </div>
  )
}
