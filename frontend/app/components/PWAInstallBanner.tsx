'use client'
import { useState, useEffect } from 'react'

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
    // Already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }
    // Dismissed previously
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
      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-indigo-900">Instalar ConectaAI</p>
            <p className="text-xs text-indigo-600 mt-0.5">Acceso rápido desde tu pantalla de inicio, sin necesidad de abrir el navegador.</p>

            {isIOS && !showIOSSteps && (
              <button
                onClick={() => setShowIOSSteps(true)}
                className="mt-2 text-xs font-semibold text-indigo-700 underline underline-offset-2"
              >
                Ver cómo instalar en iPhone/iPad →
              </button>
            )}

            {isIOS && showIOSSteps && (
              <ol className="mt-2 space-y-1 text-xs text-indigo-700">
                <li className="flex items-center gap-1.5">
                  <span className="w-4 h-4 bg-indigo-200 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0">1</span>
                  Toca el ícono <strong className="mx-0.5">Compartir</strong>
                  <svg className="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                  en Safari
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-4 h-4 bg-indigo-200 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0">2</span>
                  Selecciona <strong>"Añadir a pantalla de inicio"</strong>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-4 h-4 bg-indigo-200 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0">3</span>
                  Confirma con <strong>"Añadir"</strong>
                </li>
              </ol>
            )}
          </div>
          <button onClick={handleDismiss} className="text-indigo-300 hover:text-indigo-500 flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {prompt && (
          <button
            onClick={handleInstall}
            className="w-full mt-3 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Instalar app
          </button>
        )}
      </div>
    </div>
  )
}
