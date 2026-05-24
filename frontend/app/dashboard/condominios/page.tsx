'use client'
import { useState, useEffect, useCallback } from 'react'
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

interface MailStatus {
  connected: boolean
  provider: string
  from_email: string
  api_url_public: string
  status_code?: number
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
  const [mailStatus, setMailStatus] = useState<MailStatus | null>(null)
  const [mailLoading, setMailLoading] = useState(true)
  const [testingMail, setTestingMail] = useState(false)
  const [testMsg, setTestMsg] = useState('')

  useEffect(() => {
    fetchData()
    fetchMailStatus()
  }, [])

  async function fetchData() {
    try {
      const [personasRes, condominiosRes] = await Promise.all([
        fetch('/api/personas'),
        fetch('/api/condominios')
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

  async function fetchMailStatus() {
    setMailLoading(true)
    try {
      const res = await fetch('/api/mail')
      if (res.ok) setMailStatus(await res.json())
    } catch {}
    setMailLoading(false)
  }

  async function sendTestMail() {
    setTestingMail(true)
    setTestMsg('')
    try {
      const res = await fetch('/api/mail', { method: 'POST' })
      const data = await res.json()
      setTestMsg(data.message || (data.ok ? 'Enviado' : 'Error'))
    } catch {
      setTestMsg('No se pudo conectar')
    }
    setTestingMail(false)
    setTimeout(() => setTestMsg(''), 5000)
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
      title: 'Reservas',
      description: 'Espacios comunes y reservas de residentes',
      href: '/dashboard/condominios/reservas',
      color: 'from-yellow-500 to-yellow-700',
      stat: 'Gestión completa',
      active: true
    },
    {
      icon: '📣',
      title: 'Avisos',
      description: 'Comunicados y anuncios para residentes',
      href: '/dashboard/condominios/avisos',
      color: 'from-red-500 to-red-700',
      stat: 'Publicar avisos',
      active: true
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
      <div className="bg-gradient-to-r from-blue-700 to-purple-900 shadow-xl px-4 sm:px-8 py-6 mb-6 sm:mb-8">
        <div className="text-white">
          <h1 className="text-2xl sm:text-3xl font-bold mb-1">🏢 ConectaAI Condominios</h1>
          <p className="text-blue-200 text-sm font-medium">
            Gestión integral de edificios y comunidades
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-4 sm:px-8 mb-6 sm:mb-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6">
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-4 sm:p-6 shadow-lg border-l-4 border-purple-500">
            <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Personas</p>
            <p className="text-2xl sm:text-3xl font-bold text-purple-600">{stats.total_personas}</p>
          </div>
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-4 sm:p-6 shadow-lg border-l-4 border-blue-500">
            <p className="text-xs sm:text-sm text-gray-600 mb-1">Condominios</p>
            <p className="text-2xl sm:text-3xl font-bold text-blue-600">{stats.total_condominios}</p>
          </div>
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-4 sm:p-6 shadow-lg border-l-4 border-green-500">
            <p className="text-xs sm:text-sm text-gray-600 mb-1">Activos</p>
            <p className="text-2xl sm:text-3xl font-bold text-green-600">{stats.personas_activas}</p>
          </div>
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-4 sm:p-6 shadow-lg border-l-4 border-red-500">
            <p className="text-xs sm:text-sm text-gray-600 mb-1">Suspendidos</p>
            <p className="text-2xl sm:text-3xl font-bold text-red-600">{stats.personas_suspendidas}</p>
          </div>
        </div>
      </div>

      {/* Mail Provider Status Widget */}
      <div className="px-4 sm:px-8 mb-6 sm:mb-8">
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-4 sm:p-5 shadow-lg border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-sm ${
                mailLoading ? 'bg-gray-100' : mailStatus?.connected ? 'bg-green-100' : 'bg-red-100'
              }`}>
                ✉️
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-800 text-sm sm:text-base">Proveedor de Correo</span>
                  {mailLoading ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse"></span>
                      Verificando...
                    </span>
                  ) : mailStatus?.connected ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                      Conectado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                      Sin conexión
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {mailStatus ? (
                    <>
                      <span className="font-medium text-purple-700">{mailStatus.provider}</span>
                      {' · '}
                      <span>{mailStatus.from_email}</span>
                    </>
                  ) : 'mail.conectaai.cl · no-reply@conectaai.cl'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:flex-shrink-0">
              {testMsg && (
                <span className={`text-xs px-3 py-1.5 rounded-lg ${
                  testMsg.toLowerCase().includes('error') || testMsg.toLowerCase().includes('no se pudo')
                    ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                }`}>
                  {testMsg}
                </span>
              )}
              <button
                onClick={sendTestMail}
                disabled={testingMail}
                className="text-xs px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
              >
                {testingMail ? 'Enviando...' : 'Enviar prueba'}
              </button>
              <button
                onClick={fetchMailStatus}
                disabled={mailLoading}
                className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 rounded-lg font-medium transition-colors"
              >
                {mailLoading ? '...' : 'Verificar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Cards */}
      <div className="px-4 sm:px-8 pb-8">
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {modules.map((module) => (
            <Link
              key={module.href}
              href={module.active ? module.href : '#'}
              className={module.active ? '' : 'pointer-events-none'}
            >
              <div className={`bg-gradient-to-br ${module.color} rounded-2xl p-4 sm:p-8 shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 relative ${
                !module.active && 'opacity-50'
              }`}>
                {!module.active && (
                  <div className="absolute inset-0 bg-black/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                    <span className="text-white font-bold text-sm sm:text-lg bg-black/50 px-3 py-1 sm:px-4 sm:py-2 rounded-full">
                      Próximamente
                    </span>
                  </div>
                )}
                <div className="text-4xl sm:text-6xl mb-2 sm:mb-4">{module.icon}</div>
                <h2 className="text-lg sm:text-2xl font-bold text-white mb-1 sm:mb-2">{module.title}</h2>
                <p className="text-white/90 text-xs sm:text-sm mb-2 sm:mb-4 hidden sm:block">
                  {module.description}
                </p>
                <div className="flex items-center text-white">
                  <span className="text-sm sm:text-lg font-semibold">{module.stat}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Preview rápido de últimas personas */}
      {personas.length > 0 && (
        <div className="px-4 sm:px-8 pb-8">
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-4 sm:p-6 shadow-lg">
            <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">👥 Últimas Personas Registradas</h3>
            <div className="space-y-3">
              {personas.slice(0, 5).map((persona) => (
                <div key={persona.id} className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-xl gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 text-sm sm:text-base truncate">{persona.nombre_completo}</p>
                    <p className="text-xs sm:text-sm text-gray-600 truncate">{persona.rut} · {persona.roles.join(', ')}</p>
                  </div>
                  <span className={`flex-shrink-0 px-2 sm:px-3 py-1 rounded-full text-xs font-bold ${
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
