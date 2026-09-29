"use client"

import { useState } from "react"
import Image from "next/image"
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
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-[linear-gradient(170deg,#1F4FA3_0%,#17418A_55%,#123B82_100%)] px-4 py-10 sm:px-6">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(60% 45% at 50% 0%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 70%)",
        }}
      />

      <div className="relative w-full max-w-3xl">
        <div className="flex flex-col items-center text-center">
          <div className="rounded-full bg-white p-4 shadow-xl shadow-[#0b2c63]/35 ring-1 ring-white/60 sm:p-5">
            <Image
              src="/logo-lcg-transparent.png"
              alt="LCG — La Congolaise des Glaçons"
              width={104}
              height={101}
              priority
              className="h-20 w-auto object-contain sm:h-24"
            />
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Gestion des Ventes
          </h1>
          <p className="mt-2 text-base text-white/70 sm:text-lg">Espace staff &amp; administration</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-10 space-y-5">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200/40 bg-red-500/15 px-4 py-3 text-base text-red-50"
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-semibold text-white/80">
              Email professionnel
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="nom@lcg.cg"
              className="w-full rounded-xl border border-transparent bg-white px-5 py-3.5 text-base text-gray-900 shadow-lg shadow-[#0b2c63]/25 outline-none transition placeholder:text-gray-400 focus:ring-4 focus:ring-white/40"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-semibold text-white/80">
              Mot de passe
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full rounded-xl border border-transparent bg-white px-5 py-3.5 text-base text-gray-900 shadow-lg shadow-[#0b2c63]/25 outline-none transition placeholder:text-gray-400 focus:ring-4 focus:ring-white/40"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl border border-white/35 bg-white/15 px-6 py-3.5 text-base font-bold text-white backdrop-blur-sm transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <svg
                  className="h-5 w-5 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle className="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-90"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Connexion…
              </span>
            ) : (
              "Accéder au tableau de bord"
            )}
          </button>

          <div className="text-center">
            <Link
              href="/auth/forgot-password"
              className="text-sm font-medium text-white/70 underline underline-offset-4 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            >
              Mot de passe oublié ?
            </Link>
          </div>
        </form>

        <p className="mt-10 text-center text-xs text-white/45">
          © {new Date().getFullYear()} La Congolaise des Glaçons — Espace réservé au personnel
        </p>
      </div>
    </div>
  )
}
