"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function ConnexionPage() {
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

      router.push("/")
      router.refresh()
    } catch {
      setError("Erreur de connexion. Veuillez réessayer.")
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#1f4fa3] px-4">
      <img
        src="/logo-lcg.jpeg"
        alt=""
        className="pointer-events-none absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full object-cover opacity-40 blur-[50px] drop-shadow-[0_0_80px_rgba(255,255,255,0.3)]"
      />

      <div className="relative w-full max-w-md">
        <div className="rounded-2xl bg-white/95 backdrop-blur-sm p-8 shadow-2xl shadow-black/10">
          <div className="mb-8 flex flex-col items-center">
            <img
              src="/logo-lcg.jpeg"
              alt="LCG — La Congolaise des Glaçons"
              className="h-20 w-20 rounded-full object-cover ring-4 ring-[#1f4fa3]/15 shadow-lg"
            />
            <h1 className="mt-4 text-2xl font-bold text-[#1f4fa3]">
              LCG Clients
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Connectez-vous à votre espace
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

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
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-[#1f4fa3] focus:ring-2 focus:ring-[#1f4fa3]/30"
                placeholder="••••••••"
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
                  Connexion en cours...
                </span>
              ) : (
                "Se connecter"
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-gray-100 pt-4 text-center">
            <p className="text-xs text-gray-400">
              Pas encore de compte ?{" "}
              <Link href="/auth/inscription" className="font-semibold text-[#1f4fa3] hover:underline">
                Créer un compte
              </Link>
            </p>
            <p className="mt-2 text-xs text-gray-400">
              Personnel LCG ?{" "}
              <Link href="/auth/personnel" className="font-semibold text-gray-600 hover:underline">
                Connexion staff
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-white/40">
          © {new Date().getFullYear()} La Congolaise des Glaçons — Tous droits réservés
        </p>
      </div>
    </div>
  )
}
