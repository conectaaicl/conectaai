'use client'
import { useEffect } from 'react'

/** Errores de cliente (p. ej. chunks viejos tras un despliegue): recarga una vez sola; si persiste, muestra el boton. */
export default function VentasError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    try {
      const k = 'ventas_reload_' + (error?.digest || error?.message || 'x').slice(0, 40)
      if (!sessionStorage.getItem(k)) { sessionStorage.setItem(k, '1'); location.reload() }
    } catch {}
  }, [error])
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="bg-white border border-[#DDE4E6] rounded-3xl p-8 max-w-md text-center shadow-xl">
        <div className="text-4xl mb-3">🔄</div>
        <h1 className="text-xl font-extrabold text-[#0B1F2A]">Se actualizó la aplicación</h1>
        <p className="text-sm text-[#7A8F98] mt-2">Acabamos de publicar una versión nueva y tu pestaña tenía la anterior. Recarga y sigue donde estabas.</p>
        <div className="flex gap-2 justify-center mt-5">
          <button onClick={() => location.reload()} className="bg-[#0F766E] text-white font-bold px-5 py-3 rounded-xl text-sm">Recargar</button>
          <button onClick={reset} className="bg-white border border-[#DDE4E6] font-bold px-5 py-3 rounded-xl text-sm">Reintentar</button>
        </div>
        <p className="text-[10px] text-[#B0BCC3] mt-4 break-all">{error?.message?.slice(0, 160)}</p>
      </div>
    </div>
  )
}
