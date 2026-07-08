"use client"

import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import { LogOut, User, Bell } from "lucide-react"

export function AdminHeader() {
  const { data: session } = useSession()

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div>
        <h2 className="text-sm text-gray-500">
          <Link href="/" className="hover:text-primary-600 transition-colors">
            Voir le site
          </Link>
        </h2>
      </div>
      <div className="flex items-center gap-4">
        <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <Bell className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-7 h-7 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-semibold text-xs">
            {session?.user?.name?.charAt(0) || "U"}
          </div>
          <span className="hidden sm:inline text-gray-700">{session?.user?.name}</span>
        </div>
        <button
          onClick={() => signOut()}
          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="Déconnexion"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
