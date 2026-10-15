"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { AlertCircle, ArrowLeft, ArrowRight, Check, HandCoins, Mail, Printer, ReceiptText, X } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { canCreateNext, STATUS_LABEL, TYPE_LABEL, type DocType } from "@/components/admin/b2b-documents-screen"
import { montantEnLettres } from "@/lib/montant-en-lettres"
import { RECEIPT_METHOD_LABEL } from "@/lib/payment-methods"

// Document B2B imprimable (devis, bon de commande, bon de livraison, facture, avoir) — portage de b2b-document.php (lcgapp3).

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
  emailedAt: string | null
  emailedTo: string | null
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
  credited: number
  paid: number
  pending: number
  balance: number
  creditable: number
  paymentStatus: "PAID" | "PARTIAL" | "UNPAID" | "CANCELLED"
  overdue: boolean
  credits: { id: string; reference: string; total: number; reason: string | null; createdAt: string }[]
  payments: { id: string; amount: number; method: string; reference: string | null; validationStatus: string; rejectReason: string | null; notes: string | null; receivedBy: string | null; createdAt: string }[]
}

interface Company { name: string; address: string; phones: string; contact: string; legal: string }
interface Bank { bankName: string; accountHolder: string; accountNumber: string; mtnMoney: string; airtelMoney: string; instructions: string }

const PAYMENT_STATUS: Record<InvoiceInfo["paymentStatus"], { label: string; className: string }> = {
  PAID: { label: "Payée", className: "bg-green-100 text-green-700" },
  PARTIAL: { label: "Partiellement payée", className: "bg-amber-100 text-amber-800" },
  UNPAID: { label: "Non payée", className: "bg-rose-100 text-rose-700" },
  CANCELLED: { label: "Annulée", className: "bg-gray-100 text-gray-500" },
}

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
  AVOIR: {
    number: "N° Avoir",
    client: "Avoir en faveur de",
    arrete: "Arrêté le présent avoir",
    conditions: "Le présent avoir vient en déduction de la facture indiquée. Il n'est pas remboursable en espèces, sauf accord écrit de LCG.",
  },
}

/** En-tête par défaut, le temps que les Paramètres arrivent du serveur. */
const DEFAULT_COMPANY: Company = {
  name: "LCG — La Congolaise des Glaçons",
  address: "97 Rue EWO, Ouenzé — Brazzaville, République du Congo",
  phones: "+242 06 739 49 49 · +242 05 607 91 91",
  contact: "lcg.cg · contact@lcg.cg",
  legal: "SARL au capital de 1 000 000 FCFA — RCCM : CG-BZV-01-2025-B12-00-146 — NIU : M250000007225623",
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
}

const fieldClass = "mt-1 w-full min-h-11 rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"

/** Avertissement avant l'étape suivante (ce qui devient irréversible). */
const NEXT_WARNING: Partial<Record<DocType, string>> = {
  COMMANDE: "La facture sera émise et ne pourra plus être modifiée (un avoir permet de la corriger).",
  FACTURE: "Les quantités sortiront du stock du comptoir.",
  LIVRAISON: "La facture sera émise et ne pourra plus être modifiée (un avoir permet de la corriger).",
}

