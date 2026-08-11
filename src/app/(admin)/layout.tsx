import { redirect } from "next/navigation"
import { AdminSidebar } from "@/components/shared/admin-sidebar"
import { AdminHeader } from "@/components/shared/admin-header"
import { auth } from "@/lib/auth"

const ADMIN_ROLES = ["ADMIN", "STOCK_MANAGER", "DELIVERY_AGENT"]

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  const role = session?.user?.role

  if (!session?.user) {
    redirect("/auth/personnel?callbackUrl=/admin")
  }

  if (!role || !ADMIN_ROLES.includes(role)) {
    redirect("/")
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <div className="flex-1 flex flex-col">
        <AdminHeader />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
