import { redirect } from "next/navigation"
import { AdminShell } from "@/components/shared/admin-shell"
import { AnnouncementBanner } from "@/components/shared/announcement-banner"
import { auth } from "@/lib/auth"
import { isStaffRole } from "@/lib/permissions"

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

  // Tout le personnel entre dans l'administration, profils créés par l'administrateur compris
  // (un compte CAISSIERE était renvoyé à l'accueil du site). Chaque écran vérifie ensuite ses droits.
  if (!isStaffRole(role)) {
    redirect("/")
  }

  return (
    <AdminShell>
      <AnnouncementBanner />
      {children}
    </AdminShell>
  )
}
