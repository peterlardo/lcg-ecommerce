"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function PersonnelLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError("Email ou mot de passe incorrect")
        setLoading(false)
        return
      }

      const callbackUrl = new URLSearchParams(window.location.search).get("callbackUrl")
      router.push(callbackUrl || "/admin")
      router.refresh()
    } catch {
      setError("Erreur de connexion. Veuillez réessayer.")
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-[#0a1d3a] via-[#1a2744] to-[#0f2d5c] p-4 sm:p-8">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(26,39,68,0.4)_0%,transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(10,29,58,0.5)_0%,transparent_60%)]" />

      <div className="relative flex h-full min-h-[calc(100vh-2rem)] w-full flex-col justify-center sm:min-h-[calc(100vh-4rem)]">
        <div className="flex flex-1 flex-col justify-center rounded-3xl bg-white/95 backdrop-blur-sm p-8 shadow-2xl shadow-black/20 sm:p-12 lg:p-16">
          <div className="mb-10 flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- Logo statique simple (fichier public), next/image non requis */}
            <img
              src="/logo-lcg.jpeg"
              alt="LCG — La Congolaise des Glaçons"
              className="h-28 w-28 rounded-full object-cover ring-4 ring-gray-800/20 shadow-lg sm:h-36 sm:w-36"
            />
            <h1 className="mt-5 text-4xl font-bold text-gray-800 sm:text-5xl">
              Staff LCG
            </h1>
            <p className="mt-2 text-lg text-gray-500 sm:text-xl">
              Espace staff & administration
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mx-auto w-full max-w-xl space-y-6">
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-base text-red-600">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-2 block text-base font-medium text-gray-700">
                Email professionnel
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full rounded-xl border border-gray-300 px-5 py-4 text-lg text-gray-900 outline-none transition-colors focus:border-gray-600 focus:ring-2 focus:ring-gray-600/30"
                placeholder="nom@lcg.cg"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-base font-medium text-gray-700">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-gray-300 px-5 py-4 text-lg text-gray-900 outline-none transition-colors focus:border-gray-600 focus:ring-2 focus:ring-gray-600/30"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-4 text-lg font-semibold text-white shadow-md shadow-gray-900/25 transition-all hover:from-gray-900 hover:to-black hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Connexion...
                </span>
              ) : (
                "Accéder au tableau de bord"
              )}
            </button>

            <div className="text-center">
              <Link
                href="/auth/forgot-password"
                className="text-base text-gray-500 underline underline-offset-4 transition-colors hover:text-gray-700"
              >
                Mot de passe oublié ?
              </Link>
            </div>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-white/40">
          © {new Date().getFullYear()} La Congolaise des Glaçons — Espace réservé au personnel
        </p>
      </div>
    </div>
  )
}
