'use client'
import { useState, useEffect, useCallback } from 'react'

export function usePortalSession() {
  const [residente, setResidente] = useState<any>(null)
  const [token, setToken] = useState<string|null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = localStorage.getItem('portal_token')
    const r = localStorage.getItem('portal_residente')
    if (t && r) {
      try { setToken(t); setResidente(JSON.parse(r)) } catch {}
    }
    setLoading(false)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('portal_token')
    localStorage.removeItem('portal_residente')
    window.location.href = '/portal/login'
  }, [])

  const authFetch = useCallback((url: string, options: RequestInit = {}) =>
    fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...((options.headers as Record<string,string>) || {})
      }
    }), [token])

  return { residente, token, loading, logout, authFetch }
}
