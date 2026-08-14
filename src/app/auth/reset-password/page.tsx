"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Suspense } from "react"

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setMessage("")

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas")
      return
    }

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères")
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Erreur lors de la réinitialisation")
      } else {
        setMessage(data.message || "Mot de passe réinitialisé avec succès")
      }
    } catch {
      setError("Erreur de connexion. Veuillez réessayer.")
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0a1d3a] via-[#1a2744] to-[#0f2d5c] px-4">
        <div className="relative w-full max-w-md">
          <div className="rounded-2xl bg-white/95 backdrop-blur-sm p-8 shadow-2xl shadow-black/20 text-center">
            <h1 className="text-xl font-bold text-gray-800 mb-4">Lien invalide</h1>
            <p className="text-sm text-gray-500 mb-6">Ce lien de réinitialisation est invalide ou manquant.</p>
            <Link href="/auth/personnel" className="rounded-lg bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:from-gray-900 hover:to-black">
              Retour à la connexion
            </Link>
          </div>
        </div>
      </div>
    )
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
              Nouveau mot de passe
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Choisissez un nouveau mot de passe pour votre compte
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
                Se connecter
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
                <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
                  Nouveau mot de passe
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-gray-600 focus:ring-2 focus:ring-gray-600/30"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-gray-700">
                  Confirmer le mot de passe
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-gray-600 focus:ring-2 focus:ring-gray-600/30"
                  placeholder="••••••••"
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
                    Réinitialisation...
                  </span>
                ) : (
                  "Réinitialiser le mot de passe"
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#0a1d3a] text-white">Chargement...</div>}>
      <ResetPasswordForm />
    </Suspense>
  )
}
