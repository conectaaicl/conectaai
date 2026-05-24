'use client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function PagoResultadoContent() {
  const searchParams = useSearchParams()
  const status = searchParams.get('status')
  const isError = status === 'error' || status === '2'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-3xl shadow-2xl p-10 text-center">
          {isError ? (
            <>
              <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
                <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-gray-800 mb-3">Pago no completado</h1>
              <p className="text-gray-500 mb-8">
                Hubo un problema al procesar tu pago. Puedes intentarlo nuevamente desde el portal.
              </p>
            </>
          ) : (
            <>
              <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-gray-800 mb-3">Pago procesado!</h1>
              <p className="text-gray-500 mb-2">
                Tu pago fue recibido exitosamente.
              </p>
              <p className="text-gray-400 text-sm mb-8">
                Recibirás un comprobante en tu correo electronico.
              </p>
            </>
          )}

          <Link
            href="/portal"
            style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}}
            className="inline-block px-8 py-3 text-white rounded-xl font-bold hover:shadow-lg transition"
          >
            Volver al Portal
          </Link>
        </div>

        <div className="text-center mt-6 text-gray-400 text-sm">
          <p>ConectaAI Condominios</p>
        </div>
      </div>
    </div>
  )
}

export default function PagoResultadoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
      </div>
    }>
      <PagoResultadoContent />
    </Suspense>
  )
}
