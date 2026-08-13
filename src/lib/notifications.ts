export interface Notification {
  id: string
  type: "new_order" | "status_change"
  orderNumber: string
  customerName: string
  total: number
  newStatus?: string
  createdAt: string
}

type Listener = (notification: Notification) => void

const listeners = new Set<Listener>()

export function pushNotification(data: Omit<Notification, "id" | "createdAt">) {
  const notification: Notification = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }
  for (const listener of listeners) {
    try { listener(notification) } catch {}
  }
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
