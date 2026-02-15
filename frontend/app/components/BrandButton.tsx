'use client'
import { useBranding } from '@/hooks/useBranding'

interface BrandButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'accent'
  className?: string
  type?: 'button' | 'submit'
  disabled?: boolean
}

export default function BrandButton({ 
  children, 
  onClick, 
  variant = 'primary',
  className = '',
  type = 'button',
  disabled = false
}: BrandButtonProps) {
  const { branding } = useBranding()

  const getColor = () => {
    if (!branding) return '#7c3aed' // purple-600 default
    
    switch(variant) {
      case 'primary':
        return branding.primary_color
      case 'secondary':
        return branding.secondary_color
      case 'accent':
        return branding.accent_color
      default:
        return branding.primary_color
    }
  }

  const color = getColor()

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-6 py-3 rounded-xl font-bold text-white transition-all hover:opacity-90 disabled:opacity-50 ${className}`}
      style={{ backgroundColor: color }}
    >
      {children}
    </button>
  )
}
