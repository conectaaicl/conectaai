import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PUBLIC_PATHS = ["/", "/login", "/forgot-password", "/reset-password", "/portal", "/acceso", "/m", "/i", "/p", "/pres", "/tb", "/superadmin/login", "/conserje/login", "/blog"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith("/api/")) return NextResponse.next()

  // ventas.conectaai.cl: app de ventas en terreno (sesion propia, cookie ventas_session)
  const host = (request.headers.get("host") || "").split(":")[0]
  const esVentas = host.startsWith("ventas.")
  if (esVentas && (pathname === "/" || pathname === "/login")) {
    return NextResponse.redirect(new URL("/ventas/hoy", request.url))
  }
  if (pathname.startsWith("/ventas")) {
    const vs = request.cookies.get("ventas_session")?.value
    if (pathname === "/ventas/login") {
      if (vs) return NextResponse.redirect(new URL("/ventas/hoy", request.url))
      return NextResponse.next()
    }
    if (!vs) return NextResponse.redirect(new URL("/ventas/login", request.url))
    return NextResponse.next()
  }

  const sessionCookie = request.cookies.get("session")?.value
  const saCookie = request.cookies.get("sa_session")?.value

  // Conserje portal — separate auth flow
  if (pathname.startsWith("/conserje")) {
    if (pathname === "/conserje/login" || pathname === "/conserje") {
      // login page: if already authenticated, go to central
      if (sessionCookie && pathname === "/conserje/login") {
        return NextResponse.redirect(new URL("/conserje/central", request.url))
      }
      return NextResponse.next()
    }
    // protected conserje routes — require session, redirect to conserje login
    if (!sessionCookie) {
      return NextResponse.redirect(new URL("/conserje/login", request.url))
    }
    return NextResponse.next()
  }

  const isPublic = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + "/"))

  // Superadmin UI routes
  if (pathname.startsWith("/superadmin")) {
    if (pathname === "/superadmin/login") {
      if (saCookie) return NextResponse.redirect(new URL("/superadmin/dashboard", request.url))
      return NextResponse.next()
    }
    if (!saCookie) return NextResponse.redirect(new URL("/superadmin/login", request.url))
    return NextResponse.next()
  }

  // Regular admin routes
  if (!isPublic && !sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url))
  }
  if (sessionCookie && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|manifest-ventas.json|icon-192.png|icon-512.png|uploads|robots.txt|sitemap.xml|og-conectaai.jpg|sw.js|google39b4a51d86750223.html).*)"],
}
