'use client'
import { useState, useEffect } from 'react'
import ModalSueldo from './components/ModalSueldo'
import ModalAdelanto from './components/ModalAdelanto'
import ModalEvaluacion from './components/ModalEvaluacion'

interface PersonalActivo {
  id: number
  nombre: string
  nombre_completo: string
  rut: string
  roles: string[]
  asistencias_mes: number
  adelantos_pendientes: number
  evaluacion_promedio: number | null
}

interface Resumen {
  mes: number
  anio: number
  total_sueldos: number
  total_adelantos: number
  total_asistencias: number
  tardanzas: number
  ausencias: number
  puntualidad_porcentaje: number
}

export default function PersonalPage() {
  const [personal, setPersonal] = useState<PersonalActivo[]>([])
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [loading, setLoading] = useState(true)
  const [vistaActual, setVistaActual] = useState<'dashboard' | 'sueldos' | 'turnos' | 'asistencias' | 'adelantos' | 'evaluaciones'>('dashboard')
  
  const [showModalSueldo, setShowModalSueldo] = useState(false)
  const [showModalAdelanto, setShowModalAdelanto] = useState(false)
  const [showModalEvaluacion, setShowModalEvaluacion] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    try {
      const hoy = new Date()
      const [personalRes, resumenRes] = await Promise.all([
        fetch('/api/personal/reportes/personal-activo'),
        fetch(`/api/personal/reportes/resumen-mensual?mes=${hoy.getMonth() + 1}&anio=${hoy.getFullYear()}`)
      ])
      if (personalRes.ok) {
        const data = await personalRes.json()
        // Mapear para asegurar que tenemos nombre_completo
        const personalMapeado = data.map((p: any) => ({
          ...p,
          nombre_completo: p.nombre_completo || p.nombre
        }))
        setPersonal(personalMapeado)
      }
      if (resumenRes.ok) setResumen(await resumenRes.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

  if (loading) return (<div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div></div>)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div><h1 className="text-3xl font-bold text-gray-800">👷 Gestión de Personal</h1><p className="text-gray-600">Turnos, sueldos, adelantos y evaluaciones</p></div>
          <div className="flex gap-3">
            <button onClick={() => alert('Exportar PDF')} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold">📄 PDF</button>
            <button onClick={() => alert('Exportar Excel')} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold">📊 Excel</button>
          </div>
        </div>

        <div className="flex gap-2 mb-8 overflow-x-auto">
          {[
            { id: 'dashboard', label: '📊 Dashboard', color: 'orange' },
            { id: 'sueldos', label: '💰 Sueldos', color: 'green' },
            { id: 'turnos', label: '📅 Turnos', color: 'blue' },
            { id: 'asistencias', label: '✅ Asistencias', color: 'purple' },
            { id: 'adelantos', label: '💵 Adelantos', color: 'yellow' },
            { id: 'evaluaciones', label: '⭐ Evaluaciones', color: 'pink' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setVistaActual(tab.id as any)} className={`px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${vistaActual === tab.id ? `bg-${tab.color}-600 text-white shadow-lg` : 'bg-white text-gray-700 hover:bg-gray-100'}`}>{tab.label}</button>
          ))}
        </div>

        {vistaActual === 'dashboard' && (
          <>
            {resumen && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4">📅 Resumen {MESES[resumen.mes - 1]} {resumen.anio}</h2>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                  <div className="bg-gradient-to-br from-green-500 to-green-700 text-white rounded-xl p-6 shadow-lg"><p className="text-sm opacity-90 mb-1">💰 Total Sueldos</p><p className="text-3xl font-bold">${resumen.total_sueldos.toLocaleString('es-CL')}</p></div>
                  <div className="bg-gradient-to-br from-yellow-500 to-yellow-700 text-white rounded-xl p-6 shadow-lg"><p className="text-sm opacity-90 mb-1">💵 Adelantos</p><p className="text-3xl font-bold">${resumen.total_adelantos.toLocaleString('es-CL')}</p></div>
                  <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-xl p-6 shadow-lg"><p className="text-sm opacity-90 mb-1">✅ Asistencias</p><p className="text-3xl font-bold">{resumen.total_asistencias}</p></div>
                  <div className="bg-gradient-to-br from-red-500 to-red-700 text-white rounded-xl p-6 shadow-lg"><p className="text-sm opacity-90 mb-1">⏰ Tardanzas</p><p className="text-3xl font-bold">{resumen.tardanzas}</p></div>
                  <div className="bg-gradient-to-br from-purple-500 to-purple-700 text-white rounded-xl p-6 shadow-lg"><p className="text-sm opacity-90 mb-1">🎯 Puntualidad</p><p className="text-3xl font-bold">{resumen.puntualidad_porcentaje}%</p></div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <button onClick={() => setShowModalSueldo(true)} className="bg-gradient-to-br from-green-500 to-green-700 text-white rounded-2xl p-8 text-left hover:shadow-2xl transition-all transform hover:scale-105"><div className="text-6xl mb-4">💰</div><h3 className="text-2xl font-bold mb-2">Generar Sueldos</h3><p className="text-green-100">Liquidaciones y pagos mensuales</p></button>
              <button onClick={() => setVistaActual('turnos')} className="bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-2xl p-8 text-left hover:shadow-2xl transition-all transform hover:scale-105"><div className="text-6xl mb-4">📅</div><h3 className="text-2xl font-bold mb-2">Gestionar Turnos</h3><p className="text-blue-100">Calendario y asignaciones</p></button>
              <button onClick={() => setVistaActual('asistencias')} className="bg-gradient-to-br from-purple-500 to-purple-700 text-white rounded-2xl p-8 text-left hover:shadow-2xl transition-all transform hover:scale-105"><div className="text-6xl mb-4">✅</div><h3 className="text-2xl font-bold mb-2">Control Asistencias</h3><p className="text-purple-100">Check-in/out y reportes</p></button>
              <button onClick={() => setShowModalAdelanto(true)} className="bg-gradient-to-br from-yellow-500 to-yellow-700 text-white rounded-2xl p-8 text-left hover:shadow-2xl transition-all transform hover:scale-105"><div className="text-6xl mb-4">💵</div><h3 className="text-2xl font-bold mb-2">Adelantos</h3><p className="text-yellow-100">Solicitudes y aprobaciones</p></button>
              <button onClick={() => setShowModalEvaluacion(true)} className="bg-gradient-to-br from-pink-500 to-pink-700 text-white rounded-2xl p-8 text-left hover:shadow-2xl transition-all transform hover:scale-105"><div className="text-6xl mb-4">⭐</div><h3 className="text-2xl font-bold mb-2">Evaluaciones</h3><p className="text-pink-100">Desempeño y feedback</p></button>
              <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-2xl p-8 text-left"><div className="text-6xl mb-4">🎓</div><h3 className="text-2xl font-bold mb-2">Capacitaciones</h3><p className="text-indigo-100 text-sm">Próximamente</p></div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-orange-600 to-orange-800 px-6 py-4"><h3 className="text-xl font-bold text-white">👥 Personal Activo ({personal.length})</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100"><tr><th className="px-6 py-4 text-left font-bold">Nombre</th><th className="px-6 py-4 text-left font-bold">RUT</th><th className="px-6 py-4 text-left font-bold">Cargo</th><th className="px-6 py-4 text-center font-bold">Asist. Mes</th><th className="px-6 py-4 text-right font-bold">Adelantos Pend.</th><th className="px-6 py-4 text-center font-bold">Evaluación</th><th className="px-6 py-4 text-center font-bold">Acciones</th></tr></thead>
                  <tbody>
                    {personal.map((p, idx) => (
                      <tr key={p.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-4 font-semibold text-gray-800">{p.nombre}</td>
                        <td className="px-6 py-4 text-gray-600">{p.rut}</td>
                        <td className="px-6 py-4"><div className="flex flex-wrap gap-1">{p.roles.map(rol => (<span key={rol} className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">{rol}</span>))}</div></td>
                        <td className="px-6 py-4 text-center"><span className={`font-bold ${p.asistencias_mes >= 20 ? 'text-green-600' : 'text-yellow-600'}`}>{p.asistencias_mes}</span></td>
                        <td className="px-6 py-4 text-right font-semibold text-red-600">{p.adelantos_pendientes > 0 ? `$${p.adelantos_pendientes.toLocaleString('es-CL')}` : '-'}</td>
                        <td className="px-6 py-4 text-center">{p.evaluacion_promedio ? (<span className={`px-3 py-1 rounded-full font-bold ${p.evaluacion_promedio >= 4 ? 'bg-green-100 text-green-700' : p.evaluacion_promedio >= 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>⭐ {p.evaluacion_promedio.toFixed(1)}</span>) : (<span className="text-gray-400 text-sm">Sin eval.</span>)}</td>
                        <td className="px-6 py-4 text-center"><button onClick={() => window.location.href = '/dashboard/condominios/personas'} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold transition-all">👤 Ver Perfil</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {personal.length === 0 && (<div className="text-center py-12 text-gray-500"><p className="text-xl">👷 No hay personal registrado</p></div>)}
              </div>
            </div>
          </>
        )}

        {vistaActual === 'sueldos' && (<div className="bg-white rounded-2xl shadow-xl p-8"><h2 className="text-2xl font-bold mb-6">💰 Gestión de Sueldos</h2><button onClick={() => setShowModalSueldo(true)} className="px-8 py-4 bg-gradient-to-r from-green-600 to-green-800 text-white rounded-xl font-bold hover:shadow-xl text-lg mb-4">➕ Generar Liquidación</button><div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded"><p className="text-yellow-800 font-semibold">🚧 Historial en construcción</p></div></div>)}
        {vistaActual === 'adelantos' && (<div className="bg-white rounded-2xl shadow-xl p-8"><h2 className="text-2xl font-bold mb-6">💵 Gestión de Adelantos</h2><button onClick={() => setShowModalAdelanto(true)} className="px-8 py-4 bg-gradient-to-r from-yellow-600 to-yellow-800 text-white rounded-xl font-bold hover:shadow-xl text-lg mb-4">➕ Registrar Adelanto</button><div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded"><p className="text-yellow-800 font-semibold">💡 Sistema Inteligente</p><p className="text-yellow-700 text-sm mt-1">Los adelantos se descuentan automáticamente en la liquidación del mes siguiente</p></div></div>)}
        {vistaActual === 'evaluaciones' && (<div className="bg-white rounded-2xl shadow-xl p-8"><h2 className="text-2xl font-bold mb-6">⭐ Sistema de Evaluaciones</h2><button onClick={() => setShowModalEvaluacion(true)} className="px-8 py-4 bg-gradient-to-r from-pink-600 to-pink-800 text-white rounded-xl font-bold hover:shadow-xl text-lg mb-4">⭐ Evaluar Personal</button></div>)}

        <ModalSueldo show={showModalSueldo} onClose={() => setShowModalSueldo(false)} onSuccess={() => { setShowModalSueldo(false); fetchData() }} personal={personal} />
        <ModalAdelanto show={showModalAdelanto} onClose={() => setShowModalAdelanto(false)} onSuccess={() => { setShowModalAdelanto(false); fetchData() }} personal={personal} />
        <ModalEvaluacion show={showModalEvaluacion} onClose={() => setShowModalEvaluacion(false)} onSuccess={() => { setShowModalEvaluacion(false); fetchData() }} personal={personal} />
      </div>
    </div>
  )
}
