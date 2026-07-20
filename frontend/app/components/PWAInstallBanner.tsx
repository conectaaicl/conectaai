'use client'
import { useState, useEffect } from 'react'
import { Download, Share, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PWAInstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [showIOSSteps, setShowIOSSteps] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }
    if (localStorage.getItem('pwa_dismissed')) {
      setDismissed(true)
      return
    }

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream
    setIsIOS(ios)

    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!prompt) return
    await prompt.prompt()
    const choice = await prompt.userChoice
    if (choice.outcome === 'accepted') setIsInstalled(true)
    setPrompt(null)
  }

  const handleDismiss = () => {
    localStorage.setItem('pwa_dismissed', '1')
    setDismissed(true)
    setPrompt(null)
  }

  if (isInstalled || dismissed) return null
  if (!prompt && !isIOS) return null

  return (
    <div className="w-full mt-4">
      <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-brand-700 rounded-xl flex items-center justify-center shrink-0">
            <Download size={18} className="text-white" strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-brand-900">Instalar ConectaAI</p>
            <p className="text-xs text-brand-700 mt-0.5">Acceso rapido desde tu pantalla de inicio, sin necesidad de abrir el navegador.</p>

            {isIOS && !showIOSSteps && (
              <button
                onClick={() => setShowIOSSteps(true)}
                className="mt-2 text-xs font-semibold text-brand-800 underline underline-offset-2"
              >
                Ver como instalar en iPhone o iPad
              </button>
            )}

            {isIOS && showIOSSteps && (
              <ol className="mt-2 space-y-1.5 text-xs text-brand-800">
                <li className="flex items-center gap-1.5">
                  <span className="w-4 h-4 bg-brand-200 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                  Toca el icono <Share size={12} className="inline mx-0.5" /> Compartir en Safari
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-4 h-4 bg-brand-200 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                  Selecciona &quot;Anadir a pantalla de inicio&quot;
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-4 h-4 bg-brand-200 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                  Confirma con &quot;Anadir&quot;
                </li>
              </ol>
            )}
          </div>
          <button onClick={handleDismiss} aria-label="Cerrar" className="text-brand-300 hover:text-brand-600 shrink-0 mt-0.5">
            <X size={16} />
          </button>
        </div>

        {prompt && (
          <button
            onClick={handleInstall}
            className="w-full mt-3 py-2 bg-brand-700 text-white text-sm font-semibold rounded-xl hover:bg-brand-800 transition-colors flex items-center justify-center gap-2"
          >
            <Download size={16} />
            Instalar app
          </button>
        )}
      </div>
    </div>
  )
}
