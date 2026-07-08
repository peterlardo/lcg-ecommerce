"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"

export default function ParametresPage() {
  const { data: session, status } = useSession()

  const [name, setName] = useState(session?.user?.name || "")
  const [email, setEmail] = useState(session?.user?.email || "")
  const [phone, setPhone] = useState((session?.user as { phone?: string })?.phone || "")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  if (status === "unauthenticated") {
    redirect("/auth/connexion")
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Chargement...</p>
      </div>
    )
  }

  const handleInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage("")

    console.log("Saving info:", { name, email, phone })

    setTimeout(() => {
      setMessage("Informations mises à jour avec succès")
      setSaving(false)
    }, 500)
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage("")

    console.log("Changing password:", { currentPassword, newPassword })

    setTimeout(() => {
      setMessage("Mot de passe mis à jour avec succès")
      setSaving(false)
      setCurrentPassword("")
      setNewPassword("")
    }, 500)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-8 text-3xl font-bold text-gray-900">Paramètres du compte</h1>

      {message && (
        <div className="mb-6 rounded-lg bg-green-50 p-3 text-sm text-green-600">
          {message}
        </div>
      )}

      <div className="mb-8 rounded-xl bg-white p-6 shadow-md">
        <h2 className="mb-6 text-lg font-semibold text-gray-900">Informations personnelles</h2>
        <form onSubmit={handleInfoSubmit} className="space-y-5">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
              Nom complet
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition-colors focus:border-[#1f4fa3] focus:ring-1 focus:ring-[#1f4fa3]"
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition-colors focus:border-[#1f4fa3] focus:ring-1 focus:ring-[#1f4fa3]"
            />
          </div>

          <div>
            <label htmlFor="phone" className="mb-1 block text-sm font-medium text-gray-700">
              Téléphone
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition-colors focus:border-[#1f4fa3] focus:ring-1 focus:ring-[#1f4fa3]"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[#1f4fa3] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#183d80] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </form>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-md">
        <h2 className="mb-6 text-lg font-semibold text-gray-900">Changer le mot de passe</h2>
        <form onSubmit={handlePasswordSubmit} className="space-y-5">
          <div>
            <label htmlFor="currentPassword" className="mb-1 block text-sm font-medium text-gray-700">
              Mot de passe actuel
            </label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition-colors focus:border-[#1f4fa3] focus:ring-1 focus:ring-[#1f4fa3]"
            />
          </div>

          <div>
            <label htmlFor="newPassword" className="mb-1 block text-sm font-medium text-gray-700">
              Nouveau mot de passe
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition-colors focus:border-[#1f4fa3] focus:ring-1 focus:ring-[#1f4fa3]"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[#1f4fa3] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#183d80] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Enregistrement..." : "Mettre à jour le mot de passe"}
          </button>
        </form>
      </div>
    </div>
  )
}
