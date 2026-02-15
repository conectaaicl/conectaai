'use client'
import { useState, useEffect } from 'react'

interface DetalleGasto {
  concepto: string
  monto: number
}

interface GastoComun {
  id: number
  departamento_id: number
  mes: number
  anio: number
  monto_base: number
  multas: number
  monto_total: number
  estado: string
  fecha_vencimiento: string
  fecha_pago: string | null
  detalle: DetalleGasto[]
}

interface Stats {
  total_gastos: number
  pagados: number
  pendientes: number
  atrasados: number
  monto_pendiente: number
  tasa_pago: number
}

export default function FinanzasPage() {
  const [gastos, setGastos] = useState<GastoComun[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showDesgloseModal, setShowDesgloseModal] = useState(false)
  const [gastoSeleccionado, setGastoSeleccionado] = useState<GastoComun | null>(null)
  const [formData, setFormData] = useState({
    departamento_id: 1,
    mes: new Date().getMonth() + 1,
    anio: new Date().getFullYear(),
    monto_base: 0,
    multas: 0,
    intereses: 0,
    otros_cargos: 0,
    descuentos: 0,
    monto_total: 0,
    fecha_vencimiento: '',
    detalle: [] as DetalleGasto[]
  })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [gastosRes, statsRes] = await Promise.all([
        fetch('/api/finanzas/gastos-comunes/'),
        fetch('/api/finanzas/stats/morosidad')
      ])

      if (gastosRes.ok) setGastos(await gastosRes.json())
      if (statsRes.ok) setStats(await statsRes.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function agregarDetalle() {
    setFormData({
      ...formData,
      detalle: [...formData.detalle, { concepto: '', monto: 0 }]
    })
  }

  function eliminarDetalle(index: number) {
    const nuevo = formData.detalle.filter((_, i) => i !== index)
    setFormData({ ...formData, detalle: nuevo })
    recalcularTotal(nuevo)
  }

  function updateDetalle(index: number, field: string, value: any) {
    const nuevo = [...formData.detalle]
    nuevo[index] = { ...nuevo[index], [field]: value }
    setFormData({ ...formData, detalle: nuevo })
    recalcularTotal(nuevo)
  }

  function recalcularTotal(detalleActualizado?: DetalleGasto[]) {
    const detalles = detalleActualizado || formData.detalle
    
    // Sumar todos los conceptos del desglose
    const totalDesglose = detalles.reduce((sum, item) => sum + (parseFloat(item.monto as any) || 0), 0)
    
    // Total = base + desglose + cargos - descuentos
    const base = parseFloat(formData.monto_base as any) || 0
    const multas = parseFloat(formData.multas as any) || 0
    const intereses = parseFloat(formData.intereses as any) || 0
    const otros = parseFloat(formData.otros_cargos as any) || 0
    const desc = parseFloat(formData.descuentos as any) || 0
    
    const total = base + totalDesglose + multas + intereses + otros - desc
    
    setFormData(prev => ({ ...prev, monto_total: total }))
  }

  useEffect(() => {
    recalcularTotal()
  }, [formData.monto_base, formData.multas, formData.intereses, formData.otros_cargos, formData.descuentos])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    console.log('Enviando:', formData)
    
    try {
      const res = await fetch('/api/finanzas/gastos-comunes/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        setShowModal(false)
        fetchData()
        alert('✅ Gasto común creado y email enviado')
        // Reset form
        setFormData({
          departamento_id: 1,
          mes: new Date().getMonth() + 1,
          anio: new Date().getFullYear(),
          monto_base: 0,
          multas: 0,
          intereses: 0,
          otros_cargos: 0,
          descuentos: 0,
          monto_total: 0,
          fecha_vencimiento: '',
          detalle: []
        })
      } else {
        const error = await res.json()
        console.error('Error del servidor:', error)
        alert(`❌ Error: ${JSON.stringify(error.detail || error)}`)
      }
    } catch (err) {
      console.error('Error al crear:', err)
      alert('❌ Error al crear. Revisa consola.')
    }
  }

  async function handlePagar(id: number) {
    if (!confirm('¿Registrar pago?')) return

    try {
      const res = await fetch(`/api/finanzas/gastos-comunes/${id}/pagar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metodo_pago: 'transferencia' })
      })

      if (res.ok) {
        fetchData()
        alert('✅ Pago registrado')
      }
    } catch (err) {
      alert('❌ Error')
    }
  }

  function verDesglose(gasto: GastoComun) {
    setGastoSeleccionado(gasto)
    setShowDesgloseModal(true)
  }

  async function exportarPDF() {
    window.open('/api/finanzas/gastos-comunes/exportar/pdf', '_blank')
  }

  async function exportarExcel() {
    window.open('/api/finanzas/gastos-comunes/exportar/excel', '_blank')
  }

  async function descargarPDFIndividual(gastoId: number) {
    window.open(`/api/finanzas/gastos-comunes/${gastoId}/pdf-individual`, '_blank')
  }

  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

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
            <h1 className="text-3xl font-bold text-gray-800">💰 Finanzas</h1>
            <p className="text-gray-600">Gastos comunes, pagos y morosidad</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={exportarPDF}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold"
            >
              📄 Exportar PDF
            </button>
            <button
              onClick={exportarExcel}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
            >
              📊 Exportar Excel
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-800 text-white rounded-xl font-bold hover:shadow-xl"
            >
              ➕ Nuevo Gasto Común
            </button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <p className="text-sm text-gray-600">Total Gastos</p>
              <p className="text-3xl font-bold text-gray-800">{stats.total_gastos}</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-green-500">
              <p className="text-sm text-gray-600">Pagados</p>
              <p className="text-3xl font-bold text-green-600">{stats.pagados}</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-yellow-500">
              <p className="text-sm text-gray-600">Pendientes</p>
              <p className="text-3xl font-bold text-yellow-600">{stats.pendientes}</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-red-500">
              <p className="text-sm text-gray-600">Atrasados</p>
              <p className="text-3xl font-bold text-red-600">{stats.atrasados}</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-purple-500">
              <p className="text-sm text-gray-600">Tasa de Pago</p>
              <p className="text-3xl font-bold text-purple-600">{stats.tasa_pago}%</p>
            </div>
          </div>
        )}

        {/* Monto Pendiente */}
        {stats && stats.monto_pendiente > 0 && (
          <div className="bg-gradient-to-r from-red-500 to-red-700 rounded-2xl p-8 shadow-xl mb-8">
            <p className="text-white text-lg font-semibold mb-2">💸 Monto Total Pendiente</p>
            <p className="text-white text-5xl font-bold">
              ${stats.monto_pendiente.toLocaleString('es-CL')}
            </p>
          </div>
        )}

        {/* Tabla */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-green-600 to-green-800 text-white">
              <tr>
                <th className="px-6 py-4 text-left">Periodo</th>
                <th className="px-6 py-4 text-left">Depto</th>
                <th className="px-6 py-4 text-right">Monto Base</th>
                <th className="px-6 py-4 text-right">Multas</th>
                <th className="px-6 py-4 text-right">Total</th>
                <th className="px-6 py-4 text-left">Estado</th>
                <th className="px-6 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {gastos.map((gasto, idx) => (
                <tr key={gasto.id} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="px-6 py-4 font-semibold">
                    {MESES[gasto.mes - 1]} {gasto.anio}
                  </td>
                  <td className="px-6 py-4">Depto {gasto.departamento_id}</td>
                  <td className="px-6 py-4 text-right">${gasto.monto_base.toLocaleString('es-CL')}</td>
                  <td className="px-6 py-4 text-right text-red-600">
                    {gasto.multas > 0 ? `$${gasto.multas.toLocaleString('es-CL')}` : '-'}
                  </td>
                  <td className="px-6 py-4 text-right font-bold">${gasto.monto_total.toLocaleString('es-CL')}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      gasto.estado === 'pagado' ? 'bg-green-100 text-green-700' :
                      gasto.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {gasto.estado}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2 justify-center flex-wrap">
                      <button
                        onClick={() => verDesglose(gasto)}
                        className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
                      >
                        👁️ Ver
                      </button>
                      <button
                        onClick={() => descargarPDFIndividual(gasto.id)}
                        className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-semibold"
                      >
                        📄 PDF
                      </button>
                      {gasto.estado !== 'pagado' && (
                        <button
                          onClick={() => handlePagar(gasto.id)}
                          className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold"
                        >
                          💳 Pagar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {gastos.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-xl">💰 No hay gastos comunes registrados</p>
            </div>
          )}
        </div>

        {/* Modal Crear */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-8 max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b bg-gradient-to-r from-green-600 to-green-800 text-white rounded-t-2xl sticky top-0 z-10">
                <h3 className="text-2xl font-bold">➕ Nuevo Gasto Común</h3>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-2">Mes *</label>
                    <select
                      value={formData.mes}
                      onChange={(e) => setFormData({...formData, mes: parseInt(e.target.value)})}
                      className="w-full px-4 py-3 border-2 rounded-xl focus:border-green-500 outline-none"
                    >
                      {MESES.map((mes, idx) => (
                        <option key={idx} value={idx + 1}>{mes}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2">Año *</label>
                    <input
                      type="number"
                      value={formData.anio}
                      onChange={(e) => setFormData({...formData, anio: parseInt(e.target.value)})}
                      className="w-full px-4 py-3 border-2 rounded-xl focus:border-green-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2">Departamento ID *</label>
                    <input
                      type="number"
                      value={formData.departamento_id}
                      onChange={(e) => setFormData({...formData, departamento_id: parseInt(e.target.value)})}
                      className="w-full px-4 py-3 border-2 rounded-xl focus:border-green-500 outline-none"
                      required
                    />
                  </div>
                </div>

                {/* DESGLOSE DETALLADO */}
                <div className="bg-blue-50 p-4 rounded-xl">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-lg">📋 Desglose de Conceptos (se suma al total)</h4>
                    <button
                      type="button"
                      onClick={agregarDetalle}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
                    >
                      ➕ Agregar Concepto
                    </button>
                  </div>
                  
                  {formData.detalle.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-3 gap-4 mb-3 bg-white p-3 rounded-lg">
                      <input
                        type="text"
                        value={item.concepto}
                        onChange={(e) => updateDetalle(idx, 'concepto', e.target.value)}
                        placeholder="Concepto (ej: Agua)"
                        className="col-span-2 px-3 py-2 border-2 rounded-lg outline-none"
                      />
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={item.monto}
                          onChange={(e) => updateDetalle(idx, 'monto', parseFloat(e.target.value))}
                          placeholder="Monto"
                          className="flex-1 px-3 py-2 border-2 rounded-lg outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => eliminarDetalle(idx)}
                          className="px-3 bg-red-500 text-white rounded-lg hover:bg-red-600"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {formData.detalle.length === 0 && (
                    <p className="text-gray-500 text-sm text-center py-2">Haz clic en "Agregar Concepto" para desglosar los gastos</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-2">Monto Base</label>
                    <input
                      type="number"
                      value={formData.monto_base}
                      onChange={(e) => setFormData({...formData, monto_base: parseFloat(e.target.value)})}
                      className="w-full px-4 py-3 border-2 rounded-xl focus:border-green-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2">Multas</label>
                    <input
                      type="number"
                      value={formData.multas}
                      onChange={(e) => setFormData({...formData, multas: parseFloat(e.target.value)})}
                      className="w-full px-4 py-3 border-2 rounded-xl focus:border-green-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2">Intereses</label>
                    <input
                      type="number"
                      value={formData.intereses}
                      onChange={(e) => setFormData({...formData, intereses: parseFloat(e.target.value)})}
                      className="w-full px-4 py-3 border-2 rounded-xl focus:border-green-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2">Descuentos</label>
                    <input
                      type="number"
                      value={formData.descuentos}
                      onChange={(e) => setFormData({...formData, descuentos: parseFloat(e.target.value)})}
                      className="w-full px-4 py-3 border-2 rounded-xl focus:border-green-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">Fecha Vencimiento *</label>
                  <input
                    type="date"
                    value={formData.fecha_vencimiento}
                    onChange={(e) => setFormData({...formData, fecha_vencimiento: e.target.value})}
                    className="w-full px-4 py-3 border-2 rounded-xl focus:border-green-500 outline-none"
                    required
                  />
                </div>

                <div className="bg-green-50 p-4 rounded-xl">
                  <p className="text-sm font-bold text-gray-700">Total a Pagar (calculado automáticamente):</p>
                  <p className="text-3xl font-bold text-green-600">
                    ${formData.monto_total.toLocaleString('es-CL')}
                  </p>
                  <p className="text-xs text-gray-600 mt-2">
                    📧 Se enviará automáticamente por email al propietario
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Base: ${formData.monto_base} + Desglose: ${formData.detalle.reduce((s,i) => s + (i.monto||0), 0)} + Multas: ${formData.multas} + Intereses: ${formData.intereses} - Descuentos: ${formData.descuentos}
                  </p>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-xl font-bold hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-green-800 text-white rounded-xl font-bold hover:shadow-xl"
                  >
                    ➕ Crear y Enviar Email
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Ver Desglose */}
        {showDesgloseModal && gastoSeleccionado && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full">
              <div className="p-6 border-b bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-t-2xl">
                <h3 className="text-2xl font-bold">📋 Desglose Detallado</h3>
                <p className="text-blue-100">
                  {MESES[gastoSeleccionado.mes - 1]} {gastoSeleccionado.anio} - Depto {gastoSeleccionado.departamento_id}
                </p>
              </div>
              
              <div className="p-6 space-y-4">
                {gastoSeleccionado.detalle && gastoSeleccionado.detalle.length > 0 && (
                  <div>
                    <h4 className="font-bold mb-3">Conceptos:</h4>
                    {gastoSeleccionado.detalle.map((item, idx) => (
                      <div key={idx} className="flex justify-between p-2 bg-gray-50 rounded mb-2">
                        <span>{item.concepto}</span>
                        <span className="font-semibold">${item.monto.toLocaleString('es-CL')}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t pt-4">
                  <div className="flex justify-between p-2">
                    <span>Monto Base:</span>
                    <span className="font-semibold">${gastoSeleccionado.monto_base.toLocaleString('es-CL')}</span>
                  </div>
                  {gastoSeleccionado.multas > 0 && (
                    <div className="flex justify-between p-2 text-red-600">
                      <span>Multas:</span>
                      <span className="font-semibold">${gastoSeleccionado.multas.toLocaleString('es-CL')}</span>
                    </div>
                  )}
                  <div className="flex justify-between p-4 bg-green-50 rounded-xl mt-4">
                    <span className="font-bold text-lg">TOTAL:</span>
                    <span className="font-bold text-2xl text-green-600">
                      ${gastoSeleccionado.monto_total.toLocaleString('es-CL')}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setShowDesgloseModal(false)}
                  className="w-full px-6 py-3 bg-gray-600 text-white rounded-xl font-bold hover:bg-gray-700"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
