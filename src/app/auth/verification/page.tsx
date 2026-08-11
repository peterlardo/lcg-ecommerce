"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"

function VerificationContent() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [errorMsg, setErrorMsg] = useState("")
  const [resendEmail, setResendEmail] = useState("")
  const [resendLoading, setResendLoading] = useState(false)
  const [resendSent, setResendSent] = useState(false)

  useEffect(() => {
    const success = searchParams.get("success")
    const error = searchParams.get("error")

    if (success === "1") {
      setStatus("success")
    } else if (error) {
      setStatus("error")
      const messages: Record<string, string> = {
        missing: "Lien de vérification invalide.",
        invalid: "Ce lien de vérification n'est pas valide.",
        expired: "Ce lien de vérification a expiré. Veuillez en demander un nouveau.",
        server: "Une erreur est survenue. Veuillez réessayer.",
      }
      setErrorMsg(messages[error] || "Une erreur est survenue.")
    } else {
      setStatus("loading")
    }
  }, [searchParams])

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault()
    setResendLoading(true)
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail }),
      })
      if (res.ok) {
        setResendSent(true)
      }
    } catch {
    } finally {
      setResendLoading(false)
    }
  }

  if (status === "loading") {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-[#1f4fa3]" />
        <p className="text-gray-500">Vérification en cours...</p>
      </div>
    )
  }

  if (status === "success") {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-[#1f4fa3]">Email vérifié !</h2>
        <p className="mt-2 text-sm text-gray-500">
          Votre compte LCG Clients est maintenant actif. Vous pouvez vous connecter.
        </p>
        <Link
          href="/auth/connexion"
          className="mt-6 inline-block rounded-lg bg-gradient-to-r from-[#1f4fa3] to-[#163a72] px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:from-[#183d80] hover:to-[#0f2d5c]"
        >
          Se connecter
        </Link>
      </div>
    )
  }

  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
        <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-red-600">Vérification échouée</h2>
      <p className="mt-2 text-sm text-gray-500">{errorMsg}</p>

      <div className="mt-8 rounded-lg bg-gray-50 p-6">
        <p className="mb-3 text-sm font-medium text-gray-700">Renvoyer un email de vérification</p>
        {resendSent ? (
          <p className="text-sm text-green-600">Email envoyé ! Vérifiez votre boîte de réception.</p>
        ) : (
          <form onSubmit={handleResend} className="flex flex-col gap-3">
            <input
              type="email"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              required
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-[#1f4fa3] focus:ring-2 focus:ring-[#1f4fa3]/30"
              placeholder="votre@email.com"
            />
            <button
              type="submit"
              disabled={resendLoading}
              className="rounded-lg bg-[#1f4fa3] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#183d80] disabled:opacity-50"
            >
              {resendLoading ? "Envoi..." : "Renvoyer l'email"}
            </button>
          </form>
        )}
      </div>

      <Link href="/auth/connexion" className="mt-6 inline-block text-sm font-semibold text-[#1f4fa3] hover:underline">
        Retour à la connexion
      </Link>
    </div>
  )
}

export default function VerificationPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0b1d3a] via-[#163a72] to-[#1f4fa3] px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(31,79,163,0.25)_0%,transparent_60%)]" />
      <div className="relative w-full max-w-md">
        <div className="rounded-2xl bg-white/95 backdrop-blur-sm p-8 shadow-2xl shadow-black/20">
          <div className="mb-6 flex flex-col items-center">
            <img
              src="/logo-lcg.jpeg"
              alt="LCG — La Congolaise des Glaçons"
              className="h-20 w-20 rounded-full object-cover ring-4 ring-[#1f4fa3]/20 shadow-lg"
            />
            <h1 className="mt-4 text-2xl font-bold text-[#1f4fa3]">LCG Clients</h1>
          </div>
          <Suspense fallback={<div className="text-center text-gray-500">Chargement...</div>}>
            <VerificationContent />
          </Suspense>
        </div>
        <p className="mt-4 text-center text-xs text-white/50">
          © {new Date().getFullYear()} La Congolaise des Glaçons — Tous droits réservés
        </p>
      </div>
    </div>
  )
}
