"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"

export default function ParametresPage() {
  const { data: session, status, update } = useSession()

  const [name, setName] = useState(session?.user?.name || "")
  const [email, setEmail] = useState(session?.user?.email || "")
  const [phone, setPhone] = useState((session?.user as { phone?: string })?.phone || "")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  if (status === "unauthenticated") {
    redirect("/auth/connexion")
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const handleInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage("")
    setError("")

    try {
      const res = await fetch("/api/my-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || "Erreur lors de la mise à jour")
      }

      await update()
      setMessage("Informations mises à jour avec succès")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue")
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage("")
    setError("")

    try {
      const res = await fetch("/api/my-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || "Erreur lors du changement de mot de passe")
      }

      setMessage("Mot de passe mis à jour avec succès")
      setCurrentPassword("")
      setNewPassword("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 lg:p-10 max-w-2xl">
      <h1 className="font-display text-2xl font-extrabold tracking-tight lg:text-3xl">
        Paramètres du compte
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Gérez vos informations personnelles et votre sécurité.
      </p>

      {message && (
        <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {message}
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="mt-8 rounded-2xl border border-border bg-white p-6 shadow-sm">
        <h2 className="mb-6 font-display text-lg font-bold">
          Informations personnelles
        </h2>
        <form onSubmit={handleInfoSubmit} className="space-y-5">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-semibold text-gray-700">
              Nom complet
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition-shadow focus:border-[#1f4fa3] focus:ring-2 focus:ring-[#1f4fa3]/20"
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-semibold text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition-shadow focus:border-[#1f4fa3] focus:ring-2 focus:ring-[#1f4fa3]/20"
            />
          </div>

          <div>
            <label htmlFor="phone" className="mb-1 block text-sm font-semibold text-gray-700">
              Téléphone
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition-shadow focus:border-[#1f4fa3] focus:ring-2 focus:ring-[#1f4fa3]/20"
              placeholder="+242 ..."
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-[#1f4fa3] px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-[#1f4fa3]/25 transition-transform hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </form>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-white p-6 shadow-sm">
        <h2 className="mb-6 font-display text-lg font-bold">
          Changer le mot de passe
        </h2>
        <form onSubmit={handlePasswordSubmit} className="space-y-5">
          <div>
            <label htmlFor="currentPassword" className="mb-1 block text-sm font-semibold text-gray-700">
              Mot de passe actuel
            </label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition-shadow focus:border-[#1f4fa3] focus:ring-2 focus:ring-[#1f4fa3]/20"
            />
          </div>

          <div>
            <label htmlFor="newPassword" className="mb-1 block text-sm font-semibold text-gray-700">
              Nouveau mot de passe
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition-shadow focus:border-[#1f4fa3] focus:ring-2 focus:ring-[#1f4fa3]/20"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-[#1f4fa3] px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-[#1f4fa3]/25 transition-transform hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Enregistrement..." : "Mettre à jour le mot de passe"}
          </button>
        </form>
      </div>
    </div>
  )
}
