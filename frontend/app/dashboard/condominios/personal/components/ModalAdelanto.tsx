'use client'
import { useState } from 'react'
interface Persona { id: number; nombre_completo: string }
interface Props { show: boolean; onClose: () => void; onSuccess: () => void; personal: Persona[] }
export default function ModalAdelanto({ show, onClose, onSuccess, personal }: Props) {
  const [formData, setFormData] = useState({ persona_id: 0, monto: 0, motivo: '' })
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const res = await fetch('/api/personal/adelantos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
      if (res.ok) { onSuccess(); alert('✅ Adelanto registrado (pendiente aprobación)') }
    } catch (err) { alert('❌ Error') }
  }
  if (!show) return null
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="p-6 border-b bg-gradient-to-r from-yellow-600 to-yellow-800 text-white rounded-t-2xl"><h3 className="text-2xl font-bold">💵 Registrar Adelanto</h3></div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div><label className="block text-sm font-bold mb-2">Personal *</label><select value={formData.persona_id} onChange={(e) => setFormData({...formData, persona_id: parseInt(e.target.value)})} className="w-full px-4 py-3 border-2 rounded-xl outline-none" required><option value="">Seleccionar...</option>{personal.map(p => (<option key={p.id} value={p.id}>{p.nombre_completo}</option>))}</select></div>
          <div><label className="block text-sm font-bold mb-2">Monto *</label><input type="number" value={formData.monto} onChange={(e) => setFormData({...formData, monto: parseFloat(e.target.value)})} className="w-full px-4 py-3 border-2 rounded-xl outline-none" required /></div>
          <div><label className="block text-sm font-bold mb-2">Motivo *</label><textarea value={formData.motivo} onChange={(e) => setFormData({...formData, motivo: e.target.value})} rows={3} className="w-full px-4 py-3 border-2 rounded-xl outline-none" required /></div>
          <div className="flex gap-4">
            <button type="button" onClick={onClose} className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-xl font-bold hover:bg-gray-50">Cancelar</button>
            <button type="submit" className="flex-1 px-6 py-3 bg-gradient-to-r from-yellow-600 to-yellow-800 text-white rounded-xl font-bold hover:shadow-xl">💵 Registrar</button>
          </div>
        </form>
      </div>
    </div>
  )
}
