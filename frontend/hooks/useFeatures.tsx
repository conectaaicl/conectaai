'use client'
import { useState, useEffect, createContext, useContext, useCallback } from 'react'

interface FeaturesCtx {
  features: string[]
  tipo: string
  hasFeature: (key: string) => boolean
  loading: boolean
  refresh: () => void
}

const FeaturesContext = createContext<FeaturesCtx>({
  features: [],
  tipo: 'condominio',
  hasFeature: () => true,
  loading: true,
  refresh: () => {},
})

const CACHE_KEY = 'tenant_features_cache'
const CACHE_TTL = 5 * 60 * 1000

export function FeaturesProvider({ children }: { children: React.ReactNode }) {
  const [features, setFeatures] = useState<string[]>([])
  const [tipo, setTipo] = useState('condominio')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (force = false) => {
    if (!force) {
      try {
        const cached = localStorage.getItem(CACHE_KEY)
        if (cached) {
          const { features: f, tipo: t, ts } = JSON.parse(cached)
          if (Date.now() - ts < CACHE_TTL) {
            setFeatures(f)
            setTipo(t)
            setLoading(false)
            return
          }
        }
      } catch {}
    }
    try {
      const r = await fetch('/api/features', { credentials: 'include' })
      if (r.ok) {
        const d = await r.json()
        setFeatures(d.features || [])
        setTipo(d.tipo || 'condominio')
        localStorage.setItem(CACHE_KEY, JSON.stringify({ features: d.features, tipo: d.tipo, ts: Date.now() }))
      }
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const hasFeature = useCallback((key: string) => {
    if (features.length === 0) return true
    return features.includes(key)
  }, [features])

  return (
    <FeaturesContext.Provider value={{ features, tipo, hasFeature, loading, refresh: () => load(true) }}>
      {children}
    </FeaturesContext.Provider>
  )
}

export function useFeatures() {
  return useContext(FeaturesContext)
}
