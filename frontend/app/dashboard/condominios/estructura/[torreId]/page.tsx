'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface Piso { id: number; torre_id: number; numero: number }
interface Departamento { id: number; piso_id: number; numero: string; metros_cuadrados: number; dormitorios: number; banos: number; propietario_id: number | null; residente_id: number | null; estado: string }
interface Torre { id: number; nombre: string; numero_pisos: number }
interface Persona { id: number; nombre_completo: string; rut: string; roles: string[] }

export default function TorreDetallePage() {
  const params = useParams()
  const router = useRouter()
  const torreId = parseInt(params.torreId as string)
  
  const [torre, setTorre] = useState<Torre | null>(null)
  const [pisos, setPisos] = useState<Piso[]>([])
  const [departamentos, setDepartamentos] = useState<Record<number, Departamento[]>>({})
  const [personas, setPersonas] = useState<Persona[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [pisoSeleccionado, setPisoSeleccionado] = useState<number | null>(null)
  const [formDepto, setFormDepto] = useState({ numero: '', metros_cuadrados: 50, dormitorios: 2, banos: 1, propietario_id: null as number | null, residente_id: null as number | null, estado: 'disponible' })

  useEffect(() => { fetchData() }, [torreId])

  async function fetchData() {
    try {
      const [pisosRes, personasRes] = await Promise.all([
        fetch(`/api/condominios/torres/${torreId}/pisos`),
        fetch('/api/personas')
      ])
      if (pisosRes.ok) {
        const pisosData = await pisosRes.json()
        setPisos(pisosData)
        for (const piso of pisosData) {
          const deptosRes = await fetch(`/api/condominios/pisos/${piso.id}/departamentos`)
          if (deptosRes.ok) {
            const deptosData = await deptosRes.json()
            setDepartamentos(prev => ({ ...prev, [piso.id]: deptosData }))
          }
        }
      }
      if (personasRes.ok) setPersonas(await personasRes.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function crearDepartamento(e: React.FormEvent) {
    e.preventDefault()
    if (!pisoSeleccionado) return
    try {
      const res = await fetch(`/api/condominios/pisos/${pisoSeleccionado}/departamentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formDepto)
      })
      if (res.ok) {
        setShowModal(false)
        fetchData()
        setFormDepto({ numero: '', metros_cuadrados: 50, dormitorios: 2, banos: 1, propietario_id: null, residente_id: null, estado: 'disponible' })
        alert('✅ Departamento creado')
      } else {
        const error = await res.json()
        alert(`❌ Error: ${JSON.stringify(error)}`)
      }
    } catch (err) {
      console.error(err)
      alert('❌ Error al crear departamento')
    }
  }

  async function eliminarDepartamento(deptoId: number) {
    if (!confirm('¿Eliminar departamento?')) return
    try {
      const res = await fetch(`/api/condominios/departamentos/${deptoId}`, { method: 'DELETE' })
      if (res.ok) { fetchData(); alert('✅ Departamento eliminado') }
    } catch (err) { alert('❌ Error') }
  }

  function abrirModalDepto(pisoId: number) { setPisoSeleccionado(pisoId); setShowModal(true) }

  if (loading) return (<div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div></div>)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <button onClick={() => router.back()} className="text-blue-600 hover:text-blue-800 font-semibold mb-2">← Volver</button>
            <h1 className="text-3xl font-bold text-gray-800">🏢 Torre {torre?.nombre}</h1>
            <p className="text-gray-600">{pisos.length} pisos</p>
          </div>
        </div>

        <div className="space-y-6">
          {pisos.sort((a, b) => b.numero - a.numero).map(piso => {
            const deptosPiso = departamentos[piso.id] || []
            return (
              <div key={piso.id} className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <div><h3 className="text-xl font-bold text-gray-800">Piso {piso.numero}</h3><p className="text-sm text-gray-600">{deptosPiso.length} departamento(s)</p></div>
                  <button onClick={() => abrirModalDepto(piso.id)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold">➕ Agregar Depto</button>
                </div>
                {deptosPiso.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {deptosPiso.map(depto => {
                      const propietario = personas.find(p => p.id === depto.propietario_id)
                      return (
                        <div key={depto.id} className="border-2 border-gray-200 rounded-lg p-4 hover:border-blue-500 transition-all">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="text-lg font-bold text-gray-800">Depto {depto.numero}</h4>
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${depto.estado === 'ocupado' ? 'bg-green-100 text-green-700' : depto.estado === 'disponible' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{depto.estado}</span>
                          </div>
                          <div className="text-sm text-gray-600 space-y-1 mb-3">
                            <p>📐 {depto.metros_cuadrados}m²</p>
                            <p>🛏️ {depto.dormitorios} dorm • 🚿 {depto.banos} baños</p>
                            {propietario && (<p className="text-xs">👤 {propietario.nombre_completo}</p>)}
                          </div>
                          <button onClick={() => eliminarDepartamento(depto.id)} className="w-full px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm">🗑️ Eliminar</button>
                        </div>
                      )
                    })}
                  </div>
                ) : (<div className="text-center py-8 text-gray-500"><p>No hay departamentos en este piso</p></div>)}
              </div>
            )
          })}
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b bg-gradient-to-r from-green-600 to-green-800 text-white rounded-t-2xl sticky top-0"><h3 className="text-2xl font-bold">➕ Nuevo Departamento</h3><p className="text-green-100 text-sm">Piso {pisos.find(p => p.id === pisoSeleccionado)?.numero}</p></div>
              <form onSubmit={crearDepartamento} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-bold mb-2">Número *</label><input type="text" value={formDepto.numero} onChange={(e) => setFormDepto({...formDepto, numero: e.target.value})} placeholder="101, 102, A, B..." className="w-full px-4 py-3 border-2 rounded-xl focus:border-green-500 outline-none" required /></div>
                  <div><label className="block text-sm font-bold mb-2">M² *</label><input type="number" value={formDepto.metros_cuadrados} onChange={(e) => setFormDepto({...formDepto, metros_cuadrados: parseFloat(e.target.value)})} className="w-full px-4 py-3 border-2 rounded-xl focus:border-green-500 outline-none" required /></div>
                  <div><label className="block text-sm font-bold mb-2">Dormitorios *</label><input type="number" value={formDepto.dormitorios} onChange={(e) => setFormDepto({...formDepto, dormitorios: parseInt(e.target.value)})} min="0" max="10" className="w-full px-4 py-3 border-2 rounded-xl focus:border-green-500 outline-none" required /></div>
                  <div><label className="block text-sm font-bold mb-2">Baños *</label><input type="number" value={formDepto.banos} onChange={(e) => setFormDepto({...formDepto, banos: parseInt(e.target.value)})} min="1" max="10" className="w-full px-4 py-3 border-2 rounded-xl focus:border-green-500 outline-none" required /></div>
                </div>
                <div><label className="block text-sm font-bold mb-2">Propietario (opcional)</label><select value={formDepto.propietario_id || ''} onChange={(e) => setFormDepto({...formDepto, propietario_id: e.target.value ? parseInt(e.target.value) : null})} className="w-full px-4 py-3 border-2 rounded-xl focus:border-green-500 outline-none"><option value="">Sin asignar</option>{personas.filter(p => p.roles?.includes('propietario')).map(p => (<option key={p.id} value={p.id}>{p.nombre_completo} - {p.rut}</option>))}</select></div>
                <div><label className="block text-sm font-bold mb-2">Residente (opcional)</label><select value={formDepto.residente_id || ''} onChange={(e) => setFormDepto({...formDepto, residente_id: e.target.value ? parseInt(e.target.value) : null})} className="w-full px-4 py-3 border-2 rounded-xl focus:border-green-500 outline-none"><option value="">Sin asignar</option>{personas.filter(p => p.roles?.includes('residente')).map(p => (<option key={p.id} value={p.id}>{p.nombre_completo} - {p.rut}</option>))}</select></div>
                <div><label className="block text-sm font-bold mb-2">Estado *</label><select value={formDepto.estado} onChange={(e) => setFormDepto({...formDepto, estado: e.target.value})} className="w-full px-4 py-3 border-2 rounded-xl focus:border-green-500 outline-none"><option value="disponible">Disponible</option><option value="ocupado">Ocupado</option><option value="en_venta">En Venta</option><option value="en_arriendo">En Arriendo</option></select></div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-xl font-bold hover:bg-gray-50">Cancelar</button>
                  <button type="submit" className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-green-800 text-white rounded-xl font-bold hover:shadow-xl">➕ Crear</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
