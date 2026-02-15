'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Persona {
  id: number
  nombre_completo: string
  rut: string
  telefono: string
  email: string
  roles: string[]
  estado: string
}

interface Condominio {
  id: number
  nombre: string
  direccion: string
  comuna: string
  region: string
}

interface Stats {
  total_personas: number
  total_condominios: number
  personas_activas: number
  personas_suspendidas: number
}

export default function CondominiosPage() {
  const [stats, setStats] = useState<Stats>({
    total_personas: 0,
    total_condominios: 0,
    personas_activas: 0,
    personas_suspendidas: 0
  })
  const [personas, setPersonas] = useState<Persona[]>([])
  const [condominios, setCondominios] = useState<Condominio[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [personasRes, condominiosRes] = await Promise.all([
        fetch('/api/personas/'),
        fetch('/api/condominios/')
      ])

      if (personasRes.ok && condominiosRes.ok) {
        const personasData = await personasRes.json()
        const condominiosData = await condominiosRes.json()

        setPersonas(personasData)
        setCondominios(condominiosData)

        setStats({
          total_personas: personasData.length,
          total_condominios: condominiosData.length,
          personas_activas: personasData.filter((p: Persona) => p.estado === 'activo').length,
          personas_suspendidas: personasData.filter((p: Persona) => p.estado === 'suspendido').length
        })
      }
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const modules = [
    {
      icon: '👥',
      title: 'Personas',
      description: 'Residentes, propietarios, conserjes y personal',
      href: '/dashboard/condominios/personas',
      color: 'from-purple-500 to-purple-700',
      stat: `${stats.total_personas} registrados`,
      active: true
    },
    {
      icon: '💰',
      title: 'Finanzas',
      description: 'Gastos comunes, pagos y morosidad',
      href: '/dashboard/condominios/finanzas',
      color: 'from-green-500 to-green-700',
      stat: 'Gestión completa',
      active: true
    },
    {
      icon: '🏗️',
      title: 'Estructura',
      description: 'Torres, pisos y departamentos',
      href: '/dashboard/condominios/estructura',
      color: 'from-blue-500 to-blue-700',
      stat: `${stats.total_condominios} condominio(s)`,
      active: true
    },
    {
      icon: '👷',
      title: 'Personal',
      description: 'Turnos, sueldos, adelantos y evaluaciones',
      href: '/dashboard/condominios/personal',
      color: 'from-orange-500 to-orange-700',
      stat: 'Control total RRHH',
      active: true
    },
    {
      icon: '📅',
      title: 'Operación',
      description: 'Reservas, comunicaciones y avisos',
      href: '/dashboard/condominios/operacion',
      color: 'from-yellow-500 to-yellow-700',
      stat: 'Próximamente',
      active: false
    },
    {
      icon: '🔐',
      title: 'Accesos',
      description: 'QR, facial, huella y kiosk',
      href: '/dashboard/condominios/accesos',
      color: 'from-red-500 to-red-700',
      stat: 'Próximamente',
      active: false
    },
    {
      icon: '🤖',
      title: 'IA ConectaAI',
      description: 'Asistente inteligente',
      href: '/dashboard/condominios/ia',
      color: 'from-indigo-500 to-indigo-700',
      stat: 'Próximamente',
      active: false
    },
    {
      icon: '📊',
      title: 'Reportes',
      description: 'Estadísticas y análisis',
      href: '/dashboard/condominios/reportes',
      color: 'from-pink-500 to-pink-700',
      stat: 'Próximamente',
      active: false
    }
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-700 font-medium">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-purple-900 shadow-xl px-8 py-6 mb-8">
        <div className="flex justify-between items-center">
          <div className="text-white">
            <h1 className="text-3xl font-bold mb-1">🏢 ConectaAI Condominios</h1>
            <p className="text-blue-200 text-sm font-medium">
              Gestión integral de edificios y comunidades
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-8 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-lg border-l-4 border-purple-500">
            <p className="text-sm text-gray-600 mb-1">Total Personas</p>
            <p className="text-3xl font-bold text-purple-600">{stats.total_personas}</p>
          </div>
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-lg border-l-4 border-blue-500">
            <p className="text-sm text-gray-600 mb-1">Condominios</p>
            <p className="text-3xl font-bold text-blue-600">{stats.total_condominios}</p>
          </div>
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-lg border-l-4 border-green-500">
            <p className="text-sm text-gray-600 mb-1">Activos</p>
            <p className="text-3xl font-bold text-green-600">{stats.personas_activas}</p>
          </div>
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-lg border-l-4 border-red-500">
            <p className="text-sm text-gray-600 mb-1">Suspendidos</p>
            <p className="text-3xl font-bold text-red-600">{stats.personas_suspendidas}</p>
          </div>
        </div>
      </div>

      {/* Dashboard Cards - BOTONES GRANDES */}
      <div className="px-8 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {modules.map((module) => (
            <Link 
              key={module.href}
              href={module.active ? module.href : '#'}
              className={module.active ? '' : 'pointer-events-none'}
            >
              <div className={`bg-gradient-to-br ${module.color} rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 relative ${
                !module.active && 'opacity-50'
              }`}>
                {!module.active && (
                  <div className="absolute inset-0 bg-black/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                    <span className="text-white font-bold text-lg bg-black/50 px-4 py-2 rounded-full">
                      Próximamente
                    </span>
                  </div>
                )}
                <div className="text-6xl mb-4">{module.icon}</div>
                <h2 className="text-2xl font-bold text-white mb-2">{module.title}</h2>
                <p className="text-white/90 text-sm mb-4">
                  {module.description}
                </p>
                <div className="flex items-center text-white">
                  <span className="text-lg font-semibold">{module.stat}</span>
                </div>
              </div>
            </Link>
          ))}

        </div>
      </div>

      {/* Preview rápido de últimas personas */}
      {personas.length > 0 && (
        <div className="px-8 pb-8">
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-lg">
            <h3 className="text-xl font-bold text-gray-800 mb-4">👥 Últimas Personas Registradas</h3>
            <div className="space-y-3">
              {personas.slice(0, 5).map((persona) => (
                <div key={persona.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="font-semibold text-gray-800">{persona.nombre_completo}</p>
                    <p className="text-sm text-gray-600">{persona.rut} • {persona.roles.join(', ')}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    persona.estado === 'activo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {persona.estado}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
