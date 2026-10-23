"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Printer } from "lucide-react"
import Image from "next/image"

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

        {/* même modèle que les documents de l'administration (maquette du 2026-10-23) */}
        <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white text-gray-900 shadow-sm [print-color-adjust:exact] print:rounded-none print:border-0 print:shadow-none">
          <header className="rounded-b-[2.5rem] bg-primary px-5 pb-16 pt-6 text-white sm:px-10 sm:pt-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white p-1.5">
                  <Image src="/logo-lcg-transparent.png" alt="" width={64} height={62} className="h-full w-auto" />
                </span>
                <div>
                  <h1 className="text-xl font-extrabold uppercase leading-tight tracking-wide">{data.company.name}</h1>
                  <p className="text-xs uppercase tracking-widest text-white/75">Glaçons en eau minérale</p>
                </div>
              </div>
              <div className="text-sm text-white/90 sm:text-right">
                <p className="text-xs font-bold uppercase tracking-widest text-white">Contact</p>
                {data.company.address && <p className="mt-1">{data.company.address}</p>}
                {data.company.phones && <p>{data.company.phones}</p>}
                {data.company.contact && <p>{data.company.contact}</p>}
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-2xl font-extrabold uppercase tracking-wide sm:text-3xl">Devis</p>
                <p className="font-mono text-sm text-white/85">N° {data.document.reference}</p>
                <p className="mt-4 text-xs uppercase tracking-widest text-white/75">Devis établi pour</p>
                <p className="text-lg font-bold">{data.document.client.name}</p>
              </div>
              <div className="flex gap-6 text-sm sm:gap-8 sm:text-right">
                <div>
                  <p className="text-xs uppercase tracking-widest text-white/75">Date</p>
                  <p className="text-base font-bold">{formatDate(data.document.createdAt)}</p>
                </div>
                {data.document.validUntil && (
                  <div>
                    <p className="text-xs uppercase tracking-widest text-white/75">Valable jusqu&apos;au</p>
                    <p className="text-base font-bold">{formatDate(data.document.validUntil)}</p>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="px-4 pb-6 sm:px-10">
            <div className="relative -mt-10 overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-lg print:shadow-none">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-600">
                    <th className="w-14 px-3 py-4 text-center">N°</th>
                    <th className="px-3 py-4 text-left">Désignation</th>
                    <th className="px-3 py-4 text-right">Prix</th>
                    <th className="px-3 py-4 text-center">Qté</th>
                    <th className="px-4 py-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.document.items.map((item, index) => (
                    <tr key={index} className="border-b border-gray-100 last:border-0">
                      <td className="px-3 py-3 text-center text-gray-500">{index + 1}.</td>
                      <td className="px-3 py-3">{item.label}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">{formatPrice(item.unitPrice)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-center">{item.quantity}{item.unit ? ` ${item.unit}` : ""}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{formatPrice(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-[1fr_minmax(0,18rem)]">
              <div className="order-2 space-y-4 rounded-2xl border border-gray-200 p-4 text-sm text-gray-700 sm:order-1">
                {data.bank && (data.bank.accountNumber || data.bank.mtnMoney || data.bank.airtelMoney) && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-900">Mode de paiement</p>
                    <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                      {data.bank.accountNumber && <><dt className="text-gray-500">N° de compte</dt><dd className="font-mono font-semibold">{data.bank.accountNumber}</dd></>}
                      {data.bank.accountHolder && <><dt className="text-gray-500">Titulaire</dt><dd>{data.bank.accountHolder}</dd></>}
                      {data.bank.bankName && <><dt className="text-gray-500">Banque</dt><dd>{data.bank.bankName}</dd></>}
                      {data.bank.mtnMoney && <><dt className="text-gray-500">MTN Mobile Money</dt><dd className="font-semibold">{data.bank.mtnMoney}</dd></>}
                      {data.bank.airtelMoney && <><dt className="text-gray-500">Airtel Money</dt><dd className="font-semibold">{data.bank.airtelMoney}</dd></>}
                    </dl>
                    {data.bank.instructions && <p className="mt-1 text-gray-600">{data.bank.instructions}</p>}
                  </div>
                )}
                {(data.document.deliveryTerms || data.document.requestedDeliveryDate) && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-900">Livraison</p>
                    <p className="mt-1">
                      {data.document.requestedDeliveryDate && <span>Souhaitée le {formatDate(data.document.requestedDeliveryDate)}. </span>}
                      {data.document.deliveryTerms && <span>{data.document.deliveryTerms}</span>}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-900">Conditions</p>
                  <p className="mt-1 text-gray-600">Ce devis est sans engagement de vente. Validé par le client, il donne lieu à la facture.</p>
                </div>
              </div>
              <div className="order-1 text-sm sm:order-2">
                <p className="flex justify-between px-4 py-2 text-gray-700"><span>Sous-total</span><span>{formatPrice(data.document.subtotal)}</span></p>
                <p className="flex justify-between px-4 py-2 text-gray-700"><span>Remise</span><span>{data.document.discount > 0 ? `− ${formatPrice(data.document.discount)}` : formatPrice(0)}</span></p>
                <p className="mt-1 flex justify-between rounded-xl bg-primary px-4 py-3 text-base font-bold text-white"><span>Total</span><span>{formatPrice(data.document.total)}</span></p>
                <p className="mt-2 px-4 text-xs"><span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-700 print:hidden">{STATUS_LABEL[data.document.status] || data.document.status}</span></p>
              </div>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-8 text-center text-sm text-gray-700">
              <div>
                <div className="mt-12 border-t border-gray-400 pt-1.5">Bon pour accord du client</div>
                <p className="text-xs text-gray-500">Nom, signature et cachet</p>
              </div>
              <div>
                <div className="mt-12 border-t border-gray-400 pt-1.5">Signature autorisée — LCG</div>
                <p className="text-xs text-gray-500">Nom, signature et cachet</p>
              </div>
            </div>
          </div>

          <footer className="rounded-t-[2rem] bg-primary px-5 py-4 text-center text-white sm:px-10">
            <p className="text-sm font-semibold">Merci de votre confiance</p>
            {data.company.legal && <p className="mt-1 text-xs text-white/75">{data.company.legal}</p>}
          </footer>
        </article>
      </div>
    </main>
  )
}
