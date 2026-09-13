'use client'
import { useEffect, useState } from 'react'

/** Franja superior en tenants demo: dias restantes o modo vitrina. No renderiza nada en tenants reales. */
export default function DemoBanner() {
  const [d, setD] = useState<any>(null)
  useEffect(() => {
    fetch('/api/demo/estado', { credentials: 'include' }).then(r => r.ok ? r.json() : null).then(x => { if (x?.demo) setD(x) }).catch(() => {})
    const onErr = (ev: any) => { if (ev?.detail?.demo_vitrina) setD((s: any) => ({ ...(s || { demo: true }), vencido: true })) }
    window.addEventListener('demo-vitrina', onErr); return () => window.removeEventListener('demo-vitrina', onErr)
  }, [])
  if (!d) return null
  const wa = `https://wa.me/${d.contacto_wa || '56998101891'}?text=${encodeURIComponent('Hola, probé el demo de ConectaAI Condominios y quiero activarlo en mi edificio.')}`
  return (
    <div className={`w-full text-center text-xs md:text-sm font-semibold px-3 py-2 flex flex-wrap items-center justify-center gap-2 ${d.vencido ? 'bg-rose-600 text-white' : 'bg-amber-400 text-amber-950'}`}>
      {d.vencido ? <>🔒 Demo finalizado: puedes ver todo, pero no modificar.</> : <>🎁 Estás en un demo: te quedan {d.dias_restantes} día{d.dias_restantes === 1 ? '' : 's'} para probar todo.</>}
      <a href={wa} target="_blank" rel="noreferrer" className={`underline underline-offset-2 font-bold ${d.vencido ? 'text-white' : 'text-amber-950'}`}>Activar en mi edificio →</a>
    </div>
  )
}