export default function B2bDocumentPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: session } = useSession()
  const [moving, setMoving] = useState(false)
  const [doc, setDoc] = useState<DocumentDetail | null>(null)
  const [invoice, setInvoice] = useState<InvoiceInfo | null>(null)
  const [company, setCompany] = useState<Company>(DEFAULT_COMPANY)
  const [bank, setBank] = useState<Bank | null>(null)
  const [canCredit, setCanCredit] = useState(false)
  const [people, setPeople] = useState<{ createdBy: string | null; commercial: string | null }>({ createdBy: null, commercial: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [reload, setReload] = useState(0)

  const [mailOpen, setMailOpen] = useState(false)
  const [mailTo, setMailTo] = useState("")
  const [mailMessage, setMailMessage] = useState("")
  const [creditOpen, setCreditOpen] = useState(false)
  const [creditAmount, setCreditAmount] = useState("")
  const [creditReason, setCreditReason] = useState("")
  const [formError, setFormError] = useState("")
  const [submitting, setSubmitting] = useState(false)

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
        if (data.company) setCompany(data.company)
        setBank(data.bank ?? null)
        setCanCredit(Boolean(data.canCredit))
        setPeople({ createdBy: data.createdByName ?? null, commercial: data.commercialName ?? null })
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) setError("Connexion au serveur impossible")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void init()
    return () => controller.abort()
  }, [id, reload])

  const back = doc?.type === "DEVIS" ? "/admin/devis-b2b" : `/admin/bons-b2b${doc ? `?type=${doc.type}&doc=${doc.id}` : ""}`
  // étape suivante de la chaîne : devis → commande → facture → livraison (facture payée)
  const nextStep = doc && session?.user?.role !== "COMPTABLE" && canCreateNext({ ...doc, paid: invoice?.paid, credited: invoice?.credited })
  const goNext = async () => {
    if (!doc || moving) return
    const warning = NEXT_WARNING[doc.type]
    if (warning && !window.confirm(`${TYPE_LABEL[doc.type].next} de ${doc.reference} ?\n\n${warning}`)) return
    setMoving(true)
    setError("")
    try {
      const res = await fetch(`/api/b2b-documents/${doc.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "transform" }) })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.document?.id) { setError(data?.error || "Création impossible"); return }
      // on ouvre directement le document créé
      router.push(`/admin/bons-b2b/${data.document.id}/document`)
    } catch {
      setError("Connexion au serveur impossible : rien n'a été créé")
    } finally {
      setMoving(false)
    }
  }
  const clientName = doc?.client ? doc.client.companyName || doc.client.tradeName || doc.client.contactName || `${doc.client.firstName ?? ""} ${doc.client.lastName ?? ""}`.trim() || "Client" : "Client"
  const canEmail = doc !== null && doc.status !== "CANCELLED" && doc.status !== "REJECTED"
  const showBank = doc?.type === "FACTURE" && bank && (bank.accountNumber || bank.mtnMoney || bank.airtelMoney)

  const openMail = () => {
    setMailTo(doc?.client?.email ?? "")
    setMailMessage(`Bonjour,\n\nVeuillez trouver ci-dessous ${doc?.type === "FACTURE" ? "notre facture" : doc?.type === "DEVIS" ? "notre devis" : `le document`} ${doc?.reference}.\n\nCordialement,\n${company.name}`)
    setFormError("")
    setMailOpen(true)
  }

  const openCredit = () => {
    setCreditAmount(String(invoice?.creditable ?? ""))
    setCreditReason("")
    setFormError("")
    setCreditOpen(true)
  }

  const submit = async (path: string, payload: Record<string, unknown>, done: (data: Record<string, unknown>) => void) => {
    if (submitting) return
    setSubmitting(true)
    setFormError("")
    try {
      const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setFormError(data?.error || "Action impossible")
        return
      }
      done(data ?? {})
      setReload((n) => n + 1)
    } catch {
      setFormError("Connexion au serveur impossible : rien n'a été fait")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={back} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          <ArrowLeft className="h-4 w-4" /> Retour à la liste
        </Link>
        {doc && (
          <div className="flex flex-wrap gap-2">
            {nextStep && (
              <button type="button" onClick={goNext} disabled={moving} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-primary bg-white px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-60">
                <ArrowRight className="h-4 w-4" /> {moving ? "Création…" : TYPE_LABEL[doc.type].next}
              </button>
            )}
            {/* facture émise, pas encore payée : le bon de livraison attend l'encaissement */}
            {invoice && doc.status === "INVOICED" && invoice.balance > 0.005 && !doc.children.some((c) => c.type === "LIVRAISON") && (
              <Link href={`/admin/creances?q=${encodeURIComponent(doc.reference)}`} title="Le bon de livraison s'établit une fois la facture entièrement payée" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50">
                <HandCoins className="h-4 w-4" /> Encaisser ({formatPrice(invoice.balance)})
              </Link>
            )}
            {canCredit && invoice && invoice.creditable > 0 && (
              <button type="button" onClick={openCredit} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
                <ReceiptText className="h-4 w-4" /> Établir un avoir
              </button>
            )}
            {canEmail && (
              <button type="button" onClick={openMail} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                <Mail className="h-4 w-4" /> Envoyer par e-mail
              </button>
            )}
            <button type="button" onClick={() => window.print()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
              <Printer className="h-4 w-4" /> Imprimer
            </button>
          </div>
        )}
      </div>

      {message && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 print:hidden">
          <span className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0" /> {message}</span>
          <button type="button" onClick={() => setMessage("")} aria-label="Fermer" className="p-2 text-green-600 hover:text-green-800"><X className="h-4 w-4" /></button>
        </div>
      )}
      {doc?.emailedAt && (
        <p className="text-sm text-gray-500 print:hidden">Dernier envoi par e-mail : {formatDate(doc.emailedAt)}{doc.emailedTo ? ` à ${doc.emailedTo}` : ""}.</p>
      )}

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
                <p className="text-lg font-bold text-primary">{company.name}</p>
                <p className="text-sm text-gray-600">{company.address}</p>
                <p className="text-sm text-gray-600">{company.phones}</p>
                <p className="text-sm text-gray-600">{company.contact}</p>
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
                  {doc.parent && <tr><td className="pr-3 text-gray-600">{doc.type === "AVOIR" ? "Facture :" : "Réf. d'origine :"}</td><td className="font-mono font-semibold">{doc.parent.reference}</td></tr>}
                </tbody>
              </table>
              <p className="mt-2">
                {invoice ? (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PAYMENT_STATUS[invoice.paymentStatus].className}`}>
                    {invoice.paymentStatus === "CANCELLED" && invoice.credited > 0 ? "Annulée par avoir" : PAYMENT_STATUS[invoice.paymentStatus].label}{invoice.overdue ? " — en retard" : ""}
                  </span>
                ) : (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold print:hidden ${STATUS_LABEL[doc.status]?.className ?? "bg-gray-100 text-gray-700"}`}>{doc.type === "AVOIR" && doc.status === "INVOICED" ? "Émis" : STATUS_LABEL[doc.status]?.label ?? doc.status}</span>
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
              {doc.parent && doc.type === "AVOIR" && <p className="mt-1">Avoir sur la facture <span className="font-mono">{doc.parent.reference}</span></p>}
              {doc.parent && doc.type !== "AVOIR" && <p className="mt-1">Établi à partir de : {TYPE_LABEL[doc.parent.type].one.toLowerCase()} <span className="font-mono">{doc.parent.reference}</span></p>}
              {doc.type === "FACTURE" && doc.parent?.type === "LIVRAISON" && <p className="mt-1">Marchandises livrées le {formatDate(doc.parent.deliveredAt ?? doc.parent.createdAt)}</p>}
              {doc.type === "FACTURE" && doc.deliveredAt && <p className="mt-1">Marchandises livrées le {formatDate(doc.deliveredAt)}</p>}
              {invoice && <p className="mt-1">Paiement à {invoice.termsDays} jour{invoice.termsDays > 1 ? "s" : ""}{invoice.fromContract ? " (contrat)" : ""}, au plus tard le {formatDate(invoice.dueDate)}</p>}
              {people.createdBy && <p className="mt-1">Établi par : {people.createdBy}</p>}
              {people.commercial && <p className="mt-1">Commercial : {people.commercial}</p>}
              {doc.children.map((child) => (
                <p key={child.id} className="mt-1">{child.type === "AVOIR" ? "Avoir" : `Suivi par : ${TYPE_LABEL[child.type].one.toLowerCase()}`} <span className="font-mono">{child.reference}</span></p>
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
                {/* avoir partiel : une seule ligne, le motif */}
                {doc.items.length === 0 && doc.type === "AVOIR" && (
                  <tr className="border-b border-gray-200">
                    <td className="px-3 py-2">Avoir sur la facture {doc.parent?.reference}{doc.notes ? ` : ${doc.notes}` : ""}</td>
                    <td className="px-3 py-2 text-right">1</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">{formatPrice(doc.total)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-medium">{formatPrice(doc.total)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {doc.type !== "LIVRAISON" && (
            <div className="mt-4 ml-auto w-full max-w-xs text-sm">
              <p className="flex justify-between py-1 text-gray-700"><span>Sous-total</span><span>{formatPrice(doc.subtotal)}</span></p>
              {doc.discount > 0 && <p className="flex justify-between py-1 text-gray-700"><span>Remise</span><span>− {formatPrice(doc.discount)}</span></p>}
              <p className="flex justify-between border-t-2 border-gray-900 py-2 text-lg font-bold"><span>{doc.type === "FACTURE" ? "Total à payer" : doc.type === "AVOIR" ? "Montant de l'avoir" : "Total"}</span><span>{formatPrice(doc.total)}</span></p>
              {invoice && invoice.credited > 0 && <p className="flex justify-between py-1 text-gray-700"><span>Avoirs</span><span>− {formatPrice(invoice.credited)}</span></p>}
              {invoice && invoice.paid > 0 && <p className="flex justify-between py-1 text-gray-700"><span>Déjà payé</span><span>− {formatPrice(invoice.paid)}</span></p>}
              {invoice && (invoice.paid > 0 || invoice.credited > 0) && <p className="flex justify-between py-1 font-bold"><span>Reste à payer</span><span>{formatPrice(invoice.balance)}</span></p>}
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
                    <tr key={p.id} className={`border-b border-gray-100 last:border-0 ${p.validationStatus === "REJECTED" ? "text-gray-400 print:hidden" : ""}`}>
                      <td className="py-1 pr-2">{formatDate(p.createdAt)}</td>
                      <td className="py-1 pr-2">
                        {RECEIPT_METHOD_LABEL[p.method] ?? p.method}
                        {p.reference && <span className="ml-1 font-mono text-xs text-gray-500">réf. {p.reference}</span>}
                      </td>
                      <td className="py-1 pr-2 text-gray-500">
                        {p.validationStatus === "VALIDATED" ? "validé" : p.validationStatus === "PENDING" ? "en attente de validation" : `refusé${p.rejectReason ? ` : ${p.rejectReason}` : ""}`}
                      </td>
                      <td className="whitespace-nowrap py-1 text-right font-medium">{formatPrice(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {invoice && invoice.credits.length > 0 && (
            <div className="mt-4 rounded-lg border border-gray-200 p-3 text-sm text-gray-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Avoirs</p>
              <table className="mt-1 w-full text-left">
                <tbody>
                  {invoice.credits.map((c) => (
                    <tr key={c.id} className="border-b border-gray-100 last:border-0">
                      <td className="py-1 pr-2">{formatDate(c.createdAt)}</td>
                      <td className="py-1 pr-2">
                        <Link href={`/admin/bons-b2b/${c.id}/document`} className="font-mono text-primary underline-offset-2 hover:underline print:text-gray-900 print:no-underline">{c.reference}</Link>
                      </td>
                      <td className="py-1 pr-2 text-gray-500">{c.reason}</td>
                      <td className="whitespace-nowrap py-1 text-right font-medium">− {formatPrice(c.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {showBank && bank && (
            <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-gray-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Modalités de règlement</p>
              {bank.accountNumber && (
                <p className="mt-1">
                  Virement{bank.bankName ? ` — ${bank.bankName}` : ""}{bank.accountHolder ? `, titulaire ${bank.accountHolder}` : ""} : <span className="font-mono font-semibold">{bank.accountNumber}</span>
                </p>
              )}
              {bank.mtnMoney && <p className="mt-1">MTN Mobile Money : <span className="font-semibold">{bank.mtnMoney}</span></p>}
              {bank.airtelMoney && <p className="mt-1">Airtel Money : <span className="font-semibold">{bank.airtelMoney}</span></p>}
              {bank.instructions && <p className="mt-1 text-gray-600">{bank.instructions}</p>}
              <p className="mt-1 text-gray-600">Merci d&apos;indiquer la référence {doc.reference} avec votre paiement.</p>
            </div>
          )}

          {doc.deliveryTerms && doc.type !== "FACTURE" && doc.type !== "AVOIR" && (
            <div className="mt-4 rounded-lg border border-gray-200 p-3 text-sm text-gray-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Livraison</p>
              <p className="mt-1 whitespace-pre-line">{doc.deliveryTerms}</p>
            </div>
          )}

          {doc.notes && (
            <div className="mt-4 rounded-lg border border-gray-200 p-3 text-sm text-gray-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{doc.type === "AVOIR" ? "Motif" : "Remarques"}</p>
              <p className="mt-1 whitespace-pre-line">{doc.notes}</p>
            </div>
          )}

          <p className="mt-4 text-xs text-gray-500">{DOC_TEXT[doc.type].conditions}</p>

          {/* la facture et l'avoir ne sont signés que par LCG ; les autres documents le sont aussi par le client */}
          <div className={`mt-10 grid gap-8 text-sm text-gray-700 ${doc.type === "FACTURE" || doc.type === "AVOIR" ? "grid-cols-1 sm:ml-auto sm:w-1/2" : "grid-cols-2"}`}>
            <div>
              <p className="font-semibold">Pour LCG — La Direction</p>
              <div className="mt-12 border-t border-gray-400 pt-1 text-xs text-gray-500">Nom, signature et cachet</div>
            </div>
            {doc.type !== "FACTURE" && doc.type !== "AVOIR" && (
              <div>
                <p className="font-semibold">{doc.type === "LIVRAISON" ? "Reçu par le client" : "Pour le client"}</p>
                <div className="mt-12 border-t border-gray-400 pt-1 text-xs text-gray-500">Nom, signature et cachet</div>
              </div>
            )}
          </div>

          {company.legal && <footer className="mt-8 border-t border-gray-200 pt-3 text-center text-xs text-gray-500">{company.legal}</footer>}
        </article>
      )}

      {mailOpen && doc && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4 print:hidden" onClick={(e) => { if (e.target === e.currentTarget && !submitting) setMailOpen(false) }}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void submit(`/api/b2b-documents/${doc.id}/email`, { to: mailTo, message: mailMessage }, (data) => {
                setMailOpen(false)
                setMessage(`E-mail envoyé à ${String(data.to ?? mailTo)} (${TYPE_LABEL[doc.type].one.toLowerCase()} ${doc.reference}).${doc.status === "DRAFT" ? " Le document passe à « Envoyé »." : ""}`)
              })
            }}
            className="w-full rounded-t-2xl bg-white p-4 shadow-xl sm:max-w-lg sm:rounded-2xl sm:p-6"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Envoyer {doc.reference} par e-mail</h2>
                <p className="text-sm text-gray-500">{clientName}</p>
              </div>
              <button type="button" onClick={() => setMailOpen(false)} aria-label="Fermer" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Adresse du destinataire
                <input type="email" required value={mailTo} onChange={(e) => setMailTo(e.target.value)} placeholder="client@exemple.cg" className={fieldClass} />
              </label>
              {!doc.client?.email && <p className="text-sm text-amber-700">Le client n&apos;a pas d&apos;adresse e-mail dans sa fiche.</p>}
              <label className="block text-sm font-medium text-gray-700">
                Message d&apos;accompagnement
                <textarea rows={5} value={mailMessage} onChange={(e) => setMailMessage(e.target.value)} maxLength={1000} className={`${fieldClass} min-h-28`} />
              </label>
              <p className="text-sm text-gray-500">Le document part dans le corps de l&apos;e-mail{doc.type === "FACTURE" && showBank ? ", avec les coordonnées de règlement" : ""}.</p>
              {formError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setMailOpen(false)} disabled={submitting} className="min-h-11 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">Annuler</button>
              <button type="submit" disabled={submitting} aria-busy={submitting} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
                <Mail className="h-4 w-4" /> {submitting ? "Envoi…" : "Envoyer"}
              </button>
            </div>
          </form>
        </div>
      )}

      {creditOpen && doc && invoice && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4 print:hidden" onClick={(e) => { if (e.target === e.currentTarget && !submitting) setCreditOpen(false) }}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void submit(`/api/b2b-documents/${doc.id}/avoir`, { amount: Number(creditAmount), reason: creditReason }, (data) => {
                const created = data.document as { reference?: string } | undefined
                setCreditOpen(false)
                setMessage(`Avoir ${created?.reference ?? ""} de ${formatPrice(Number(creditAmount))} établi sur ${doc.reference}.`)
              })
            }}
            className="w-full rounded-t-2xl bg-white p-4 shadow-xl sm:max-w-md sm:rounded-2xl sm:p-6"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Avoir sur {doc.reference}</h2>
                <p className="text-sm text-gray-500">{clientName} · annulable au plus {formatPrice(invoice.creditable)}</p>
              </div>
              <button type="button" onClick={() => setCreditOpen(false)} aria-label="Fermer" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Montant de l&apos;avoir (FCFA)
                <input type="number" min={1} max={invoice.creditable} step="1" required value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} className={`${fieldClass} text-lg font-bold`} />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Motif (obligatoire, imprimé sur l&apos;avoir)
                <input type="text" required maxLength={500} value={creditReason} onChange={(e) => setCreditReason(e.target.value)} placeholder="Ex. : erreur de quantité, geste commercial, facture annulée…" className={fieldClass} />
              </label>
              <p className="text-sm text-gray-500">
                L&apos;avoir réduit ce que le client doit sur cette facture. La part déjà réglée ne s&apos;annule pas ainsi (remboursement à traiter à part), et le stock n&apos;est pas modifié.
              </p>
              {formError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setCreditOpen(false)} disabled={submitting} className="min-h-11 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">Annuler</button>
              <button type="submit" disabled={submitting || !creditReason.trim()} className="min-h-11 rounded-lg bg-red-600 px-5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                {submitting ? "Enregistrement…" : "Établir l'avoir"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
