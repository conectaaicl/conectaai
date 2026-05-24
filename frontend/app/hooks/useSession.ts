"use client"
import { useState, useEffect } from "react"

export interface SessionUser {
  id: number
  email: string
  nombre_completo: string
  rol: string
  tenant_id: number
  tenant?: {
    nombre: string
    plan: string
    logo_url?: string
    color_primario?: string
  }
}

let _cache: SessionUser | null = null

export function useSession() {
  const [user, setUser] = useState<SessionUser | null>(_cache)
  const [loading, setLoading] = useState(!_cache)

  useEffect(() => {
    if (_cache) { setUser(_cache); setLoading(false); return }
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) { _cache = data; setUser(data) }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return { user, loading, tenantId: user?.tenant_id ?? 1 }
}
