'use client'
import { useState, useEffect } from 'react'

interface Persona {
  id: number
  nombre_completo: string
  rut: string
  telefono: string
  email: string
  roles: string[]
  estado: string
  datos_contacto: any
}

interface Condominio {
  id: number
  nombre: string
}

export default function PersonasPage() {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [condominios, setCondominios] = useState<Condominio[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null)
  const [vistaActual, setVistaActual] = useState<'residentes' | 'personal'>('residentes')
  const [busqueda, setBusqueda] = useState('')
  const [formData, setFormData] = useState({
    nombre_completo: '',
    rut: '',
    telefono: '',
    email: '',
    roles: [] as string[],
    estado: 'activo',
    datos_contacto: {
      condominio_id: '',
      torre: '',
      piso: '',
      departamento: '',
      telefono_emergencia: '',
      contacto_emergencia: '',
      familiares: [] as Array<{nombre: string, telefono: string, relacion: string}>
    }
  })

  const ROLES_RESIDENTES = ['propietario', 'residente', 'arrendatario']
  const ROLES_PERSONAL = ['conserje', 'aseo', 'mantencion', 'administrador']

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [personasRes, condominiosRes] = await Promise.all([
        fetch('/api/personas/'),
        fetch('/api/condominios/')
      ])

      if (personasRes.ok) setPersonas(await personasRes.json())
      if (condominiosRes.ok) setCondominios(await condominiosRes.json())
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setFormData({
      nombre_completo: '',
      rut: '',
      telefono: '',
      email: '',
      roles: [],
      estado: 'activo',
      datos_contacto: {
        condominio_id: '',
        torre: '',
        piso: '',
        departamento: '',
        telefono_emergencia: '',
        contacto_emergencia: '',
        familiares: []
      }
    })
  }

  function handleNew(tipo: 'residentes' | 'personal') {
    resetForm()
    if (tipo === 'personal') {
      setFormData({...formData, roles: ['conserje']})
    }
    setEditingPersona(null)
    setShowModal(true)
  }

  function handleEdit(persona: Persona) {
    setEditingPersona(persona)
    setFormData({
      nombre_completo: persona.nombre_completo,
      rut: persona.rut,
      telefono: persona.telefono,
      email: persona.email,
      roles: persona.roles,
      estado: persona.estado,
      datos_contacto: persona.datos_contacto || {
        condominio_id: '',
        torre: '',
        piso: '',
        departamento: '',
        telefono_emergencia: '',
        contacto_emergencia: '',
        familiares: []
      }
    })
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      const url = editingPersona
        ? `/api/personas/${editingPersona.id}`
        : '/api/personas/'

      const method = editingPersona ? 'PUT' : 'POST'

      // ✅ AGREGADO: tenant_id al payload
      const payload = {
        ...formData,
        tenant_id: 1 // Por ahora hardcodeado a tenant demo
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        setShowModal(false)
        setEditingPersona(null)
        resetForm()
        fetchData()
        alert(editingPersona ? '✅ Persona actualizada' : '✅ Persona creada')
      } else {
        const error = await res.json()
        alert(`❌ Error: ${error.detail || JSON.stringify(error)}`)
      }
    } catch (err) {
      console.error('Error completo:', err)
      alert('❌ Error al guardar. Revisa la consola.')
    }
  }

  async function handleDelete(id: number, nombre: string) {
    if (!confirm(`¿Eliminar a ${nombre}?`)) return

    try {
      const res = await fetch(`/api/personas/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchData()
        alert('✅ Persona eliminada')
      }
    } catch (err) {
      alert('❌ Error al eliminar')
    }
  }

  function toggleRole(role: string) {
    if (formData.roles.includes(role)) {
      setFormData({...formData, roles: formData.roles.filter(r => r !== role)})
    } else {
      setFormData({...formData, roles: [...formData.roles, role]})
    }
  }

  function agregarFamiliar() {
    setFormData({
      ...formData,
      datos_contacto: {
        ...formData.datos_contacto,
        familiares: [...formData.datos_contacto.familiares, {nombre: '', telefono: '', relacion: ''}]
      }
    })
  }

  function eliminarFamiliar(index: number) {
    const nuevos = formData.datos_contacto.familiares.filter((_: any, i: number) => i !== index)
    setFormData({
      ...formData,
      datos_contacto: {
        ...formData.datos_contacto,
        familiares: nuevos
      }
    })
  }

  function updateFamiliar(index: number, field: string, value: string) {
    const nuevos = [...formData.datos_contacto.familiares]
    nuevos[index] = {...nuevos[index], [field]: value}
    setFormData({
      ...formData,
      datos_contacto: {
        ...formData.datos_contacto,
        familiares: nuevos
      }
    })
  }

  // FILTROS
  const personasFiltradas = personas.filter(p => {
    // Filtro por tipo
    const esResidente = p.roles.some(r => ROLES_RESIDENTES.includes(r))
    const esPersonal = p.roles.some(r => ROLES_PERSONAL.includes(r))

    if (vistaActual === 'residentes' && !esResidente) return false
    if (vistaActual === 'personal' && !esPersonal) return false

    // Filtro por búsqueda
    if (busqueda) {
      const termino = busqueda.toLowerCase()
      return (
        p.nombre_completo.toLowerCase().includes(termino) ||
        p.rut.toLowerCase().includes(termino) ||
        p.email.toLowerCase().includes(termino) ||
        p.telefono.includes(termino) ||
        (p.datos_contacto?.departamento && p.datos_contacto.departamento.toLowerCase().includes(termino))
      )
    }

    return true
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">👥 Gestión de Personas</h1>
            <p className="text-gray-600">Residentes, propietarios y personal del condominio</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => handleNew('residentes')}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-800 text-white rounded-xl font-bold hover:shadow-xl transition-all"
            >
              ➕ Nuevo Residente
            </button>
            <button
              onClick={() => handleNew('personal')}
              className="px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-800 text-white rounded-xl font-bold hover:shadow-xl transition-all"
            >
              👷 Nuevo Personal
            </button>
          </div>
        </div>

        {/* Tabs + Búsqueda */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setVistaActual('residentes')}
              className={`px-6 py-3 rounded-xl font-bold transition-all ${
                vistaActual === 'residentes'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              🏠 Residentes ({personas.filter(p => p.roles.some(r => ROLES_RESIDENTES.includes(r))).length})
            </button>
            <button
              onClick={() => setVistaActual('personal')}
              className={`px-6 py-3 rounded-xl font-bold transition-all ${
                vistaActual === 'personal'
                  ? 'bg-orange-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              👷 Personal ({personas.filter(p => p.roles.some(r => ROLES_PERSONAL.includes(r))).length})
            </button>
          </div>

          {/* Barra de Búsqueda */}
          <div className="relative">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="🔍 Buscar por nombre, RUT, depto..."
              className="px-6 py-3 pr-12 border-2 border-gray-300 rounded-xl focus:border-purple-500 outline-none w-96"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <p className="text-sm text-gray-600">Total</p>
            <p className="text-3xl font-bold text-purple-600">{personasFiltradas.length}</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <p className="text-sm text-gray-600">Activos</p>
            <p className="text-3xl font-bold text-green-600">
              {personasFiltradas.filter(p => p.estado === 'activo').length}
            </p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <p className="text-sm text-gray-600">
              {vistaActual === 'residentes' ? 'Propietarios' : 'Conserjes'}
            </p>
            <p className="text-3xl font-bold text-blue-600">
              {vistaActual === 'residentes'
                ? personasFiltradas.filter(p => p.roles.includes('propietario')).length
                : personasFiltradas.filter(p => p.roles.includes('conserje')).length
              }
            </p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <p className="text-sm text-gray-600">
              {vistaActual === 'residentes' ? 'Arrendatarios' : 'Aseo'}
            </p>
            <p className="text-3xl font-bold text-orange-600">
              {vistaActual === 'residentes'
                ? personasFiltradas.filter(p => p.roles.includes('arrendatario')).length
                : personasFiltradas.filter(p => p.roles.includes('aseo')).length
              }
            </p>
          </div>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <table className="w-full">
            <thead className={`bg-gradient-to-r ${
              vistaActual === 'residentes'
                ? 'from-purple-600 to-purple-800'
                : 'from-orange-600 to-orange-800'
            } text-white`}>
              <tr>
                <th className="px-6 py-4 text-left">Nombre</th>
                <th className="px-6 py-4 text-left">RUT</th>
                {vistaActual === 'residentes' && (
                  <th className="px-6 py-4 text-left">Ubicación</th>
                )}
                <th className="px-6 py-4 text-left">Contacto</th>
                <th className="px-6 py-4 text-left">Roles</th>
                <th className="px-6 py-4 text-left">Estado</th>
                <th className="px-6 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {personasFiltradas.map((persona, idx) => (
                <tr key={persona.id} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="px-6 py-4 font-semibold text-gray-800">{persona.nombre_completo}</td>
                  <td className="px-6 py-4 text-gray-600">{persona.rut}</td>
                  {vistaActual === 'residentes' && (
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {persona.datos_contacto?.torre && (
                        <div>
                          <div className="font-semibold">Torre {persona.datos_contacto.torre}</div>
                          <div>Piso {persona.datos_contacto.piso}, Depto {persona.datos_contacto.departamento}</div>
                        </div>
                      )}
                    </td>
                  )}
                  <td className="px-6 py-4 text-sm text-gray-600">
                    📞 {persona.telefono}<br/>
                    ✉️ {persona.email}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {persona.roles.map(rol => (
                        <span key={rol} className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          ROLES_RESIDENTES.includes(rol)
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          {rol}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      persona.estado === 'activo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {persona.estado}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => handleEdit(persona)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => handleDelete(persona.id, persona.nombre_completo)}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-semibold"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {personasFiltradas.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-xl">
                {busqueda
                  ? `🔍 No se encontraron resultados para "${busqueda}"`
                  : `👥 No hay ${vistaActual === 'residentes' ? 'residentes' : 'personal'} registrados`
                }
              </p>
            </div>
          )}
        </div>

        {/* Modal - MISMO DE ANTES CON LOS CAMPOS COMPLETOS */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-8 max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b bg-gradient-to-r from-purple-600 to-purple-800 text-white rounded-t-2xl sticky top-0 z-10">
                <h3 className="text-2xl font-bold">
                  {editingPersona ? '✏️ Editar Persona' : '➕ Nueva Persona'}
                </h3>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* DATOS BÁSICOS */}
                <div className="bg-gray-50 p-4 rounded-xl">
                  <h4 className="font-bold text-lg mb-4">📋 Datos Básicos</h4>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold mb-2 text-gray-700">Nombre Completo *</label>
                      <input
                        type="text"
                        value={formData.nombre_completo}
                        onChange={(e) => setFormData({...formData, nombre_completo: e.target.value})}
                        className="w-full px-4 py-3 border-2 rounded-xl focus:border-purple-500 outline-none"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold mb-2 text-gray-700">RUT *</label>
                        <input
                          type="text"
                          value={formData.rut}
                          onChange={(e) => setFormData({...formData, rut: e.target.value})}
                          className="w-full px-4 py-3 border-2 rounded-xl focus:border-purple-500 outline-none"
                          required
                          disabled={!!editingPersona}
                          placeholder="12345678-9"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold mb-2 text-gray-700">Teléfono *</label>
                        <input
                          type="tel"
                          value={formData.telefono}
                          onChange={(e) => setFormData({...formData, telefono: e.target.value})}
                          className="w-full px-4 py-3 border-2 rounded-xl focus:border-purple-500 outline-none"
                          required
                          placeholder="+56912345678"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-2 text-gray-700">Email *</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="w-full px-4 py-3 border-2 rounded-xl focus:border-purple-500 outline-none"
                        required
                        placeholder="persona@ejemplo.cl"
                      />
                    </div>
                  </div>
                </div>

                {/* UBICACIÓN - SOLO PARA RESIDENTES */}
                {!formData.roles.some(r => ROLES_PERSONAL.includes(r)) && (
                  <div className="bg-blue-50 p-4 rounded-xl">
                    <h4 className="font-bold text-lg mb-4">🏢 Ubicación en Condominio</h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold mb-2">Condominio</label>
                        <select
                          value={formData.datos_contacto.condominio_id}
                          onChange={(e) => setFormData({
                            ...formData,
                            datos_contacto: {...formData.datos_contacto, condominio_id: e.target.value}
                          })}
                          className="w-full px-4 py-3 border-2 rounded-xl focus:border-blue-500 outline-none"
                        >
                          <option value="">Seleccionar...</option>
                          {condominios.map(c => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold mb-2">Torre/Bloque</label>
                        <input
                          type="text"
                          value={formData.datos_contacto.torre}
                          onChange={(e) => setFormData({
                            ...formData,
                            datos_contacto: {...formData.datos_contacto, torre: e.target.value}
                          })}
                          className="w-full px-4 py-3 border-2 rounded-xl focus:border-blue-500 outline-none"
                          placeholder="A, B, 1, 2..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold mb-2">Piso</label>
                        <input
                          type="text"
                          value={formData.datos_contacto.piso}
                          onChange={(e) => setFormData({
                            ...formData,
                            datos_contacto: {...formData.datos_contacto, piso: e.target.value}
                          })}
                          className="w-full px-4 py-3 border-2 rounded-xl focus:border-blue-500 outline-none"
                          placeholder="1, 2, 3..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold mb-2">Departamento</label>
                        <input
                          type="text"
                          value={formData.datos_contacto.departamento}
                          onChange={(e) => setFormData({
                            ...formData,
                            datos_contacto: {...formData.datos_contacto, departamento: e.target.value}
                          })}
                          className="w-full px-4 py-3 border-2 rounded-xl focus:border-blue-500 outline-none"
                          placeholder="101, 202, A, B..."
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ROLES */}
                <div className="bg-purple-50 p-4 rounded-xl">
                  <h4 className="font-bold text-lg mb-4">👤 Roles</h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">Residentes:</p>
                      <div className="flex flex-wrap gap-2">
                        {ROLES_RESIDENTES.map(rol => (
                          <button
                            key={rol}
                            type="button"
                            onClick={() => toggleRole(rol)}
                            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                              formData.roles.includes(rol)
                                ? 'bg-purple-600 text-white shadow-lg'
                                : 'bg-white text-gray-700 hover:bg-gray-100 border-2'
                            }`}
                          >
                            {rol}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">Personal:</p>
                      <div className="flex flex-wrap gap-2">
                        {ROLES_PERSONAL.map(rol => (
                          <button
                            key={rol}
                            type="button"
                            onClick={() => toggleRole(rol)}
                            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                              formData.roles.includes(rol)
                                ? 'bg-orange-600 text-white shadow-lg'
                                : 'bg-white text-gray-700 hover:bg-gray-100 border-2'
                            }`}
                          >
                            {rol}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* CONTACTO EMERGENCIA */}
                <div className="bg-red-50 p-4 rounded-xl">
                  <h4 className="font-bold text-lg mb-4">🚨 Contacto de Emergencia</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold mb-2">Nombre</label>
                      <input
                        type="text"
                        value={formData.datos_contacto.contacto_emergencia}
                        onChange={(e) => setFormData({
                          ...formData,
                          datos_contacto: {...formData.datos_contacto, contacto_emergencia: e.target.value}
                        })}
                        className="w-full px-4 py-3 border-2 rounded-xl focus:border-red-500 outline-none"
                        placeholder="Nombre completo"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold mb-2">Teléfono</label>
                      <input
                        type="tel"
                        value={formData.datos_contacto.telefono_emergencia}
                        onChange={(e) => setFormData({
                          ...formData,
                          datos_contacto: {...formData.datos_contacto, telefono_emergencia: e.target.value}
                        })}
                        className="w-full px-4 py-3 border-2 rounded-xl focus:border-red-500 outline-none"
                        placeholder="+56912345678"
                      />
                    </div>
                  </div>
                </div>

                {/* FAMILIARES - SOLO PARA RESIDENTES */}
                {!formData.roles.some(r => ROLES_PERSONAL.includes(r)) && (
                  <div className="bg-green-50 p-4 rounded-xl">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-bold text-lg">👨‍👩‍👧‍👦 Familiares/Habitantes</h4>
                      <button
                        type="button"
                        onClick={agregarFamiliar}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold"
                      >
                        ➕ Agregar
                      </button>
                    </div>

                    {formData.datos_contacto.familiares.map((fam: any, idx: number) => (
                      <div key={idx} className="grid grid-cols-3 gap-4 mb-3 bg-white p-3 rounded-lg">
                        <input
                          type="text"
                          value={fam.nombre}
                          onChange={(e) => updateFamiliar(idx, 'nombre', e.target.value)}
                          placeholder="Nombre"
                          className="px-3 py-2 border-2 rounded-lg outline-none"
                        />
                        <input
                          type="tel"
                          value={fam.telefono}
                          onChange={(e) => updateFamiliar(idx, 'telefono', e.target.value)}
                          placeholder="Teléfono"
                          className="px-3 py-2 border-2 rounded-lg outline-none"
                        />
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={fam.relacion}
                            onChange={(e) => updateFamiliar(idx, 'relacion', e.target.value)}
                            placeholder="Relación"
                            className="flex-1 px-3 py-2 border-2 rounded-lg outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => eliminarFamiliar(idx)}
                            className="px-3 bg-red-500 text-white rounded-lg hover:bg-red-600"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ESTADO */}
                <div>
                  <label className="block text-sm font-bold mb-2 text-gray-700">Estado</label>
                  <select
                    value={formData.estado}
                    onChange={(e) => setFormData({...formData, estado: e.target.value})}
                    className="w-full px-4 py-3 border-2 rounded-xl focus:border-purple-500 outline-none"
                  >
                    <option value="activo">✅ Activo</option>
                    <option value="suspendido">⏸️ Suspendido</option>
                    <option value="inactivo">❌ Inactivo</option>
                  </select>
                </div>

                {/* BOTONES */}
                <div className="flex gap-4 pt-4 sticky bottom-0 bg-white pb-4">
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); setEditingPersona(null); resetForm() }}
                    className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-xl font-bold hover:bg-gray-50 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-800 text-white rounded-xl font-bold hover:shadow-xl transition-all"
                  >
                    {editingPersona ? '💾 Guardar Cambios' : '➕ Crear Persona'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
