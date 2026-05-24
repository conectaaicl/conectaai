'use client'
import { useState } from 'react'
interface Persona { id: number; nombre_completo: string }
interface Props { show: boolean; onClose: () => void; onSuccess: () => void; personal: Persona[] }
export default function ModalEvaluacion({ show, onClose, onSuccess, personal }: Props) {
  const [formData, setFormData] = useState({ persona_id: 0, tipo: 'mensual', fecha: new Date().toISOString().split('T')[0], puntualidad: 5, desempeno: 5, actitud: 5, presentacion: 5, comentarios: '' })
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const res = await fetch('/api/personal/evaluaciones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
      if (res.ok) { onSuccess(); alert('✅ Evaluación registrada') }
    } catch (err) { alert('❌ Error') }
  }
  if (!show) return null
  const promedio = ((formData.puntualidad + formData.desempeno + formData.actitud + formData.presentacion) / 4).toFixed(1)
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full">
        <div className="p-6 border-b bg-gradient-to-r from-pink-600 to-pink-800 text-white rounded-t-2xl"><h3 className="text-2xl font-bold">⭐ Evaluar Desempeño</h3></div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-bold mb-2">Personal *</label><select value={formData.persona_id} onChange={(e) => setFormData({...formData, persona_id: parseInt(e.target.value)})} className="w-full px-4 py-3 border-2 rounded-xl outline-none" required><option value="">Seleccionar...</option>{personal.map(p => (<option key={p.id} value={p.id}>{p.nombre_completo}</option>))}</select></div>
            <div><label className="block text-sm font-bold mb-2">Fecha *</label><input type="date" value={formData.fecha} onChange={(e) => setFormData({...formData, fecha: e.target.value})} className="w-full px-4 py-3 border-2 rounded-xl outline-none" required /></div>
          </div>
          <div className="bg-blue-50 p-4 rounded-xl space-y-3">
            <h4 className="font-bold">Calificaciones (1-5)</h4>
            {[{ key: 'puntualidad', label: '⏰ Puntualidad' }, { key: 'desempeno', label: '💪 Desempeño' }, { key: 'actitud', label: '😊 Actitud' }, { key: 'presentacion', label: '👔 Presentación' }].map(item => (<div key={item.key}><label className="block text-sm font-bold mb-1">{item.label}</label><div className="flex gap-2">{[1,2,3,4,5].map(val => (<button key={val} type="button" onClick={() => setFormData({...formData, [item.key]: val})} className={`flex-1 py-2 rounded-lg font-bold ${formData[item.key as keyof typeof formData] === val ? 'bg-pink-600 text-white' : 'bg-white border-2'}`}>{val}</button>))}</div></div>))}
          </div>
          <div className="bg-green-50 p-4 rounded-xl"><p className="text-sm font-bold">Promedio</p><p className="text-3xl font-bold text-green-600">⭐ {promedio}</p></div>
          <div><label className="block text-sm font-bold mb-2">Comentarios</label><textarea value={formData.comentarios} onChange={(e) => setFormData({...formData, comentarios: e.target.value})} rows={3} className="w-full px-4 py-3 border-2 rounded-xl outline-none" /></div>
          <div className="flex gap-4">
            <button type="button" onClick={onClose} className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-xl font-bold hover:bg-gray-50">Cancelar</button>
            <button type="submit" className="flex-1 px-6 py-3 bg-gradient-to-r from-pink-600 to-pink-800 text-white rounded-xl font-bold hover:shadow-xl">⭐ Registrar Evaluación</button>
          </div>
        </form>
      </div>
    </div>
  )
}
