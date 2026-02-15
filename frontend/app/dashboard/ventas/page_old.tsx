'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Deal {
  id: number
  cliente: string
  monto: number
  etapa: 'prospecto' | 'calificado' | 'propuesta' | 'negociacion' | 'ganado' | 'perdido'
  origen: 'facebook' | 'instagram' | 'linkedin' | 'twitter' | 'web' | 'referido' | 'llamada' | 'email' | 'google_ads' | 'evento' | 'otro'
  fecha: string
  contacto?: string
  email?: string
  telefono?: string
  probabilidad: number
}

interface Actividad {
  id: number
  deal_id: number
  tipo: 'nota' | 'llamada' | 'email' | 'reunion' | 'propuesta' | 'negociacion' | 'ganado' | 'perdido' | 'archivo'
  descripcion: string
  fecha: string
  usuario: string
  created_at: string
}

interface ReportesData {
  deals_estancados: any[]
  total_estancados: number
}

const ETAPAS = [
  { id: 'prospecto', nombre: 'Prospecto', emoji: '🎯', color: 'bg-gray-100 border-gray-300' },
  { id: 'calificado', nombre: 'Calificado', emoji: '✅', color: 'bg-blue-100 border-blue-300' },
  { id: 'propuesta', nombre: 'Propuesta', emoji: '📄', color: 'bg-yellow-100 border-yellow-300' },
  { id: 'negociacion', nombre: 'Negociación', emoji: '🤝', color: 'bg-orange-100 border-orange-300' },
  { id: 'ganado', nombre: 'Ganado', emoji: '🎉', color: 'bg-green-100 border-green-300' },
  { id: 'perdido', nombre: 'Perdido', emoji: '❌', color: 'bg-red-100 border-red-300' }
]

const ORIGENES = [
  { id: 'facebook', nombre: 'Facebook', emoji: '📱' },
  { id: 'instagram', nombre: 'Instagram', emoji: '📷' },
  { id: 'linkedin', nombre: 'LinkedIn', emoji: '💼' },
  { id: 'twitter', nombre: 'Twitter', emoji: '🐦' },
  { id: 'web', nombre: 'Sitio Web', emoji: '🌐' },
  { id: 'referido', nombre: 'Referido', emoji: '👥' },
  { id: 'llamada', nombre: 'Llamada', emoji: '📞' },
  { id: 'email', nombre: 'Email', emoji: '📧' },
  { id: 'google_ads', nombre: 'Google Ads', emoji: '🎯' },
  { id: 'evento', nombre: 'Evento', emoji: '🏪' },
  { id: 'otro', nombre: 'Otro', emoji: '➕' }
]

const TIPOS_ACTIVIDAD = [
  { id: 'nota', nombre: 'Nota', emoji: '📝', color: 'bg-gray-100' },
  { id: 'llamada', nombre: 'Llamada', emoji: '📞', color: 'bg-blue-100' },
  { id: 'email', nombre: 'Email', emoji: '📧', color: 'bg-purple-100' },
  { id: 'reunion', nombre: 'Reunión', emoji: '🤝', color: 'bg-green-100' },
  { id: 'propuesta', nombre: 'Propuesta', emoji: '📄', color: 'bg-yellow-100' },
  { id: 'negociacion', nombre: 'Negociación', emoji: '💰', color: 'bg-orange-100' },
  { id: 'ganado', nombre: 'Ganado', emoji: '🎉', color: 'bg-green-200' },
  { id: 'perdido', nombre: 'Perdido', emoji: '❌', color: 'bg-red-100' },
  { id: 'archivo', nombre: 'Archivo', emoji: '📎', color: 'bg-indigo-100' }
]

