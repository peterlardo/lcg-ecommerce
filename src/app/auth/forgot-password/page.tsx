"use client"

import { useState } from "react"
import Link from "next/link"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setMessage("")
    setLoading(true)

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      setMessage(data.message || "Un lien de réinitialisation a été envoyé.")
    } catch {
      setError("Erreur de connexion. Veuillez réessayer.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0a1d3a] via-[#1a2744] to-[#0f2d5c] px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(26,39,68,0.4)_0%,transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(10,29,58,0.5)_0%,transparent_60%)]" />

      <div className="relative w-full max-w-md">
        <div className="rounded-2xl bg-white/95 backdrop-blur-sm p-8 shadow-2xl shadow-black/20">
          <div className="mb-8 flex flex-col items-center">
            <img
              src="/logo-lcg.jpeg"
              alt="LCG — La Congolaise des Glaçons"
              className="h-20 w-20 rounded-full object-cover ring-4 ring-gray-800/20 shadow-lg"
            />
            <h1 className="mt-4 text-2xl font-bold text-gray-800">
              Mot de passe oublié
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Entrez votre email pour recevoir un lien de réinitialisation
            </p>
          </div>

          {message ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                {message}
              </div>
              <Link
                href="/auth/personnel"
                className="block w-full rounded-lg bg-gradient-to-r from-gray-800 to-gray-900 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-md transition-all hover:from-gray-900 hover:to-black hover:shadow-lg"
              >
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
                  Email professionnel
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-gray-600 focus:ring-2 focus:ring-gray-600/30"
                  placeholder="nom@lcg.cg"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-gradient-to-r from-gray-800 to-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-gray-900/25 transition-all hover:from-gray-900 hover:to-black hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Envoi en cours...
                  </span>
                ) : (
                  "Envoyer le lien de réinitialisation"
                )}
              </button>

              <div className="text-center">
                <Link
                  href="/auth/personnel"
                  className="text-sm text-gray-500 underline underline-offset-4 transition-colors hover:text-gray-700"
                >
                  Retour à la connexion
                </Link>
              </div>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-white/40">
          © {new Date().getFullYear()} La Congolaise des Glaçons — Espace réservé au personnel
        </p>
      </div>
    </div>
  )
}
