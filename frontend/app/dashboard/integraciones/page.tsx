'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function IntegracionesPage() {
  const [loading, setLoading] = useState(false)

  const handleConectarGoogle = () => {
    alert('🚧 Integración OAuth de Google Calendar en desarrollo.\n\nPróximamente podrás:\n• Conectar tu cuenta Google\n• Sincronizar reuniones\n• Crear eventos desde deals')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-700 to-purple-900 shadow-xl px-8 py-6 mb-8">
        <div className="flex justify-between items-center">
          <div className="text-white">
            <h1 className="text-3xl font-bold mb-1">🔗 Integraciones</h1>
            <p className="text-purple-200 text-sm font-medium">
              Conecta tus herramientas favoritas con ConectaAI
            </p>
          </div>
          <Link 
            href="/dashboard"
            className="px-5 py-3 bg-white/20 backdrop-blur-sm text-white rounded-xl font-semibold hover:bg-white/30 transition-all"
          >
            ← Volver
          </Link>
        </div>
      </div>

      <div className="px-8 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Google Calendar */}
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="text-6xl">📅</div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">Google Calendar</h3>
                  <p className="text-sm text-gray-600">Sincroniza reuniones automáticamente</p>
                </div>
              </div>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-green-600">✓</span>
                  <span>Crear eventos desde deals</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-green-600">✓</span>
                  <span>Sincronización bidireccional</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-green-600">✓</span>
                  <span>Recordatorios automáticos</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">Estado:</span>
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-semibold">
                    En desarrollo
                  </span>
                </div>
              </div>

              <button
                onClick={handleConectarGoogle}
                className="w-full mt-4 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-bold hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg"
              >
                🔗 Conectar Google Calendar
              </button>
            </div>
          </div>

          {/* WhatsApp */}
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="text-6xl">💬</div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">WhatsApp Business</h3>
                  <p className="text-sm text-gray-600">API oficial de Meta</p>
                </div>
              </div>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-green-600">✓</span>
                  <span>Envío masivo de mensajes</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-green-600">✓</span>
                  <span>Plantillas aprobadas por Meta</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-green-600">✓</span>
                  <span>Integración con CRM</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">Estado:</span>
                  <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-semibold">
                    Por revisar
                  </span>
                </div>
              </div>

              <button
                onClick={() => alert('Revisando estado de WhatsApp API...')}
                className="w-full mt-4 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-bold hover:from-green-700 hover:to-green-800 transition-all shadow-lg"
              >
                🔍 Verificar Integración
              </button>
            </div>
          </div>

          {/* Meta (Facebook + Instagram) */}
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="text-6xl">📱</div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">Meta Business</h3>
                  <p className="text-sm text-gray-600">Facebook + Instagram</p>
                </div>
              </div>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-green-600">✓</span>
                  <span>Gestión de mensajes directos</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-green-600">✓</span>
                  <span>Publicación programada</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-green-600">✓</span>
                  <span>Analytics integrado</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">Estado:</span>
                  <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-semibold">
                    Próximamente
                  </span>
                </div>
              </div>

              <button
                disabled
                className="w-full mt-4 px-6 py-3 bg-gray-400 text-white rounded-xl font-bold cursor-not-allowed opacity-60"
              >
                🔗 Próximamente
              </button>
            </div>
          </div>

          {/* Shopify */}
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="text-6xl">🛍️</div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">Shopify</h3>
                  <p className="text-sm text-gray-600">E-commerce integration</p>
                </div>
              </div>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-green-600">✓</span>
                  <span>Sincronizar productos</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-green-600">✓</span>
                  <span>Gestión de pedidos</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-green-600">✓</span>
                  <span>Inventario en tiempo real</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">Estado:</span>
                  <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-semibold">
                    Próximamente
                  </span>
                </div>
              </div>

              <button
                disabled
                className="w-full mt-4 px-6 py-3 bg-gray-400 text-white rounded-xl font-bold cursor-not-allowed opacity-60"
              >
                🔗 Próximamente
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
