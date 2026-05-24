"use client"
import { useState, useEffect, useCallback } from "react"

export interface CondominioBasico {
  id: number
  nombre: string
  direccion: string
  tipo: string
  logo_url?: string | null
}

const STORAGE_KEY = "active_condominio"
let _cache: CondominioBasico[] | null = null
let _activeCache: CondominioBasico | null = null

export function useCondominio(tenantId: number) {
  const [condominios, setCondominios] = useState<CondominioBasico[]>(_cache || [])
  const [active, setActiveState] = useState<CondominioBasico | null>(_activeCache)
  const [loading, setLoading] = useState(!_cache)

  useEffect(() => {
    if (_cache) {
      setCondominios(_cache)
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as CondominioBasico
          const found = _cache.find(c => c.id === parsed.id)
          if (found) { _activeCache = found; setActiveState(found) }
          else if (_cache.length > 0) { _activeCache = _cache[0]; setActiveState(_cache[0]) }
        } catch {
          if (_cache.length > 0) { _activeCache = _cache[0]; setActiveState(_cache[0]) }
        }
      } else if (_cache.length > 0) {
        _activeCache = _cache[0]; setActiveState(_cache[0])
      }
      setLoading(false)
      return
    }
    if (!tenantId) { setLoading(false); return }
    fetch(`/api/condominios?tenant_id=${tenantId}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: CondominioBasico[]) => {
        _cache = Array.isArray(data) ? data : []
        setCondominios(_cache)
        const stored = localStorage.getItem(STORAGE_KEY)
        let active: CondominioBasico | null = null
        if (stored) {
          try {
            const parsed = JSON.parse(stored) as CondominioBasico
            active = _cache.find(c => c.id === parsed.id) || null
          } catch { /* ignore */ }
        }
        if (!active && _cache.length > 0) active = _cache[0]
        if (active) { _activeCache = active; localStorage.setItem(STORAGE_KEY, JSON.stringify(active)) }
        setActiveState(active)
      })
      .catch(() => { _cache = [] })
      .finally(() => setLoading(false))
  }, [tenantId])

  const setActive = useCallback((c: CondominioBasico) => {
    _activeCache = c
    localStorage.setItem(STORAGE_KEY, JSON.stringify(c))
    setActiveState(c)
    // Trigger storage event for other components
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: JSON.stringify(c) }))
  }, [])

  return { condominios, active, loading, setActive }
}
