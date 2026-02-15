'use client'
import { useState } from 'react'

interface Item {
  descripcion: string
  cantidad: number
  precio: number
  subtotal: number
}

interface Props {
  dealId: number
  dealCliente: string
  dealMonto: number
  onClose: () => void
  onCreated: () => void
}

export default function ModalCotizacion({ dealId, dealCliente, dealMonto, onClose, onCreated }: Props) {
  const [items, setItems] = useState<Item[]>([
    { descripcion: '', cantidad: 1, precio: 0, subtotal: 0 }
  ])
  const [descuento, setDescuento] = useState(0)
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)

  const agregarItem = () => {
    setItems([...items, { descripcion: '', cantidad: 1, precio: 0, subtotal: 0 }])
  }

  const eliminarItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index))
    }
  }

  const actualizarItem = (index: number, field: keyof Item, value: any) => {
    const nuevosItems = [...items]
    nuevosItems[index] = { ...nuevosItems[index], [field]: value }
    
    if (field === 'cantidad' || field === 'precio') {
      nuevosItems[index].subtotal = nuevosItems[index].cantidad * nuevosItems[index].precio
    }
    
    setItems(nuevosItems)
  }

  const calcularSubtotal = () => items.reduce((sum, item) => sum + item.subtotal, 0)
  const calcularIVA = () => Math.round((calcularSubtotal() - descuento) * 0.19)
  const calcularTotal = () => calcularSubtotal() - descuento + calcularIVA()

  const formatMonto = (monto: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(monto)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const response = await fetch(`/api/ventas/deals/${dealId}/cotizaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.filter(i => i.descripcion.trim()),
          descuento,
          notas
        })
      })
      
      if (response.ok) {
        alert('✅ Cotización creada exitosamente')
        onCreated()
        onClose()
      } else {
        throw new Error('Error al crear cotización')
      }
    } catch (err: any) {
      alert('❌ Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-purple-700 to-purple-900 text-white px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Nueva Cotización</h2>
            <p className="text-purple-200 text-sm mt-1">{dealCliente}</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-bold text-gray-800">Items</h3>
              <button type="button" onClick={agregarItem} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-semibold">
                + Agregar Item
              </button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Descripción</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold w-24">Cant.</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold w-32">Precio</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold w-32">Subtotal</th>
                    <th className="px-4 py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <input type="text" value={item.descripcion} onChange={(e) => actualizarItem(index, 'descripcion', e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="Descripción" required />
                      </td>
                      <td className="px-4 py-3">
                        <input type="number" min="1" value={item.cantidad} onChange={(e) => actualizarItem(index, 'cantidad', parseInt(e.target.value) || 0)} className="w-full px-3 py-2 border rounded-lg" required />
                      </td>
                      <td className="px-4 py-3">
                        <input type="number" min="0" value={item.precio} onChange={(e) => actualizarItem(index, 'precio', parseInt(e.target.value) || 0)} className="w-full px-3 py-2 border rounded-lg" required />
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold">{formatMonto(item.subtotal)}</span>
                      </td>
                      <td className="px-4 py-3">
                        {items.length > 1 && <button type="button" onClick={() => eliminarItem(index)} className="text-red-600 hover:text-red-800">🗑️</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold mb-2">Notas</label>
              <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={4} className="w-full px-4 py-3 border rounded-lg" placeholder="Condiciones, términos..." />
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Subtotal:</span>
                  <span className="font-semibold">{formatMonto(calcularSubtotal())}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Descuento:</span>
                  <input type="number" min="0" value={descuento} onChange={(e) => setDescuento(parseInt(e.target.value) || 0)} className="w-32 px-3 py-1 border rounded-lg text-right" />
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">IVA (19%):</span>
                  <span className="font-semibold">{formatMonto(calcularIVA())}</span>
                </div>
                <div className="flex justify-between pt-3 border-t-2 border-purple-600">
                  <span className="text-lg font-bold">TOTAL:</span>
                  <span className="text-2xl font-bold text-purple-600">{formatMonto(calcularTotal())}</span>
                </div>
              </div>
            </div>
          </div>
        </form>

        <div className="border-t bg-gray-50 px-6 py-4 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-6 py-2 border text-gray-700 rounded-lg hover:bg-gray-100 font-semibold">Cancelar</button>
          <button onClick={handleSubmit} disabled={loading} className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold disabled:opacity-50">
            {loading ? 'Creando...' : 'Crear Cotización'}
          </button>
        </div>
      </div>
    </div>
  )
}
