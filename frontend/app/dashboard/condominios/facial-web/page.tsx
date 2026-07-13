'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

interface Puerta {
  id: number
  nombre: string
  activa: boolean
}

interface Persona {
  id: number
  nombre_completo: string
  rut: string
  tiene_rostro: boolean
}

interface Resultado {
  acceso: boolean
  titular?: string
  razon?: string
  ts: number
}

function Camara({ onCapturar, activa }: { onCapturar: (foto: string) => void; activa: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!activa) return
    let cancelado = false
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } })
      .then(stream => {
        if (cancelado) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch(() => setError('No se pudo acceder a la cámara. Revisa los permisos del navegador.'))
    return () => {
      cancelado = true
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [activa])

  function capturar() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    onCapturar(canvas.toDataURL('image/jpeg', 0.85))
  }

  if (error) {
    return <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">{error}</div>
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <video ref={videoRef} autoPlay playsInline muted className="w-full max-w-sm rounded-xl bg-black scale-x-[-1]" />
      <canvas ref={canvasRef} className="hidden" />
      <button
        onClick={capturar}
        className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700"
      >
        📸 Capturar foto
      </button>
    </div>
  )
}

export default function FacialWebPage() {
  const [tab, setTab] = useState<'probar' | 'registrar'>('probar')
  const [puertas, setPuertas] = useState<Puerta[]>([])
  const [puertaId, setPuertaId] = useState<number | null>(null)
  const [personas, setPersonas] = useState<Persona[]>([])
  const [personaId, setPersonaId] = useState<number | null>(null)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [verificando, setVerificando] = useState(false)
  const [msgEnrolar, setMsgEnrolar] = useState<{ ok: boolean; texto: string } | null>(null)
  const [camActiva, setCamActiva] = useState(false)

  const cargarPersonas = useCallback(() => {
    fetch('/api/condominios/facial-web/personas')
      .then(r => (r.ok ? r.json() : []))
      .then((data: Persona[]) => {
        setPersonas(data)
        if (data.length > 0 && personaId === null) setPersonaId(data[0].id)
      })
      .catch(() => {})
  }, [personaId])

  useEffect(() => {
    fetch('/api/condominios/puertas')
      .then(r => (r.ok ? r.json() : []))
      .then((data: Puerta[]) => {
        setPuertas(data)
        const principal = data.find((p: Puerta) => p.nombre.trim().toLowerCase() === 'puerta principal')
        if (data.length > 0) setPuertaId((principal ?? data[0]).id)
      })
      .catch(() => {})
    cargarPersonas()
  }, [])

  useEffect(() => {
    setCamActiva(true)
    return () => setCamActiva(false)
  }, [tab])

  async function onCapturarProbar(foto: string) {
    if (!puertaId) return
    setVerificando(true)
    try {
      const res = await fetch('/api/condominios/facial-web/verificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foto_base64: foto, puerta_id: puertaId }),
      })
      const data = await res.json()
      setResultado({
        acceso: !!data.acceso,
        titular: data.titular,
        razon: data.razon || (res.ok ? undefined : data.detail || 'Error del servidor'),
        ts: Date.now(),
      })
    } catch {
      setResultado({ acceso: false, razon: 'Error de conexión con el servidor', ts: Date.now() })
    } finally {
      setVerificando(false)
      setTimeout(() => setResultado(null), 5000)
    }
  }

  async function onCapturarRegistrar(foto: string) {
    if (!personaId) return
    setMsgEnrolar(null)
    try {
      const res = await fetch('/api/condominios/facial-web/enrolar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona_id: personaId, foto_base64: foto }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsgEnrolar({ ok: true, texto: 'Rostro registrado correctamente' })
        cargarPersonas()
      } else {
        setMsgEnrolar({ ok: false, texto: data.detail || 'Error al registrar el rostro' })
      }
    } catch {
      setMsgEnrolar({ ok: false, texto: 'Error de conexión con el servidor' })
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reconocimiento Facial (Celular)</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Función experimental — usa la cámara del navegador para reconocer personas registradas. Se puede
          desactivar en cualquier momento desde Configuración → Features.
        </p>
      </div>

      <div className="flex gap-2 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('probar')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'probar' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
        >
          Probar acceso
        </button>
        <button
          onClick={() => setTab('registrar')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'registrar' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
        >
          Registrar rostro
        </button>
      </div>

      {tab === 'probar' ? (
        <div className="space-y-4">
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
          </div>

          {resultado ? (
            <div
              className={`rounded-2xl border-4 p-10 flex flex-col items-center justify-center text-center min-h-[260px] ${
                resultado.acceso ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'
              }`}
            >
              <div className="text-7xl mb-4">{resultado.acceso ? '✅' : '❌'}</div>
              <p className={`text-3xl font-extrabold ${resultado.acceso ? 'text-green-700' : 'text-red-700'}`}>
                {resultado.acceso ? 'ACCESO PERMITIDO' : 'ACCESO DENEGADO'}
              </p>
              {resultado.titular && <p className="text-lg mt-2 text-gray-700">{resultado.titular}</p>}
              {resultado.razon && <p className="text-sm mt-1 text-gray-500">{resultado.razon}</p>}
            </div>
          ) : (
            <div className="rounded-2xl border-4 border-dashed border-gray-300 bg-gray-50 p-8">
              <Camara activa={camActiva} onCapturar={onCapturarProbar} />
            </div>
          )}
          {verificando && <p className="text-center text-sm text-gray-400">Verificando rostro...</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 flex-wrap">
            <label className="text-sm font-medium text-gray-700">Persona a registrar:</label>
            <select
              value={personaId ?? ''}
              onChange={e => setPersonaId(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {personas.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nombre_completo}{p.tiene_rostro ? ' ✓ (ya tiene rostro registrado)' : ''}
                </option>
              ))}
            </select>
            {personas.length === 0 && (
              <span className="text-sm text-amber-600">No hay personas creadas todavía en este condominio.</span>
            )}
          </div>

          {msgEnrolar && (
            <div className={`rounded-xl p-3 text-sm border ${msgEnrolar.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
              {msgEnrolar.texto}
            </div>
          )}

          <div className="rounded-2xl border-4 border-dashed border-gray-300 bg-gray-50 p-8">
            <p className="text-center text-sm text-gray-500 mb-4">
              Mira de frente a la cámara, con buena luz, y captura la foto.
            </p>
            <Camara activa={camActiva} onCapturar={onCapturarRegistrar} />
          </div>
        </div>
      )}
    </div>
  )
}
