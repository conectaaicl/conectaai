'use client'
// Utilidades compartidas de Ventas Terreno (ventas.conectaai.cl)
export const API = '/api/ventas-terreno'

export async function vfetch(path: string, init: RequestInit = {}) {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> || {}) }
  if (init.body && typeof init.body === 'string') headers['Content-Type'] = 'application/json'
  const r = await fetch(API + path, { credentials: 'include', ...init, headers })
  if (r.status === 401 && typeof window !== 'undefined' && !location.pathname.endsWith('/ventas/login')) {
    location.href = '/ventas/login'
  }
  return r
}

export async function vjson<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await vfetch(path, init)
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.detail || 'Error')
  return d as T
}

export const clp = (n: number | null | undefined) => '$' + Math.round(n || 0).toLocaleString('es-CL')

export const ETAPAS: Record<string, { label: string; color: string; hint: string }> = {
  visitado:    { label: 'Visitado',          color: 'bg-slate-100 text-slate-700',     hint: 'Manda la propuesta o agenda la reunión' },
  propuesta:   { label: 'Propuesta enviada', color: 'bg-blue-100 text-blue-700',       hint: 'Confirma que la abrió; reenvía por WhatsApp si no' },
  demo:        { label: 'Demo activo',       color: 'bg-teal-100 text-teal-800',       hint: 'Mira la telemetría y llama cuando esté probando' },
  negociacion: { label: 'Negociación',       color: 'bg-amber-100 text-amber-800',     hint: 'Cierra fecha de comité y condiciones' },
  cliente:     { label: 'Cliente',           color: 'bg-emerald-100 text-emerald-800', hint: 'Convertir demo y cargar unidades reales' },
  perdido:     { label: 'Perdido',           color: 'bg-rose-100 text-rose-700',       hint: 'Vuelve a visitar en 3 meses' },
}

export const RESULTADOS: Record<string, string> = {
  no_estaba: 'No estaba', interesado: 'Interesado — pidió propuesta', tiene_sistema: 'Ya tiene sistema',
  rechazo: 'Rechazó', reunion: 'Agendar reunión', seguimiento: 'Seguimiento',
}

export const TIPOS = [['departamentos', 'Departamentos'], ['casas', 'Casas'], ['oficinas', 'Oficinas']]

export function fecha(iso?: string | null, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' }) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-CL', opts)
}
export function hace(iso?: string | null) {
  if (!iso) return ''
  const d = (Date.now() - new Date(iso).getTime()) / 36e5
  if (d < 1) return 'hace minutos'
  if (d < 24) return `hace ${Math.round(d)} h`
  if (d < 48) return 'ayer'
  return `hace ${Math.round(d / 24)} días`
}
export function diasRestantes(iso?: string | null) {
  if (!iso) return null
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 864e5)
}
export function telLink(t?: string | null) { return t ? 'tel:' + t.replace(/\s/g, '') : undefined }
export function waLink(t?: string | null, txt?: string) {
  const d = (t || '').replace(/\D/g, '')
  const n = d.length === 9 ? '56' + d : d
  return `https://wa.me/${n}${txt ? '?text=' + encodeURIComponent(txt) : ''}`
}

// TerraBlinds
export const ETC: Record<string, { label: string; color: string }> = {
  lead: { label: 'Lead', color: 'bg-slate-100 text-slate-700' }, medido: { label: 'Medido', color: 'bg-blue-100 text-blue-800' }, propuesta: { label: 'Propuesta enviada', color: 'bg-amber-100 text-amber-800' },
  aceptada: { label: '¡Aceptada!', color: 'bg-emerald-100 text-emerald-800' }, instalada: { label: 'Instalada', color: 'bg-teal-100 text-teal-800' }, perdido: { label: 'Perdido', color: 'bg-rose-100 text-rose-700' },
}
