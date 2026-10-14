"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useParams } from "next/navigation"
import { AlertCircle, ArrowLeft, Printer } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { STATUS_LABEL, TYPE_LABEL, type DocType } from "@/components/admin/b2b-documents-screen"
import { montantEnLettres } from "@/lib/montant-en-lettres"

// Document B2B imprimable (devis, bon de commande, bon de livraison, facture) — portage de b2b-document.php (lcgapp3).

interface DocumentItem {
  id: string
  quantity: number
  unitPrice: number
  lineTotal: number
  productVariant: { format: string; unit: string | null; product: { name: string } } | null
}

interface DocumentDetail {
  id: string
  type: DocType
  reference: string
  status: string
  subtotal: number
  discount: number
  total: number
  notes: string | null
  validUntil: string | null
  deliveryTerms: string | null
  requestedDeliveryDate: string | null
  createdAt: string
  cancelReason: string | null
  deliveredAt: string | null
  invoicedAt: string | null
  parent: { id: string; reference: string; type: DocType; deliveredAt: string | null; createdAt: string } | null
  children: { id: string; reference: string; type: DocType }[]
  client: {
    companyName: string | null
    tradeName: string | null
    contactName: string | null
    firstName: string | null
    lastName: string | null
    phone: string | null
    email: string | null
    address: string | null
    city: string | null
    taxId: string | null
  } | null
  items: DocumentItem[]
}

/** Facture : échéance et état du paiement, calculés par le serveur. */
interface InvoiceInfo {
  termsDays: number
  fromContract: boolean
  dueDate: string
  paid: number
  pending: number
  balance: number
  paymentStatus: "PAID" | "PARTIAL" | "UNPAID" | "CANCELLED"
  overdue: boolean
  payments: { id: string; amount: number; method: string; validationStatus: string; notes: string | null; createdAt: string }[]
}

const PAYMENT_STATUS: Record<InvoiceInfo["paymentStatus"], { label: string; className: string }> = {
  PAID: { label: "Payée", className: "bg-green-100 text-green-700" },
  PARTIAL: { label: "Partiellement payée", className: "bg-amber-100 text-amber-800" },
  UNPAID: { label: "Non payée", className: "bg-rose-100 text-rose-700" },
  CANCELLED: { label: "Annulée", className: "bg-gray-100 text-gray-500" },
}

const PAYMENT_METHOD: Record<string, string> = { CARD: "Carte", MOBILE_MONEY: "Mobile Money", CASH_ON_DELIVERY: "Espèces" }

/** Libellés propres à chaque type de document. */
const DOC_TEXT: Record<DocType, { number: string; client: string; arrete: string; conditions: string }> = {
  DEVIS: {
    number: "N° Devis",
    client: "Devis établi pour",
    arrete: "Arrêté le présent devis",
    conditions: "Ce devis est sans engagement de vente. Il est confirmé par sa transformation en bon de commande.",
  },
  COMMANDE: {
    number: "N° Commande",
    client: "Commande de",
    arrete: "Arrêté le présent bon de commande",
    conditions: "Le bon de commande doit être confirmé par LCG pour engager la production et la livraison. Tout retard ou annulation doit être notifié par écrit.",
  },
  LIVRAISON: {
    number: "N° Bon de livraison",
    client: "Livré à",
    arrete: "Arrêté le présent bon de livraison",
    conditions: "Le présent bon matérialise la remise des marchandises. Les quantités livrées font foi ; toute différence à la réception doit être signalée sous 48 heures.",
  },
  FACTURE: {
    number: "N° Facture",
    client: "Facturé à",
    arrete: "Arrêtée la présente facture",
    conditions: "Les montants sont exprimés en francs CFA et sont dus à l'échéance indiquée, sauf conditions différentes prévues au contrat.",
  },
}

const COMPANY = {
  name: "LCG — La Congolaise des Glaçons",
  address: "97 Rue EWO, Ouenzé — Brazzaville, République du Congo",
  phones: "+242 06 739 49 49 · +242 05 607 91 91",
  contact: "www.lcg.cg · contact@lcg.cg",
  legal: "SARL au capital de 1 000 000 FCFA — RCCM : CG-BZV-01-2025-B12-00-146 — NIU : M250000007225623",
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
}

