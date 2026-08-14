"use client"

import { useState, useCallback } from "react"
import { AdminSidebar, MobileSidebar } from "@/components/shared/admin-sidebar"
import { AdminHeader } from "@/components/shared/admin-header"
import { ChatWidget } from "@/components/shared/chat-widget"
import { Menu } from "lucide-react"

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const closeMobile = useCallback(() => setMobileOpen(false), [])

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <MobileSidebar open={mobileOpen} onClose={closeMobile} />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 p-3 sm:p-4 md:p-6">{children}</main>
      </div>
      <ChatWidget />
    </div>
  )
}
