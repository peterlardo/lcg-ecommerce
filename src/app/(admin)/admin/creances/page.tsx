import { redirect } from "next/navigation"

export default function CreancesPage() {
  redirect("/admin/ventes?tab=creances")
}
