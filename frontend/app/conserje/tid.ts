"use client"
// Tenant real del conserje (lo fija el layout tras /api/auth/me). Nunca asumir tenant 1.
// El backend usa siempre el tenant del JWT; '0' significa "no informado" y el cortafuegos lo acepta.
export function tid(): string {
  if (typeof window === 'undefined') return '0'
  return localStorage.getItem('conserje_tenant_id') || '0'
}
export function conserjeUser(): { id: number; nombre_completo: string; tenant_id: number } | null {
  if (typeof window === 'undefined') return null
  try { return JSON.parse(localStorage.getItem('conserje_user') || 'null') } catch { return null }
}
