export type SessionUser = {
  id: number
  name: string
  email: string
  role: string
  company_id: number
}

export function getSessionUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem("user")
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearSession() {
  localStorage.removeItem("token")
  localStorage.removeItem("user")
}
