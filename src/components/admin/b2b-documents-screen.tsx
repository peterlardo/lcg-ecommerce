"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { AlertCircle, ArrowRight, Check, ChevronLeft, ChevronRight, FileText, Plus, Printer, Search, Send, Trash2, X } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { contractDiscount, productOptions } from "@/lib/b2b-contract"

// Écran commun aux devis et aux bons B2B (commande, livraison, facture) : liste, création, suite de la chaîne
// devis -> bon de commande -> bon de livraison -> facture. Portage de devis-b2b.php et bons-b2b.php (lcgapp3).

export type DocType = "DEVIS" | "COMMANDE" | "LIVRAISON" | "FACTURE"

interface LinkedDoc {
  id: string
  reference: string
  type: DocType
}

interface B2bDocument {
  id: string
  type: DocType
  reference: string
  status: string
  clientName: string
  subtotal: number
  discount: number
  total: number
  notes: string | null
  validUntil: string | null
  createdAt: string
  parent: LinkedDoc | null
  children: LinkedDoc[]
  _count: { items: number }
}

interface ClientOption {
  id: string
  companyName: string | null
  tradeName: string | null
  contactName: string | null
  isActive: boolean
}

/** Devis encore ouvert, qu'un bon de commande peut reprendre. */
interface QuoteOption {
  id: string
  reference: string
  clientId: string
  clientName: string
  total: number
  status: string
  validUntil: string | null
  /** date de validité dépassée (calculée à la lecture) */
  expired: boolean
}

interface VariantOption {
  id: string
  label: string
  price: number
}

/** Contrat en cours du client choisi : ses prix négociés et sa remise sont proposés dans le formulaire. */
interface ClientContract {
  clientId: string
  discountPercent: number
  minOrderAmount: number
  paymentTermsDays: number
  prices: Map<string, number>
}

interface DraftLine {
  variantId: string
  quantity: string
  unitPrice: string
}

export const TYPE_LABEL: Record<DocType, { one: string; many: string; next?: string }> = {
  DEVIS: { one: "Devis", many: "Devis", next: "Créer le bon de commande" },
  COMMANDE: { one: "Bon de commande", many: "Commandes", next: "Créer le bon de livraison" },
  LIVRAISON: { one: "Bon de livraison", many: "Livraisons", next: "Créer la facture" },
  FACTURE: { one: "Facture", many: "Factures" },
}

