import { useState, useEffect } from 'react'

interface Branding {
  brand_name: string
  logo_url: string | null
  favicon_url: string | null
  primary_color: string
  secondary_color: string
  accent_color: string
  subdomain: string | null
  custom_domain: string | null
}

export function useBranding() {
  const [branding, setBranding] = useState<Branding | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchBranding() {
      try {
        const response = await fetch('/api/branding/company/1')
        if (response.ok) {
          const data = await response.json()
          setBranding(data)
          
          if (data.primary_color) {
            document.documentElement.style.setProperty('--color-primary', data.primary_color)
          }
          if (data.secondary_color) {
            document.documentElement.style.setProperty('--color-secondary', data.secondary_color)
          }
          if (data.accent_color) {
            document.documentElement.style.setProperty('--color-accent', data.accent_color)
          }
        }
      } catch (err) {
        console.error('Error loading branding:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchBranding()
  }, [])

  return { branding, loading }
}
