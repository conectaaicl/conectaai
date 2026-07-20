'use client'
import { useState, useEffect, use } from 'react'

interface Votacion {
  id: number
  titulo: string
  descripcion?: string
  opciones: string[]
  estado: string
  fecha_fin?: string
}

interface Resultados {
  votos: Record<string, number>
  total: number
}

export default function VotarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [votacion, setVotacion] = useState<Votacion | null>(null)
  const [resultados, setResultados] = useState<Resultados | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deptoId, setDeptoId] = useState('')
  const [opcion, setOpcion] = useState('')
  const [voting, setVoting] = useState(false)
  const [voted, setVoted] = useState(false)
  const [voteError, setVoteError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch(`/api/condominios/votaciones/${id}`),
      fetch(`/api/condominios/votaciones/${id}/resultados`),
    ]).then(async ([vRes, rRes]) => {
      if (vRes.ok) setVotacion(await vRes.json())
      else setError('Votación no encontrada')
      if (rRes.ok) setResultados(await rRes.json())
    }).catch(() => setError('Error al cargar la votación')).finally(() => setLoading(false))
  }, [id])

  async function handleVote(e: React.FormEvent) {
    e.preventDefault()
    setVoteError('')
    if (!opcion) return setVoteError('Selecciona una opción')
    if (!deptoId) return setVoteError('Ingresa tu departamento')
    setVoting(true)
    try {
      const res = await fetch(`/api/condominios/votaciones/${id}/votar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opcion_elegida: opcion, departamento_id: Number(deptoId) }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setVoted(true)
        const rRes = await fetch(`/api/condominios/votaciones/${id}/resultados`)
        if (rRes.ok) setResultados(await rRes.json())
      } else {
        setVoteError(data.detail || 'Error al registrar voto')
      }
    } finally { setVoting(false) }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
    </div>
  )

  const cerrada = votacion?.estado === 'cerrada'
  const maxVotos = resultados ? Math.max(...Object.values(resultados.votos), 1) : 1

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 py-10 px-4">
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white text-center">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <h1 className="text-xl font-bold">Votación en línea</h1>
            <p className="text-indigo-100 text-sm">ConectaAI — Portal Residentes</p>
          </div>

          <div className="p-6">
            {error ? (
              <p className="text-red-500 text-center">{error}</p>
            ) : votacion ? (
              <>
                <h2 className="text-lg font-bold text-slate-800 mb-1">{votacion.titulo}</h2>
                {votacion.descripcion && <p className="text-slate-500 text-sm mb-4">{votacion.descripcion}</p>}
                <div className="flex items-center gap-2 mb-5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cerrada ? 'bg-slate-100 text-slate-500' : 'bg-green-100 text-green-700'}`}>
                    {cerrada ? 'Cerrada' : 'En curso'}
                  </span>
                  {votacion.fecha_fin && <span className="text-xs text-slate-400">Cierra: {new Date(votacion.fecha_fin).toLocaleDateString('es-CL')}</span>}
                </div>

                {resultados && (
                  <div className="mb-6 p-4 bg-slate-50 rounded-xl">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">Resultados actuales ({resultados.total} votos)</h3>
                    <div className="space-y-2">
                      {Object.entries(resultados.votos).map(([op, count]) => (
                        <div key={op}>
                          <div className="flex justify-between text-xs text-slate-600 mb-1">
                            <span>{op}</span>
                            <span className="font-medium">{count}</span>
                          </div>
                          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${(count / maxVotos) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!cerrada && !voted ? (
                  <form onSubmit={handleVote} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Tu voto</label>
                      <div className="space-y-2">
                        {votacion.opciones.map(op => (
                          <label key={op} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${opcion === op ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}>
                            <input type="radio" name="opcion" value={op} checked={opcion === op} onChange={() => setOpcion(op)} className="text-indigo-600" />
                            <span className="text-sm font-medium text-slate-700">{op}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nº de departamento</label>
                      <input type="number" required value={deptoId} onChange={e => setDeptoId(e.target.value)} placeholder="Ej: 101" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    {voteError && <p className="text-red-500 text-sm">{voteError}</p>}
                    <button type="submit" disabled={voting} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition disabled:opacity-60">
                      {voting ? 'Enviando...' : 'Votar'}
                    </button>
                  </form>
                ) : voted ? (
                  <div className="text-center py-4">
                    <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-green-700 font-semibold">¡Voto registrado!</p>
                    <p className="text-slate-500 text-sm mt-1">Gracias por participar</p>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
