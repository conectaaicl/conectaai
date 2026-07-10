import { NextResponse } from 'next/server'

const BACKEND = 'http://host.docker.internal:8003'

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/api/sistema/public/visits`, { cache: 'no-store' })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ visits: 0 })
  }
}

export async function POST() {
  try {
    const res = await fetch(`${BACKEND}/api/sistema/public/visits`, { method: 'POST', cache: 'no-store' })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ visits: 0 })
  }
}
