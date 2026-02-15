'use client'

import { useState, useEffect } from 'react'

interface Usuario {
  id: number
  email: string
  nombre_completo: string
  telefono?: string
  cargo?: string
  empresa?: string
  rut_empresa?: string
  direccion_empresa?: string
  sitio_web?: string
  logo_url?: string
  rol: string
  tenant_id: number
}

export default function PerfilPage() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{tipo: 'success' | 'error', texto: string} | null>(null)
  
  // Tabs
  const [tabActiva, setTabActiva] = useState<'personal' | 'empresa' | 'seguridad'>('personal')
  
  // Datos personales
  const [nombreCompleto, setNombreCompleto] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [cargo, setCargo] = useState('')
  
  // Datos empresa
  const [empresa, setEmpresa] = useState('')
  const [rutEmpresa, setRutEmpresa] = useState('')
  const [direccionEmpresa, setDireccionEmpresa] = useState('')
  const [sitioWeb, setSitioWeb] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  
  // Seguridad
  const [passwordActual, setPasswordActual] = useState('')
  const [passwordNueva, setPasswordNueva] = useState('')
  const [passwordConfirmar, setPasswordConfirmar] = useState('')

  useEffect(() => {
    cargarUsuario()
  }, [])

  const cargarUsuario = async () => {
    try {
      setLoading(true)
      const response = await fetch('https://sistema.conectaai.cl/api/auth/me', {
        credentials: 'include',
      })
      
      if (response.ok) {
        const data = await response.json()
        setUsuario(data)
        
        // Llenar formularios
        setNombreCompleto(data.nombre_completo || '')
        setEmail(data.email || '')
        setTelefono(data.telefono || '')
        setCargo(data.cargo || '')
        setEmpresa(data.empresa || '')
        setRutEmpresa(data.rut_empresa || '')
        setDireccionEmpresa(data.direccion_empresa || '')
        setSitioWeb(data.sitio_web || '')
        setLogoUrl(data.logo_url || '')
      }
    } catch (error) {
      console.error('Error cargando usuario:', error)
    } finally {
      setLoading(false)
    }
  }

  const guardarDatosPersonales = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    setMensaje(null)

    try {
      const response = await fetch(`https://sistema.conectaai.cl/api/usuarios/${usuario?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          nombre_completo: nombreCompleto,
          email: email,
          telefono: telefono,
          cargo: cargo,
        }),
      })

      if (response.ok) {
        setMensaje({ tipo: 'success', texto: '✅ Datos personales actualizados correctamente' })
        await cargarUsuario()
      } else {
        setMensaje({ tipo: 'error', texto: '❌ Error al actualizar los datos' })
      }
    } catch (error) {
      setMensaje({ tipo: 'error', texto: '❌ Error de conexión' })
    } finally {
      setGuardando(false)
    }
  }

  const guardarDatosEmpresa = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    setMensaje(null)

    try {
      const response = await fetch(`https://sistema.conectaai.cl/api/usuarios/${usuario?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          empresa: empresa,
          rut_empresa: rutEmpresa,
          direccion_empresa: direccionEmpresa,
          sitio_web: sitioWeb,
          logo_url: logoUrl,
        }),
      })

      if (response.ok) {
        setMensaje({ tipo: 'success', texto: '✅ Datos de empresa actualizados correctamente' })
        await cargarUsuario()
      } else {
        setMensaje({ tipo: 'error', texto: '❌ Error al actualizar los datos' })
      }
    } catch (error) {
      setMensaje({ tipo: 'error', texto: '❌ Error de conexión' })
    } finally {
      setGuardando(false)
    }
  }

  const cambiarPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    setMensaje(null)

    if (passwordNueva !== passwordConfirmar) {
      setMensaje({ tipo: 'error', texto: '❌ Las contraseñas no coinciden' })
      setGuardando(false)
      return
    }

    if (passwordNueva.length < 6) {
      setMensaje({ tipo: 'error', texto: '❌ La contraseña debe tener al menos 6 caracteres' })
      setGuardando(false)
      return
    }

    try {
      const response = await fetch(`https://sistema.conectaai.cl/api/usuarios/${usuario?.id}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          password_actual: passwordActual,
          password_nueva: passwordNueva,
        }),
      })

      if (response.ok) {
        setMensaje({ tipo: 'success', texto: '✅ Contraseña actualizada correctamente' })
        setPasswordActual('')
        setPasswordNueva('')
        setPasswordConfirmar('')
      } else {
        const error = await response.json()
        setMensaje({ tipo: 'error', texto: `❌ ${error.detail || 'Error al cambiar contraseña'}` })
      }
    } catch (error) {
      setMensaje({ tipo: 'error', texto: '❌ Error de conexión' })
    } finally {
      setGuardando(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-700 font-semibold">Cargando perfil...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2 flex items-center gap-3">
            <span className="text-5xl">👤</span>
            Mi Cuenta
          </h1>
          <p className="text-gray-600 text-lg">Gestiona tu información personal y configuración de empresa</p>
        </div>

        {/* Mensaje de feedback */}
        {mensaje && (
          <div className={`mb-6 p-4 rounded-xl font-semibold ${
            mensaje.tipo === 'success' 
              ? 'bg-green-100 text-green-800 border-2 border-green-300' 
              : 'bg-red-100 text-red-800 border-2 border-red-300'
          }`}>
            {mensaje.texto}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTabActiva('personal')}
            className={`px-6 py-3 rounded-xl font-bold transition ${
              tabActiva === 'personal'
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            👤 Información Personal
          </button>
          <button
            onClick={() => setTabActiva('empresa')}
            className={`px-6 py-3 rounded-xl font-bold transition ${
              tabActiva === 'empresa'
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            🏢 Información de Empresa
          </button>
          <button
            onClick={() => setTabActiva('seguridad')}
            className={`px-6 py-3 rounded-xl font-bold transition ${
              tabActiva === 'seguridad'
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            🔒 Seguridad
          </button>
        </div>

        {/* Contenido según tab activa */}
        {tabActiva === 'personal' && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Datos Personales</h2>
            <form onSubmit={guardarDatosPersonales} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Nombre Completo</label>
                <input
                  type="text"
                  value={nombreCompleto}
                  onChange={(e) => setNombreCompleto(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition"
                  placeholder="Juan Pérez"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition"
                  placeholder="juan@empresa.cl"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Teléfono</label>
                <input
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition"
                  placeholder="+56912345678"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Cargo</label>
                <input
                  type="text"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition"
                  placeholder="CEO / Gerente General"
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={guardando}
                  className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-bold hover:from-purple-700 hover:to-blue-700 transition shadow-lg disabled:opacity-50"
                >
                  {guardando ? 'Guardando...' : '💾 Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        )}

        {tabActiva === 'empresa' && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Información de tu Empresa</h2>
            <p className="text-gray-600 mb-6">Esta información se usa para la marca blanca de tu sistema</p>
            
            <form onSubmit={guardarDatosEmpresa} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Nombre de la Empresa</label>
                <input
                  type="text"
                  value={empresa}
                  onChange={(e) => setEmpresa(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition"
                  placeholder="Mi Empresa SPA"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">RUT Empresa</label>
                <input
                  type="text"
                  value={rutEmpresa}
                  onChange={(e) => setRutEmpresa(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition"
                  placeholder="12.345.678-9"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Dirección</label>
                <input
                  type="text"
                  value={direccionEmpresa}
                  onChange={(e) => setDireccionEmpresa(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition"
                  placeholder="Av. Principal 123, Santiago"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Sitio Web</label>
                <input
                  type="url"
                  value={sitioWeb}
                  onChange={(e) => setSitioWeb(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition"
                  placeholder="https://miempresa.cl"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Logo URL</label>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition"
                  placeholder="https://miempresa.cl/logo.png"
                />
                {logoUrl && (
                  <div className="mt-3 p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Vista previa:</p>
                    <img src={logoUrl} alt="Logo" className="h-16 object-contain" />
                  </div>
                )}
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={guardando}
                  className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-bold hover:from-purple-700 hover:to-blue-700 transition shadow-lg disabled:opacity-50"
                >
                  {guardando ? 'Guardando...' : '💾 Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        )}

        {tabActiva === 'seguridad' && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Cambiar Contraseña</h2>
            <p className="text-gray-600 mb-6">Asegúrate de usar una contraseña segura</p>
            
            <form onSubmit={cambiarPassword} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Contraseña Actual</label>
                <input
                  type="password"
                  value={passwordActual}
                  onChange={(e) => setPasswordActual(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Nueva Contraseña</label>
                <input
                  type="password"
                  value={passwordNueva}
                  onChange={(e) => setPasswordNueva(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
                <p className="text-xs text-gray-500 mt-1">Mínimo 6 caracteres</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Confirmar Nueva Contraseña</label>
                <input
                  type="password"
                  value={passwordConfirmar}
                  onChange={(e) => setPasswordConfirmar(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={guardando}
                  className="w-full px-6 py-4 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-bold hover:from-red-700 hover:to-red-800 transition shadow-lg disabled:opacity-50"
                >
                  {guardando ? 'Cambiando...' : '🔒 Cambiar Contraseña'}
                </button>
              </div>
            </form>

            {/* Info adicional */}
            <div className="mt-8 p-6 bg-blue-50 rounded-xl border-2 border-blue-200">
              <h3 className="font-bold text-blue-900 mb-2">💡 Consejos de Seguridad</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Usa una contraseña única y segura</li>
                <li>• Combina mayúsculas, minúsculas, números y símbolos</li>
                <li>• No compartas tu contraseña con nadie</li>
                <li>• Cambia tu contraseña regularmente</li>
              </ul>
            </div>
          </div>
        )}

        {/* Info de cuenta */}
        <div className="mt-6 bg-white rounded-2xl shadow-xl p-6">
          <h3 className="font-bold text-gray-900 mb-4">📋 Información de la Cuenta</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">ID de Usuario:</p>
              <p className="font-bold text-gray-900">{usuario?.id}</p>
            </div>
            <div>
              <p className="text-gray-600">Rol:</p>
              <p className="font-bold text-gray-900 capitalize">{usuario?.rol}</p>
            </div>
            <div>
              <p className="text-gray-600">Tenant ID:</p>
              <p className="font-bold text-gray-900">{usuario?.tenant_id}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
