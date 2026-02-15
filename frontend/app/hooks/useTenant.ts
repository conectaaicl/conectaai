'use client'
import { useState, useEffect } from 'react'

interface TenantConfig {
  id: number
  nombre: string
  subdominio: string
  logo_url: string | null
  favicon_url: string | null
  color_primario: string
  color_secundario: string
  color_acento: string
}

export function useTenant() {
  const [tenant, setTenant] = useState<TenantConfig | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchTenantConfig() {
      try {
        const res = await fetch('/api/admin/tenants/1/config')
        if (res.ok) {
          const data = await res.json()
          setTenant(data)
          if (data.color_primario) document.documentElement.style.setProperty('--color-primary', data.color_primario)
          if (data.color_secundario) document.documentElement.style.setProperty('--color-secondary', data.color_secundario)
          if (data.color_acento) document.documentElement.style.setProperty('--color-accent', data.color_acento)
          if (data.favicon_url) {
            const favicon = document.querySelector("link[rel='icon']") as HTMLLinkElement
            if (favicon) favicon.href = data.favicon_url
          }
          document.title = data.nombre || 'ConectaAI'
        }
      } catch (err) {
        console.error('Error cargando tenant config:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchTenantConfig()
  }, [])

  return { tenant, loading }
}
