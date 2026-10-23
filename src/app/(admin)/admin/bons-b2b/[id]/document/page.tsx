"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { AlertCircle, ArrowLeft, ArrowRight, CalendarClock, Check, HandCoins, Link2, Mail, Printer, ReceiptText, X } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { canCreateNext, STATUS_LABEL, TYPE_LABEL, type DocType } from "@/components/admin/b2b-documents-screen"
import { montantEnLettres } from "@/lib/montant-en-lettres"
import { documentMailMessage } from "@/lib/b2b-document-mail-text"
import { RECEIPT_METHOD_LABEL } from "@/lib/payment-methods"
import { InvoicePaymentDialog } from "@/components/admin/invoice-payment-dialog"

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
    conditions: "Ce devis est sans engagement de vente. Validé par le client, il donne lieu à la facture.",
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
  DEVIS: "Le client a validé ce devis. La facture sera émise et ne pourra plus être modifiée (un avoir permet de la corriger).",
  COMMANDE: "La facture sera émise et ne pourra plus être modifiée (un avoir permet de la corriger).",
  FACTURE: "Le bon de livraison sera créé et la facture marquée comme livrée. Le stock du comptoir n'est pas modifié.",
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
  const [sharingLink, setSharingLink] = useState(false)

  const [mailOpen, setMailOpen] = useState(false)
  const [mailTo, setMailTo] = useState("")
  const [mailMessage, setMailMessage] = useState("")
  const [creditOpen, setCreditOpen] = useState(false)
  // formulaire « Encaisser » ouvert sur la page
  const [payOpen, setPayOpen] = useState(false)
  const [creditAmount, setCreditAmount] = useState("")
  const [creditReason, setCreditReason] = useState("")
  const [promiseOpen, setPromiseOpen] = useState(false)
  const [promiseAmount, setPromiseAmount] = useState("")
  const [promiseDue, setPromiseDue] = useState("")
  const [promiseNotes, setPromiseNotes] = useState("")
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
  const canEmail = doc !== null && doc.status !== "CANCELLED" && doc.status !== "REJECTED" && session?.user?.role !== "COMPTABLE"
  const showBank = (doc?.type === "FACTURE" || doc?.type === "DEVIS") && bank && (bank.accountNumber || bank.mtnMoney || bank.airtelMoney)

  const openMail = () => {
    setMailTo(doc?.client?.email ?? "")
    if (doc) {
      // message propre au type de document (devis, bon de commande, facture…), modifiable avant l'envoi
      setMailMessage(documentMailMessage({
        type: doc.type,
        reference: doc.reference,
        total: doc.total,
        companyName: company.name,
        validUntil: doc.validUntil,
        requestedDeliveryDate: doc.requestedDeliveryDate,
        dueDate: invoice?.dueDate ?? null,
        balance: invoice?.balance ?? null,
        parentReference: doc.parent?.reference ?? null,
      }))
    }
    setFormError("")
    setMailOpen(true)
  }

  const openCredit = () => {
    setCreditAmount(String(invoice?.creditable ?? ""))
    setCreditReason("")
    setFormError("")
    setCreditOpen(true)
  }

  const openPromise = () => {
    setPromiseAmount(invoice ? String(Math.round(invoice.balance)) : "")
    setPromiseDue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
    setPromiseNotes("")
    setFormError("")
    setPromiseOpen(true)
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

  const sharePublicLink = async () => {
    if (!doc || sharingLink) return
    setSharingLink(true)
    setError("")
    try {
      const res = await fetch(`/api/b2b-documents/${doc.id}/public-token`)
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.path) {
        setError(data?.error || "Impossible de générer le lien public.")
        return
      }
      const url = `${window.location.origin}${data.path}`
      try {
        await navigator.clipboard.writeText(url)
        setMessage("Lien public du devis copié dans le presse-papiers")
      } catch {
        setMessage(`Lien public du devis : ${url}`)
      }
    } catch {
      setError("Connexion au serveur impossible : le lien n'a pas pu être généré.")
    } finally {
      setSharingLink(false)
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
              <button type="button" onClick={() => setPayOpen(true)} disabled={invoice.balance - invoice.pending <= 0.005} title={invoice.balance - invoice.pending <= 0.005 ? "Règlement déjà saisi, en attente de validation" : "Le bon de livraison s'établit une fois la facture entièrement payée"} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50">
                <HandCoins className="h-4 w-4" /> Encaisser ({formatPrice(Math.max(0, invoice.balance - invoice.pending))})
              </button>
            )}
            {canCredit && invoice && invoice.creditable > 0 && (
              <button type="button" onClick={openCredit} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
                <ReceiptText className="h-4 w-4" /> Établir un avoir
              </button>
            )}
            {doc.type === "FACTURE" && doc.status === "INVOICED" && invoice && invoice.balance > 0.005 && (
              <button type="button" onClick={openPromise} title="Enregistrer une date de règlement promise par le client" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                <CalendarClock className="h-4 w-4" /> Promesse de paiement
              </button>
            )}
            {canEmail && (
              <button type="button" onClick={openMail} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                <Mail className="h-4 w-4" /> Envoyer par e-mail
              </button>
            )}
            {doc.type === "DEVIS" && doc.status !== "CANCELLED" && (
              <button type="button" onClick={sharePublicLink} disabled={sharingLink} title="Copier un lien que le client peut ouvrir sans compte" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">
                <Link2 className="h-4 w-4" /> {sharingLink ? "Génération…" : "Lien public"}
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
        // Modèle de document (facture, devis, livraison, avoir) d'après la maquette fournie le 2026-10-23 :
        // bandeau bleu (société, contact, client, dates), tableau en carte, paiement + conditions, totaux, signature.
        <article className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-gray-200 bg-white text-gray-900 shadow-sm [print-color-adjust:exact] print:max-w-none print:rounded-none print:border-0 print:shadow-none">
          <header className="relative rounded-b-[2.5rem] bg-primary px-5 pb-16 pt-6 text-white sm:px-10 sm:pt-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white p-1.5">
                  <Image src="/logo-lcg-transparent.png" alt="" width={64} height={62} className="h-full w-auto" />
                </span>
                <div>
                  <p className="text-xl font-extrabold uppercase leading-tight tracking-wide">{company.name}</p>
                  <p className="text-xs uppercase tracking-widest text-white/75">Glaçons en eau minérale</p>
                </div>
              </div>
              <div className="text-sm text-white/90 sm:text-right">
                <p className="text-xs font-bold uppercase tracking-widest text-white">Contact</p>
                <p className="mt-1">{company.address}</p>
                <p>{company.phones}</p>
                <p>{company.contact}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-2xl font-extrabold uppercase tracking-wide sm:text-3xl">{TYPE_LABEL[doc.type].one}</p>
                <p className="font-mono text-sm text-white/85">{DOC_TEXT[doc.type].number} {doc.reference}</p>
                <p className="mt-4 text-xs uppercase tracking-widest text-white/75">{DOC_TEXT[doc.type].client}</p>
                <p className="text-lg font-bold">{clientName}</p>
                {doc.client?.contactName && doc.client.contactName !== clientName && <p className="text-sm text-white/90">À l&apos;attention de {doc.client.contactName}</p>}
                {(doc.client?.address || doc.client?.city) && <p className="text-sm text-white/90">{[doc.client.address, doc.client.city].filter(Boolean).join(", ")}</p>}
                {(doc.client?.phone || doc.client?.email) && <p className="text-sm text-white/90">{[doc.client.phone, doc.client.email].filter(Boolean).join(" · ")}</p>}
                {doc.client?.taxId && <p className="text-sm text-white/90">NIU : {doc.client.taxId}</p>}
              </div>
              <div className="flex gap-6 text-sm sm:gap-8 sm:text-right">
                <div>
                  <p className="text-xs uppercase tracking-widest text-white/75">Date</p>
                  <p className="text-base font-bold">{formatDate(doc.invoicedAt ?? doc.createdAt)}</p>
                </div>
                {invoice && (
                  <div>
                    <p className="text-xs uppercase tracking-widest text-white/75">Échéance</p>
                    <p className="text-base font-bold">{formatDate(invoice.dueDate)}</p>
                  </div>
                )}
                {doc.type === "DEVIS" && doc.validUntil && (
                  <div>
                    <p className="text-xs uppercase tracking-widest text-white/75">Valable jusqu&apos;au</p>
                    <p className="text-base font-bold">{formatDate(doc.validUntil)}</p>
                  </div>
                )}
                {doc.type === "LIVRAISON" && doc.deliveredAt && (
                  <div>
                    <p className="text-xs uppercase tracking-widest text-white/75">Livré le</p>
                    <p className="text-base font-bold">{formatDate(doc.deliveredAt)}</p>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="px-4 pb-6 sm:px-10">
            {/* tableau des articles, en carte qui chevauche le bandeau */}
            <div className="relative -mt-10 overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-lg print:shadow-none">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-600">
                    <th className="w-14 px-3 py-4 text-center">N°</th>
                    <th className="px-3 py-4 text-left">Désignation</th>
                    {doc.type !== "LIVRAISON" && <th className="px-3 py-4 text-right">Prix</th>}
                    <th className="px-3 py-4 text-center">Qté</th>
                    {doc.type !== "LIVRAISON" && <th className="px-4 py-4 text-right">Total</th>}
                  </tr>
                </thead>
                <tbody>
                  {doc.items.map((item, index) => (
                    <tr key={item.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-3 py-3 text-center text-gray-500">{index + 1}.</td>
                      <td className="px-3 py-3">{item.productVariant ? `${item.productVariant.product.name} — ${item.productVariant.format}` : "Article retiré du catalogue"}</td>
                      {doc.type !== "LIVRAISON" && <td className="whitespace-nowrap px-3 py-3 text-right">{formatPrice(item.unitPrice)}</td>}
                      <td className="whitespace-nowrap px-3 py-3 text-center">{item.quantity}{item.productVariant?.unit ? ` ${item.productVariant.unit}` : ""}</td>
                      {doc.type !== "LIVRAISON" && <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{formatPrice(item.lineTotal)}</td>}
                    </tr>
                  ))}
                  {/* avoir partiel : une seule ligne, le motif */}
                  {doc.items.length === 0 && doc.type === "AVOIR" && (
                    <tr>
                      <td className="px-3 py-3 text-center text-gray-500">1.</td>
                      <td className="px-3 py-3">Avoir sur la facture {doc.parent?.reference}{doc.notes ? ` : ${doc.notes}` : ""}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">{formatPrice(doc.total)}</td>
                      <td className="px-3 py-3 text-center">1</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{formatPrice(doc.total)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {doc.status === "CANCELLED" && (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                Document annulé{doc.cancelReason ? ` : ${doc.cancelReason}` : ""}
              </p>
            )}

            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-[1fr_minmax(0,18rem)]">
              {/* à gauche : mode de paiement, informations et conditions */}
              <div className="order-2 space-y-4 rounded-2xl border border-gray-200 p-4 text-sm text-gray-700 sm:order-1">
                {showBank && bank && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-900">Mode de paiement</p>
                    <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                      {bank.accountNumber && <><dt className="text-gray-500">N° de compte</dt><dd className="font-mono font-semibold">{bank.accountNumber}</dd></>}
                      {bank.accountHolder && <><dt className="text-gray-500">Titulaire</dt><dd>{bank.accountHolder}</dd></>}
                      {bank.bankName && <><dt className="text-gray-500">Banque</dt><dd>{bank.bankName}</dd></>}
                      {bank.mtnMoney && <><dt className="text-gray-500">MTN Mobile Money</dt><dd className="font-semibold">{bank.mtnMoney}</dd></>}
                      {bank.airtelMoney && <><dt className="text-gray-500">Airtel Money</dt><dd className="font-semibold">{bank.airtelMoney}</dd></>}
                    </dl>
                    {bank.instructions && <p className="mt-1 text-gray-600">{bank.instructions}</p>}
                    <p className="mt-1 text-gray-600">Merci d&apos;indiquer la référence {doc.reference} avec votre paiement.</p>
                  </div>
                )}
                {(doc.parent || doc.children.length > 0 || invoice || people.createdBy || people.commercial) && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-900">Informations</p>
                    {doc.parent && doc.type === "AVOIR" && <p className="mt-1">Avoir sur la facture <span className="font-mono">{doc.parent.reference}</span></p>}
                    {doc.parent && doc.type !== "AVOIR" && <p className="mt-1">Établi à partir de : {TYPE_LABEL[doc.parent.type].one.toLowerCase()} <span className="font-mono">{doc.parent.reference}</span></p>}
                    {doc.type === "FACTURE" && doc.deliveredAt && <p className="mt-1">Marchandises livrées le {formatDate(doc.deliveredAt)}</p>}
                    {invoice && <p className="mt-1">Paiement à {invoice.termsDays} jour{invoice.termsDays > 1 ? "s" : ""}{invoice.fromContract ? " (contrat)" : ""}, au plus tard le {formatDate(invoice.dueDate)}</p>}
                    {people.createdBy && <p className="mt-1">Établi par : {people.createdBy}</p>}
                    {people.commercial && <p className="mt-1">Commercial : {people.commercial}</p>}
                    {doc.children.map((child) => (
                      <p key={child.id} className="mt-1">{child.type === "AVOIR" ? "Avoir" : `Suivi par : ${TYPE_LABEL[child.type].one.toLowerCase()}`} <span className="font-mono">{child.reference}</span></p>
                    ))}
                  </div>
                )}
                {doc.deliveryTerms && doc.type !== "FACTURE" && doc.type !== "AVOIR" && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-900">Livraison</p>
                    <p className="mt-1 whitespace-pre-line">{doc.deliveryTerms}</p>
                  </div>
                )}
                {doc.notes && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-900">{doc.type === "AVOIR" ? "Motif" : "Remarques"}</p>
                    <p className="mt-1 whitespace-pre-line">{doc.notes}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-900">Conditions</p>
                  <p className="mt-1 text-gray-600">{DOC_TEXT[doc.type].conditions}</p>
                </div>
              </div>

              {/* à droite : totaux */}
              {doc.type !== "LIVRAISON" ? (
                <div className="order-1 text-sm sm:order-2">
                  <p className="flex justify-between px-4 py-2 text-gray-700"><span>Sous-total</span><span>{formatPrice(doc.subtotal)}</span></p>
                  <p className="flex justify-between px-4 py-2 text-gray-700"><span>Remise</span><span>{doc.discount > 0 ? `− ${formatPrice(doc.discount)}` : formatPrice(0)}</span></p>
                  <p className="mt-1 flex justify-between rounded-xl bg-primary px-4 py-3 text-base font-bold text-white">
                    <span>{doc.type === "FACTURE" ? "Total à payer" : doc.type === "AVOIR" ? "Montant de l'avoir" : "Total"}</span><span>{formatPrice(doc.total)}</span>
                  </p>
                  {invoice && invoice.credited > 0 && <p className="flex justify-between px-4 pt-2 text-gray-700"><span>Avoirs</span><span>− {formatPrice(invoice.credited)}</span></p>}
                  {invoice && invoice.paid > 0 && <p className="flex justify-between px-4 pt-2 text-gray-700"><span>Déjà payé</span><span>− {formatPrice(invoice.paid)}</span></p>}
                  {invoice && (invoice.paid > 0 || invoice.credited > 0) && <p className="flex justify-between px-4 pt-2 font-bold"><span>Reste à payer</span><span>{formatPrice(invoice.balance)}</span></p>}
                  {invoice && invoice.pending > 0 && <p className="px-4 pt-1 text-xs text-gray-500">Règlement de {formatPrice(invoice.pending)} reçu, en attente de validation.</p>}
                  <p className="mt-2 px-4 text-xs">
                    {invoice ? (
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${PAYMENT_STATUS[invoice.paymentStatus].className}`}>
                        {invoice.paymentStatus === "CANCELLED" && invoice.credited > 0 ? "Annulée par avoir" : PAYMENT_STATUS[invoice.paymentStatus].label}{invoice.overdue ? " — en retard" : ""}
                      </span>
                    ) : (
                      <span className={`rounded-full px-2 py-0.5 font-semibold print:hidden ${STATUS_LABEL[doc.status]?.className ?? "bg-gray-100 text-gray-700"}`}>{doc.type === "AVOIR" && doc.status === "INVOICED" ? "Émis" : STATUS_LABEL[doc.status]?.label ?? doc.status}</span>
                    )}
                  </p>
                </div>
              ) : (
                <div className="order-1 text-xs sm:order-2">
                  <span className={`rounded-full px-2 py-0.5 font-semibold print:hidden ${STATUS_LABEL[doc.status]?.className ?? "bg-gray-100 text-gray-700"}`}>{STATUS_LABEL[doc.status]?.label ?? doc.status}</span>
                </div>
              )}
            </div>

            {doc.type !== "LIVRAISON" && (
              <p className="mt-5 text-sm italic text-gray-700">
                {DOC_TEXT[doc.type].arrete} à la somme de : <span className="font-semibold not-italic text-gray-900">{montantEnLettres(doc.total)}</span>.
              </p>
            )}

            {invoice && invoice.payments.length > 0 && (
              <div className="mt-4 rounded-2xl border border-gray-200 p-4 text-sm text-gray-700">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-900">Règlements reçus</p>
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
              <div className="mt-4 rounded-2xl border border-gray-200 p-4 text-sm text-gray-700">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-900">Avoirs</p>
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

            {/* signature : la facture et l'avoir ne sont signés que par LCG ; les autres documents aussi par le client */}
            <div className={`mt-10 grid gap-8 text-sm text-gray-700 ${doc.type === "FACTURE" || doc.type === "AVOIR" ? "grid-cols-1 sm:ml-auto sm:w-72" : "grid-cols-2"}`}>
              {doc.type !== "FACTURE" && doc.type !== "AVOIR" && (
                <div className="text-center">
                  <div className="mt-12 border-t border-gray-400 pt-1.5">{doc.type === "LIVRAISON" ? "Reçu par le client" : "Bon pour accord du client"}</div>
                  <p className="text-xs text-gray-500">Nom, signature et cachet</p>
                </div>
              )}
              <div className="text-center">
                <div className="mt-12 border-t border-gray-400 pt-1.5">Signature autorisée — LCG</div>
                <p className="text-xs text-gray-500">Nom, signature et cachet</p>
              </div>
            </div>
          </div>

          <footer className="rounded-t-[2rem] bg-primary px-5 py-4 text-center text-white sm:px-10">
            <p className="text-sm font-semibold">Merci de votre confiance</p>
            {company.legal && <p className="mt-1 text-xs text-white/75">{company.legal}</p>}
          </footer>
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

      {payOpen && doc && invoice && (
        <InvoicePaymentDialog
          invoice={{ id: doc.id, reference: doc.reference, clientName, balance: Math.max(0, invoice.balance - invoice.pending) }}
          onClose={() => setPayOpen(false)}
          onDone={(text) => { setMessage(text); setPayOpen(false); setReload((n) => n + 1) }}
        />
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

      {promiseOpen && doc && invoice && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4 print:hidden" onClick={(e) => { if (e.target === e.currentTarget && !submitting) setPromiseOpen(false) }}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void submit(`/api/encaissements/${doc.id}`, { action: "promise", amount: Number(promiseAmount), dueDate: promiseDue, notes: promiseNotes }, () => {
                setPromiseOpen(false)
                setMessage(`Promesse de paiement enregistrée sur ${doc.reference}`)
              })
            }}
            className="w-full rounded-t-2xl bg-white p-4 shadow-xl sm:max-w-lg sm:rounded-2xl sm:p-6"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Promesse de paiement — {doc.reference}</h2>
                <p className="text-sm text-gray-500">{clientName} · reste à recouvrer {formatPrice(invoice.balance)}</p>
              </div>
              <button type="button" onClick={() => setPromiseOpen(false)} aria-label="Fermer" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Montant promis (FCFA)
                <input type="number" min={1} max={Math.max(1, Math.round(invoice.balance))} step="1" required value={promiseAmount} onChange={(e) => setPromiseAmount(e.target.value)} className={`${fieldClass} text-lg font-bold`} />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Échéance promise
                <input type="date" required value={promiseDue} onChange={(e) => setPromiseDue(e.target.value)} className={fieldClass} />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Note (optionnel)
                <textarea rows={2} maxLength={500} value={promiseNotes} onChange={(e) => setPromiseNotes(e.target.value)} placeholder="Ex. : règlement annoncé par le comptable du client…" className={`${fieldClass} min-h-16`} />
              </label>
              <p className="text-sm text-gray-500">La promesse est affichée dans le suivi du recouvrement. Elle n&apos;enregistre pas de règlement : le client doit toujours payer.</p>
              {formError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPromiseOpen(false)} disabled={submitting} className="min-h-11 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">Annuler</button>
              <button type="submit" disabled={submitting || !(Number(promiseAmount) > 0) || !promiseDue} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                <CalendarClock className="h-4 w-4" /> {submitting ? "Enregistrement…" : "Enregistrer la promesse"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
