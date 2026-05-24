"use client"
import { useState, useEffect, useCallback } from "react"

const PUSH_API = "/api/push"

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export type PushState = "unsupported" | "denied" | "granted" | "subscribed" | "loading"

export function usePushNotifications(tenantId: number, personaId?: number) {
  const [state, setState] = useState<PushState>("loading")
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [error, setError] = useState<string | null>(null)

  const checkState = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported")
      return
    }
    const perm = Notification.permission
    if (perm === "denied") { setState("denied"); return }

    try {
      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      if (existing) {
        setSubscription(existing)
        setState("subscribed")
      } else {
        setState(perm === "granted" ? "granted" : "unsupported")
      }
    } catch {
      setState("unsupported")
    }
  }, [])

  useEffect(() => {
    // Register SW if not already
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => null)
    }
    checkState()
  }, [checkState])

  const subscribe = useCallback(async () => {
    setState("loading")
    setError(null)
    try {
      // Get VAPID key
      const keyRes = await fetch(`${PUSH_API}/vapid-public-key`)
      if (!keyRes.ok) throw new Error("Push no configurado en el servidor")
      const { public_key } = await keyRes.json()

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(public_key) as unknown as BufferSource,
      })

      const subJson = sub.toJSON()
      await fetch(`${PUSH_API}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          persona_id: personaId || null,
          endpoint: subJson.endpoint,
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth,
          user_agent: navigator.userAgent.slice(0, 200),
        }),
      })

      setSubscription(sub)
      setState("subscribed")
    } catch (e: any) {
      setError(e.message || "Error al activar notificaciones")
      setState(Notification.permission === "denied" ? "denied" : "granted")
    }
  }, [tenantId, personaId])

  const unsubscribe = useCallback(async () => {
    if (!subscription) return
    setState("loading")
    try {
      await fetch(`${PUSH_API}/subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
        method: "DELETE",
      })
      await subscription.unsubscribe()
      setSubscription(null)
      setState("granted")
    } catch {
      setState("subscribed")
    }
  }, [subscription])

  return { state, subscription, error, subscribe, unsubscribe }
}
