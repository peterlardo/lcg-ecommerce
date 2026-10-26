"use client"

import { AdminTopNav } from "@/components/shared/admin-top-nav"
import { ChatWidget } from "@/components/shared/chat-widget"
import { NotificationToast } from "@/components/notification-toast"
import { useNotifications } from "@/hooks/use-notifications"
import { useActivityPing } from "@/hooks/use-activity-ping"
import { usePosMode } from "@/hooks/use-pos-mode"

export function AdminShell({ children }: { children: React.ReactNode }) {
  useActivityPing()
  // Plus de déconnexion automatique après inactivité (demande du 2026-10-26) : la session reste ouverte jusqu'à la déconnexion
  const { notifications, recent, newCount, plannedCount, dismiss, dismissAll } = useNotifications(10000)
  const { posMode, setOverride } = usePosMode()

  return (
    <div className={`pos-touch${posMode ? " pos-compact" : ""} flex min-h-screen flex-col bg-gray-50`}>
      <AdminTopNav
        recent={recent}
        newCount={newCount}
        plannedCount={plannedCount}
        onMarkAllRead={dismissAll}
        posMode={posMode}
        onPosModeChange={setOverride}
      />
      <main className="flex-1 px-3 py-4 sm:px-4 sm:py-6 md:px-6">{children}</main>
      <NotificationToast notifications={notifications} onDismiss={dismiss} />
      <ChatWidget />
    </div>
  )
}
