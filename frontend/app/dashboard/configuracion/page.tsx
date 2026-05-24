'use client'
import { useState, useEffect } from 'react'
import BrandButton from '../../components/BrandButton'

interface BrandingData {
  brand_name: string
  logo_url: string | null
  favicon_url: string | null
  primary_color: string
  secondary_color: string
  accent_color: string
  subdomain: string
  support_email: string
  support_phone: string
}

export default function ConfiguracionPage() {
  const [companyId, setCompanyId] = useState<number | null>(null)
  const [branding, setBranding] = useState<BrandingData>({
    brand_name: 'ConectaAI',
    logo_url: null,
    favicon_url: null,
    primary_color: '#7c3aed',
    secondary_color: '#3b82f6',
    accent_color: '#ec4899',
    subdomain: '',
    support_email: '',
    support_phone: ''
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingFavicon, setUploadingFavicon] = useState(false)

  useEffect(() => {
    fetchUserAndBranding()
  }, [])

  async function fetchUserAndBranding() {
    try {
      const userResponse = await fetch('/api/auth/me', { credentials: 'include' })
      if (userResponse.ok) {
        const userData = await userResponse.json()
        setCompanyId(userData.company_id)
        await fetchBranding(userData.company_id)
      } else {
        setLoading(false)
      }
    } catch (err) {
      console.error('Error fetching user:', err)
      setLoading(false)
    }
  }

  async function fetchBranding(id?: number) {
    const cid = id ?? companyId
    if (!cid) return
    try {
      const response = await fetch(`/api/branding/company/${cid}`)
      if (response.ok) {
        const data = await response.json()
        setBranding({
          brand_name: data.brand_name || 'ConectaAI',
          logo_url: data.logo_url,
          favicon_url: data.favicon_url,
          primary_color: data.primary_color || '#7c3aed',
          secondary_color: data.secondary_color || '#3b82f6',
          accent_color: data.accent_color || '#ec4899',
          subdomain: data.subdomain || '',
          support_email: data.support_email || '',
          support_phone: data.support_phone || ''
        })
      }
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const response = await fetch(`/api/branding/company/${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(branding)
      })

      if (response.ok) {
        alert('✅ Configuración guardada exitosamente')
        fetchBranding()
      } else {
        const error = await response.json()
        alert('❌ Error al guardar: ' + JSON.stringify(error))
      }
    } catch (err) {
      alert('❌ Error: ' + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingLogo(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/api/upload/logo', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        setBranding({ ...branding, logo_url: data.url })
      }
    } catch (err) {
      alert('❌ Error subiendo logo')
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleFaviconUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingFavicon(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/api/upload/favicon', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        setBranding({ ...branding, favicon_url: data.url })
      }
    } catch (err) {
      alert('❌ Error subiendo favicon')
    } finally {
      setUploadingFavicon(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-700 font-medium">Cargando configuración...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">⚙️ Marca Blanca</h1>
          <p className="text-gray-600">Personaliza tu plataforma con tu identidad corporativa</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-lg">
              <h3 className="text-lg font-bold text-gray-800 mb-4">📸 Logo</h3>
              <div className="space-y-4">
                {branding.logo_url && (
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <img src={branding.logo_url} alt="Logo" className="h-16 object-contain" />
                  </div>
                )}
                <label className="block">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml"
                    onChange={handleLogoUpload}
                    className="hidden"
                    id="logo-upload"
                  />
                  <div className="cursor-pointer px-4 py-3 bg-purple-100 text-purple-700 rounded-xl font-semibold text-center hover:bg-purple-200 transition-all">
                    {uploadingLogo ? '⏳ Subiendo...' : '📤 Subir Logo'}
                  </div>
                </label>
              </div>
            </div>

            <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-lg">
              <h3 className="text-lg font-bold text-gray-800 mb-4">🔖 Favicon</h3>
              <div className="space-y-4">
                {branding.favicon_url && (
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <img src={branding.favicon_url} alt="Favicon" className="h-8 object-contain" />
                  </div>
                )}
                <label className="block">
                  <input
                    type="file"
                    accept=".ico,image/png"
                    onChange={handleFaviconUpload}
                    className="hidden"
                    id="favicon-upload"
                  />
                  <div className="cursor-pointer px-4 py-3 bg-purple-100 text-purple-700 rounded-xl font-semibold text-center hover:bg-purple-200 transition-all">
                    {uploadingFavicon ? '⏳ Subiendo...' : '📤 Subir Favicon'}
                  </div>
                </label>
              </div>
            </div>

            <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-lg">
              <h3 className="text-lg font-bold text-gray-800 mb-4">✏️ Nombre de Marca</h3>
              <input
                type="text"
                value={branding.brand_name}
                onChange={(e) => setBranding({ ...branding, brand_name: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500"
                placeholder="Tu Empresa"
              />
            </div>

            <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-lg">
              <h3 className="text-lg font-bold text-gray-800 mb-4">🎨 Colores</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Color Primario</label>
                  <div className="flex gap-3">
                    <input
                      type="color"
                      value={branding.primary_color}
                      onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                      className="h-12 w-20 rounded-xl cursor-pointer"
                    />
                    <input
                      type="text"
                      value={branding.primary_color}
                      onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                      className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Color Secundario</label>
                  <div className="flex gap-3">
                    <input
                      type="color"
                      value={branding.secondary_color}
                      onChange={(e) => setBranding({ ...branding, secondary_color: e.target.value })}
                      className="h-12 w-20 rounded-xl cursor-pointer"
                    />
                    <input
                      type="text"
                      value={branding.secondary_color}
                      onChange={(e) => setBranding({ ...branding, secondary_color: e.target.value })}
                      className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Color de Acento</label>
                  <div className="flex gap-3">
                    <input
                      type="color"
                      value={branding.accent_color}
                      onChange={(e) => setBranding({ ...branding, accent_color: e.target.value })}
                      className="h-12 w-20 rounded-xl cursor-pointer"
                    />
                    <input
                      type="text"
                      value={branding.accent_color}
                      onChange={(e) => setBranding({ ...branding, accent_color: e.target.value })}
                      className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-lg">
              <h3 className="text-lg font-bold text-gray-800 mb-4">🌐 Subdomain</h3>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={branding.subdomain}
                  onChange={(e) => setBranding({ ...branding, subdomain: e.target.value })}
                  className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500"
                  placeholder="miempresa"
                />
                <span className="text-gray-600 font-medium">.conectaai.cl</span>
              </div>
            </div>

            <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-lg">
              <h3 className="text-lg font-bold text-gray-800 mb-4">📞 Contacto</h3>
              <div className="space-y-3">
                <input
                  type="email"
                  value={branding.support_email}
                  onChange={(e) => setBranding({ ...branding, support_email: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500"
                  placeholder="soporte@tuempresa.cl"
                />
                <input
                  type="tel"
                  value={branding.support_phone}
                  onChange={(e) => setBranding({ ...branding, support_phone: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500"
                  placeholder="+56 9 1234 5678"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-all"
              >
                Cancelar
              </button>
              <BrandButton
                onClick={handleSave}
                disabled={saving}
                className="flex-1"
              >
                {saving ? '💾 Guardando...' : '💾 Guardar Cambios'}
              </BrandButton>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-lg sticky top-8">
              <h3 className="text-lg font-bold text-gray-800 mb-4">👁️ Vista Previa</h3>

              <div className="mb-6 p-4 bg-white rounded-xl shadow-md">
                <div className="flex items-center justify-between">
                  {branding.logo_url ? (
                    <img src={branding.logo_url} alt="Logo" className="h-8 object-contain" />
                  ) : (
                    <div className="text-xl font-bold" style={{ color: branding.primary_color }}>
                      {branding.brand_name}
                    </div>
                  )}
                  <div
                    className="px-4 py-2 rounded-lg text-white text-sm font-semibold"
                    style={{ backgroundColor: branding.primary_color }}
                  >
                    Mi Cuenta
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div
                  className="p-6 rounded-xl text-white"
                  style={{
                    background: `linear-gradient(135deg, ${branding.primary_color}, ${branding.secondary_color})`
                  }}
                >
                  <div className="text-4xl mb-2">💼</div>
                  <h4 className="font-bold text-lg mb-2">Módulo Principal</h4>
                  <p className="text-sm opacity-90">Con tus colores personalizados</p>
                </div>

                <div className="flex gap-3">
                  <div
                    className="flex-1 p-4 rounded-xl text-white text-center font-semibold"
                    style={{ backgroundColor: branding.primary_color }}
                  >
                    Primario
                  </div>
                  <div
                    className="flex-1 p-4 rounded-xl text-white text-center font-semibold"
                    style={{ backgroundColor: branding.secondary_color }}
                  >
                    Secundario
                  </div>
                  <div
                    className="flex-1 p-4 rounded-xl text-white text-center font-semibold"
                    style={{ backgroundColor: branding.accent_color }}
                  >
                    Acento
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-xl">
                <p className="text-sm text-blue-800">
                  <strong>💡 Tip:</strong> Los cambios se aplicarán en toda la plataforma al guardar.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
