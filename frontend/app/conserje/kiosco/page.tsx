'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { tid } from '../tid'

interface Puerta {
  id: number
  nombre: string
  activa: boolean
}

interface Resultado {
  acceso: boolean
  titular?: string
  categoria?: string
  razon?: string
  ts: number
}

function ScannerQR({ activo, onCodigo }: { activo: boolean; onCodigo: (codigo: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const navegandoRef = useRef(false)
  const [error, setError] = useState('')
  const [estado, setEstado] = useState<'buscando' | 'encontrado'>('buscando')

  useEffect(() => {
    if (!activo) return
    let cancelado = false

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
      .catch(() => navigator.mediaDevices.getUserMedia({ video: true }))
      .then(stream => {
        if (cancelado) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
        loopEscaneo()
      })
      .catch(() => setError('No se pudo acceder a la camara. Revisa los permisos del navegador.'))

    async function loopEscaneo() {
      const jsQR = (await import('jsqr')).default
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas) return
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return

      function tick() {
        if (cancelado || navegandoRef.current) return
        if (video && video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
          canvas!.width = video.videoWidth
          canvas!.height = video.videoHeight
          ctx.drawImage(video, 0, 0, canvas!.width, canvas!.height)
          const imgData = ctx.getImageData(0, 0, canvas!.width, canvas!.height)
          const codigo = jsQR(imgData.data, imgData.width, imgData.height)
          if (codigo && codigo.data) {
            navegandoRef.current = true
            setEstado('encontrado')
            setTimeout(() => {
              onCodigo(codigo.data)
              navegandoRef.current = false
              setEstado('buscando')
            }, 300)
            return
          }
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()
    }

    return () => {
      cancelado = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [activo])

  if (error) {
    return <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-300">{error}</div>
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-full max-w-sm">
        <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-xl bg-black" />
        <div className="absolute inset-8 border-4 border-white/70 rounded-2xl pointer-events-none" />
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <p className="text-sm text-slate-400">
        {estado === 'buscando' ? 'Buscando codigo QR...' : 'Codigo detectado, verificando...'}
      </p>
    </div>
  )
}

export default function ConserjeKioscoPage() {
  const [puertas, setPuertas] = useState<Puerta[]>([])
  const [puertaId, setPuertaId] = useState<number | null>(null)
  const [codigo, setCodigo] = useState('')
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [verificando, setVerificando] = useState(false)
  const [historial, setHistorial] = useState<Resultado[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const limpiarTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)


  useEffect(() => {
    fetch('/api/condominios/puertas?tenant_id=' + tid(), { credentials: 'include' })
      .then(r => (r.ok ? r.json() : []))
      .then((data: Puerta[]) => {
        setPuertas(data)
        if (data.length > 0) setPuertaId(data[0].id)
      })
      .catch(() => {})
  }, [])

  const refocus = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  useEffect(() => { refocus() }, [refocus, puertaId])

  async function verificar(codigoEscaneado: string) {
    if (!puertaId || !codigoEscaneado.trim()) return
    if (limpiarTimeout.current) clearTimeout(limpiarTimeout.current)
    setVerificando(true)
    try {
      const cod = codigoEscaneado.trim()
      // Un UID RFID de este sistema siempre es hex corto; el QR rotativo es un
      // blob base64url mas largo (nunca hex puro) -- suficiente para distinguirlos.
      const pareceRFID = /^[0-9A-Fa-f]{6,20}$/.test(cod)
      const endpoint = pareceRFID ? '/api/condominios/rfid/verificar' : '/api/condominios/qr-rotativo/validar'
      const body = pareceRFID ? { uid: cod, puerta_id: puertaId } : { payload: cod, puerta_id: puertaId }
      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      const r: Resultado = {
        acceso: !!data.acceso,
        titular: data.titular,
        categoria: data.categoria,
        razon: data.razon || (res.ok ? undefined : 'Error del servidor'),
        ts: Date.now(),
      }
      setResultado(r)
      setHistorial(h => [r, ...h].slice(0, 8))
    } catch {
      setResultado({ acceso: false, razon: 'Error de conexion con el servidor', ts: Date.now() })
    } finally {
      setVerificando(false)
      setCodigo('')
      refocus()
      limpiarTimeout.current = setTimeout(() => setResultado(null), 4000)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      verificar(codigo)
    }
  }

  const puertaActiva = puertas.find(p => p.id === puertaId)

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Kiosco de Acceso</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Tarjeta RFID, Llave QR rotativa de residentes/socios, o la camara para escanear.
        </p>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-700/60 p-4 flex items-center gap-3 flex-wrap">
        <label className="text-sm font-medium text-slate-300">Puerta:</label>
        <select
          value={puertaId ?? ''}
          onChange={e => setPuertaId(Number(e.target.value))}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
        >
          {puertas.map(p => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-700/60 p-5">
        <input
          ref={inputRef}
          value={codigo}
          onChange={e => setCodigo(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={refocus}
          autoFocus
          placeholder="Pasa una tarjeta o pega un codigo aqui..."
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white text-center outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <p className="text-xs text-slate-500 mt-2 text-center">
          El lector RFID/scanner USB escribe aqui solo y presiona Enter
        </p>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-700/60 p-5">
        <ScannerQR activo={!verificando} onCodigo={verificar} />
      </div>

      {resultado && (
        <div className={`rounded-xl p-5 text-center border ${resultado.acceso ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-red-500/10 border-red-500/40'}`}>
          <p className={`text-lg font-bold ${resultado.acceso ? 'text-emerald-300' : 'text-red-300'}`}>
            {resultado.acceso ? 'Acceso permitido' : 'Acceso denegado'}
          </p>
          {resultado.titular && <p className="text-white text-sm mt-1">{resultado.titular}</p>}
          {resultado.razon && <p className="text-slate-400 text-xs mt-1">{resultado.razon}</p>}
        </div>
      )}

      {historial.length > 0 && (
        <div className="bg-slate-900 rounded-xl border border-slate-700/60 p-4">
          <p className="text-xs font-medium text-slate-400 mb-2">Ultimos escaneos</p>
          <div className="space-y-1.5">
            {historial.map(h => (
              <div key={h.ts} className="flex items-center justify-between text-xs">
                <span className={h.acceso ? 'text-emerald-400' : 'text-red-400'}>
                  {h.titular || h.razon || (h.acceso ? 'Acceso' : 'Denegado')}
                </span>
                <span className="text-slate-500">{new Date(h.ts).toLocaleTimeString('es-CL')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!puertaActiva && (
        <p className="text-xs text-amber-400 text-center">No hay puertas configuradas para este condominio.</p>
      )}
    </div>
  )
}
