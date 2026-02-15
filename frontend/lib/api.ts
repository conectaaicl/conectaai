import axios from 'axios'

// ==============================
// Cliente API central de ConectaAI
// ==============================

const api = axios.create({
  baseURL: 'https://conectaai.cl/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
})

// ==============================
// Helpers de Cookie
// ==============================

function getTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null
  const cookie = document.cookie
    .split('; ')
    .find(row => row.startsWith('auth_token='))
  return cookie ? cookie.split('=')[1] : null
}

export function saveToken(token: string) {
  const maxAge = 60 * 60 * 24 // 24 horas
  document.cookie = `auth_token=${token}; path=/; max-age=${maxAge}; SameSite=Lax`
  console.log('[AUTH] Token guardado en cookie')
}

export function removeToken() {
  document.cookie = 'auth_token=; path=/; max-age=0'
  console.log('[AUTH] Token eliminado')
}

export function hasToken(): boolean {
  return !!getTokenFromCookie()
}

// ==============================
// Interceptor REQUEST
// ==============================

api.interceptors.request.use(
  (config) => {
    const token = getTokenFromCookie()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
      console.log('[API] Request con token:', config.method?.toUpperCase(), config.url)
    } else {
      console.warn('[API] Request SIN token:', config.method?.toUpperCase(), config.url)
    }
    return config
  },
  (error) => {
    console.error('[API] Error en request:', error)
    return Promise.reject(error)
  }
)

// ==============================
// Interceptor RESPONSE
// ==============================

api.interceptors.response.use(
  (response) => {
    console.log('[API] Response OK:', response.status, response.config.url)
    return response
  },
  (error) => {
    console.error('[API] Error en response:', {
      status: error.response?.status,
      url: error.config?.url,
      message: error.message,
    })
    
    if (error.response?.status === 401) {
      console.error('[API] 401 → limpiando sesión')
      removeToken()
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    
    return Promise.reject(error)
  }
)

export default api
