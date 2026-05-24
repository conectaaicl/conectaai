'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import ModalCotizacion from './components/ModalCotizacion'

interface Deal {
  id: number
  cliente: string
  monto: number
  etapa: string
  origen: string
  fecha: string
  contacto?: string
  email?: string
  telefono?: string
  probabilidad: number
}

interface Stats {
  total_pipeline: number
  total_deals: number
  tasa_conversion: number
  forecast_ponderado: number
  por_etapa: Record<string, { count: number; monto: number }>
}

interface WhatsAppStats {
  conversaciones: { total: number; activas: number }
  leads: { total: number; calientes: number; ganados: number }
  mensajes: { total: number }
}

const ETAPAS = [
  { key: 'prospecto', label: 'Prospecto', icon: '🔍' },
  { key: 'calificado', label: 'Calificado', icon: '✅' },
  { key: 'propuesta', label: 'Propuesta', icon: '📄' },
  { key: 'negociacion', label: 'Negociación', icon: '🤝' },
  { key: 'ganado', label: 'Ganado', icon: '🎉' },
  { key: 'perdido', label: 'Perdido', icon: '❌' }
]

const ETAPA_COLORS: Record<string, string> = {
  'prospecto': 'from-gray-400 to-gray-600',
  'calificado': 'from-blue-400 to-blue-600',
  'propuesta': 'from-yellow-400 to-yellow-600',
  'negociacion': 'from-orange-400 to-orange-600',
  'ganado': 'from-green-400 to-green-600',
  'perdido': 'from-red-400 to-red-600'
}

