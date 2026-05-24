'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export default function ConserjeIndex() {
  const r = useRouter()
  useEffect(() => { r.replace('/conserje/central') }, [r])
  return null
}