export const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Brouillon", className: "bg-gray-100 text-gray-700" },
  SENT: { label: "Envoyé", className: "bg-blue-100 text-blue-700" },
  CONFIRMED: { label: "Confirmé", className: "bg-emerald-100 text-emerald-700" },
  REJECTED: { label: "Refusé", className: "bg-rose-100 text-rose-700" },
  DELIVERED: { label: "Livré", className: "bg-indigo-100 text-indigo-700" },
  INVOICED: { label: "Facturé", className: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Annulé", className: "bg-gray-100 text-gray-500" },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

const EMPTY_LINE: DraftLine = { variantId: "", quantity: "1", unitPrice: "" }

export function B2bDocumentsScreen({ title, subtitle, types, creatable }: { title: string; subtitle: string; types: DocType[]; creatable: DocType | null }) {
  const { data: session } = useSession()
  const [type, setType] = useState<DocType>(types[0])
  const [status, setStatus] = useState("")
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [documents, setDocuments] = useState<B2bDocument[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [reload, setReload] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)

  // formulaire de création
  const [creating, setCreating] = useState(false)
  const [clients, setClients] = useState<ClientOption[]>([])
  const [variants, setVariants] = useState<VariantOption[]>([])
  const [clientId, setClientId] = useState("")
  const [contract, setContract] = useState<ClientContract | null>(null)
  const [lines, setLines] = useState<DraftLine[]>([EMPTY_LINE])
  const [discount, setDiscount] = useState("")
  const [notes, setNotes] = useState("")
  const [formError, setFormError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  // bon de commande : devis repris (ses articles, prix et remise remplissent le formulaire)
  const [quotes, setQuotes] = useState<QuoteOption[]>([])
  const [quotesLoaded, setQuotesLoaded] = useState(false)
  const [quoteId, setQuoteId] = useState("")
  const [quoteLoading, setQuoteLoading] = useState(false)
  // lu par l'effet du contrat : les prix d'un devis repris ne sont pas recalculés
  const quoteRef = useRef("")
  const fromQuotes = creatable === "COMMANDE"

  useEffect(() => {
    const controller = new AbortController()
    const init = async () => {
      const params = new URLSearchParams({ type, page: String(page) })
      if (status) params.set("status", status)
      if (query) params.set("q", query)
      try {
        const res = await fetch(`/api/b2b-documents?${params.toString()}`, { signal: controller.signal })
        const data = await res.json().catch(() => null)
        if (controller.signal.aborted) return
        if (!res.ok) {
          setError(res.status === 403 ? "Cet écran est réservé à l'administrateur et aux commerciaux." : data?.error || "Chargement impossible")
          return
        }
        setError("")
        setDocuments(data.documents ?? [])
        setTotal(data.total ?? 0)
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) setError("Connexion au serveur impossible")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void init()
    return () => controller.abort()
  }, [type, status, query, page, reload])

  // clients et produits du formulaire, chargés à sa première ouverture
  useEffect(() => {
    if (!creating || clients.length > 0) return
    const controller = new AbortController()
    const init = async () => {
      try {
        // un commercial ne propose que ses clients ; l'administrateur les voit tous
        const mine = session?.user?.role === "COMMERCIAL" ? `&commercialId=${session.user.id}` : ""
        const [clientsRes, productsRes] = await Promise.all([
          fetch(`/api/clients?type=B2B&active=true${mine}`, { signal: controller.signal }),
          fetch("/api/produits?all=1", { signal: controller.signal }),
        ])
        if (controller.signal.aborted) return
        if (clientsRes.ok) setClients(await clientsRes.json())
        if (productsRes.ok) {
          setVariants(productOptions(await productsRes.json()))
        }
      } catch {}
    }
    void init()
    return () => controller.abort()
  }, [creating, clients.length, session?.user?.id, session?.user?.role])

  // devis encore ouverts, relus à chaque ouverture du formulaire de bon de commande
  useEffect(() => {
    if (!creating || !fromQuotes) return
    const controller = new AbortController()
    const init = async () => {
      try {
        const res = await fetch("/api/b2b-documents?available=1", { signal: controller.signal })
        const data = await res.json().catch(() => null)
        if (controller.signal.aborted) return
        if (res.ok) {
          const now = Date.now()
          setQuotes((data?.documents ?? []).map((q: Omit<QuoteOption, "expired">) => ({ ...q, expired: q.validUntil !== null && new Date(q.validUntil).getTime() < now })))
        }
      } catch {}
      if (!controller.signal.aborted) setQuotesLoaded(true)
    }
    void init()
    return () => controller.abort()
  }, [creating, fromQuotes])

  // contrat du client choisi dans le formulaire : seul un contrat actif et dans sa période s'applique
  useEffect(() => {
    if (!creating || !clientId) return
    const controller = new AbortController()
    const init = async () => {
      let next: ClientContract | null = null
      try {
        const res = await fetch(`/api/b2b-contracts?clientId=${encodeURIComponent(clientId)}&status=ACTIVE`, { signal: controller.signal })
        const data = await res.json().catch(() => null)
        const found = res.ok ? (data?.contracts ?? []).find((c: { applicable: boolean }) => c.applicable) : null
        if (found) {
          next = {
            clientId,
            discountPercent: Number(found.discountPercent) || 0,
            minOrderAmount: Number(found.minOrderAmount) || 0,
            paymentTermsDays: Number(found.paymentTermsDays) || 0,
            prices: new Map((found.items ?? []).map((i: { productVariantId: string; unitPrice: number }) => [i.productVariantId, i.unitPrice])),
          }
        }
      } catch {}
      if (controller.signal.aborted) return
      setContract(next)
      // les prix d'un devis repris restent ceux du devis
      if (quoteRef.current) return
      // les articles déjà choisis prennent les prix de ce client
      setLines((current) => current.map((l) => {
        if (!l.variantId) return l
        const price = next?.prices.get(l.variantId) ?? variants.find((v) => v.id === l.variantId)?.price
        return price === undefined ? l : { ...l, unitPrice: String(price) }
      }))
    }
    void init()
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seul le changement de client relance la lecture du contrat
  }, [creating, clientId])

  const totalPages = Math.max(1, Math.ceil(total / 20))
  const subtotal = useMemo(() => lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0), [lines])
  // contrat du client actuellement choisi (celui d'un client précédent ne compte plus)
  const activeContract = contract && contract.clientId === clientId ? contract : null
  // Remise : laissée vide, c'est celle du contrat (même calcul que le serveur) ; saisie, elle la remplace.
  const autoDiscount = useMemo(
    () => contractDiscount(
      activeContract?.discountPercent,
      lines.filter((l) => l.variantId).map((l) => ({ productVariantId: l.variantId, lineTotal: (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0) })),
      new Set(activeContract?.prices.keys() ?? []),
    ),
    [activeContract, lines],
  )
  const discountValue = discount === "" ? autoDiscount : Number(discount) || 0

  const changeType = (next: DocType) => { setType(next); setStatus(""); setPage(1); setLoading(true) }
  const updateLine = (index: number, patch: Partial<DraftLine>) => setLines((current) => current.map((l, i) => (i === index ? { ...l, ...patch } : l)))

  const openCreate = () => {
    setCreating(true)
    setQuoteId("")
    setQuotesLoaded(false)
    quoteRef.current = ""
    setClientId("")
    setContract(null)
    setLines([EMPTY_LINE])
    setDiscount("")
    setNotes("")
    setFormError("")
  }

  /** Reprend un devis : client, articles, prix, remise et remarques, tout reste modifiable. */
  const chooseQuote = async (id: string) => {
    setFormError("")
    if (!id) {
      quoteRef.current = ""
      setQuoteId("")
      setLines([EMPTY_LINE])
      setDiscount("")
      setNotes("")
      return
    }
    setQuoteLoading(true)
    try {
      const res = await fetch(`/api/b2b-documents/${id}`)
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.document) { setFormError(data?.error || "Lecture du devis impossible"); return }
      const quote = data.document as { clientId: string; discount: number; notes: string | null; items: { productVariantId: string | null; quantity: number; unitPrice: number }[] }
      quoteRef.current = id
      setQuoteId(id)
      setClientId(quote.clientId)
      setLines(quote.items.filter((i) => i.productVariantId).map((i) => ({ variantId: i.productVariantId as string, quantity: String(i.quantity), unitPrice: String(i.unitPrice) })))
      setDiscount(String(quote.discount ?? 0))
      setNotes(quote.notes ?? "")
    } catch {
      setFormError("Connexion au serveur impossible")
    } finally {
      setQuoteLoading(false)
    }
  }

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting || !creatable) return
    const items = lines.filter((l) => l.variantId).map((l) => ({ productVariantId: l.variantId, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) }))
    if (!clientId) { setFormError("Choisissez un client"); return }
    if (items.length === 0) { setFormError("Ajoutez au moins un article"); return }
    if (items.some((i) => !Number.isInteger(i.quantity) || i.quantity < 1)) { setFormError("Les quantités doivent être des nombres entiers"); return }
    if (discountValue < 0 || discountValue > subtotal) { setFormError("La remise ne peut pas dépasser le total"); return }
    setSubmitting(true)
    setFormError("")
    try {
      const res = await fetch("/api/b2b-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // remise non saisie : le serveur applique celle du contrat
        body: JSON.stringify({ type: creatable, clientId, items, ...(discount === "" ? {} : { discount: discountValue }), notes, ...(quoteId ? { parentId: quoteId } : {}) }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setFormError(data?.error || "Création impossible"); return }
      const quoteRefLabel = quotes.find((q) => q.id === quoteId)?.reference
      setMessage(`${TYPE_LABEL[creatable].one} ${data.document.reference} créé en brouillon${quoteRefLabel ? ` à partir du devis ${quoteRefLabel}` : ""}.`)
      setCreating(false)
      setType(creatable)
      setPage(1)
      setReload((n) => n + 1)
    } catch {
      setFormError("Connexion au serveur impossible : rien n'a été créé")
    } finally {
      setSubmitting(false)
    }
  }

  const act = async (doc: B2bDocument, action: "send" | "confirm" | "reject" | "cancel" | "transform") => {
    if (busy) return
    let cancelReason: string | null = null
    if (action === "cancel") {
      cancelReason = window.prompt(`Motif de l'annulation de ${doc.reference} :`)
      if (!cancelReason?.trim()) return
    }
    if (action === "reject" && !window.confirm(`Marquer ${doc.reference} comme refusé par le client ?`)) return
    if (action === "transform" && doc.type === "COMMANDE" && !window.confirm(`Créer le bon de livraison de ${doc.reference} ?\n\nLes quantités seront sorties du stock du comptoir.`)) return
    setBusy(`${action}-${doc.id}`)
    setError("")
    setMessage("")
    try {
      const res = await fetch(`/api/b2b-documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(cancelReason ? { cancelReason: cancelReason.trim() } : {}) }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setError(data?.error || "Action impossible"); return }
      const done: Record<string, string> = {
        send: `${doc.reference} marqué comme envoyé au client.`,
        confirm: `${doc.reference} confirmé.`,
        reject: `${doc.reference} marqué comme refusé.`,
        cancel: `${doc.reference} annulé.`,
        transform: `${TYPE_LABEL[data.document.type as DocType]?.one ?? "Document"} ${data.document.reference} créé à partir de ${doc.reference}.`,
      }
      setMessage(done[action])
      setReload((n) => n + 1)
    } catch {
      setError("Connexion au serveur impossible")
    } finally {
      setBusy(null)
    }
  }

  const actionButton = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900 sm:text-2xl">
            <FileText className="h-6 w-6 text-primary" />
            {title}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
        </div>
        {creatable && (
          <button type="button" onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">
            <Plus className="h-4 w-4" /> Nouveau {TYPE_LABEL[creatable].one.toLowerCase()}
          </button>
        )}
      </div>

      {types.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {types.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => changeType(t)}
              aria-pressed={type === t}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${type === t ? "bg-primary text-white" : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"}`}
            >
              {TYPE_LABEL[t].many}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 sm:flex-row sm:items-center sm:p-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { setQuery(search.trim()); setPage(1) } }}
            placeholder="Référence ou client, puis Entrée"
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
          />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm">
          <option value="">Tous les états</option>
          {Object.entries(STATUS_LABEL).map(([key, s]) => <option key={key} value={key}>{s.label}</option>)}
        </select>
        <p className="text-sm text-gray-500">{total} {total > 1 ? TYPE_LABEL[type].many.toLowerCase() : TYPE_LABEL[type].one.toLowerCase()}</p>
      </div>

      {message && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <span className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0" /> {message}</span>
          <button type="button" onClick={() => setMessage("")} aria-label="Fermer" className="p-2 text-green-600 hover:text-green-800"><X className="h-4 w-4" /></button>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading && <p className="p-4 text-sm text-gray-500">Chargement...</p>}
        {!loading && documents.length === 0 && <p className="p-8 text-center text-sm text-gray-500">Aucun document pour ces critères.</p>}
        {!loading && documents.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {documents.map((doc) => {
              const next = doc.children[0]
              const canTransform = Boolean(TYPE_LABEL[doc.type].next) && !next && (doc.status === "CONFIRMED" || doc.status === "DRAFT" || doc.status === "SENT")
              const open = doc.status === "DRAFT" || doc.status === "SENT"
              return (
                <li key={doc.id} className="flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-gray-900">{doc.reference}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_LABEL[doc.status]?.className ?? "bg-gray-100 text-gray-700"}`}>{STATUS_LABEL[doc.status]?.label ?? doc.status}</span>
                      {doc.parent && <span className="text-xs text-gray-500">issu de {doc.parent.reference}</span>}
                      {next && <span className="text-xs text-gray-500">→ {next.reference}</span>}
                    </div>
                    <p className="mt-1 text-sm font-medium text-gray-800">{doc.clientName}</p>
                    <p className="text-xs text-gray-500">
                      du {formatDate(doc.createdAt)} · {doc._count.items} article{doc._count.items > 1 ? "s" : ""}
                      {doc.type === "DEVIS" && doc.validUntil ? ` · valable jusqu'au ${formatDate(doc.validUntil)}` : ""}
                      {doc.discount > 0 ? ` · remise ${formatPrice(doc.discount)}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <span className="mr-1 whitespace-nowrap text-base font-bold text-gray-900">{formatPrice(doc.total)}</span>
                    <Link href={`/admin/bons-b2b/${doc.id}/document`} className={`${actionButton} border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}>
                      <Printer className="h-4 w-4" /> Voir
                    </Link>
                    {doc.status === "DRAFT" && (
                      <button type="button" onClick={() => act(doc, "send")} disabled={busy !== null} className={`${actionButton} border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}>
                        <Send className="h-4 w-4" /> Envoyé au client
                      </button>
                    )}
                    {open && doc.type !== "FACTURE" && (
                      <button type="button" onClick={() => act(doc, "confirm")} disabled={busy !== null} className={`${actionButton} border-green-300 bg-white text-green-700 hover:bg-green-50`}>
                        <Check className="h-4 w-4" /> Confirmer
                      </button>
                    )}
                    {canTransform && (
                      <button type="button" onClick={() => act(doc, "transform")} disabled={busy !== null} className={`${actionButton} border-primary bg-primary text-white hover:opacity-90`}>
                        <ArrowRight className="h-4 w-4" /> {busy === `transform-${doc.id}` ? "Création…" : TYPE_LABEL[doc.type].next}
                      </button>
                    )}
                    {open && doc.type === "DEVIS" && (
                      <button type="button" onClick={() => act(doc, "reject")} disabled={busy !== null} className={`${actionButton} border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}>
                        Refusé
                      </button>
                    )}
                    {open && (
                      <button type="button" onClick={() => act(doc, "cancel")} disabled={busy !== null} className={`${actionButton} border-red-200 bg-white text-red-600 hover:bg-red-50`}>
                        <X className="h-4 w-4" /> Annuler
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {!loading && total > 20 && (
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 sm:px-4">
          <p className="text-sm text-gray-500">Page {page}/{totalPages}</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" /> Précédent
            </button>
            <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 disabled:opacity-40">
              Suivant <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {creating && creatable && (
        <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 sm:items-center sm:p-4">
          <form onSubmit={submitCreate} className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:max-w-3xl sm:rounded-2xl sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Nouveau {TYPE_LABEL[creatable].one.toLowerCase()}</h2>
                <p className="text-sm text-gray-500">Créé en brouillon : vous pourrez le vérifier avant de l&apos;envoyer.</p>
              </div>
              <button type="button" onClick={() => setCreating(false)} aria-label="Fermer" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>

            {fromQuotes && (
              <label className="mb-4 block text-sm font-medium text-gray-700">
                Devis à reprendre
                <select value={quoteId} onChange={(e) => void chooseQuote(e.target.value)} disabled={quoteLoading} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 disabled:opacity-60">
                  <option value="">{quotesLoaded ? "Aucun : commande sans devis" : "Chargement des devis…"}</option>
                  {quotes
                    // client déjà choisi : seulement ses devis
                    .filter((q) => quoteId || !clientId || q.clientId === clientId)
                    .map((q) => (
                      <option key={q.id} value={q.id}>
                        {`${q.reference} · ${q.clientName} · ${formatPrice(q.total)} · ${STATUS_LABEL[q.status]?.label.toLowerCase() ?? q.status}${q.expired ? " · validité dépassée" : ""}`}
                      </option>
                    ))}
                </select>
                <span className="mt-1 block text-xs font-normal text-gray-500">
                  {quoteId
                    ? "Articles, prix et remise repris du devis : vous pouvez encore les modifier. Le devis passera à « Confirmé »."
                    : quotesLoaded && quotes.length === 0
                      ? "Aucun devis en attente de commande."
                      : "Les devis déjà transformés, refusés ou annulés ne sont pas proposés."}
                </span>
              </label>
            )}

            <label className="block text-sm font-medium text-gray-700">
              Client B2B
              <select value={clientId} onChange={(e) => setClientId(e.target.value)} required disabled={Boolean(quoteId)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 disabled:bg-gray-50 disabled:text-gray-700">
                <option value="">Choisir un client…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.companyName || c.tradeName || c.contactName || "Client"}</option>)}
                {/* client du devis absent de la liste (client désactivé, par exemple) */}
                {clientId && !clients.some((c) => c.id === clientId) && <option value={clientId}>{quotes.find((q) => q.id === quoteId)?.clientName ?? "Client"}</option>}
              </select>
            </label>
            {clients.length === 0 && <p className="mt-1 text-sm text-amber-700">Aucun client B2B disponible : créez-le d&apos;abord dans l&apos;écran Clients B2B.</p>}
            {activeContract && (
              <p className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                Contrat en cours : {activeContract.prices.size} prix négocié{activeContract.prices.size > 1 ? "s" : ""}
                {activeContract.discountPercent > 0 ? ` · remise ${activeContract.discountPercent} %` : ""}
                {` · paiement à ${activeContract.paymentTermsDays} jour${activeContract.paymentTermsDays > 1 ? "s" : ""}`}
                {activeContract.minOrderAmount > 0 ? ` · commande minimum ${formatPrice(activeContract.minOrderAmount)}` : ""}
              </p>
            )}

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">Articles</p>
                <button type="button" onClick={() => setLines((current) => [...current, EMPTY_LINE])} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-primary-700 hover:bg-gray-50">
                  <Plus className="h-4 w-4" /> Ajouter un article
                </button>
              </div>
              <div className="space-y-2">
                {/* Une ligne par article à partir de 768 px ; en dessous, le produit prend toute la largeur
                    (sinon son nom était coupé). Les titres restent visibles une fois les cases remplies. */}
                <div aria-hidden="true" className="hidden gap-2 px-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 md:grid md:grid-cols-[1fr_6rem_8rem_7rem_2.75rem]">
                  <span>Produit</span><span>Quantité</span><span>Prix unitaire</span><span>Total</span><span />
                </div>
                {lines.map((line, index) => (
                  <div key={index} className="grid grid-cols-2 gap-2 rounded-lg border border-gray-100 bg-gray-50 p-2.5 md:grid-cols-[1fr_6rem_8rem_7rem_2.75rem] md:items-center">
                    <select
                      value={line.variantId}
                      onChange={(e) => {
                        const variant = variants.find((v) => v.id === e.target.value)
                        // prix proposé : celui du contrat du client, à défaut le prix public
                        updateLine(index, { variantId: e.target.value, unitPrice: variant ? String(activeContract?.prices.get(variant.id) ?? variant.price) : "" })
                      }}
                      aria-label="Produit"
                      className="col-span-2 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2.5 md:col-span-1"
                    >
                      <option value="">{variants.length ? "Choisir un produit…" : "Chargement des produits…"}</option>
                      {/* le prix figure dans la liste : celui du contrat du client s'il en a un, sinon le prix public */}
                      {variants.map((v) => <option key={v.id} value={v.id}>{`${v.label} · ${formatPrice(activeContract?.prices.get(v.id) ?? v.price)}${activeContract?.prices.has(v.id) ? " (contrat)" : ""}`}</option>)}
                    </select>
                    <label className="text-xs font-medium text-gray-600 md:contents">
                      <span className="md:sr-only">Quantité</span>
                      <input type="number" min={1} step={1} value={line.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} placeholder="Qté" className="mt-1 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base font-normal text-gray-900 md:mt-0" />
                    </label>
                    <label className="text-xs font-medium text-gray-600 md:contents">
                      <span className="md:sr-only">Prix unitaire (FCFA)</span>
                      <input type="number" min={0} step={1} value={line.unitPrice} onChange={(e) => updateLine(index, { unitPrice: e.target.value })} placeholder="Prix" className="mt-1 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base font-normal text-gray-900 md:mt-0" />
                    </label>
                    <p className="self-center whitespace-nowrap text-sm font-semibold text-gray-900">
                      <span className="font-normal text-gray-600 md:hidden">Total : </span>
                      {formatPrice((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0))}
                    </p>
                    <button type="button" onClick={() => setLines((current) => current.filter((_, i) => i !== index))} disabled={lines.length === 1} aria-label="Retirer l'article" className="justify-self-end rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30">
                      <Trash2 className="h-4 w-4" />
                    </button>
                    {activeContract?.prices.has(line.variantId) && (
                      <p className="col-span-2 text-xs font-medium text-blue-700 md:col-span-5">
                        Prix du contrat : {formatPrice(activeContract.prices.get(line.variantId) ?? 0)}
                        {Number(line.unitPrice) !== activeContract.prices.get(line.variantId) ? " (prix modifié à la main)" : ""}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-gray-700">
                Remise (FCFA)
                <input type="number" min={0} step={1} value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder={autoDiscount > 0 ? String(autoDiscount) : "0"} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5" />
                {activeContract && activeContract.discountPercent > 0 && (
                  <span className="mt-1 block text-xs font-normal text-gray-600">
                    {discount === ""
                      ? `Remise du contrat (${activeContract.discountPercent} %) appliquée automatiquement. Saisissez un montant pour la remplacer, 0 pour ne pas en faire.`
                      : `Remise saisie à la main. Videz le champ pour revenir à celle du contrat (${activeContract.discountPercent} %).`}
                  </span>
                )}
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Remarques
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="Conditions, délais…" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5" />
              </label>
            </div>

            <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm">
              <p className="flex justify-between text-gray-600"><span>Sous-total</span><span>{formatPrice(subtotal)}</span></p>
              {discountValue > 0 && <p className="flex justify-between text-gray-600"><span>{discount === "" ? `Remise du contrat (${activeContract?.discountPercent} %)` : "Remise"}</span><span>− {formatPrice(discountValue)}</span></p>}
              <p className="mt-1 flex justify-between text-lg font-bold text-gray-900"><span>Total</span><span>{formatPrice(Math.max(0, subtotal - discountValue))}</span></p>
            </div>

            {activeContract && activeContract.minOrderAmount > 0 && subtotal > 0 && subtotal - discountValue < activeContract.minOrderAmount && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Le contrat prévoit une commande minimum de {formatPrice(activeContract.minOrderAmount)} : ce document est en dessous.</p>
            )}

            {formError && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setCreating(false)} disabled={submitting} className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Annuler</button>
              <button type="submit" disabled={submitting} aria-busy={submitting} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-wait disabled:opacity-60">
                {submitting ? "Création…" : "Créer le brouillon"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