export default function VentasPage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [whatsappStats, setWhatsappStats] = useState<WhatsAppStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null)
  const [showDrawer, setShowDrawer] = useState(false)
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [showModalCotizacion, setShowModalCotizacion] = useState(false)
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null)

  useEffect(() => {
    fetchDeals()
    fetchStats()
    fetchWhatsAppStats()
  }, [])

  async function fetchDeals() {
    try {
      const response = await fetch('/api/ventas/deals')
      if (response.ok) {
        const data = await response.json()
        setDeals(data)
      }
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchStats() {
    try {
      const response = await fetch('/api/ventas/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (err) {
      console.error('Error:', err)
    }
  }

  async function fetchWhatsAppStats() {
    try {
      const response = await fetch('/api/whatsapp360/stats?tenant_id=1', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setWhatsappStats(data)
      }
    } catch (err) {
      console.error('Error loading WhatsApp stats:', err)
    }
  }

  function handleDragStart(deal: Deal) {
    setDraggedDeal(deal)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  async function handleDrop(etapa: string) {
    if (!draggedDeal) return

    try {
      const response = await fetch(`/api/ventas/deals/${draggedDeal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etapa })
      })

      if (response.ok) {
        fetchDeals()
        fetchStats()
      }
    } catch (err) {
      console.error('Error:', err)
    }

    setDraggedDeal(null)
  }

  async function handleDeleteDeal() {
    if (!selectedDeal) return
    if (!confirm(`¿Eliminar deal "${selectedDeal.cliente}"?`)) return

    try {
      const response = await fetch(`/api/ventas/deals/${selectedDeal.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setShowDrawer(false)
        setSelectedDeal(null)
        fetchDeals()
        fetchStats()
        alert('✅ Deal eliminado')
      }
    } catch (err) {
      alert('❌ Error al eliminar')
    }
  }

  async function handleEditDeal() {
    if (!selectedDeal) return
    setEditingDeal(selectedDeal)
    setShowDrawer(false)
  }

  async function handleSaveEdit() {
    if (!editingDeal) return

    try {
      const response = await fetch(`/api/ventas/deals/${editingDeal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingDeal)
      })

      if (response.ok) {
        setEditingDeal(null)
        fetchDeals()
        fetchStats()
        alert('✅ Deal actualizado')
      }
    } catch (err) {
      alert('❌ Error al actualizar')
    }
  }

  function handleCrearCotizacion() {
    setShowDrawer(false)
    setShowModalCotizacion(true)
  }

  function formatMonto(monto: number) {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP'
    }).format(monto)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-purple-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-700 font-semibold text-lg">Cargando módulo de ventas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Header Moderno */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 shadow-2xl px-8 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="text-white">
              <h1 className="text-4xl font-extrabold mb-2 flex items-center gap-3">
                <span className="text-5xl">🚀</span>
                Módulo de Ventas
              </h1>
              <p className="text-indigo-100 text-base font-medium">
                Gestión completa de pipeline • WhatsApp 360 • Cotizaciones • Reportes
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Menú de Navegación Mejorado */}
      <div className="px-8 -mt-6 mb-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Inbox WhatsApp */}
            <Link href="/dashboard/ventas/inbox" className="group">
              <div className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all p-6 border-2 border-transparent hover:border-blue-400 transform hover:-translate-y-1">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-3xl shadow-lg">
                    💬
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">Inbox</h3>
                    <p className="text-sm text-gray-500">Conversaciones</p>
                  </div>
                </div>
                {whatsappStats && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Activas:</span>
                    <span className="font-bold text-blue-600 text-lg">{whatsappStats.conversaciones.activas}</span>
                  </div>
                )}
              </div>
            </Link>

            {/* Leads Panel */}
            <Link href="/dashboard/ventas/leads" className="group">
              <div className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all p-6 border-2 border-transparent hover:border-orange-400 transform hover:-translate-y-1">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center text-3xl shadow-lg">
                    🔥
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">Leads</h3>
                    <p className="text-sm text-gray-500">Panel Kanban</p>
                  </div>
                </div>
                {whatsappStats && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Calientes:</span>
                    <span className="font-bold text-orange-600 text-lg">{whatsappStats.leads.calientes}</span>
                  </div>
                )}
              </div>
            </Link>

            {/* Stats Dashboard */}
            <Link href="/dashboard/ventas/stats" className="group">
              <div className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all p-6 border-2 border-transparent hover:border-purple-400 transform hover:-translate-y-1">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center text-3xl shadow-lg">
                    📊
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">Estadísticas</h3>
                    <p className="text-sm text-gray-500">Métricas WA360</p>
                  </div>
                </div>
                {whatsappStats && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Mensajes:</span>
                    <span className="font-bold text-purple-600 text-lg">{whatsappStats.mensajes.total}</span>
                  </div>
                )}
              </div>
            </Link>

            {/* Cotizaciones */}
            <Link href="/dashboard/ventas/cotizaciones" className="group">
              <div className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all p-6 border-2 border-transparent hover:border-green-400 transform hover:-translate-y-1">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center text-3xl shadow-lg">
                    💰
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">Cotizaciones</h3>
                    <p className="text-sm text-gray-500">Propuestas</p>
                  </div>
                </div>
              </div>
            </Link>

            {/* Reportes */}
            <Link href="/dashboard/ventas/reportes" className="group">
              <div className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all p-6 border-2 border-transparent hover:border-indigo-400 transform hover:-translate-y-1">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center text-3xl shadow-lg">
                    📈
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">Reportes</h3>
                    <p className="text-sm text-gray-500">Análisis</p>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Divider con título */}
      <div className="px-8 mb-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <span>📋</span>
            Pipeline de Ventas
          </h2>
          <p className="text-gray-600 mt-1">Arrastra y suelta los deals para cambiar su etapa</p>
        </div>
      </div>

      {/* Stats Cards del Pipeline */}
      {stats && (
        <div className="px-8 mb-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-purple-500">
                <p className="text-sm text-gray-600 mb-1 font-semibold">Pipeline Total</p>
                <p className="text-3xl font-bold text-purple-600">{formatMonto(stats.total_pipeline)}</p>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-blue-500">
                <p className="text-sm text-gray-600 mb-1 font-semibold">Total Deals</p>
                <p className="text-3xl font-bold text-blue-600">{stats.total_deals}</p>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-green-500">
                <p className="text-sm text-gray-600 mb-1 font-semibold">Conversión</p>
                <p className="text-3xl font-bold text-green-600">{stats.tasa_conversion.toFixed(1)}%</p>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-orange-500">
                <p className="text-sm text-gray-600 mb-1 font-semibold">Forecast</p>
                <p className="text-3xl font-bold text-orange-600">{formatMonto(stats.forecast_ponderado)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <div className="px-8 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
            {ETAPAS.map(etapa => {
              const dealsEnEtapa = (Array.isArray(deals) ? deals : []).filter(d => d.etapa === etapa.key)
              const montoTotal = dealsEnEtapa.reduce((sum, d) => sum + d.monto, 0)

              return (
                <div
                  key={etapa.key}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(etapa.key)}
                  className="flex flex-col"
                >
                  <div className={`bg-gradient-to-br ${ETAPA_COLORS[etapa.key]} text-white rounded-t-2xl p-4 shadow-lg`}>
                    <div className="mb-3">
                      <span className="text-3xl block mb-2">{etapa.icon}</span>
                      <h3 className="font-bold text-sm leading-tight">{etapa.label}</h3>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="bg-white/30 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-bold">{dealsEnEtapa.length}</span>
                      <span className="text-xs font-semibold opacity-90 truncate ml-2">{formatMonto(montoTotal)}</span>
                    </div>
                  </div>

                  <div className="bg-white/80 backdrop-blur-sm rounded-b-2xl p-4 space-y-3 min-h-[500px] shadow-xl">
                    {dealsEnEtapa.map((deal) => (
                      <div
                        key={deal.id}
                        draggable
                        onDragStart={() => handleDragStart(deal)}
                        onClick={() => { setSelectedDeal(deal); setShowDrawer(true) }}
                        className="bg-white rounded-xl p-4 shadow-md hover:shadow-2xl cursor-move transition-all duration-300 transform hover:scale-105 border-2 border-transparent hover:border-purple-400"
                      >
                        <h4 className="font-bold text-gray-800 mb-2 text-sm leading-tight">{deal.cliente}</h4>
                        <p className="text-xs text-gray-600 mb-3">{deal.contacto}</p>
                        <div className="flex justify-between items-center">
                          <span className="text-base font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                            {formatMonto(deal.monto)}
                          </span>
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-semibold">
                            {deal.probabilidad}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Drawer con Botones */}
      {showDrawer && selectedDeal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={() => setShowDrawer(false)}>
          <div className="absolute right-0 top-0 h-full w-96 bg-white shadow-2xl p-6 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {selectedDeal.cliente}
              </h2>
              <button onClick={() => setShowDrawer(false)} className="text-2xl text-gray-500 hover:text-gray-700">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Contacto</p>
                <p className="font-semibold">{selectedDeal.contacto}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-semibold">{selectedDeal.email || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Teléfono</p>
                <p className="font-semibold">{selectedDeal.telefono || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Monto</p>
                <p className="text-2xl font-bold text-green-600">{formatMonto(selectedDeal.monto)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Probabilidad</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all"
                      style={{ width: `${selectedDeal.probabilidad}%` }}
                    />
                  </div>
                  <span className="font-bold text-purple-600">{selectedDeal.probabilidad}%</span>
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="space-y-3 pt-6 border-t">
                <button
                  onClick={handleCrearCotizacion}
                  className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-800 text-white rounded-xl font-bold hover:from-purple-700 hover:to-purple-900 transition-all shadow-lg"
                >
                  💰 Crear Cotización
                </button>

                <button
                  onClick={handleEditDeal}
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all"
                >
                  ✏️ Editar Deal
                </button>

                <button
                  onClick={handleDeleteDeal}
                  className="w-full px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all"
                >
                  🗑️ Eliminar Deal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {editingDeal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h3 className="text-2xl font-bold">✏️ Editar Deal</h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Cliente</label>
                <input
                  type="text"
                  value={editingDeal.cliente}
                  onChange={(e) => setEditingDeal({...editingDeal, cliente: e.target.value})}
                  className="w-full px-4 py-3 border-2 rounded-xl focus:border-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Contacto</label>
                <input
                  type="text"
                  value={editingDeal.contacto || ''}
                  onChange={(e) => setEditingDeal({...editingDeal, contacto: e.target.value})}
                  className="w-full px-4 py-3 border-2 rounded-xl focus:border-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Email</label>
                <input
                  type="email"
                  value={editingDeal.email || ''}
                  onChange={(e) => setEditingDeal({...editingDeal, email: e.target.value})}
                  className="w-full px-4 py-3 border-2 rounded-xl focus:border-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Teléfono</label>
                <input
                  type="tel"
                  value={editingDeal.telefono || ''}
                  onChange={(e) => setEditingDeal({...editingDeal, telefono: e.target.value})}
                  className="w-full px-4 py-3 border-2 rounded-xl focus:border-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Monto</label>
                <input
                  type="number"
                  value={editingDeal.monto}
                  onChange={(e) => setEditingDeal({...editingDeal, monto: parseFloat(e.target.value)})}
                  className="w-full px-4 py-3 border-2 rounded-xl focus:border-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Probabilidad (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={editingDeal.probabilidad}
                  onChange={(e) => setEditingDeal({...editingDeal, probabilidad: parseInt(e.target.value)})}
                  className="w-full px-4 py-3 border-2 rounded-xl focus:border-purple-500 outline-none"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setEditingDeal(null)}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-xl font-bold hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700"
                >
                  Guardar Cambios
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cotización */}
      {showModalCotizacion && selectedDeal && (
        <ModalCotizacion
          dealId={selectedDeal.id}
          dealCliente={selectedDeal.cliente}
          dealMonto={selectedDeal.monto}
          onClose={() => setShowModalCotizacion(false)}
          onCreated={() => { fetchDeals(); fetchStats() }}
        />
      )}
    </div>
  )
}
