'use client'
import { useState, useEffect, useCallback } from 'react'

interface Registro {
  id: number
  identificador: string
  tipo_evento: 'entrada' | 'salida'
  metodo: string
  timestamp: string
  dispositivo_id: number | null
  notas: string | null
}

interface Resumen {
  total: number
  entradas: number
  salidas: number
  identificadores_unicos: number
  por_dia: Record<string, { entradas: number; salidas: number }>
}

const METODO_ICON: Record<string, string> = {
  rfid: '💳', huella: '👆', pin: '🔢', facial: '😊', manual: '✍️',
}

export default function AsistenciaPage() {
  const [registros, setRegistros] = useState<Registro[]>([])
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [fechaInicio, setFechaInicio] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7)
    return d.toISOString().slice(0, 10)
  })
  const [fechaFin, setFechaFin] = useState(() => new Date().toISOString().slice(0, 10))
  const [showManual, setShowManual] = useState(false)
  const [manualForm, setManualForm] = useState({ identificador: '', tipo_evento: 'entrada', notas: '' })
  const [savingManual, setSavingManual] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ fecha_inicio: fechaInicio, fecha_fin: fechaFin, limit: '200' })
      if (search) params.set('identificador', search)
      const [r1, r2] = await Promise.all([
        fetch(`/api/biometrico/registros?${params}`, { credentials: 'include' }).then(r => r.json()),
        fetch(`/api/biometrico/resumen`, { credentials: 'include' }).then(r => r.json()),
      ])
      setRegistros(r1.registros || [])
      setResumen(r2)
    } finally { setLoading(false) }
  }, [fechaInicio, fechaFin, search])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 30s
  useEffect(() => {
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [load])

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSavingManual(true)
    try {
      await fetch('/api/biometrico/registros', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manualForm),
      })
      setShowManual(false)
      setManualForm({ identificador: '', tipo_evento: 'entrada', notas: '' })
      load()
    } finally { setSavingManual(false) }
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este registro?')) return
    await fetch(`/api/biometrico/registros/${id}`, { method: 'DELETE', credentials: 'include' })
    load()
  }

  const todayEntradas = registros.filter(r => {
    const today = new Date().toISOString().slice(0, 10)
    return r.timestamp?.slice(0, 10) === today && r.tipo_evento === 'entrada'
  }).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Control de Asistencia</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">
            Registro biométrico y RFID · Auto-actualiza cada 30s
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowManual(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition shadow-md shadow-indigo-500/20"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Registro manual
          </button>
          <a
            href="/api/biometrico/registros?limit=1000"
            className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-xl transition"
          >
            Exportar
          </a>
        </div>
      </div>

      {/* Stats */}
      {resumen && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total mes', value: resumen.total, color: 'text-indigo-400', icon: '📊' },
            { label: 'Entradas mes', value: resumen.entradas, color: 'text-emerald-400', icon: '🟢' },
            { label: 'Salidas mes', value: resumen.salidas, color: 'text-blue-400', icon: '🔵' },
            { label: 'Hoy (entradas)', value: todayEntradas, color: 'text-amber-400', icon: '⚡' },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5">
              <div className="text-2xl mb-2">{s.icon}</div>
              <div className={`text-3xl font-bold ${s.color} mb-1`}>{s.value}</div>
              <div className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Desde</label>
          <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Hasta</label>
          <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Buscar identificador</label>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="RUT, nombre, UID..."
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white w-48 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button onClick={load} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-xl transition">
          Filtrar
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"/>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800">
                  {['Fecha / Hora', 'Identificador', 'Evento', 'Método', 'Dispositivo', ''].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-800/50">
                {registros.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/30 transition">
                    <td className="px-5 py-3.5 text-gray-900 dark:text-white font-mono text-xs">
                      {r.timestamp ? (
                        <>
                          <div>{r.timestamp.slice(0, 10)}</div>
                          <div className="text-gray-400 dark:text-slate-500">{r.timestamp.slice(11, 16)}</div>
                        </>
                      ) : '-'}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-white">{r.identificador}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        r.tipo_evento === 'entrada'
                          ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                          : 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400'
                      }`}>
                        <span>{r.tipo_evento === 'entrada' ? '↓' : '↑'}</span>
                        {r.tipo_evento}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 dark:text-slate-300 text-xs">
                      {METODO_ICON[r.metodo] || '?'} {r.metodo}
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 dark:text-slate-500 text-xs">{r.dispositivo_id ? `#${r.dispositivo_id}` : 'manual'}</td>
                    <td className="px-5 py-3.5">
                      <button onClick={() => handleDelete(r.id)}
                        className="text-red-400 hover:text-red-500 text-xs transition">
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
                {registros.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400 dark:text-slate-500">
                    No hay registros para el período seleccionado
                  </td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Manual entry modal */}
      {showManual && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 w-full max-w-md">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4">Registro Manual</h3>
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Identificador (RUT, nombre)</label>
                <input value={manualForm.identificador} onChange={e => setManualForm(f => ({...f, identificador: e.target.value}))}
                  required placeholder="Ej: 12345678-9"
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Tipo de evento</label>
                <select value={manualForm.tipo_evento} onChange={e => setManualForm(f => ({...f, tipo_evento: e.target.value}))}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="entrada">Entrada</option>
                  <option value="salida">Salida</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Notas (opcional)</label>
                <input value={manualForm.notas} onChange={e => setManualForm(f => ({...f, notas: e.target.value}))}
                  placeholder="Observaciones..."
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowManual(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-white text-sm rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 transition">
                  Cancelar
                </button>
                <button type="submit" disabled={savingManual}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition">
                  {savingManual ? 'Guardando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
