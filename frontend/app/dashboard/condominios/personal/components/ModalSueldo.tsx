'use client'
import { useState, useEffect } from 'react'

interface Persona { id: number; nombre_completo: string; rut: string }
interface Adelanto { id: number; monto: number; descontado: boolean }
interface Props { show: boolean; onClose: () => void; onSuccess: () => void; personal: Persona[] }

export default function ModalSueldo({ show, onClose, onSuccess, personal }: Props) {
  const [formData, setFormData] = useState({ persona_id: 0, mes: new Date().getMonth() + 1, anio: new Date().getFullYear(), sueldo_base: 0, horas_extra: 0, bonos: [] as Array<{concepto: string, monto: number}>, adelantos: 0, multas: 0, otros_descuentos: [] as Array<{concepto: string, monto: number}> })
  const [adelantosPendientes, setAdelantosPendientes] = useState(0)

  useEffect(() => { if (formData.persona_id > 0) fetchAdelantos(formData.persona_id) }, [formData.persona_id])

  async function fetchAdelantos(personaId: number) {
    try {
      const res = await fetch(`/api/personal/adelantos/?persona_id=${personaId}&estado=aprobado`)
      if (res.ok) {
        const data = await res.json()
        const total = data.filter((a: Adelanto) => !a.descontado).reduce((sum: number, a: Adelanto) => sum + a.monto, 0)
        setAdelantosPendientes(total)
        setFormData(prev => ({ ...prev, adelantos: total }))
      }
    } catch (err) { console.error(err) }
  }

  function agregarBono() { setFormData({ ...formData, bonos: [...formData.bonos, { concepto: '', monto: 0 }] }) }
  function agregarDescuento() { setFormData({ ...formData, otros_descuentos: [...formData.otros_descuentos, { concepto: '', monto: 0 }] }) }
  function calcularTotal() {
    const haberes = formData.sueldo_base + formData.horas_extra + formData.bonos.reduce((s, b) => s + b.monto, 0)
    const descuentos = formData.adelantos + formData.multas + formData.otros_descuentos.reduce((s, d) => s + d.monto, 0)
    return haberes - descuentos
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const res = await fetch('/api/personal/sueldos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
      if (res.ok) { onSuccess(); alert('✅ Liquidación generada') } else { const error = await res.json(); alert(`❌ Error: ${JSON.stringify(error)}`) }
    } catch (err) { alert('❌ Error al generar liquidación') }
  }

  if (!show) return null

  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-8 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b bg-gradient-to-r from-green-600 to-green-800 text-white rounded-t-2xl sticky top-0 z-10"><h3 className="text-2xl font-bold">💰 Generar Liquidación</h3></div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div><label className="block text-sm font-bold mb-2">Personal *</label><select value={formData.persona_id} onChange={(e) => setFormData({...formData, persona_id: parseInt(e.target.value)})} className="w-full px-4 py-3 border-2 rounded-xl outline-none" required><option value="">Seleccionar...</option>{personal.map(p => (<option key={p.id} value={p.id}>{p.nombre_completo}</option>))}</select></div>
            <div><label className="block text-sm font-bold mb-2">Mes *</label><select value={formData.mes} onChange={(e) => setFormData({...formData, mes: parseInt(e.target.value)})} className="w-full px-4 py-3 border-2 rounded-xl outline-none">{MESES.map((m, i) => (<option key={i} value={i+1}>{m}</option>))}</select></div>
            <div><label className="block text-sm font-bold mb-2">Año *</label><input type="number" value={formData.anio} onChange={(e) => setFormData({...formData, anio: parseInt(e.target.value)})} className="w-full px-4 py-3 border-2 rounded-xl outline-none" required /></div>
          </div>
          <div className="bg-blue-50 p-4 rounded-xl">
            <h4 className="font-bold mb-3">💵 HABERES</h4>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><label className="block text-sm font-bold mb-2">Sueldo Base *</label><input type="number" value={formData.sueldo_base} onChange={(e) => setFormData({...formData, sueldo_base: parseFloat(e.target.value)})} className="w-full px-4 py-3 border-2 rounded-xl outline-none" required /></div>
              <div><label className="block text-sm font-bold mb-2">Horas Extra</label><input type="number" value={formData.horas_extra} onChange={(e) => setFormData({...formData, horas_extra: parseFloat(e.target.value)})} className="w-full px-4 py-3 border-2 rounded-xl outline-none" /></div>
            </div>
            <div className="flex justify-between items-center mb-2"><h5 className="font-bold">Bonos</h5><button type="button" onClick={agregarBono} className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm">➕ Agregar</button></div>
            {formData.bonos.map((b, i) => (<div key={i} className="grid grid-cols-3 gap-2 mb-2"><input type="text" value={b.concepto} onChange={(e) => { const n = [...formData.bonos]; n[i].concepto = e.target.value; setFormData({...formData, bonos: n}) }} placeholder="Concepto" className="col-span-2 px-3 py-2 border-2 rounded-lg outline-none" /><input type="number" value={b.monto} onChange={(e) => { const n = [...formData.bonos]; n[i].monto = parseFloat(e.target.value); setFormData({...formData, bonos: n}) }} placeholder="Monto" className="px-3 py-2 border-2 rounded-lg outline-none" /></div>))}
          </div>
          <div className="bg-red-50 p-4 rounded-xl">
            <h4 className="font-bold mb-3">💸 DESCUENTOS</h4>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><label className="block text-sm font-bold mb-2">Adelantos Pendientes</label><input type="number" value={formData.adelantos} readOnly className="w-full px-4 py-3 border-2 rounded-xl outline-none bg-gray-100" />{adelantosPendientes > 0 && (<p className="text-xs text-red-600 mt-1">Se descontarán automáticamente</p>)}</div>
              <div><label className="block text-sm font-bold mb-2">Multas</label><input type="number" value={formData.multas} onChange={(e) => setFormData({...formData, multas: parseFloat(e.target.value)})} className="w-full px-4 py-3 border-2 rounded-xl outline-none" /></div>
            </div>
            <div className="flex justify-between items-center mb-2"><h5 className="font-bold">Otros Descuentos</h5><button type="button" onClick={agregarDescuento} className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm">➕ Agregar</button></div>
            {formData.otros_descuentos.map((d, i) => (<div key={i} className="grid grid-cols-3 gap-2 mb-2"><input type="text" value={d.concepto} onChange={(e) => { const n = [...formData.otros_descuentos]; n[i].concepto = e.target.value; setFormData({...formData, otros_descuentos: n}) }} placeholder="Concepto" className="col-span-2 px-3 py-2 border-2 rounded-lg outline-none" /><input type="number" value={d.monto} onChange={(e) => { const n = [...formData.otros_descuentos]; n[i].monto = parseFloat(e.target.value); setFormData({...formData, otros_descuentos: n}) }} placeholder="Monto" className="px-3 py-2 border-2 rounded-lg outline-none" /></div>))}
          </div>
          <div className="bg-green-50 p-6 rounded-xl"><p className="text-sm font-bold text-gray-700">LÍQUIDO A PAGAR:</p><p className="text-4xl font-bold text-green-600">${calcularTotal().toLocaleString('es-CL')}</p></div>
          <div className="flex gap-4">
            <button type="button" onClick={onClose} className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-xl font-bold hover:bg-gray-50">Cancelar</button>
            <button type="submit" className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-green-800 text-white rounded-xl font-bold hover:shadow-xl">💰 Generar Liquidación</button>
          </div>
        </form>
      </div>
    </div>
  )
}
