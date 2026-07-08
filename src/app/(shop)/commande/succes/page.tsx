"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { CircleCheck, ArrowRight } from "lucide-react"

function SuccessContent() {
  const searchParams = useSearchParams()
  const order = searchParams.get("order")

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ice-gradient text-primary">
        <CircleCheck className="h-8 w-8" />
      </div>
      <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight">
        Commande enregistrée !
      </h1>
      <p className="mt-3 leading-relaxed text-muted-foreground">
        {order ? (
          <>
            Référence <strong className="text-foreground">{order}</strong>.{" "}
          </>
        ) : null}
        Notre équipe vous contactera très rapidement pour confirmer la livraison et le paiement (espèces ou Mobile Money).
      </p>
      <Link
        href="/produits"
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 font-display text-sm font-bold text-primary-foreground shadow-frost transition-transform hover:scale-[1.03]"
      >
        Continuer mes achats
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

export default function CommandeSuccesPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ice-gradient text-primary">
          <CircleCheck className="h-8 w-8" />
        </div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}
