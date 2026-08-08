'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from '@/hooks/useSession'

interface Puerta {
  id: number
  nombre: string
  tipo: string
  activa: boolean
}

interface Resultado {
  acceso: boolean
  titular?: string
  categoria?: string
  razon?: string
  ts: number
}

function ScannerQR({ activo }: { activo: boolean }) {
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
      .catch(() => setError('No se pudo acceder a la cámara. Revisa los permisos del navegador.'))

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
            const destino = codigo.data
            setTimeout(() => {
              if (destino.includes('/acceso/qr/')) {
                window.location.href = destino
              } else {
                window.open(destino, '_blank')
                navegandoRef.current = false
                setEstado('buscando')
              }
            }, 400)
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
    return <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">{error}</div>
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-full max-w-sm">
        <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-xl bg-black" />
        <div className="absolute inset-8 border-4 border-white/70 rounded-2xl pointer-events-none" />
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <p className="text-sm text-gray-500">
        {estado === 'buscando' ? '🔎 Buscando código QR...' : '✅ Código detectado, abriendo...'}
      </p>
    </div>
  )
}

export default function KioscoAccesoPage() {
  useSession()
  const [tab, setTab] = useState<'tarjeta' | 'qr'>('tarjeta')
  const [puertas, setPuertas] = useState<Puerta[]>([])
  const [puertaId, setPuertaId] = useState<number | null>(null)
  const [codigo, setCodigo] = useState('')
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [verificando, setVerificando] = useState(false)
  const [historial, setHistorial] = useState<Resultado[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const limpiarTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/condominios/puertas')
      .then(r => (r.ok ? r.json() : []))
      .then((data: Puerta[]) => {
        setPuertas(data)
        if (data.length > 0) {
          const principal = data.find(p => p.nombre.trim().toLowerCase() === 'puerta principal')
          setPuertaId((principal ?? data[0]).id)
        }
      })
      .catch(() => {})
  }, [])

  const refocus = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  useEffect(() => { if (tab === 'tarjeta') refocus() }, [refocus, puertaId, tab])

  async function verificar(codigoEscaneado: string) {
    if (!puertaId || !codigoEscaneado.trim()) return
    if (limpiarTimeout.current) clearTimeout(limpiarTimeout.current)
    setVerificando(true)
    try {
      const codigo = codigoEscaneado.trim()
      // Un UID RFID de este sistema siempre es hex corto; el QR rotativo es un
      // blob base64url mas largo (nunca hex puro) -- suficiente para distinguirlos.
      const pareceRFID = /^[0-9A-Fa-f]{6,20}$/.test(codigo)
      const endpoint = pareceRFID ? '/api/condominios/rfid/verificar' : '/api/condominios/qr-rotativo/validar'
      const body = pareceRFID ? { uid: codigo, puerta_id: puertaId } : { payload: codigo, puerta_id: puertaId }
      const res = await fetch(endpoint, {
        method: 'POST',
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
      setHistorial(h => [r, ...h].slice(0, 12))
    } catch {
      setResultado({ acceso: false, razon: 'Error de conexión con el servidor', ts: Date.now() })
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
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Kiosco de Prueba — Control de Acceso</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          RFID, la Llave QR rotativa de residentes/socios y códigos QR de visitas — todo desde la misma pantalla.
        </p>
      </div>

      <div className="flex gap-2 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('tarjeta')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'tarjeta' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
        >
          Tarjeta / Código
        </button>
        <button
          onClick={() => setTab('qr')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'qr' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
        >
          Escanear QR de visita
        </button>
      </div>

      {tab === 'tarjeta' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 flex-wrap">
          <label className="text-sm font-medium text-gray-700">Puerta a probar:</label>
          <select
            value={puertaId ?? ''}
            onChange={e => setPuertaId(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            {puertas.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}{!p.activa ? ' (inactiva)' : ''}</option>
            ))}
          </select>
          {puertas.length === 0 && (
            <span className="text-sm text-amber-600">
              No hay puertas configuradas — créalas primero en &quot;Puertas y Accesos&quot;.
            </span>
          )}
        </div>
      )}

      {tab === 'tarjeta' ? (
        <>
          <div
            onClick={refocus}
            className={`rounded-2xl border-4 transition-colors duration-300 p-10 flex flex-col items-center justify-center text-center min-h-[320px] relative ${
              resultado === null
                ? 'border-dashed border-gray-300 bg-gray-50'
                : resultado.acceso
                ? 'border-green-500 bg-green-50'
                : 'border-red-500 bg-red-50'
            }`}
          >
            {resultado === null ? (
              <>
                <div className="text-6xl mb-4">📡</div>
                <p className="text-lg font-medium text-gray-600">Esperando lectura...</p>
                <p className="text-sm text-gray-400 mt-1">
                  Pasa una tarjeta RFID o escanea un código para {puertaActiva?.nombre || 'la puerta seleccionada'}
                </p>
              </>
            ) : resultado.acceso ? (
              <>
                <div className="text-7xl mb-4">✅</div>
                <p className="text-3xl font-extrabold text-green-700">ACCESO PERMITIDO</p>
                {resultado.titular && (
                  <p className="text-lg text-green-800 mt-2">{resultado.titular}{resultado.categoria ? ` · ${resultado.categoria}` : ''}</p>
                )}
              </>
            ) : (
              <>
                <div className="text-7xl mb-4">❌</div>
                <p className="text-3xl font-extrabold text-red-700">ACCESO DENEGADO</p>
                <p className="text-lg text-red-800 mt-2">{resultado.razon}</p>
              </>
            )}

            {/* Input invisible siempre enfocado: el lector RFID/scanner "escribe" aquí y presiona Enter */}
            <input
              ref={inputRef}
              value={codigo}
              onChange={e => setCodigo(e.target.value)}
              onKeyDown={onKeyDown}
              onBlur={refocus}
              autoFocus
              className="opacity-0 absolute w-px h-px"
            />
          </div>

          {verificando && <p className="text-center text-sm text-gray-400">Verificando...</p>}

          {historial.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <span className="text-sm font-medium text-gray-700">Últimos escaneos de esta prueba</span>
              </div>
              <div className="divide-y divide-gray-50">
                {historial.map((h, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className={h.acceso ? 'text-green-600' : 'text-red-600'}>{h.acceso ? '✅' : '❌'}</span>
                    <span className="flex-1">{h.acceso ? h.titular || 'Acceso permitido' : h.razon || 'Denegado'}</span>
                    <span className="text-xs text-gray-400">{new Date(h.ts).toLocaleTimeString('es-CL')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-2xl border-4 border-dashed border-gray-300 bg-gray-50 p-8">
          <p className="text-center text-sm text-gray-500 mb-4">
            Apunta la cámara al código QR que el residente compartió con su visita.
          </p>
          <ScannerQR activo={tab === 'qr'} />
        </div>
      )}
    </div>
  )
}