export default function B2bDocumentPage() {
  const { id } = useParams<{ id: string }>()
  const [doc, setDoc] = useState<DocumentDetail | null>(null)
  const [invoice, setInvoice] = useState<InvoiceInfo | null>(null)
  const [people, setPeople] = useState<{ createdBy: string | null; commercial: string | null }>({ createdBy: null, commercial: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    const init = async () => {
      try {
        const res = await fetch(`/api/b2b-documents/${id}`, { signal: controller.signal })
        const data = await res.json().catch(() => null)
        if (controller.signal.aborted) return
        if (!res.ok || !data?.document) {
          setError(res.status === 404 ? "Document introuvable." : res.status === 403 ? "Ce document ne fait pas partie de vos clients." : data?.error || "Chargement impossible")
          return
        }
        setDoc(data.document)
        setInvoice(data.invoice ?? null)
        setPeople({ createdBy: data.createdByName ?? null, commercial: data.commercialName ?? null })
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) setError("Connexion au serveur impossible")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void init()
    return () => controller.abort()
  }, [id])

  const back = doc?.type === "DEVIS" ? "/admin/devis-b2b" : "/admin/bons-b2b"
  const clientName = doc?.client ? doc.client.companyName || doc.client.tradeName || doc.client.contactName || `${doc.client.firstName ?? ""} ${doc.client.lastName ?? ""}`.trim() || "Client" : "Client"

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={back} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          <ArrowLeft className="h-4 w-4" /> Retour à la liste
        </Link>
        {doc && (
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            <Printer className="h-4 w-4" /> Imprimer
          </button>
        )}
      </div>

      {loading && <p className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500 print:hidden">Chargement...</p>}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 print:hidden">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {doc && (
        <article className="mx-auto max-w-4xl rounded-xl border border-gray-200 bg-white p-5 text-gray-900 sm:p-8 print:max-w-none print:rounded-none print:border-0 print:p-0">
          <header className="flex flex-col gap-4 border-b-2 border-primary pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <Image src="/logo-lcg-transparent.png" alt="" width={64} height={62} className="h-14 w-auto" />
              <div>
                <p className="text-lg font-bold text-primary">{COMPANY.name}</p>
                <p className="text-sm text-gray-600">{COMPANY.address}</p>
                <p className="text-sm text-gray-600">{COMPANY.phones}</p>
                <p className="text-sm text-gray-600">{COMPANY.contact}</p>
              </div>
            </div>
            <div className="sm:text-right">
              <p className="text-2xl font-bold uppercase tracking-wide text-gray-900">{TYPE_LABEL[doc.type].one}</p>
              <table className="mt-1 text-sm sm:ml-auto">
                <tbody>
                  <tr><td className="pr-3 text-gray-600">{DOC_TEXT[doc.type].number} :</td><td className="font-mono font-semibold">{doc.reference}</td></tr>
                  <tr><td className="pr-3 text-gray-600">Date :</td><td className="font-semibold">{formatDate(doc.invoicedAt ?? doc.createdAt)}</td></tr>
                  {invoice && <tr><td className="pr-3 text-gray-600">Échéance :</td><td className={`font-semibold ${invoice.overdue ? "text-red-700" : ""}`}>{formatDate(invoice.dueDate)}</td></tr>}
                  {doc.type === "DEVIS" && doc.validUntil && <tr><td className="pr-3 text-gray-600">Valable jusqu&apos;au :</td><td className="font-semibold">{formatDate(doc.validUntil)}</td></tr>}
                  {doc.type === "COMMANDE" && doc.requestedDeliveryDate && <tr><td className="pr-3 text-gray-600">Livraison souhaitée :</td><td className="font-semibold">{formatDate(doc.requestedDeliveryDate)}</td></tr>}
                  {doc.type === "LIVRAISON" && doc.deliveredAt && <tr><td className="pr-3 text-gray-600">Livré le :</td><td className="font-semibold">{formatDate(doc.deliveredAt)}</td></tr>}
                  {doc.parent && <tr><td className="pr-3 text-gray-600">Réf. d&apos;origine :</td><td className="font-mono font-semibold">{doc.parent.reference}</td></tr>}
                </tbody>
              </table>
              <p className="mt-2">
                {invoice ? (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PAYMENT_STATUS[invoice.paymentStatus].className}`}>
                    {PAYMENT_STATUS[invoice.paymentStatus].label}{invoice.overdue ? " — en retard" : ""}
                  </span>
                ) : (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold print:hidden ${STATUS_LABEL[doc.status]?.className ?? "bg-gray-100 text-gray-700"}`}>{STATUS_LABEL[doc.status]?.label ?? doc.status}</span>
                )}
              </p>
            </div>
          </header>

          <section className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{DOC_TEXT[doc.type].client}</p>
              <p className="mt-1 text-base font-bold">{clientName}</p>
              {doc.client?.contactName && doc.client.contactName !== clientName && <p className="text-sm text-gray-700">À l&apos;attention de {doc.client.contactName}</p>}
              {(doc.client?.address || doc.client?.city) && <p className="text-sm text-gray-700">{[doc.client.address, doc.client.city].filter(Boolean).join(", ")}</p>}
              {doc.client?.phone && <p className="text-sm text-gray-700">{doc.client.phone}</p>}
              {doc.client?.email && <p className="text-sm text-gray-700">{doc.client.email}</p>}
              {doc.client?.taxId && <p className="text-sm text-gray-700">NIU : {doc.client.taxId}</p>}
            </div>
            <div className="rounded-lg border border-gray-200 p-3 text-sm text-gray-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Informations</p>
              {doc.parent && <p className="mt-1">Établi à partir de : {TYPE_LABEL[doc.parent.type].one.toLowerCase()} <span className="font-mono">{doc.parent.reference}</span></p>}
              {doc.type === "FACTURE" && doc.parent?.type === "LIVRAISON" && <p className="mt-1">Marchandises livrées le {formatDate(doc.parent.deliveredAt ?? doc.parent.createdAt)}</p>}
              {invoice && <p className="mt-1">Paiement à {invoice.termsDays} jour{invoice.termsDays > 1 ? "s" : ""}{invoice.fromContract ? " (contrat)" : ""}, au plus tard le {formatDate(invoice.dueDate)}</p>}
              {people.createdBy && <p className="mt-1">Établi par : {people.createdBy}</p>}
              {people.commercial && <p className="mt-1">Commercial : {people.commercial}</p>}
              {doc.children.map((child) => (
                <p key={child.id} className="mt-1">Suivi par : {TYPE_LABEL[child.type].one.toLowerCase()} <span className="font-mono">{child.reference}</span></p>
              ))}
              {doc.type === "DEVIS" && doc.validUntil && <p className="mt-1">Valable jusqu&apos;au {formatDate(doc.validUntil)}</p>}
              {doc.requestedDeliveryDate && doc.type === "LIVRAISON" && <p className="mt-1">Livraison souhaitée le {formatDate(doc.requestedDeliveryDate)}</p>}
              {!doc.parent && doc.children.length === 0 && !(doc.type === "DEVIS" && doc.validUntil) && !doc.requestedDeliveryDate && !invoice && !people.createdBy && !people.commercial && <p className="mt-1 text-gray-500">—</p>}
            </div>
          </section>

          {doc.status === "CANCELLED" && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              Document annulé{doc.cancelReason ? ` : ${doc.cancelReason}` : ""}
            </p>
          )}

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="bg-primary text-white">
                  <th className="px-3 py-2 font-semibold">Désignation</th>
                  <th className="px-3 py-2 text-right font-semibold">Quantité</th>
                  {doc.type !== "LIVRAISON" && <th className="px-3 py-2 text-right font-semibold">Prix unitaire</th>}
                  {doc.type !== "LIVRAISON" && <th className="px-3 py-2 text-right font-semibold">Montant</th>}
                </tr>
              </thead>
              <tbody>
                {doc.items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-200">
                    <td className="px-3 py-2">{item.productVariant ? `${item.productVariant.product.name} — ${item.productVariant.format}` : "Article retiré du catalogue"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">{item.quantity}{item.productVariant?.unit ? ` ${item.productVariant.unit}` : ""}</td>
                    {doc.type !== "LIVRAISON" && <td className="whitespace-nowrap px-3 py-2 text-right">{formatPrice(item.unitPrice)}</td>}
                    {doc.type !== "LIVRAISON" && <td className="whitespace-nowrap px-3 py-2 text-right font-medium">{formatPrice(item.lineTotal)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {doc.type !== "LIVRAISON" && (
            <div className="mt-4 ml-auto w-full max-w-xs text-sm">
              <p className="flex justify-between py-1 text-gray-700"><span>Sous-total</span><span>{formatPrice(doc.subtotal)}</span></p>
              {doc.discount > 0 && <p className="flex justify-between py-1 text-gray-700"><span>Remise</span><span>− {formatPrice(doc.discount)}</span></p>}
              <p className="flex justify-between border-t-2 border-gray-900 py-2 text-lg font-bold"><span>{doc.type === "FACTURE" ? "Total à payer" : "Total"}</span><span>{formatPrice(doc.total)}</span></p>
              {invoice && invoice.paid > 0 && <p className="flex justify-between py-1 text-gray-700"><span>Déjà payé</span><span>− {formatPrice(invoice.paid)}</span></p>}
              {invoice && invoice.paid > 0 && <p className="flex justify-between py-1 font-bold"><span>Reste à payer</span><span>{formatPrice(invoice.balance)}</span></p>}
              {invoice && invoice.pending > 0 && <p className="py-1 text-xs text-gray-500">Règlement de {formatPrice(invoice.pending)} reçu, en attente de validation.</p>}
            </div>
          )}

          {doc.type !== "LIVRAISON" && (
            <p className="mt-4 text-sm italic text-gray-700">
              {DOC_TEXT[doc.type].arrete} à la somme de : <span className="font-semibold not-italic text-gray-900">{montantEnLettres(doc.total)}</span>.
            </p>
          )}

          {invoice && invoice.payments.length > 0 && (
            <div className="mt-4 rounded-lg border border-gray-200 p-3 text-sm text-gray-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Règlements reçus</p>
              <table className="mt-1 w-full text-left">
                <tbody>
                  {invoice.payments.map((p) => (
                    <tr key={p.id} className="border-b border-gray-100 last:border-0">
                      <td className="py-1 pr-2">{formatDate(p.createdAt)}</td>
                      <td className="py-1 pr-2">{PAYMENT_METHOD[p.method] ?? p.method}</td>
                      <td className="py-1 pr-2 text-gray-500">{p.validationStatus === "VALIDATED" ? "validé" : p.validationStatus === "PENDING" ? "en attente de validation" : "refusé"}</td>
                      <td className="whitespace-nowrap py-1 text-right font-medium">{formatPrice(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {doc.deliveryTerms && doc.type !== "FACTURE" && (
            <div className="mt-4 rounded-lg border border-gray-200 p-3 text-sm text-gray-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Livraison</p>
              <p className="mt-1 whitespace-pre-line">{doc.deliveryTerms}</p>
            </div>
          )}

          {doc.notes && (
            <div className="mt-4 rounded-lg border border-gray-200 p-3 text-sm text-gray-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Remarques</p>
              <p className="mt-1 whitespace-pre-line">{doc.notes}</p>
            </div>
          )}

          <p className="mt-4 text-xs text-gray-500">{DOC_TEXT[doc.type].conditions}</p>

          {/* la facture n'est signée que par LCG ; les autres documents le sont aussi par le client */}
          <div className={`mt-10 grid gap-8 text-sm text-gray-700 ${doc.type === "FACTURE" ? "grid-cols-1 sm:ml-auto sm:w-1/2" : "grid-cols-2"}`}>
            <div>
              <p className="font-semibold">Pour LCG — La Direction</p>
              <div className="mt-12 border-t border-gray-400 pt-1 text-xs text-gray-500">Nom, signature et cachet</div>
            </div>
            {doc.type !== "FACTURE" && (
              <div>
                <p className="font-semibold">{doc.type === "LIVRAISON" ? "Reçu par le client" : "Pour le client"}</p>
                <div className="mt-12 border-t border-gray-400 pt-1 text-xs text-gray-500">Nom, signature et cachet</div>
              </div>
            )}
          </div>

          <footer className="mt-8 border-t border-gray-200 pt-3 text-center text-xs text-gray-500">{COMPANY.legal}</footer>
        </article>
      )}
    </div>
  )
}
