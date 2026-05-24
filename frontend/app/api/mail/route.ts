import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://conectaai_backend_condominios:8003'

export async function GET(request: NextRequest) {
  try {
    const resp = await fetch(`${BACKEND_URL}/api/mail/status`, { cache: 'no-store' })
    const data = await resp.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ connected: false, provider: 'mail.conectaai.cl', error: 'Backend unreachable' }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  const cookie = request.cookies.get('session')?.value
  try {
    const resp = await fetch(`${BACKEND_URL}/api/mail/test`, {
      method: 'POST',
      headers: cookie ? { Cookie: 'session=' + cookie } : {},
    })
    const data = await resp.json()
    return NextResponse.json(data, { status: resp.status })
  } catch {
    return NextResponse.json({ ok: false, message: 'Backend no disponible' }, { status: 503 })
  }
}
