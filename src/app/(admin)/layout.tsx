import { redirect } from "next/navigation"
import { AdminShell } from "@/components/shared/admin-shell"
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

  return <AdminShell>{children}</AdminShell>
}
