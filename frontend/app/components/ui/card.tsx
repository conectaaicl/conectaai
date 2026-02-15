import React from "react"

type Props = {
  children: React.ReactNode
  className?: string
}

export function Card({ children, className = "" }: Props) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition
      hover:shadow-md hover:-translate-y-0.5 ${className}`}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className = "" }: Props) {
  return (
    <div className={`mb-3 ${className}`}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className = "" }: Props) {
  return (
    <h3 className={`text-sm font-medium text-slate-500 ${className}`}>
      {children}
    </h3>
  )
}

export function CardContent({ children, className = "" }: Props) {
  return (
    <div className={`mt-1 ${className}`}>
      {children}
    </div>
  )
}
