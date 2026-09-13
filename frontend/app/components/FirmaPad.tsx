'use client'
import { useEffect, useRef, useState } from 'react'

/** Pad de firma táctil. onChange recibe el PNG en base64 (data URL) o '' si está vacío. */
export default function FirmaPad({ onChange, color = '#0B1F2A' }: { onChange: (dataUrl: string) => void; color?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [vacio, setVacio] = useState(true)
  const dib = useRef(false)

  useEffect(() => {
    const c = ref.current; if (!c) return
    const r = c.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1
    c.width = r.width * dpr; c.height = 160 * dpr
    const ctx = c.getContext('2d')!; ctx.scale(dpr, dpr); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = color
  }, [color])

  const pos = (e: any) => { const c = ref.current!; const r = c.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e; return { x: t.clientX - r.left, y: t.clientY - r.top } }
  const start = (e: any) => { e.preventDefault(); dib.current = true; const ctx = ref.current!.getContext('2d')!; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y) }
  const move = (e: any) => { if (!dib.current) return; e.preventDefault(); const ctx = ref.current!.getContext('2d')!; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); if (vacio) setVacio(false) }
  const end = () => { if (!dib.current) return; dib.current = false; onChange(ref.current!.toDataURL('image/png')) }
  const limpiar = () => { const c = ref.current!; const ctx = c.getContext('2d')!; ctx.clearRect(0, 0, c.width, c.height); setVacio(true); onChange('') }

  return (
    <div>
      <div className="relative rounded-2xl border-2 border-dashed border-[#C9D3DA] bg-white overflow-hidden" style={{ touchAction: 'none' }}>
        <canvas ref={ref} className="w-full h-[160px] block" onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end} onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
        {vacio && <div className="absolute inset-0 flex items-center justify-center text-sm text-[#9AA7B0] pointer-events-none">Firma aquí con el dedo o el mouse</div>}
      </div>
      <div className="flex justify-between items-center mt-1"><span className="text-[11px] text-[#7A8F98]">Firma (opcional): deja constancia de tu aceptación.</span><button type="button" onClick={limpiar} className="text-xs font-bold text-[#7A8F98]">Limpiar</button></div>
    </div>
  )
}
