"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Printer } from "lucide-react"

type PublicItem = { label: string; unit: string | null; quantity: number; unitPrice: number; lineTotal: number }
type PublicDevis = {
  reference: string
  type: string
  status: string
  createdAt: string
  validUntil: string | null
  deliveryTerms: string | null
  requestedDeliveryDate: string | null
  subtotal: number
  discount: number
  total: number
  client: { name: string }
  items: PublicItem[]
}
type Company = { name: string; address: string; phones: string; contact: string; legal: string }
type Bank = { bankName: string; accountHolder: string; accountNumber: string; mtnMoney: string; airtelMoney: string; instructions: string }

const formatPrice = (value: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(value || 0)) + " FCFA"
const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "")

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Brouillon",
  SENT: "Envoyé",
  RECEIVED: "Reçu",
  CONFIRMED: "Confirmé",
  INVOICED: "Facturé",
  CANCELLED: "Annulé",
}

export default function PublicDevisPage() {
  const { reference, token } = useParams<{ reference: string; token: string }>()
  // reference et token viennent de l'URL : le serveur revalide le jeton, rien n'est fait confiance au client.
  const [data, setData] = useState<{ document: PublicDevis; company: Company; bank: Bank } | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    const init = async () => {
      try {
        const response = await fetch(`/api/b2b/public/devis/${reference}/${token}`, { signal: controller.signal })
        const body = await response.json().catch(() => null)
        if (!response.ok) {
          setError(body?.error || "Ce devis est introuvable ou le lien n'est plus valide.")
          return
        }
        setData(body)
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError("Connexion au serveur impossible.")
      } finally {
        setLoading(false)
      }
    }
    void init()
    return () => controller.abort()
  }, [reference, token])

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-500">Chargement du devis…</main>
  }

  if (error || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900">Devis indisponible</h1>
          <p className="mt-2 text-sm text-gray-500">{error || "Ce devis est introuvable."}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-100 py-6 print:bg-white print:py-0">
      <div className="mx-auto max-w-3xl px-4 print:max-w-none print:px-0">
        <div className="mb-3 flex justify-end print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Printer className="h-4 w-4" /> Imprimer / Enregistrer en PDF
          </button>
        </div>

        <article className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 pb-5">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{data.company.name}</h1>
              {data.company.address && <p className="mt-1 max-w-xs text-sm text-gray-600">{data.company.address}</p>}
              {data.company.phones && <p className="text-sm text-gray-600">Tél. {data.company.phones}</p>}
              {data.company.contact && <p className="text-sm text-gray-600">{data.company.contact}</p>}
              {data.company.legal && <p className="mt-1 text-xs text-gray-500">{data.company.legal}</p>}
            </div>
            <div className="text-right">
              <p className="text-lg font-bold uppercase tracking-wide text-primary">Devis</p>
              <p className="text-sm font-semibold text-gray-900">N° {data.document.reference}</p>
              <p className="mt-1 text-sm text-gray-600">Établi le {formatDate(data.document.createdAt)}</p>
              {data.document.validUntil && <p className="text-sm text-gray-600">Valable jusqu&apos;au {formatDate(data.document.validUntil)}</p>}
              <span className="mt-2 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">{STATUS_LABEL[data.document.status] || data.document.status}</span>
            </div>
          </header>

          <section className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Client</p>
            <p className="mt-1 font-semibold text-gray-900">{data.document.client.name}</p>
          </section>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="bg-primary text-white">
                  <th className="px-3 py-2 font-semibold">Désignation</th>
                  <th className="px-3 py-2 text-right font-semibold">Quantité</th>
                  <th className="px-3 py-2 text-right font-semibold">Prix unitaire</th>
                  <th className="px-3 py-2 text-right font-semibold">Montant</th>
                </tr>
              </thead>
              <tbody>
                {data.document.items.map((item, index) => (
                  <tr key={index} className="border-b border-gray-200">
                    <td className="px-3 py-2">{item.label}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">{item.quantity}{item.unit ? ` ${item.unit}` : ""}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">{formatPrice(item.unitPrice)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-medium">{formatPrice(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 ml-auto w-full max-w-xs">
            <p className="flex justify-between py-1 text-sm text-gray-700"><span>Sous-total</span><span>{formatPrice(data.document.subtotal)}</span></p>
            {data.document.discount > 0 && (
              <p className="flex justify-between py-1 text-sm text-gray-700"><span>Remise</span><span>− {formatPrice(data.document.discount)}</span></p>
            )}
            <p className="mt-1 flex justify-between border-t border-gray-300 py-2 text-base font-bold text-gray-900"><span>Total</span><span>{formatPrice(data.document.total)}</span></p>
          </div>

          {(data.document.deliveryTerms || data.document.requestedDeliveryDate) && (
            <p className="mt-4 text-sm text-gray-700">
              {data.document.requestedDeliveryDate && <span>Livraison souhaitée le {formatDate(data.document.requestedDeliveryDate)}. </span>}
              {data.document.deliveryTerms && <span>{data.document.deliveryTerms}</span>}
            </p>
          )}

          {data.bank && (data.bank.accountNumber || data.bank.mtnMoney || data.bank.airtelMoney) && (
            <section className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Modalités de règlement</p>
              <div className="mt-1 space-y-0.5 text-sm text-gray-700">
                {data.bank.bankName && <p>{data.bank.bankName}{data.bank.accountHolder ? ` — ${data.bank.accountHolder}` : ""}</p>}
                {data.bank.accountNumber && <p>Compte : {data.bank.accountNumber}</p>}
                {data.bank.mtnMoney && <p>MTN Mobile Money : {data.bank.mtnMoney}</p>}
                {data.bank.airtelMoney && <p>Airtel Money : {data.bank.airtelMoney}</p>}
                {data.bank.instructions && <p className="text-gray-600">{data.bank.instructions}</p>}
              </div>
            </section>
          )}

          <footer className="mt-6 border-t border-gray-200 pt-4 text-xs text-gray-500">
            Devis consultable en ligne. Pour toute question, contactez {data.company.name}{data.company.phones ? ` au ${data.company.phones}` : ""}.
          </footer>
        </article>
      </div>
    </main>
  )
}
