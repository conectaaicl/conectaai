'use client'
import { useEffect, useRef, useState } from 'react'
import { Camera, Trash2 } from 'lucide-react'

/** Fotos tomadas en terreno (fachada, ventana, local). tipo: edificio | cortinas | negocio */
export default function FotosPanel({ tipo, id }: { tipo: 'edificio' | 'cortinas' | 'negocio'; id: number | string }) {
  const [fotos, setFotos] = useState<{ nombre: string; url: string }[]>([])
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const inp = useRef<HTMLInputElement>(null)
  const base = `/api/ventas-terreno/fotos/${tipo}/${id}`
  const load = () => fetch(base, { credentials: 'include' }).then(r => r.ok ? r.json() : []).then(setFotos).catch(() => {})
  useEffect(() => { load() }, [tipo, id]) // eslint-disable-line react-hooks/exhaustive-deps
  async function subir(files: FileList | null) {
    if (!files?.length) return
    setBusy(true); setErr('')
    try {
      for (const f of Array.from(files)) { const fd = new FormData(); fd.append('archivo', f); const r = await fetch(base, { method: 'POST', body: fd, credentials: 'include' }); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || 'No se pudo subir') }
      await load()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false); if (inp.current) inp.current.value = '' }
  }
  async function borrar(n: string) { if (!confirm('¿Eliminar la foto?')) return; await fetch(`${base}/${n}`, { method: 'DELETE', credentials: 'include' }); load() }
  return (
    <section className="bg-white border border-[#DDE4E6] rounded-2xl p-4 md:p-5">
      <div className="flex items-center justify-between mb-3"><h2 className="font-bold flex items-center gap-2 text-sm"><Camera size={16} className="text-[#0F766E]" /> Fotos en terreno</h2>
        <button onClick={() => inp.current?.click()} disabled={busy} className="bg-[#0F766E] text-white text-xs font-bold px-3 py-2 rounded-xl">{busy ? 'Subiendo…' : '📷 Tomar / subir foto'}</button>
        <input ref={inp} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={e => subir(e.target.files)} /></div>
      {err && <p className="text-xs text-rose-700 mb-2">{err}</p>}
      {fotos.length === 0 ? <p className="text-sm text-[#7A8F98]">Sin fotos. La fachada o la ventana ayudan a recordar el lugar y salen bien en la ficha.</p> :
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2">{fotos.map(f => <div key={f.nombre} className="relative group aspect-square rounded-xl overflow-hidden bg-slate-100"><a href={f.url} target="_blank" rel="noreferrer">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={f.url} alt="" className="w-full h-full object-cover" /></a><button onClick={() => borrar(f.nombre)} className="absolute top-1 right-1 bg-white/90 rounded-lg p-1 text-rose-600 opacity-80"><Trash2 size={14} /></button></div>)}</div>}
    </section>
  )
}
