"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

export default function Sidebar() {
  const pathname = usePathname()
  const [role, setRole] = useState<string>("user")

  useEffect(() => {
    const stored = localStorage.getItem("user")
    if (stored) {
      setRole(JSON.parse(stored).role)
    }
  }, [])

  const linkClass = (path: string) =>
    `block rounded-lg px-3 py-2 transition ${
      pathname === path
        ? "bg-slate-800 text-white"
        : "hover:bg-slate-800 text-slate-200"
    }`

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 p-6 flex flex-col">
      <div className="mb-10">
        <h1 className="text-2xl font-bold tracking-tight">ConectaAI</h1>
        <p className="text-xs text-slate-400">Panel</p>
      </div>

      <nav className="space-y-2 flex-1">
        <Link href="/dashboard" className={linkClass("/dashboard")}>
          Dashboard
        </Link>

        {role === "admin" && (
          <div className="mt-4">
            <p className="text-xs uppercase text-slate-500 mb-2">Admin</p>
            <Link href="#" className="block rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800">
              Gestión de usuarios
            </Link>
            <Link href="#" className="block rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800">
              Empresas
            </Link>
          </div>
        )}
      </nav>

      <div className="text-xs text-slate-500">
        © ConectaAI
      </div>
    </aside>
  )
}