function DraggableDealCard({ deal, onEdit, onDelete, onViewDetails }: { 
  deal: Deal, 
  onEdit: () => void, 
  onDelete: () => void,
  onViewDetails: () => void
}) {
  const [isDragging, setIsDragging] = useState(false)
  
  const origen = ORIGENES.find(o => o.id === deal.origen)
  const formatMonto = (monto: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(monto)
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        setIsDragging(true)
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('dealId', deal.id.toString())
      }}
      onDragEnd={() => setIsDragging(false)}
      className={`bg-white p-3 rounded-lg shadow-sm border-2 border-gray-200 hover:border-blue-400 mb-2 transition-all ${
        isDragging ? 'opacity-50' : 'opacity-100'
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-semibold text-sm text-gray-800">{deal.cliente}</h4>
        <span className="text-xs">{origen?.emoji}</span>
      </div>
      <p className="text-lg font-bold text-blue-600 mb-2">{formatMonto(deal.monto)}</p>
      <div className="flex justify-between items-center text-xs text-gray-600 mb-2">
        <span>{deal.contacto}</span>
        <span className="bg-blue-100 px-2 py-1 rounded">{deal.probabilidad}%</span>
      </div>
      <div className="grid grid-cols-3 gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); onViewDetails() }}
          className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700"
        >
          👁️
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onEdit() }}
          className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
        >
          ✏️
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
        >
          🗑️
        </button>
      </div>
    </div>
  )
}

export default function VentasPage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [stats, setStats] = useState<any>(null)
  const [reportes, setReportes] = useState<ReportesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false)
  const [showAlertasPanel, setShowAlertasPanel] = useState(false)
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null)
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [loadingActividades, setLoadingActividades] = useState(false)
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  
  const [formData, setFormData] = useState<Partial<Deal>>({
    cliente: '',
    monto: 0,
    etapa: 'prospecto',
    origen: 'otro',
    fecha: new Date().toISOString().split('T')[0],
    contacto: '',
    email: '',
    telefono: '',
    probabilidad: 20
  })

  const [actividadForm, setActividadForm] = useState({
    tipo: 'nota' as Actividad['tipo'],
    descripcion: ''
  })

  useEffect(() => {
    fetchDeals()
    fetchStats()
    fetchReportes()
  }, [])

  async function fetchDeals() {
    try {
      setLoading(true)
      setError('')
      const response = await fetch('/api/ventas/deals')
      if (!response.ok) throw new Error(`Error ${response.status}`)
      const data = await response.json()
      setDeals(data.deals || [])
    } catch (err: any) {
      console.error('Error fetching deals:', err)
      setError(err.message || 'Error al cargar deals')
    } finally {
      setLoading(false)
    }
  }

  async function fetchStats() {
    try {
      const response = await fetch('/api/ventas/stats')
      if (!response.ok) throw new Error(`Error ${response.status}`)
      const data = await response.json()
      setStats(data)
    } catch (err: any) {
      console.error('Error fetching stats:', err)
    }
  }

  async function fetchReportes() {
    try {
      const response = await fetch('/api/ventas/reportes/avanzados')
      if (!response.ok) throw new Error(`Error ${response.status}`)
      const data = await response.json()
      setReportes({
        deals_estancados: data.deals_estancados || [],
        total_estancados: data.total_estancados || 0
      })
    } catch (err: any) {
      console.error('Error fetching reportes:', err)
    }
  }

  async function fetchActividades(dealId: number) {
    try {
      setLoadingActividades(true)
      const response = await fetch(`/api/ventas/deals/${dealId}/actividades`)
      if (!response.ok) throw new Error(`Error ${response.status}`)
      const data = await response.json()
      setActividades(data.actividades || [])
    } catch (err: any) {
      console.error('Error fetching actividades:', err)
      alert('Error al cargar actividades: ' + err.message)
    } finally {
      setLoadingActividades(false)
    }
  }

  async function handleAddActividad(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedDeal || !actividadForm.descripcion.trim()) return

    try {
      const response = await fetch(`/api/ventas/deals/${selectedDeal.id}/actividades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actividadForm)
      })

      if (!response.ok) throw new Error('Error al crear actividad')

      await fetchActividades(selectedDeal.id)
      await fetchReportes() // Actualizar alertas
      setActividadForm({ tipo: 'nota', descripcion: '' })
      alert('Actividad agregada')
    } catch (err: any) {
      alert(err.message || 'Error al crear actividad')
    }
  }

  async function handleDeleteActividad(actividadId: number) {
    if (!confirm('¿Eliminar esta actividad?')) return

    try {
      const response = await fetch(`/api/ventas/actividades/${actividadId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Error al eliminar')

      if (selectedDeal) {
        await fetchActividades(selectedDeal.id)
      }
      alert('Actividad eliminada')
    } catch (err: any) {
      alert(err.message || 'Error al eliminar')
    }
  }

  async function handleDrop(etapaId: string, dealId: number) {
    try {
      const response = await fetch(`/api/ventas/deals/${dealId}/etapa`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etapa: etapaId })
      })

      if (!response.ok) throw new Error('Error al actualizar')

      await fetchDeals()
      await fetchStats()
      await fetchReportes() // Actualizar alertas
      
      if (selectedDeal && selectedDeal.id === dealId) {
        await fetchActividades(dealId)
      }
    } catch (err: any) {
      alert(err.message || 'Error al mover deal')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const url = editingDeal 
        ? `/api/ventas/deals/${editingDeal.id}`
        : '/api/ventas/deals'
      
      const method = editingDeal ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) throw new Error('Error al guardar')

      await fetchDeals()
      await fetchStats()
      await fetchReportes()
      handleCloseModal()
      alert(editingDeal ? 'Deal actualizado' : 'Deal creado')
    } catch (err: any) {
      alert(err.message || 'Error al guardar')
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este deal?')) return

    try {
      const response = await fetch(`/api/ventas/deals/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Error al eliminar')
      await fetchDeals()
      await fetchStats()
      await fetchReportes()
      
      if (selectedDeal && selectedDeal.id === id) {
        setShowDetailsDrawer(false)
        setSelectedDeal(null)
      }
      
      alert('Deal eliminado')
    } catch (err: any) {
      alert(err.message || 'Error al eliminar')
    }
  }

  function handleViewDetails(deal: Deal) {
    setSelectedDeal(deal)
    setShowDetailsDrawer(true)
    fetchActividades(deal.id)
  }

  function handleEdit(deal: Deal) {
    setEditingDeal(deal)
    setFormData(deal)
    setShowModal(true)
  }

  function handleNew() {
    setEditingDeal(null)
    setFormData({
      cliente: '',
      monto: 0,
      etapa: 'prospecto',
      origen: 'otro',
      fecha: new Date().toISOString().split('T')[0],
      contacto: '',
      email: '',
      telefono: '',
      probabilidad: 20
    })
    setShowModal(true)
  }

  function handleCloseModal() {
    setShowModal(false)
    setEditingDeal(null)
  }

  function handleCloseDrawer() {
    setShowDetailsDrawer(false)
    setSelectedDeal(null)
    setActividades([])
  }

  async function handleExportExcel() {
    try {
      const response = await fetch('/api/ventas/deals/export/excel')
      if (!response.ok) throw new Error('Error al exportar')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `deals_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      alert(err.message || 'Error al exportar')
    }
  }

  const formatMonto = (monto: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(monto)
  }

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Cargando embudo...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <p className="font-semibold">❌ Error</p>
            <p>{error}</p>
            <button
              onClick={fetchDeals}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    )
  }

  const dealsByEtapa = ETAPAS.reduce((acc, etapa) => {
    acc[etapa.id] = deals.filter(d => d.etapa === etapa.id)
    return acc
  }, {} as Record<string, Deal[]>)

  const totalAlertas = (reportes?.total_estancados || 0)

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              🎯 Embudo de Ventas
            </h1>
            <p className="text-gray-600">
              Pipeline activo • Forecast: {stats && formatMonto(stats.forecast_ponderado)} • {deals.length} deals
            </p>
          </div>
          <div className="flex gap-2">
            {totalAlertas > 0 && (
              <button
                onClick={() => setShowAlertasPanel(!showAlertasPanel)}
                className="relative px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                🔔 Alertas
                <span className="absolute -top-2 -right-2 bg-yellow-400 text-red-900 text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
                  {totalAlertas}
                </span>
              </button>
            )}
            <Link 
              href="/dashboard/ventas/reportes"
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              📊 Reportes
            </Link>
            <button
              onClick={() => setViewMode(viewMode === 'kanban' ? 'list' : 'kanban')}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              {viewMode === 'kanban' ? '📋 Lista' : '📊 Kanban'}
            </button>
            <button
              onClick={handleExportExcel}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              📥 Excel
            </button>
            <button
              onClick={fetchDeals}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              🔄
            </button>
            <button
              onClick={handleNew}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              ➕ Nuevo Deal
            </button>
          </div>
        </div>

        {/* Panel de Alertas */}
        {showAlertasPanel && reportes && reportes.total_estancados > 0 && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-lg">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-lg font-bold text-red-800 flex items-center">
                  ⚠️ Deals que Requieren Atención
                  <span className="ml-2 px-2 py-1 bg-red-200 text-red-900 text-sm rounded">
                    {reportes.total_estancados}
                  </span>
                </h3>
                <p className="text-sm text-red-700">Sin actividad reciente - requieren seguimiento inmediato</p>
              </div>
              <button
                onClick={() => setShowAlertasPanel(false)}
                className="text-red-800 hover:text-red-900 text-xl"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {reportes.deals_estancados.slice(0, 5).map((deal) => (
                <div key={deal.id} className="bg-white border-l-4 border-red-400 p-3 rounded flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold text-gray-800">{deal.cliente}</h4>
                    <p className="text-sm text-gray-600">
                      {deal.contacto} • Etapa: {deal.etapa} • {formatMonto(deal.monto)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleViewDetails(deal)}
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    Ver Deal
                  </button>
                </div>
              ))}
            </div>
            {reportes.total_estancados > 5 && (
              <Link
                href="/dashboard/ventas/reportes"
                className="mt-3 inline-block text-sm text-red-700 hover:text-red-900 font-semibold"
              >
                Ver todos los {reportes.total_estancados} deals estancados →
              </Link>
            )}
          </div>
        )}

        {/* Stats rápidas */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
            {ETAPAS.map(etapa => {
              const etapaStats = stats.por_etapa[etapa.id]
              return (
                <div key={etapa.id} className={`${etapa.color} p-4 rounded-lg border-2`}>
                  <p className="text-xs text-gray-600 mb-1">{etapa.emoji} {etapa.nombre}</p>
                  <p className="text-lg font-bold">{etapaStats.count}</p>
                  <p className="text-xs text-gray-700">{formatMonto(etapaStats.monto)}</p>
                </div>
              )
            })}
          </div>
        )}

        {/* Vista Kanban */}
        {viewMode === 'kanban' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {ETAPAS.map(etapa => (
              <div
                key={etapa.id}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const dealId = parseInt(e.dataTransfer.getData('dealId'))
                  if (dealId) {
                    handleDrop(etapa.id, dealId)
                  }
                }}
                className={`${etapa.color} rounded-lg p-4 border-2 min-h-[500px]`}
              >
                <h3 className="font-bold text-sm mb-3 flex justify-between items-center sticky top-0 bg-opacity-90 backdrop-blur">
                  <span>{etapa.emoji} {etapa.nombre}</span>
                  <span className="bg-white px-2 py-1 rounded text-xs">
                    {dealsByEtapa[etapa.id].length}
                  </span>
                </h3>
                <div className="space-y-2">
                  {dealsByEtapa[etapa.id].map(deal => (
                    <DraggableDealCard
                      key={deal.id}
                      deal={deal}
                      onEdit={() => handleEdit(deal)}
                      onDelete={() => handleDelete(deal.id)}
                      onViewDetails={() => handleViewDetails(deal)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Vista Lista */}
        {viewMode === 'list' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-bold mb-4">Lista de Deals</h3>
            <div className="space-y-2">
              {deals.map(deal => {
                const etapa = ETAPAS.find(e => e.id === deal.etapa)
                const origen = ORIGENES.find(o => o.id === deal.origen)
                return (
                  <div 
                    key={deal.id} 
                    className="flex items-center justify-between p-4 border rounded hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <h4 className="font-semibold">{deal.cliente}</h4>
                      <p className="text-sm text-gray-600">{deal.contacto} • {origen?.emoji} {origen?.nombre}</p>
                    </div>
                    <div className="text-right mr-4">
                      <p className="font-bold">{formatMonto(deal.monto)}</p>
                      <p className="text-sm text-gray-600">{deal.probabilidad}% prob.</p>
                    </div>
                    <span className={`px-3 py-1 rounded text-sm ${etapa?.color} mr-4`}>
                      {etapa?.emoji} {etapa?.nombre}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleViewDetails(deal)}
                        className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
                      >
                        👁️ Ver
                      </button>
                      <button
                        onClick={() => handleEdit(deal)}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(deal.id)}
                        className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* DRAWER DE DETALLES Y ACTIVIDADES */}
      {showDetailsDrawer && selectedDeal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end" onClick={handleCloseDrawer}>
          <div 
            className="bg-white w-full max-w-2xl h-full overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b p-6 z-10">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">{selectedDeal.cliente}</h2>
                  <p className="text-gray-600">{selectedDeal.contacto}</p>
                </div>
                <button
                  onClick={handleCloseDrawer}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ✕
                </button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Monto</p>
                  <p className="text-xl font-bold text-blue-600">{formatMonto(selectedDeal.monto)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Probabilidad</p>
                  <p className="text-xl font-bold">{selectedDeal.probabilidad}%</p>
                </div>
              </div>
            </div>

            {/* Formulario Nueva Actividad */}
            <div className="p-6 border-b bg-gray-50">
              <h3 className="font-bold mb-3">➕ Nueva Actividad</h3>
              <form onSubmit={handleAddActividad} className="space-y-3">
                <div>
                  <select
                    value={actividadForm.tipo}
                    onChange={(e) => setActividadForm({...actividadForm, tipo: e.target.value as any})}
                    className="w-full border rounded px-3 py-2"
                  >
                    {TIPOS_ACTIVIDAD.map(t => (
                      <option key={t.id} value={t.id}>{t.emoji} {t.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <textarea
                    value={actividadForm.descripcion}
                    onChange={(e) => setActividadForm({...actividadForm, descripcion: e.target.value})}
                    placeholder="Descripción de la actividad..."
                    className="w-full border rounded px-3 py-2 h-20"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Agregar Actividad
                </button>
              </form>
            </div>

            {/* Timeline de Actividades */}
            <div className="p-6">
              <h3 className="font-bold mb-4">⏱️ Timeline de Actividades ({actividades.length})</h3>
              
              {loadingActividades ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-sm text-gray-600">Cargando actividades...</p>
                </div>
              ) : actividades.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No hay actividades registradas</p>
                  <p className="text-sm">Agrega la primera actividad arriba</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {actividades.map((act, idx) => {
                    const tipoInfo = TIPOS_ACTIVIDAD.find(t => t.id === act.tipo)
                    return (
                      <div key={act.id} className="relative pl-8 pb-4 border-l-2 border-gray-300">
                        <div className={`absolute left-[-13px] top-0 w-6 h-6 rounded-full ${tipoInfo?.color} border-2 border-white flex items-center justify-center text-sm`}>
                          {tipoInfo?.emoji}
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-sm border">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="font-semibold text-sm">{tipoInfo?.nombre}</span>
                              <p className="text-xs text-gray-500">
                                {formatDateTime(act.created_at)} • {act.usuario}
                              </p>
                            </div>
                            <button
                              onClick={() => handleDeleteActividad(act.id)}
                              className="text-red-600 hover:text-red-800 text-xs"
                            >
                              🗑️
                            </button>
                          </div>
                          <p className="text-sm text-gray-700">{act.descripcion}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR/CREAR */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">
              {editingDeal ? 'Editar Deal' : 'Nuevo Deal'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Cliente *</label>
                  <input
                    type="text"
                    required
                    value={formData.cliente}
                    onChange={(e) => setFormData({...formData, cliente: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Monto (CLP) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.monto}
                    onChange={(e) => setFormData({...formData, monto: parseInt(e.target.value)})}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Etapa *</label>
                  <select
                    required
                    value={formData.etapa}
                    onChange={(e) => setFormData({...formData, etapa: e.target.value as any})}
                    className="w-full border rounded px-3 py-2"
                  >
                    {ETAPAS.map(e => (
                      <option key={e.id} value={e.id}>{e.emoji} {e.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Origen *</label>
                  <select
                    required
                    value={formData.origen}
                    onChange={(e) => setFormData({...formData, origen: e.target.value as any})}
                    className="w-full border rounded px-3 py-2"
                  >
                    {ORIGENES.map(o => (
                      <option key={o.id} value={o.id}>{o.emoji} {o.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Probabilidad (%) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="100"
                    value={formData.probabilidad}
                    onChange={(e) => setFormData({...formData, probabilidad: parseInt(e.target.value)})}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Fecha *</label>
                  <input
                    type="date"
                    required
                    value={formData.fecha}
                    onChange={(e) => setFormData({...formData, fecha: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Contacto</label>
                  <input
                    type="text"
                    value={formData.contacto}
                    onChange={(e) => setFormData({...formData, contacto: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Teléfono</label>
                  <input
                    type="tel"
                    value={formData.telefono}
                    onChange={(e) => setFormData({...formData, telefono: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {editingDeal ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
