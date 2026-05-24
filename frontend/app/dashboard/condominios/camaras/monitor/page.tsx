'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from '@/hooks/useSession'

interface Camara {
  id: number
  nombre: string
  ubicacion?: string
  ip: string
  puerto: number
  modelo?: string
  activa: boolean
  ultimo_estado: string
}

function gridCols(n: number): string {
  if (n <= 1) return 'grid-cols-1'
  if (n <= 4) return 'grid-cols-2'
  if (n <= 9) return 'grid-cols-3'
  return 'grid-cols-4'
}

function gridLabel(n: number): string {
  if (n <= 1) return '1x1'
  if (n <= 4) return '2x2'
  if (n <= 9) return '3x3'
  return '4x4'
}

function CameraCell({ cam, refreshMs }: { cam: Camara; refreshMs: number }) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [expanded, setExpanded] = useState(false)
  const [expandTs, setExpandTs] = useState(0)

  const loadImage = useCallback(() => {
    if (!imgRef.current) return
    setStatus('loading')
    imgRef.current.src = '/api/camaras/' + cam.id + '/snapshot?_t=' + Date.now()
  }, [cam.id])

  useEffect(() => {
    loadImage()
    const iv = setInterval(loadImage, refreshMs)
    return () => clearInterval(iv)
  }, [loadImage, refreshMs])

  function openExpanded() {
    setExpandTs(Date.now())
    setExpanded(true)
  }

  return (
    <>
      <div
        className="relative bg-slate-950 rounded-xl overflow-hidden aspect-video cursor-pointer group border border-slate-800 hover:border-slate-600 transition-colors"
        onClick={openExpanded}
      >
        <img
          ref={imgRef}
          alt={cam.nombre}
          className={`w-full h-full object-cover transition-opacity duration-300 ${status === 'ok' ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setStatus('ok')}
          onError={() => setStatus('error')}
        />

        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-slate-600 border-t-slate-300 rounded-full animate-spin" />
          </div>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
            <svg className="w-10 h-10 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
            <p className="text-xs font-medium">Sin senal</p>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-3 py-2 pointer-events-none">
          <div className="flex items-center justify-between">
            <span className="text-white text-xs font-semibold truncate drop-shadow-sm">{cam.nombre}</span>
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ml-2 ${
              status === 'ok' ? 'bg-emerald-400' : status === 'error' ? 'bg-red-400 animate-pulse' : 'bg-yellow-400'
            }`} />
          </div>
          {cam.ubicacion && (
            <p className="text-slate-300 text-xs truncate opacity-80">{cam.ubicacion}</p>
          )}
        </div>

        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-lg p-1">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </div>
      </div>

      {expanded && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-4"
          onClick={() => setExpanded(false)}
        >
          <div className="w-full max-w-5xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3 px-1">
              <div>
                <h3 className="text-white font-bold text-lg">{cam.nombre}</h3>
                {cam.ubicacion && <p className="text-slate-400 text-sm">{cam.ubicacion}</p>}
              </div>
              <button
                onClick={() => setExpanded(false)}
                className="text-slate-400 hover:text-white w-9 h-9 flex items-center justify-center text-2xl"
              >
                x
              </button>
            </div>
            <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-700">
              <img
                key={expandTs}
                src={'/api/camaras/' + cam.id + '/snapshot?_t=' + expandTs}
                alt={cam.nombre}
                className="w-full object-contain max-h-[70vh]"
              />
            </div>
            <div className="flex items-center justify-between mt-3 px-1">
              <span className="text-xs text-slate-500 font-mono">
                {cam.ip}:{cam.puerto}{cam.modelo ? ' · ' + cam.modelo : ''}
              </span>
              <button
                onClick={() => setExpandTs(Date.now())}
                className="text-xs text-slate-400 hover:text-white border border-slate-700 px-3 py-1.5 rounded-lg"
              >
                Refrescar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function CameraMonitorPage() {
  const { tenantId } = useSession()
  const [camaras, setCamaras] = useState<Camara[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshMs, setRefreshMs] = useState(4000)
  const [fullscreen, setFullscreen] = useState(false)

  const fetchCamaras = useCallback(async () => {
    if (!tenantId) return
    try {
      const r = await fetch('/api/camaras?tenant_id=' + tenantId)
      if (r.ok) {
        const all: Camara[] = await r.json()
        setCamaras(all.filter(c => c.activa))
      }
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [tenantId])

  useEffect(() => { fetchCamaras() }, [fetchCamaras])

  return (
    <div className={`${fullscreen ? 'fixed inset-0 z-40' : 'min-h-screen'} bg-slate-950 text-white flex flex-col`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900 flex-shrink-0">
        <div className="flex items-center gap-3">
          <a href="/dashboard/condominios/camaras" className="text-slate-400 hover:text-white text-sm transition-colors">
            Gestion
          </a>
          <span className="text-slate-700">/</span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-sm">Monitor en Vivo</span>
            <span className="text-slate-500 text-xs">
              {camaras.length} camara{camaras.length !== 1 ? 's' : ''} activa{camaras.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 mr-1">Refresco:</label>
          <select
            value={refreshMs}
            onChange={e => setRefreshMs(Number(e.target.value))}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300"
          >
            <option value={2000}>2s</option>
            <option value={4000}>4s</option>
            <option value={8000}>8s</option>
            <option value={15000}>15s</option>
          </select>
          <button
            onClick={fetchCamaras}
            className="border border-slate-700 text-slate-400 hover:text-white px-3 py-1.5 rounded-lg text-xs transition-colors"
          >
            Actualizar lista
          </button>
          <button
            onClick={() => setFullscreen(v => !v)}
            className="border border-slate-700 text-slate-400 hover:text-white px-3 py-1.5 rounded-lg text-xs transition-colors"
          >
            {fullscreen ? 'Ventana' : 'Pantalla completa'}
          </button>
        </div>
      </div>

      <div className="flex-1 p-3 overflow-auto">
        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-slate-600 border-t-slate-300 rounded-full animate-spin" />
          </div>
        )}

        {!loading && camaras.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <svg className="w-16 h-16 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
            <div className="text-center">
              <p className="text-slate-400 font-medium">No hay camaras activas</p>
              <a href="/dashboard/condominios/camaras" className="text-blue-400 hover:text-blue-300 text-sm mt-1 inline-block">
                Registrar camaras
              </a>
            </div>
          </div>
        )}

        {!loading && camaras.length > 0 && (
          <div className={`grid ${gridCols(camaras.length)} gap-2`}>
            {camaras.map(cam => (
              <CameraCell key={cam.id} cam={cam} refreshMs={refreshMs} />
            ))}
          </div>
        )}
      </div>

      {!loading && camaras.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-800 bg-slate-900 flex items-center gap-4 text-xs text-slate-500 flex-shrink-0">
          <span>Layout: {gridLabel(camaras.length)}</span>
          <span>·</span>
          <span>Refresco: {refreshMs / 1000}s por camara</span>
          <span>·</span>
          <span>Click en cualquier camara para ampliar</span>
        </div>
      )}
    </div>
  )
}
