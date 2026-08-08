'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PWAInstallBanner from '@/components/PWAInstallBanner'

export default function LoginPage() {
  const router = useRouter()
  const [sistemaLabel, setSistemaLabel] = useState('Sistema de Condominios')

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hostname.includes('gym.')) {
      setSistemaLabel('Sistema de Gimnasio')
    }
  }, [])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('email', email)
      fd.append('password', password)
      const res = await fetch('/api/login', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.detail || data?.error || 'Credenciales incorrectas')
      if (data.success) {
        const rol = data.user?.rol || ''
        if (rol === 'conserje') {
          router.push('/conserje/central')
        } else if (rol === 'residente' || rol === 'usuario') {
          router.push('/portal/dashboard')
        } else {
          router.push('/dashboard')
        }
        router.refresh()
      }
      else throw new Error(data.error || 'Login fallido')
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión')
    } finally { setLoading(false) }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: '#070b12' }}
    >
      {/* Decorative orbs */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '-10%',
          left: '-5%',
          width: '55vw',
          height: '55vw',
          maxWidth: 700,
          maxHeight: 700,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: '-15%',
          right: '-8%',
          width: '50vw',
          height: '50vw',
          maxWidth: 650,
          maxHeight: 650,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)',
          filter: 'blur(50px)',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          top: '45%',
          left: '55%',
          width: '30vw',
          height: '30vw',
          maxWidth: 400,
          maxHeight: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(79,70,229,0.06) 0%, transparent 70%)',
          filter: 'blur(35px)',
        }}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md px-4">
        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderRadius: '1.5rem',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div className="px-8 pt-10 pb-8 text-center">
            {/* Logo mark */}
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                boxShadow: '0 0 32px rgba(99,102,241,0.35)',
              }}
            >
              <span className="text-white text-2xl font-bold" style={{ fontFamily: 'Inter, sans-serif' }}>C</span>
            </div>
            <h1
              className="text-2xl font-bold text-white tracking-tight"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Conecta AI
            </h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(148,163,184,0.8)' }}>
              {sistemaLabel}
            </p>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '0 2rem' }} />

          {/* Form */}
          <div className="px-8 py-8">
            {error && (
              <div
                className="mb-5 flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
                style={{
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  color: '#fca5a5',
                }}
              >
                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'rgba(203,213,225,0.85)' }}
                >
                  Correo electrónico
                </label>
                <div className="relative">
                  <span
                    className="absolute left-3.5 top-1/2 -translate-y-1/2"
                    style={{ color: 'rgba(148,163,184,0.5)' }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="tu@correo.com"
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl outline-none transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.09)',
                      color: '#e2e8f0',
                    }}
                    onFocus={e => {
                      e.currentTarget.style.border = '1px solid rgba(99,102,241,0.55)'
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.10)'
                    }}
                    onBlur={e => {
                      e.currentTarget.style.border = '1px solid rgba(255,255,255,0.09)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label
                    className="block text-sm font-medium"
                    style={{ color: 'rgba(203,213,225,0.85)' }}
                  >
                    Contraseña
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium transition-opacity hover:opacity-80"
                    style={{ color: '#818cf8' }}
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <div className="relative">
                  <span
                    className="absolute left-3.5 top-1/2 -translate-y-1/2"
                    style={{ color: 'rgba(148,163,184,0.5)' }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full pl-10 pr-11 py-2.5 text-sm rounded-xl outline-none transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.09)',
                      color: '#e2e8f0',
                    }}
                    onFocus={e => {
                      e.currentTarget.style.border = '1px solid rgba(99,102,241,0.55)'
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.10)'
                    }}
                    onBlur={e => {
                      e.currentTarget.style.border = '1px solid rgba(255,255,255,0.09)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-80"
                    style={{ color: 'rgba(148,163,184,0.55)' }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showPassword ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" : "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  boxShadow: loading ? 'none' : '0 0 20px rgba(99,102,241,0.35)',
                }}
                onMouseEnter={e => {
                  if (!loading) e.currentTarget.style.boxShadow = '0 0 32px rgba(99,102,241,0.55)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = loading ? 'none' : '0 0 20px rgba(99,102,241,0.35)'
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Iniciando...
                  </span>
                ) : 'Iniciar sesión'}
              </button>
            </form>

            <p
              className="mt-6 text-center text-xs"
              style={{ color: 'rgba(100,116,139,0.7)' }}
            >
              ¿Problemas para acceder? Contacta al administrador.
            </p>
            <PWAInstallBanner />
          </div>
        </div>
      </div>
    </div>
  )
}
