'use client'
import { useState } from 'react'

interface GastoComun {
  id: number
  mes: number
  anio: number
  monto_total: number
  estado: string
  fecha_vencimiento: string
  fecha_pago: string | null
}

interface ResidenteData {
  nombre_completo: string
  rut: string
  departamento: string
  torre: string
  condominio: string
  gastos_pendientes: GastoComun[]
  historial_pagados: GastoComun[]
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

function formatCLP(amount: number): string {
  return '$' + amount.toLocaleString('es-CL')
}

function validarRUT(rut: string): boolean {
  if (!rut) return false
  const cleaned = rut.replace(/\./g, '').replace(/-/g, '')
  if (cleaned.length < 2) return false
  const body = cleaned.slice(0, -1)
  const dv = cleaned.slice(-1).toUpperCase()
  if (!/^\d+$/.test(body)) return false
  let sum = 0
  let mul = 2
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * mul
    mul = mul === 7 ? 2 : mul + 1
  }
  const expected = 11 - (sum % 11)
  const dvExpected = expected === 11 ? '0' : expected === 10 ? 'K' : String(expected)
  return dv === dvExpected
}

function formatRUT(value: string): string {
  const cleaned = value.replace(/[^0-9kK]/g, '')
  if (cleaned.length <= 1) return cleaned
  const body = cleaned.slice(0, -1)
  const dv = cleaned.slice(-1).toUpperCase()
  const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return formatted + '-' + dv
}

export default function PortalPage() {
  const [rut, setRut] = useState('')
  const [email, setEmail] = useState('')
  const [residente, setResidente] = useState<ResidenteData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pagandoId, setPagandoId] = useState<number | null>(null)
  const [rutError, setRutError] = useState('')

  function handleRutChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatRUT(e.target.value)
    setRut(formatted)
    if (formatted.length > 3 && !validarRUT(formatted)) {
      setRutError('RUT invalido')
    } else {
      setRutError('')
    }
  }

  async function handleBuscar(e: React.FormEvent) {
    e.preventDefault()
    if (!validarRUT(rut)) {
      setRutError('Ingresa un RUT valido (ej: 12.345.678-9)')
      return
    }
    setLoading(true)
    setError('')
    setResidente(null)
    try {
      const rutEncoded = encodeURIComponent(rut)
      const res = await fetch('/api/portal/residente/' + rutEncoded)
      if (res.ok) {
        const data = await res.json()
        setResidente(data)
      } else if (res.status === 404) {
        setError('No se encontro un residente con ese RUT.')
      } else {
        setError('Error al buscar. Intenta nuevamente.')
      }
    } catch {
      setError('Error de conexion. Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handlePagar(gastoId: number) {
    if (!email) {
      alert('Ingresa tu correo electronico para continuar con el pago.')
      return
    }
    setPagandoId(gastoId)
    try {
      const res = await fetch('/api/portal/pago/flow/iniciar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gasto_id: gastoId, email })
      })
      if (res.ok) {
        const data = await res.json()
        if (data.url) {
          window.location.href = data.url
        } else {
          alert('Error al iniciar pago. Intenta nuevamente.')
        }
      } else {
        const err = await res.json()
        alert('Error: ' + (err.detail || 'No se pudo iniciar el pago'))
      }
    } catch {
      alert('Error de conexion al iniciar pago.')
    } finally {
      setPagandoId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}} className="py-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-5xl mb-4">🏢</div>
          <h1 className="text-4xl font-bold text-white mb-3">Portal Residente</h1>
          <p className="text-purple-200 text-lg">
            Consulta tus gastos comunes y realiza pagos en linea
          </p>
        </div>

        <form onSubmit={handleBuscar} className="max-w-xl mx-auto mt-10">
          <div className="bg-white rounded-2xl shadow-2xl p-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Ingresa tu RUT
            </label>
            <div className="flex gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={rut}
                  onChange={handleRutChange}
                  placeholder="12.345.678-9"
                  maxLength={12}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-lg focus:border-purple-500 outline-none transition"
                  required
                />
                {rutError && (
                  <p className="text-red-500 text-xs mt-1">{rutError}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={loading || !!rutError}
                style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}}
                className="px-6 py-3 text-white rounded-xl font-bold hover:shadow-lg transition disabled:opacity-60"
              >
                {loading ? '...' : 'Buscar'}
              </button>
            </div>

            {residente && (
              <div className="mt-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tu correo electronico (para recibo de pago)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@correo.cl"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none transition"
                />
              </div>
            )}
          </div>
        </form>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-center mb-6">
            {error}
          </div>
        )}

        {residente && (
          <>
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border-l-4 border-purple-500">
              <div className="flex items-center gap-4">
                <div
                  style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}}
                  className="w-14 h-14 rounded-full flex items-center justify-center text-white text-2xl font-bold flex-shrink-0"
                >
                  {residente.nombre_completo.charAt(0)}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{residente.nombre_completo}</h2>
                  <p className="text-gray-500 text-sm">RUT: {residente.rut}</p>
                  <p className="text-gray-600 text-sm font-medium">
                    {residente.condominio} - Torre {residente.torre} - Depto {residente.departamento}
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                Gastos Pendientes
              </h3>

              {residente.gastos_pendientes.length === 0 ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center text-green-700 font-medium">
                  Sin gastos pendientes. Estas al dia!
                </div>
              ) : (
                <div className="space-y-4">
                  {residente.gastos_pendientes.map(gasto => (
                    <div
                      key={gasto.id}
                      className="bg-white rounded-2xl shadow-md p-5 border border-gray-100 hover:shadow-lg transition"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                          <p className="font-bold text-gray-800 text-lg">
                            {MESES[gasto.mes - 1]} {gasto.anio}
                          </p>
                          <p className="text-gray-500 text-sm">
                            Vence: {new Date(gasto.fecha_vencimiento).toLocaleDateString('es-CL')}
                          </p>
                          <span className={
                            'inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-bold ' +
                            (gasto.estado === 'atrasado'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-orange-100 text-orange-700')
                          }>
                            {gasto.estado === 'atrasado' ? 'Atrasado' : 'Pendiente'}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-gray-800">
                            {formatCLP(gasto.monto_total)}
                          </p>
                          <button
                            onClick={() => handlePagar(gasto.id)}
                            disabled={pagandoId === gasto.id}
                            style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}}
                            className="mt-2 px-5 py-2 text-white rounded-xl font-semibold text-sm hover:shadow-md transition disabled:opacity-60"
                          >
                            {pagandoId === gasto.id ? 'Procesando...' : 'Pagar con Flow'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {residente.historial_pagados.length > 0 && (
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-4">
                  Historial de Pagos
                  <span className="text-sm font-normal text-gray-500 ml-2">(ultimos 6 meses)</span>
                </h3>
                <div className="space-y-3">
                  {residente.historial_pagados.map(gasto => (
                    <div
                      key={gasto.id}
                      className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-semibold text-gray-700">
                          {MESES[gasto.mes - 1]} {gasto.anio}
                        </p>
                        {gasto.fecha_pago && (
                          <p className="text-green-600 text-xs">
                            Pagado el {new Date(gasto.fecha_pago).toLocaleDateString('es-CL')}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-700">{formatCLP(gasto.monto_total)}</p>
                        <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full font-bold">
                          Pagado
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="text-center py-8 text-gray-400 text-sm border-t border-gray-200">
        <p>ConectaAI Condominios - Plataforma de gestion residencial</p>
      </div>
    </div>
  )
}
