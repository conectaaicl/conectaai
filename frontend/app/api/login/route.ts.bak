import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    
    // Llamar al backend INTERNO (mismo servidor)
    const response = await fetch('http://127.0.0.1:8003/api/auth/login', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Login fallido' }))
      return NextResponse.json(
        { error: error.detail || 'Credenciales incorrectas' },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    // Crear respuesta con la cookie
    const nextResponse = NextResponse.json(data)
    
    // Copiar la cookie del backend
    const sessionCookie = response.headers.get('set-cookie')
    if (sessionCookie) {
      // Extraer el valor del token de la cookie
      const tokenMatch = sessionCookie.match(/session=([^;]+)/)
      if (tokenMatch) {
        nextResponse.cookies.set('session', tokenMatch[1], {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60, // 7 días
          path: '/'
        })
      }
    }

    return nextResponse
    
  } catch (err) {
    console.error('[LOGIN ERROR]', err)
    return NextResponse.json(
      { error: 'Error de conexión con el servidor' },
      { status: 500 }
    )
  }
}
