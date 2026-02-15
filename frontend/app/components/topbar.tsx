"use client"

import { useEffect, useState } from "react"
import { getSessionUser, clearSession } from "../lib/session"

export default function Topbar() {
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    setUser(getSessionUser())
  }, [])

  function handleLogout() {
    clearSession()
    window.location.href = "/login"
  }

  return (
    <header className="flex items-center justify-between">
      <h2 className="text-3xl font-bold">Dashboard</h2>

      <div className="flex items-center gap-4">
        {user && (
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              user.role === "admin"
                ? "bg-purple-100 text-purple-700"
                : "bg-slate-200 text-slate-700"
            }`}
          >
            {user.role.toUpperCase()}
          </span>
        )}

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium">{user?.name ?? "Usuario"}</p>
            <p className="text-xs text-slate-500">ConectaAI</p>
          </div>

          <div className="h-9 w-9 rounded-full bg-slate-900 text-white flex items-center justify-center">
            {user?.name?.[0]?.toUpperCase() ?? "U"}
          </div>

          <button
            onClick={handleLogout}
            className="ml-2 text-sm text-red-600 hover:underline"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  )
}
