'use client'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default function PortalHeader({
  title,
  subtitle,
  backHref = '/portal/dashboard',
}: {
  title: string
  subtitle?: string
  backHref?: string
}) {
  return (
    <div className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-30">
      <div className="max-w-lg mx-auto flex items-center gap-3">
        <Link
          href={backHref}
          aria-label="Volver"
          className="w-9 h-9 -ml-1.5 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
        >
          <ChevronLeft size={20} strokeWidth={2} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-slate-900 truncate">{title}</h1>
          {subtitle && <p className="text-xs text-brand-700 font-medium mt-0.5">{subtitle}</p>}
        </div>
      </div>
    </div>
  )
}
