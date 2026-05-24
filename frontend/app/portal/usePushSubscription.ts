'use client'
import { useEffect, useRef } from 'react'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function usePushSubscription(
  token: string | null,
  residente: any
) {
  const attempted = useRef(false)

  useEffect(() => {
    if (!token || !residente || attempted.current) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    attempted.current = true

    async function subscribe() {
      try {
        // Register service worker
        const reg = await navigator.serviceWorker.register('/sw.js')
        await navigator.serviceWorker.ready

        // Check existing subscription
        const existing = await reg.pushManager.getSubscription()
        if (existing) {
          // Already subscribed — re-send to backend to ensure it's saved
          await sendSubscription(existing, token!, residente)
          return
        }

        // Request permission
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return

        // Fetch VAPID public key
        const res = await fetch('/api/push/vapid-public-key')
        if (!res.ok) return
        const { public_key } = await res.json()

        // Subscribe
        const subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(public_key) as unknown as BufferSource,
        })

        await sendSubscription(subscription, token!, residente)
      } catch (err) {
        // Silent fail — push is optional enhancement
        console.debug('Push subscription failed:', err)
      }
    }

    async function sendSubscription(
      sub: PushSubscription,
      tk: string,
      res: any
    ) {
      const keys = sub.toJSON().keys || {}
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + tk,
        },
        body: JSON.stringify({
          tenant_id: res.tenant_id || 1,
          persona_id: res.id || null,
          endpoint: sub.endpoint,
          p256dh: keys.p256dh || '',
          auth: keys.auth || '',
          user_agent: navigator.userAgent.slice(0, 200),
        }),
      })
    }

    subscribe()
  }, [token, residente])
}
