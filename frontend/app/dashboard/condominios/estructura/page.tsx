'use client'
import { useState, useEffect } from 'react'

interface Torre {
  id: number
  condominio_id: number
  nombre: string
  numero_pisos: number
  created_at: string
}

interface Condominio {
  id: number
  nombre: string
  direccion: string
  comuna: string
  region: string
}

export default function EstructuraPage() {
  const [condominios, setCondominios] = useState<Condominio[]>([])
  const [condominioSeleccionado, setCondominioSeleccionado] = useState<number | null>(null)
  const [torres, setTorres] = useState<Torre[]>([])
  const [loading, setLoading] = useState(true)

  const [showModalCondominio, setShowModalCondominio] = useState(false)
  const [showModalTorre, setShowModalTorre] = useState(false)
  const [modoEdicion, setModoEdicion] = useState(false)
  const [condominioEditando, setCondominioEditando] = useState<number | null>(null)

  const [formCondominio, setFormCondominio] = useState({
    nombre: '',
    direccion: '',
    comuna: '',
    region: 'Metropolitana'
  })

  const [formTorre, setFormTorre] = useState({
    nombre: '',
    numero_pisos: 1
  })

  useEffect(() => {
    fetchCondominios()
  }, [])

  useEffect(() => {
    if (condominioSeleccionado) {
      fetchTorres(condominioSeleccionado)
    }
  }, [condominioSeleccionado])

  async function fetchCondominios() {
    try {
      const res = await fetch('/api/condominios/?tenant_id=1')
      if (res.ok) {
        const data = await res.json()
        setCondominios(data)
        if (data.length > 0 && !condominioSeleccionado) {
          setCondominioSeleccionado(data[0].id)
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchTorres(condominioId: number) {
    try {
      const res = await fetch(`/api/condominios/${condominioId}/torres`)
      if (res.ok) {
        const data = await res.json()
        setTorres(data)
      }
    } catch (err) {
      console.error(err)
      setTorres([])
    }
  }

  async function crearCondominio(e: React.FormEvent) {
    e.preventDefault()
    try {
      const url = modoEdicion ? `/api/condominios/${condominioEditando}` : '/api/condominios/'
      const method = modoEdicion ? 'PUT' : 'POST'
      
      // ✅ AGREGADO: Incluir tenant_id en el payload
      const payload = {
        ...formCondominio,
        tenant_id: 1
      }
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        setShowModalCondominio(false)
        fetchCondominios()
        setFormCondominio({ nombre: '', direccion: '', comuna: '', region: 'Metropolitana' })
        setModoEdicion(false)
        setCondominioEditando(null)
        alert(modoEdicion ? '✅ Condominio actualizado' : '✅ Condominio creado')
      } else {
        const error = await res.json()
        alert(`❌ Error: ${JSON.stringify(error)}`)
      }
    } catch (err) {
      console.error(err)
      alert('❌ Error al guardar condominio')
    }
  }

  async function eliminarCondominio(condominioId: number) {
    if (!confirm('¿Eliminar condominio? Se eliminarán todas sus torres, pisos y departamentos.')) return
    try {
      const res = await fetch(`/api/condominios/${condominioId}`, { method: 'DELETE' })
      if (res.ok) {
        fetchCondominios()
        if (condominioSeleccionado === condominioId) {
          setCondominioSeleccionado(null)
          setTorres([])
        }
        alert('✅ Condominio eliminado')
      }
    } catch (err) {
      alert('❌ Error')
    }
  }

  function editarCondominio(condominio: Condominio) {
    setFormCondominio({
      nombre: condominio.nombre,
      direccion: condominio.direccion,
      comuna: condominio.comuna,
      region: condominio.region
    })
    setModoEdicion(true)
    setCondominioEditando(condominio.id)
    setShowModalCondominio(true)
  }

  async function crearTorre(e: React.FormEvent) {
    e.preventDefault()
    if (!condominioSeleccionado) return
    try {
      const res = await fetch(`/api/condominios/${condominioSeleccionado}/torres`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formTorre)
      })
      if (res.ok) {
        setShowModalTorre(false)
        fetchTorres(condominioSeleccionado)
        setFormTorre({ nombre: '', numero_pisos: 1 })
        alert('✅ Torre creada con sus pisos')
      } else {
        const error = await res.json()
        alert(`❌ Error: ${JSON.stringify(error)}`)
      }
    } catch (err) {
      console.error(err)
      alert('❌ Error al crear torre')
    }
  }

  async function eliminarTorre(torreId: number) {
    if (!confirm('¿Eliminar torre? Se eliminarán todos sus pisos y departamentos.')) return
    try {
      const res = await fetch(`/api/condominios/torres/${torreId}`, { method: 'DELETE' })
      if (res.ok) {
        fetchTorres(condominioSeleccionado!)
        alert('✅ Torre eliminada')
      }
    } catch (err) {
      alert('❌ Error')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    )
  }

  const condominioActual = condominios.find(c => c.id === condominioSeleccionado)
  const totalPisos = torres.reduce((sum, t) => sum + t.numero_pisos, 0)
  const totalDeptos = torres.reduce((sum, t) => sum + (t.numero_pisos * 4), 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">🏗️ Estructura</h1>
            <p className="text-gray-600">Condominios, torres, pisos y departamentos</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setModoEdicion(false); setCondominioEditando(null); setFormCondominio({ nombre: '', direccion: '', comuna: '', region: 'Metropolitana' }); setShowModalCondominio(true) }} className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-800 text-white rounded-xl font-bold hover:shadow-xl">➕ Nuevo Condominio</button>
            {condominioSeleccionado && (<button onClick={() => setShowModalTorre(true)} className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-xl font-bold hover:shadow-xl">➕ Nueva Torre</button>)}
          </div>
        </div>

        {condominios.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {condominios.map(cond => (
                <div key={cond.id} className={`bg-white rounded-xl shadow-lg p-6 cursor-pointer transition-all ${condominioSeleccionado === cond.id ? 'ring-4 ring-purple-500 shadow-2xl' : 'hover:shadow-xl'}`} onClick={() => setCondominioSeleccionado(cond.id)}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">{cond.nombre}</h3>
                      <p className="text-sm text-gray-600">{cond.direccion}</p>
                      <p className="text-xs text-gray-500">{cond.comuna}, {cond.region}</p>
                    </div>
                    {condominioSeleccionado === cond.id && (<span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold">ACTIVO</span>)}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={(e) => { e.stopPropagation(); editarCondominio(cond) }} className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold">✏️ Editar</button>
                    <button onClick={(e) => { e.stopPropagation(); eliminarCondominio(cond.id) }} className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-semibold">🗑️ Eliminar</button>
                  </div>
                </div>
              ))}
            </div>

            {condominioActual && (
              <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
                <h2 className="text-2xl font-bold mb-4">📊 Estadísticas - {condominioActual.nombre}</h2>
                <div className="grid grid-cols-3 gap-6">
                  <div className="text-center"><p className="text-4xl font-bold text-blue-600">{torres.length}</p><p className="text-gray-600 font-semibold">🏢 Torres</p></div>
                  <div className="text-center"><p className="text-4xl font-bold text-purple-600">{totalPisos}</p><p className="text-gray-600 font-semibold">📏 Pisos Totales</p></div>
                  <div className="text-center"><p className="text-4xl font-bold text-green-600">{totalDeptos}</p><p className="text-gray-600 font-semibold">🏠 Deptos (estimado)</p></div>
                </div>
              </div>
            )}

            {condominioSeleccionado && (
              <div>
                <h3 className="text-xl font-bold mb-4">🏢 Torres de {condominioActual?.nombre}</h3>
                {torres.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {torres.map(torre => (
                      <div key={torre.id} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-2xl transition-all">
                        <div className="flex justify-between items-start mb-4">
                          <div><h4 className="text-2xl font-bold text-gray-800">Torre {torre.nombre}</h4><p className="text-gray-600">{torre.numero_pisos} pisos</p></div>
                          <button onClick={() => eliminarTorre(torre.id)} className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm">🗑️</button>
                        </div>
                        <div className="space-y-2">
                          <button onClick={() => window.location.href = `/dashboard/condominios/estructura/${torre.id}`} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">📏 Ver {torre.numero_pisos} Pisos</button>
                          <button className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold">🏠 Ver Departamentos</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                    <div className="text-6xl mb-4">🏗️</div>
                    <h4 className="text-xl font-bold text-gray-800 mb-2">No hay torres en este condominio</h4>
                    <p className="text-gray-600 mb-4">Crea la primera torre para comenzar</p>
                    <button onClick={() => setShowModalTorre(true)} className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-xl font-bold hover:shadow-xl">➕ Crear Primera Torre</button>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <div className="text-6xl mb-4">🏢</div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">No hay condominios registrados</h3>
            <p className="text-gray-600 mb-6">Comienza creando el primer condominio</p>
            <button onClick={() => setShowModalCondominio(true)} className="px-8 py-4 bg-gradient-to-r from-purple-600 to-purple-800 text-white rounded-xl font-bold hover:shadow-xl text-lg">➕ Crear Primer Condominio</button>
          </div>
        )}

        {showModalCondominio && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
              <div className="p-6 border-b bg-gradient-to-r from-purple-600 to-purple-800 text-white rounded-t-2xl"><h3 className="text-2xl font-bold">{modoEdicion ? '✏️ Editar Condominio' : '➕ Nuevo Condominio'}</h3></div>
              <form onSubmit={crearCondominio} className="p-6 space-y-4">
                <div><label className="block text-sm font-bold mb-2">Nombre *</label><input type="text" value={formCondominio.nombre} onChange={(e) => setFormCondominio({...formCondominio, nombre: e.target.value})} placeholder="Ej: Condominio Los Olivos" className="w-full px-4 py-3 border-2 rounded-xl focus:border-purple-500 outline-none" required /></div>
                <div><label className="block text-sm font-bold mb-2">Dirección *</label><input type="text" value={formCondominio.direccion} onChange={(e) => setFormCondominio({...formCondominio, direccion: e.target.value})} placeholder="Ej: Av. Principal 1234" className="w-full px-4 py-3 border-2 rounded-xl focus:border-purple-500 outline-none" required /></div>
                <div><label className="block text-sm font-bold mb-2">Comuna *</label><input type="text" value={formCondominio.comuna} onChange={(e) => setFormCondominio({...formCondominio, comuna: e.target.value})} placeholder="Ej: Las Condes" className="w-full px-4 py-3 border-2 rounded-xl focus:border-purple-500 outline-none" required /></div>
                <div><label className="block text-sm font-bold mb-2">Región *</label><input type="text" value={formCondominio.region} onChange={(e) => setFormCondominio({...formCondominio, region: e.target.value})} placeholder="Ej: Metropolitana" className="w-full px-4 py-3 border-2 rounded-xl focus:border-purple-500 outline-none" required /></div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => { setShowModalCondominio(false); setModoEdicion(false); setCondominioEditando(null) }} className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-xl font-bold hover:bg-gray-50">Cancelar</button>
                  <button type="submit" className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-800 text-white rounded-xl font-bold hover:shadow-xl">{modoEdicion ? '💾 Guardar' : '➕ Crear'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showModalTorre && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
              <div className="p-6 border-b bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-t-2xl"><h3 className="text-2xl font-bold">➕ Nueva Torre</h3><p className="text-blue-100 text-sm">{condominioActual?.nombre}</p></div>
              <form onSubmit={crearTorre} className="p-6 space-y-4">
                <div><label className="block text-sm font-bold mb-2">Nombre/Letra *</label><input type="text" value={formTorre.nombre} onChange={(e) => setFormTorre({...formTorre, nombre: e.target.value})} placeholder="A, B, C o Norte, Sur, etc" className="w-full px-4 py-3 border-2 rounded-xl focus:border-blue-500 outline-none" required /></div>
                <div><label className="block text-sm font-bold mb-2">Número de Pisos *</label><input type="number" value={formTorre.numero_pisos} onChange={(e) => setFormTorre({...formTorre, numero_pisos: parseInt(e.target.value)})} min="1" max="50" className="w-full px-4 py-3 border-2 rounded-xl focus:border-blue-500 outline-none" required /><p className="text-xs text-gray-500 mt-1">✨ Los pisos se crearán automáticamente</p></div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setShowModalTorre(false)} className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-xl font-bold hover:bg-gray-50">Cancelar</button>
                  <button type="submit" className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-xl font-bold hover:shadow-xl">➕ Crear Torre</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
