"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function InscriptionPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showEmailSent, setShowEmailSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Une erreur est survenue")
        setLoading(false)
        return
      }

      setShowEmailSent(true)
    } catch {
      setError("Erreur réseau. Veuillez réessayer.")
      setLoading(false)
    }
  }

  if (showEmailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0b1d3a] via-[#163a72] to-[#1f4fa3] px-4">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(31,79,163,0.25)_0%,transparent_60%)]" />
        <div className="relative w-full max-w-md">
          <div className="rounded-2xl bg-white/95 backdrop-blur-sm p-8 shadow-2xl shadow-black/20">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                <svg className="h-8 w-8 text-[#1f4fa3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-[#1f4fa3]">LCG Clients</h1>
              <h2 className="mt-3 text-lg font-semibold text-gray-800">Vérifiez votre email</h2>
              <p className="mt-2 text-sm text-gray-500">
                Un email de vérification a été envoyé à <strong>{email}</strong>.
                Veuillez cliquer sur le lien dans l&apos;email pour activer votre compte.
              </p>
              <p className="mt-3 text-xs text-gray-400">
                Vérifiez aussi votre dossier spam / indésirables.
              </p>

              <div className="mt-6 flex flex-col gap-3 w-full">
                <button
                  onClick={() => router.push("/auth/connexion")}
                  className="w-full rounded-lg bg-gradient-to-r from-[#1f4fa3] to-[#163a72] px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:from-[#183d80] hover:to-[#0f2d5c]"
                >
                  Se connecter
                </button>
                <Link href="/" className="text-sm font-semibold text-[#1f4fa3] hover:underline">
                  Retour à l&apos;accueil
                </Link>
              </div>
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-white/50">
            © {new Date().getFullYear()} La Congolaise des Glaçons — Tous droits réservés
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0b1d3a] via-[#163a72] to-[#1f4fa3] px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(31,79,163,0.25)_0%,transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(10,29,58,0.4)_0%,transparent_60%)]" />

      <div className="relative w-full max-w-md">
        <div className="rounded-2xl bg-white/95 backdrop-blur-sm p-8 shadow-2xl shadow-black/20">
          <div className="mb-8 flex flex-col items-center">
            <img
              src="/logo-lcg.jpeg"
              alt="LCG — La Congolaise des Glaçons"
              className="h-20 w-20 rounded-full object-cover ring-4 ring-[#1f4fa3]/20 shadow-lg"
            />
            <h1 className="mt-4 text-2xl font-bold text-[#1f4fa3]">
              LCG Clients
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Créez votre compte
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
                Nom complet
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-[#1f4fa3] focus:ring-2 focus:ring-[#1f4fa3]/30"
                placeholder="Jean Dupont"
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
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-[#1f4fa3] focus:ring-2 focus:ring-[#1f4fa3]/30"
                placeholder="vous@exemple.fr"
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
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-[#1f4fa3] focus:ring-2 focus:ring-[#1f4fa3]/30"
                placeholder="+242..."
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-[#1f4fa3] focus:ring-2 focus:ring-[#1f4fa3]/30"
                placeholder="Minimum 8 caractères"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-gradient-to-r from-[#1f4fa3] to-[#163a72] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#1f4fa3]/25 transition-all hover:from-[#183d80] hover:to-[#0f2d5c] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Création en cours...
                </span>
              ) : (
                "Créer mon compte"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Déjà un compte ?{" "}
            <Link href="/auth/connexion" className="font-semibold text-[#1f4fa3] hover:underline">
              Se connecter
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-white/50">
          © {new Date().getFullYear()} La Congolaise des Glaçons — Tous droits réservés
        </p>
      </div>
    </div>
  )
}
