'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePortalSession } from '../usePortalSession'

interface Documento {
  id: number
  nombre: string
  tipo: string
  descripcion: string | null
  url: string
  created_at: string
}

const TIPO_ICON: Record<string, string> = {
  reglamento: '📋',
  acta: '📄',
  financiero: '💰',
  contrato: '📝',
  certificado: '🏆',
  formulario: '📑',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function PortalDocumentos() {
  const router = useRouter()
  const { token, loading, logout, authFetch } = usePortalSession()
  const [items, setItems] = useState<Documento[]>([])
  const [fetching, setFetching] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { if (!loading && !token) router.push('/portal/login') }, [loading, token, router])

  useEffect(() => {
    if (!token) return
    authFetch('/api/portal/documentos')
      .then(r => r.json())
      .then(data => setItems(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setFetching(false))
  }, [token])

  const filtered = items.filter(d =>
    d.nombre.toLowerCase().includes(search.toLowerCase()) ||
    d.tipo.toLowerCase().includes(search.toLowerCase())
  )

  if (loading || fetching) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white px-4 pt-8 pb-6">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-indigo-200 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-bold">Documentos</h1>
              <p className="text-indigo-200 text-xs">Documentos del condominio</p>
            </div>
          </div>
          <button onClick={logout} className="text-indigo-200 hover:text-white text-xs">Salir</button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar documentos..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <div className="text-4xl mb-3">📁</div>
            <p className="font-medium">{search ? 'Sin resultados' : 'Sin documentos disponibles'}</p>
            <p className="text-sm mt-1">La administración publicará documentos aquí</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(doc => (
              <div key={doc.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-start gap-4">
                <div className="text-2xl flex-shrink-0">{TIPO_ICON[doc.tipo] || '📄'}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-800 text-sm leading-tight">{doc.nombre}</h3>
                  {doc.descripcion && (
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{doc.descripcion}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full capitalize">{doc.tipo}</span>
                    <span className="text-xs text-slate-400">{fmt(doc.created_at)}</span>
                  </div>
                </div>
                {doc.url && (
                  <a href={doc.url} target="_blank" rel="noopener noreferrer"
                    className="flex-shrink-0 p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                    </svg>
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex">
        {[
          {href:'/portal/dashboard', icon:'🏠', label:'Inicio'},
          {href:'/portal/cuenta', icon:'💰', label:'Cuenta'},
          {href:'/portal/mensajes', icon:'💬', label:'Mensajes'},
          {href:'/portal/incidencias', icon:'🔧', label:'Incidencias'},
          {href:'/portal/avisos', icon:'📢', label:'Avisos'},
        ].map(item => (
          <a key={item.href} href={item.href}
            className="flex-1 flex flex-col items-center py-2 text-slate-400 hover:text-indigo-600 transition-colors">
            <span className="text-xl">{item.icon}</span>
            <span className="text-[10px] mt-0.5">{item.label}</span>
          </a>
        ))}
      </nav>
    </div>
  )
}
