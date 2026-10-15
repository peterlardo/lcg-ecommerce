"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { AlertCircle, ArrowRight, Check, ChevronLeft, ChevronRight, FileText, HandCoins, Pencil, Plus, Printer, Search, Send, Trash2, X } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { contractDiscount, productOptions } from "@/lib/b2b-contract"

// Écran commun aux devis et aux bons B2B (commande, livraison, facture) : liste, création, suite de la chaîne
// devis -> bon de commande -> bon de livraison -> facture. Portage de devis-b2b.php et bons-b2b.php (lcgapp3).

export type DocType = "DEVIS" | "COMMANDE" | "LIVRAISON" | "FACTURE" | "AVOIR"

interface LinkedDoc {
  id: string
  reference: string
  type: DocType
  total?: number
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
  requestedDeliveryDate: string | null
  createdAt: string
  /** règlements validés (factures) */
  paid?: number
  /** avoirs émis (factures) */
  credited?: number
  parent: LinkedDoc | null
  children: LinkedDoc[]
  _count: { items: number }
}

interface ClientOption {
  id: string
  companyName: string | null
  tradeName: string | null
  contactName: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  city?: string | null
  creditLimit?: number | null
  isActive: boolean
}

/** Facture non soldée (écran Créances), pour l'encours du client dans le bon de commande. */
interface OpenInvoice {
  clientId: string | null
  balance: number
  overdue: boolean
}

/** Adresse d'un client, pour proposer le lieu de livraison. */
const clientAddress = (c: ClientOption | undefined) => (c ? [c.address, c.city].filter(Boolean).join(", ") : "")

/** Jour (AAAA-MM-JJ) à Brazzaville, pour les champs de type date. */
const dayInBrazzaville = (d: Date) => d.toLocaleDateString("fr-CA", { timeZone: "Africa/Brazzaville" })

/** Devis encore ouvert, qu'un bon de commande peut reprendre. */
interface QuoteOption {
  id: string
  reference: string
  clientId: string
  clientName: string
  total: number
  status: string
  validUntil: string | null
  createdAt: string
  discount: number
  notes: string | null
  deliveryTerms: string | null
  requestedDeliveryDate: string | null
  items: { productVariantId: string | null; quantity: number; unitPrice: number }[]
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

/**
 * Chaîne de vente : devis → bon de commande → facture → bon de livraison (une fois la facture payée).
 * `next` : libellé du bouton qui crée le document suivant. Un bon de livraison de l'ancienne chaîne
 * (établi depuis une commande) se facture encore.
 */
export const TYPE_LABEL: Record<DocType, { one: string; many: string; next?: string }> = {
  DEVIS: { one: "Devis", many: "Devis", next: "Créer le bon de commande" },
  COMMANDE: { one: "Bon de commande", many: "Commandes", next: "Créer la facture" },
  FACTURE: { one: "Facture", many: "Factures", next: "Créer le bon de livraison" },
  LIVRAISON: { one: "Bon de livraison", many: "Livraisons", next: "Créer la facture" },
  AVOIR: { one: "Avoir", many: "Avoirs" },
}

/** États utiles au filtre de chaque liste. */
const STATUS_BY_TYPE: Record<DocType, string[]> = {
  DEVIS: ["DRAFT", "SENT", "CONFIRMED", "REJECTED", "CANCELLED"],
  COMMANDE: ["DRAFT", "SENT", "CONFIRMED", "INVOICED", "CANCELLED"],
  FACTURE: [],
  LIVRAISON: ["DRAFT", "CONFIRMED", "DELIVERED", "CANCELLED"],
  AVOIR: [],
}

/** Document suivant dans la chaîne (les avoirs d'une facture n'en sont pas). */
const nextInChain = <T extends { type: DocType }>(doc: { children: T[] }): T | undefined => doc.children.find((c) => c.type !== "AVOIR")

/** Facture : reste dû (avoirs déduits) et payée en entier ? Seuls les règlements validés comptent. */
export function invoiceState(doc: { total: number; paid?: number; credited?: number }) {
  const due = Math.max(0, doc.total - (doc.credited ?? 0))
  const rest = Math.max(0, due - (doc.paid ?? 0))
  return { due, rest, cancelled: (doc.credited ?? 0) > 0 && due <= 0.005, paid: due > 0.005 && rest <= 0.005 }
}

/**
 * Le document peut-il donner le suivant ? Devis et commande : ouverts ; facture : émise et payée en entier ;
 * bon de livraison : seulement ceux de l'ancienne chaîne. Jamais deux fois.
 */
export function canCreateNext(doc: { type: DocType; status: string; total: number; paid?: number; credited?: number; parent: { type: DocType } | null; children: { type: DocType }[] }) {
  if (nextInChain(doc)) return false
  const open = doc.status === "DRAFT" || doc.status === "SENT" || doc.status === "CONFIRMED"
  if (doc.type === "DEVIS" || doc.type === "COMMANDE") return open
  if (doc.type === "FACTURE") return doc.status === "INVOICED" && invoiceState(doc).paid
  if (doc.type === "LIVRAISON") return open && doc.parent?.type === "COMMANDE"
  return false
}

/** Avertissement avant de créer le document suivant (ce qui sera irréversible). */
const NEXT_CONFIRM: Partial<Record<DocType, string>> = {
  COMMANDE: "La facture sera émise et ne pourra plus être modifiée (un avoir permet de la corriger).",
  FACTURE: "Les quantités sortiront du stock du comptoir.",
  LIVRAISON: "La facture sera émise et ne pourra plus être modifiée (un avoir permet de la corriger).",
}

/** Jour (AAAA-MM-JJ) dans N jours, à Brazzaville. */
const dayPlus = (days: number) => new Date(Date.now() + days * 864e5).toLocaleDateString("fr-CA", { timeZone: "Africa/Brazzaville" })

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
  // document qui vient d'être créé : mis en évidence dans la liste
  const [highlightId, setHighlightId] = useState("")
  const [loadedAt, setLoadedAt] = useState(0)
  const canWrite = session?.user?.role !== "COMPTABLE"

  // formulaire de création (ou de modification d'un brouillon : `editing`)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<{ id: string; reference: string; type: DocType; parentReference: string | null } | null>(null)
  const [validUntil, setValidUntil] = useState("")
  const [clients, setClients] = useState<ClientOption[]>([])
  const [variants, setVariants] = useState<VariantOption[]>([])
  const [clientId, setClientId] = useState("")
  const [contract, setContract] = useState<ClientContract | null>(null)
  const [lines, setLines] = useState<DraftLine[]>([EMPTY_LINE])
  const [discount, setDiscount] = useState("")
  const [notes, setNotes] = useState("")
  // livraison souhaitée
  const [deliveryDate, setDeliveryDate] = useState("")
  const [deliveryTerms, setDeliveryTerms] = useState("")
  const [today, setToday] = useState("")
  // factures non soldées de la portée : encours du client affiché dans les informations financières
  const [openInvoices, setOpenInvoices] = useState<OpenInvoice[] | null>(null)
  const [formError, setFormError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  // bon de commande : devis repris (ses articles, prix et remise remplissent le formulaire)
  const [quotes, setQuotes] = useState<QuoteOption[]>([])
  const [quotesLoaded, setQuotesLoaded] = useState(false)
  const [quoteId, setQuoteId] = useState("")
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
        // heure de lecture : sert à repérer les devis dont la validité est dépassée
        setLoadedAt(Date.now())
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

  // devis encore ouverts : lus dès l'arrivée sur l'écran (la liste est prête quand on ouvre le formulaire),
  // puis relus à chaque ouverture et après chaque création
  useEffect(() => {
    if (!fromQuotes) return
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
  }, [creating, fromQuotes, reload])

  // encours des clients, relu à chaque ouverture du formulaire de bon de commande
  useEffect(() => {
    if (!creating || !fromQuotes) return
    const controller = new AbortController()
    const init = async () => {
      try {
        const res = await fetch("/api/commercial/creances", { signal: controller.signal })
        const data = await res.json().catch(() => null)
        if (!controller.signal.aborted) setOpenInvoices(res.ok ? (data?.creances ?? []) : null)
      } catch {}
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

  /** Liste remise à zéro sur un document : son onglet, sans filtre, en tête et mis en évidence. */
  const showDocument = (docType: DocType, id: string) => {
    if (!types.includes(docType)) {
      // document d'un autre écran (ex. bon de commande créé depuis un devis) : on y va
      window.location.href = `/admin/bons-b2b?type=${docType}&doc=${encodeURIComponent(id)}`
      return
    }
    setType(docType)
    setStatus("")
    setSearch("")
    setQuery("")
    setPage(1)
    setHighlightId(id)
    setReload((n) => n + 1)
  }

  // arrivée depuis un autre écran : ?type=COMMANDE&doc=<id> ouvre le bon onglet et met le document en évidence
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const wanted = params.get("type") as DocType | null
    const doc = params.get("doc")
    // lecture de l'adresse au premier affichage seulement
    // eslint-disable-next-line react-hooks/set-state-in-effect -- état initial tiré de l'adresse
    if (wanted && types.includes(wanted)) setType(wanted)
    if (doc) setHighlightId(doc)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule fois, à l'arrivée
  }, [])

  // le document mis en évidence est amené à l'écran
  useEffect(() => {
    if (!highlightId || loading) return
    document.getElementById(`doc-${highlightId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [highlightId, loading, documents])

  const openCreate = () => {
    setEditing(null)
    setValidUntil(dayPlus(30))
    setCreating(true)
    setQuoteId("")
    quoteRef.current = ""
    setClientId("")
    setContract(null)
    // bon de commande : aucun article d'office, ils viennent du devis ou du bouton « Ajouter un article »
    setLines(fromQuotes ? [] : [EMPTY_LINE])
    setDiscount("")
    setNotes("")
    setDeliveryDate("")
    setDeliveryTerms("")
    setToday(dayInBrazzaville(new Date()))
    setFormError("")
  }

  /** Modification d'un brouillon (devis ou bon de commande) : même formulaire, prérempli. */
  const openEdit = async (doc: B2bDocument) => {
    if (busy) return
    setBusy(`edit-${doc.id}`)
    setError("")
    try {
      const res = await fetch(`/api/b2b-documents/${doc.id}`)
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.document) { setError(data?.error || "Brouillon illisible"); return }
      const d = data.document as {
        id: string; reference: string; type: DocType; status: string; clientId: string | null; discount: number; notes: string | null
        validUntil: string | null; deliveryTerms: string | null; requestedDeliveryDate: string | null
        parent: { reference: string } | null
        items: { productVariantId: string | null; quantity: number; unitPrice: number }[]
      }
      if (d.status !== "DRAFT") { setError(`${d.reference} n'est plus un brouillon : il ne se modifie plus.`); return }
      setEditing({ id: d.id, reference: d.reference, type: d.type, parentReference: d.parent?.reference ?? null })
      setQuoteId("")
      // les prix enregistrés sont gardés (pas de recalcul par le contrat à l'ouverture)
      quoteRef.current = d.id
      setClientId(d.clientId ?? "")
      setLines(d.items.filter((i) => i.productVariantId).map((i) => ({ variantId: i.productVariantId as string, quantity: String(i.quantity), unitPrice: String(i.unitPrice) })))
      setDiscount(String(d.discount ?? 0))
      setNotes(d.notes ?? "")
      setValidUntil(d.validUntil ? dayInBrazzaville(new Date(d.validUntil)) : "")
      setDeliveryDate(d.requestedDeliveryDate ? dayInBrazzaville(new Date(d.requestedDeliveryDate)) : "")
      setDeliveryTerms(d.deliveryTerms ?? "")
      setToday(dayInBrazzaville(new Date()))
      setFormError("")
      setCreating(true)
    } catch {
      setError("Connexion au serveur impossible")
    } finally {
      setBusy(null)
    }
  }

  /** Changement de client : son adresse est proposée comme lieu de livraison si rien n'est saisi. */
  const chooseClient = (id: string) => {
    setClientId(id)
    setDeliveryTerms((current) => current || clientAddress(clients.find((c) => c.id === id)))
  }

  /** Reprend un devis : client, articles, prix, remise et remarques, tout reste modifiable. */
  const chooseQuote = (id: string) => {
    setFormError("")
    const quote = quotes.find((q) => q.id === id)
    if (!quote) {
      quoteRef.current = ""
      setQuoteId("")
      // le client venait du devis : plus de devis, plus de client
      setClientId("")
      setContract(null)
      setLines([])
      setDiscount("")
      setNotes("")
      setDeliveryDate("")
      setDeliveryTerms("")
      return
    }
    quoteRef.current = id
    setQuoteId(id)
    setClientId(quote.clientId)
    setLines(quote.items.filter((i) => i.productVariantId).map((i) => ({ variantId: i.productVariantId as string, quantity: String(i.quantity), unitPrice: String(i.unitPrice) })))
    setDiscount(String(quote.discount ?? 0))
    setNotes(quote.notes ?? "")
    const quoteDay = quote.requestedDeliveryDate ? dayInBrazzaville(new Date(quote.requestedDeliveryDate)) : ""
    setDeliveryDate(quoteDay && quoteDay >= today ? quoteDay : "")
    setDeliveryTerms(quote.deliveryTerms || clientAddress(clients.find((c) => c.id === quote.clientId)))
  }

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting || !creatable) return
    const items = lines.filter((l) => l.variantId).map((l) => ({ productVariantId: l.variantId, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) }))
    if (fromQuotes && !quoteId && !editing) { setFormError("Choisissez le devis à transformer en bon de commande"); return }
    if (!clientId) { setFormError("Choisissez un client"); return }
    if (items.length === 0) { setFormError("Ajoutez au moins un article"); return }
    if (items.some((i) => !Number.isInteger(i.quantity) || i.quantity < 1)) { setFormError("Les quantités doivent être des nombres entiers"); return }
    if (discountValue < 0 || discountValue > subtotal) { setFormError("La remise ne peut pas dépasser le total"); return }
    if (deliveryDate && deliveryDate < today) { setFormError("La date de livraison souhaitée est déjà passée"); return }
    const formType = editing?.type ?? creatable
    if (formType === "DEVIS" && validUntil && validUntil < today) { setFormError("La date de validité du devis est déjà passée"); return }
    setSubmitting(true)
    setFormError("")
    // mêmes champs en création et en modification
    const fields = {
      items,
      notes,
      ...(formType === "DEVIS" ? { validUntil: validUntil ? `${validUntil}T23:59:59+01:00` : null } : {}),
      ...(formType === "COMMANDE" ? { deliveryTerms, requestedDeliveryDate: deliveryDate ? `${deliveryDate}T12:00:00+01:00` : null } : {}),
    }
    try {
      const res = editing
        ? await fetch(`/api/b2b-documents/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...fields, discount: discountValue }),
          })
        : await fetch("/api/b2b-documents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // remise non saisie : le serveur applique celle du contrat ; bon de commande : le client vient du devis
            body: JSON.stringify({ type: creatable, clientId, ...fields, ...(discount === "" ? {} : { discount: discountValue }), ...(quoteId ? { parentId: quoteId } : {}) }),
          })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setFormError(data?.error || (editing ? "Modification impossible" : "Création impossible")); return }
      if (editing) {
        setMessage(`${editing.reference} modifié.`)
        setCreating(false)
        showDocument(editing.type, editing.id)
        setEditing(null)
        return
      }
      const quoteRefLabel = quotes.find((q) => q.id === quoteId)?.reference
      setMessage(`${TYPE_LABEL[creatable].one} ${data.document.reference} créé en brouillon${quoteRefLabel ? ` à partir du devis ${quoteRefLabel}` : ""}.`)
      setCreating(false)
      showDocument(creatable, data.document.id)
    } catch {
      setFormError(editing ? "Connexion au serveur impossible : rien n'a été modifié" : "Connexion au serveur impossible : rien n'a été créé")
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
    if (action === "transform" && NEXT_CONFIRM[doc.type] && !window.confirm(`${TYPE_LABEL[doc.type].next} de ${doc.reference} ?\n\n${NEXT_CONFIRM[doc.type]}`)) return
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
        transform: `${TYPE_LABEL[data.document.type as DocType]?.one ?? "Document"} ${data.document.reference} ${data.document.type === "FACTURE" ? "créée" : "créé"} à partir de ${doc.reference}.`,
      }
      setMessage(done[action])
      // le document créé s'affiche aussitôt : son onglet (ou son écran), sans filtre, mis en évidence
      if (action === "transform" && data?.document?.id) showDocument(data.document.type as DocType, data.document.id)
      else setReload((n) => n + 1)
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
        {creatable && canWrite && (
          <button type="button" onClick={openCreate} className="inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">
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
        {STATUS_BY_TYPE[type].length > 0 && (
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm" aria-label="État">
            <option value="">Tous les états</option>
            {STATUS_BY_TYPE[type].map((key) => <option key={key} value={key}>{STATUS_LABEL[key]?.label ?? key}</option>)}
          </select>
        )}
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
              const next = nextInChain(doc)
              const credits = doc.children.filter((c) => c.type === "AVOIR")
              const canTransform = canWrite && canCreateNext(doc)
              const open = doc.status === "DRAFT" || doc.status === "SENT"
              const isInvoice = doc.type === "FACTURE" && doc.status === "INVOICED"
              const inv = invoiceState(doc)
              const docLink = "font-mono text-primary underline-offset-2 hover:underline"
              return (
                <li
                  key={doc.id}
                  id={`doc-${doc.id}`}
                  className={`flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between ${doc.id === highlightId ? "bg-primary/5 ring-2 ring-inset ring-primary" : ""}`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/admin/bons-b2b/${doc.id}/document`} className="font-mono text-sm font-semibold text-gray-900 underline-offset-2 hover:underline">{doc.reference}</Link>
                      {doc.id === highlightId && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-white">Nouveau</span>}
                      {/* devis encore ouvert dont la date de validité est passée : à refaire ou à reconfirmer avec le client */}
                      {doc.type === "DEVIS" && open && !next && doc.validUntil && new Date(doc.validUntil).getTime() < loadedAt && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Validité dépassée</span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_LABEL[doc.status]?.className ?? "bg-gray-100 text-gray-700"}`}>{(doc.type === "AVOIR" || doc.type === "FACTURE") && doc.status === "INVOICED" ? "Émis" + (doc.type === "FACTURE" ? "e" : "") : STATUS_LABEL[doc.status]?.label ?? doc.status}</span>
                      {isInvoice && (() => {
                        // état du paiement : seuls les règlements validés comptent ; les avoirs réduisent le dû
                        const state =
                          inv.cancelled ? { label: "Annulée par avoir", className: "bg-gray-100 text-gray-600" }
                          : inv.paid ? { label: "Payée", className: "bg-green-100 text-green-700" }
                          : (doc.paid ?? 0) > 0 || (doc.credited ?? 0) > 0 ? { label: `Reste ${formatPrice(inv.rest)}`, className: "bg-amber-100 text-amber-800" }
                          : { label: "Non payée", className: "bg-rose-100 text-rose-700" }
                        return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${state.className}`}>{state.label}</span>
                      })()}
                    </div>
                    <p className="mt-1 text-sm font-medium text-gray-800">{doc.clientName}</p>
                    {/* place dans la chaîne : document d'origine et document suivant, cliquables */}
                    {(doc.parent || next || credits.length > 0) && (
                      <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-600">
                        {doc.parent && (
                          <span>
                            {doc.type === "AVOIR" ? "Sur la facture" : `Issu ${({ DEVIS: "du devis", COMMANDE: "du bon de commande", FACTURE: "de la facture", LIVRAISON: "du bon de livraison", AVOIR: "de l'avoir" } as Record<DocType, string>)[doc.parent.type]}`}{" "}
                            <Link href={`/admin/bons-b2b/${doc.parent.id}/document`} className={docLink}>{doc.parent.reference}</Link>
                          </span>
                        )}
                        {next && (
                          <span>
                            → {TYPE_LABEL[next.type].one.toLowerCase()} <Link href={`/admin/bons-b2b/${next.id}/document`} className={docLink}>{next.reference}</Link>
                          </span>
                        )}
                        {credits.map((c) => (
                          <span key={c.id}>Avoir <Link href={`/admin/bons-b2b/${c.id}/document`} className={docLink}>{c.reference}</Link></span>
                        ))}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      du {formatDate(doc.createdAt)} · {doc._count.items} article{doc._count.items > 1 ? "s" : ""}
                      {doc.type === "DEVIS" && doc.validUntil ? ` · valable jusqu'au ${formatDate(doc.validUntil)}` : ""}
                      {doc.requestedDeliveryDate && doc.type !== "FACTURE" ? ` · livraison souhaitée le ${formatDate(doc.requestedDeliveryDate)}` : ""}
                      {doc.discount > 0 ? ` · remise ${formatPrice(doc.discount)}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <span className="mr-1 whitespace-nowrap text-base font-bold text-gray-900">{formatPrice(doc.total)}</span>
                    <Link href={`/admin/bons-b2b/${doc.id}/document`} className={`${actionButton} border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}>
                      <Printer className="h-4 w-4" /> Voir
                    </Link>
                    {canWrite && doc.status === "DRAFT" && (doc.type === "DEVIS" || doc.type === "COMMANDE") && (
                      <button type="button" onClick={() => openEdit(doc)} disabled={busy !== null} className={`${actionButton} border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}>
                        <Pencil className="h-4 w-4" /> {busy === `edit-${doc.id}` ? "Ouverture…" : "Modifier"}
                      </button>
                    )}
                    {canWrite && doc.status === "DRAFT" && (doc.type === "DEVIS" || doc.type === "COMMANDE") && (
                      <button type="button" onClick={() => act(doc, "send")} disabled={busy !== null} className={`${actionButton} border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}>
                        <Send className="h-4 w-4" /> Envoyé au client
                      </button>
                    )}
                    {canWrite && open && doc.type === "DEVIS" && !next && (
                      <button type="button" onClick={() => act(doc, "confirm")} disabled={busy !== null} className={`${actionButton} border-green-300 bg-white text-green-700 hover:bg-green-50`}>
                        <Check className="h-4 w-4" /> Accepté par le client
                      </button>
                    )}
                    {canWrite && doc.type === "LIVRAISON" && open && (
                      <button type="button" onClick={() => act(doc, "confirm")} disabled={busy !== null} className={`${actionButton} border-green-300 bg-white text-green-700 hover:bg-green-50`}>
                        <Check className="h-4 w-4" /> Reçu par le client
                      </button>
                    )}
                    {canTransform && (
                      <button type="button" onClick={() => act(doc, "transform")} disabled={busy !== null} className={`${actionButton} border-primary bg-primary text-white hover:opacity-90`}>
                        <ArrowRight className="h-4 w-4" /> {busy === `transform-${doc.id}` ? "Création…" : TYPE_LABEL[doc.type].next}
                      </button>
                    )}
                    {/* facture pas encore payée : le bon de livraison attend l'encaissement */}
                    {isInvoice && !next && !inv.paid && !inv.cancelled && (
                      <Link href={`/admin/creances?q=${encodeURIComponent(doc.reference)}`} className={`${actionButton} border-amber-300 bg-white text-amber-800 hover:bg-amber-50`} title="Le bon de livraison s'établit une fois la facture entièrement payée">
                        <HandCoins className="h-4 w-4" /> Encaisser ({formatPrice(inv.rest)})
                      </Link>
                    )}
                    {canWrite && open && doc.type === "DEVIS" && (
                      <button type="button" onClick={() => act(doc, "reject")} disabled={busy !== null} className={`${actionButton} border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}>
                        Refusé par le client
                      </button>
                    )}
                    {canWrite && open && !next && (
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
                <h2 className="text-lg font-bold text-gray-900">
                  {editing ? `Modifier ${TYPE_LABEL[editing.type].one.toLowerCase()} ${editing.reference}` : `Nouveau ${TYPE_LABEL[creatable].one.toLowerCase()}`}
                </h2>
                <p className="text-sm text-gray-500">
                  {editing ? "Brouillon : il reste modifiable tant qu'il n'est pas envoyé au client." : "Créé en brouillon : vous pourrez le vérifier et le modifier avant de l'envoyer."}
                </p>
              </div>
              <button type="button" onClick={() => setCreating(false)} aria-label="Fermer" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>

            {/* modification : le client (et, pour un bon de commande, le devis d'origine) ne changent pas */}
            {editing && (
              <p className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                Client : <span className="font-semibold">{clients.find((c) => c.id === clientId)?.companyName || documents.find((d) => d.id === editing.id)?.clientName || "—"}</span>
                {editing.parentReference && <> · issu du devis <span className="font-mono">{editing.parentReference}</span></>}
              </p>
            )}

            {fromQuotes && !editing && (
              <label className="mb-4 block text-sm font-medium text-gray-700">
                Devis à reprendre
                <select value={quoteId} onChange={(e) => chooseQuote(e.target.value)} required className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5">
                  <option value="">{quotesLoaded ? "Choisir un devis…" : "Chargement des devis…"}</option>
                  {quotes.map((q) => (
                      <option key={q.id} value={q.id}>
                        {`${q.reference} — ${q.clientName} — ${formatPrice(q.total)}${q.status === "DRAFT" ? "" : ` (${STATUS_LABEL[q.status]?.label.toLowerCase() ?? q.status})`}${q.expired ? " — validité dépassée" : ""}`}
                      </option>
                    ))}
                </select>
                <span className="mt-1 block text-xs font-normal text-gray-500">
                  {quoteId
                    ? (() => {
                        const q = quotes.find((x) => x.id === quoteId)
                        return `${q ? `Devis du ${formatDate(q.createdAt)}, ${q.items.length} article${q.items.length > 1 ? "s" : ""}. ` : ""}Articles, prix et remise repris du devis : vous pouvez encore les modifier. Le devis passera à « Confirmé ».`
                      })()
                    : quotesLoaded && quotes.length === 0
                      ? "Aucun devis en attente de commande : établissez d'abord un devis (écran Devis)."
                      : "Le client, les articles et les prix viennent du devis. Les devis déjà transformés, refusés ou annulés ne sont pas proposés."}
                </span>
              </label>
            )}

            {/* bon de commande : pas de champ client, il vient du devis choisi */}
            {!fromQuotes && !editing && (
              <>
                <label className="block text-sm font-medium text-gray-700">
                  Client B2B
                  <select value={clientId} onChange={(e) => chooseClient(e.target.value)} required className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5">
                    <option value="">Choisir un client…</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.companyName || c.tradeName || c.contactName || "Client"}</option>)}
                  </select>
                </label>
                {clients.length === 0 && <p className="mt-1 text-sm text-amber-700">Aucun client B2B disponible : créez-le d&apos;abord dans l&apos;écran Clients B2B.</p>}
              </>
            )}
            {activeContract && (
              <p className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                Contrat en cours : {activeContract.prices.size} prix négocié{activeContract.prices.size > 1 ? "s" : ""}
                {activeContract.discountPercent > 0 ? ` · remise ${activeContract.discountPercent} %` : ""}
                {` · paiement à ${activeContract.paymentTermsDays} jour${activeContract.paymentTermsDays > 1 ? "s" : ""}`}
                {activeContract.minOrderAmount > 0 ? ` · commande minimum ${formatPrice(activeContract.minOrderAmount)}` : ""}
              </p>
            )}

            {/* bon de commande : rien à saisir avant d'avoir choisi le devis, tout en découle */}
            {(!fromQuotes || quoteId || editing) && (<>
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">
                  {quoteId ? `Produits du devis ${quotes.find((q) => q.id === quoteId)?.reference ?? ""}` : "Articles"}
                  {lines.length > 0 && <span className="font-normal text-gray-500"> ({lines.length})</span>}
                </p>
                <button type="button" onClick={() => setLines((current) => [...current, EMPTY_LINE])} disabled={fromQuotes && !quoteId && !editing} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-primary-700 hover:bg-gray-50 disabled:opacity-40">
                  <Plus className="h-4 w-4" /> Ajouter un article
                </button>
              </div>
              <div className="space-y-2">
                {/* Une ligne par article à partir de 768 px ; en dessous, le produit prend toute la largeur
                    (sinon son nom était coupé). Les titres restent visibles une fois les cases remplies. */}
                {lines.length === 0 && (
                  <p className="rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
                    {fromQuotes && !quoteId && !editing ? "Choisissez un devis : ses produits s'afficheront ici." : "Aucun article : ajoutez-en un."}
                  </p>
                )}
                {lines.length > 0 && (
                  <div aria-hidden="true" className="hidden gap-2 px-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 md:grid md:grid-cols-[1fr_6rem_8rem_7rem_2.75rem]">
                    <span>Produit</span><span>Quantité</span><span>Prix unitaire</span><span>Total</span><span />
                  </div>
                )}
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
                    <button type="button" onClick={() => setLines((current) => current.filter((_, i) => i !== index))} disabled={!fromQuotes && lines.length === 1} aria-label="Retirer l'article" className="justify-self-end rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30">
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
              {!fromQuotes && (
                <label className="block text-sm font-medium text-gray-700">
                  Devis valable jusqu&apos;au
                  <input type="date" value={validUntil} min={today || undefined} onChange={(e) => setValidUntil(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5" />
                  <span className="mt-1 block text-xs font-normal text-gray-500">30 jours par défaut. Passé cette date, le devis est signalé « validité dépassée ».</span>
                </label>
              )}
              {fromQuotes && (<>
              <label className="block text-sm font-medium text-gray-700">
                Livraison souhaitée le
                <input type="date" value={deliveryDate} min={today || undefined} onChange={(e) => setDeliveryDate(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5" />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Lieu et conditions de livraison
                <input type="text" value={deliveryTerms} onChange={(e) => setDeliveryTerms(e.target.value)} maxLength={500} placeholder="Adresse, horaire, personne à contacter…" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5" />
              </label>
              </>)}
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

            {!fromQuotes && (
              <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm">
                <p className="flex justify-between text-gray-600"><span>Sous-total</span><span>{formatPrice(subtotal)}</span></p>
                {discountValue > 0 && <p className="flex justify-between text-gray-600"><span>{discount === "" ? `Remise du contrat (${activeContract?.discountPercent} %)` : "Remise"}</span><span>− {formatPrice(discountValue)}</span></p>}
                <p className="mt-1 flex justify-between text-lg font-bold text-gray-900"><span>Total</span><span>{formatPrice(Math.max(0, subtotal - discountValue))}</span></p>
              </div>
            )}

            {fromQuotes && (() => {
              const chosen = lines.filter((l) => l.variantId)
              const units = chosen.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0)
              const totalDue = Math.max(0, subtotal - discountValue)
              const termsDays = activeContract ? activeContract.paymentTermsDays : 30
              const dueDate = today ? formatDate(new Date(new Date(`${today}T12:00:00+01:00`).getTime() + termsDays * 864e5).toISOString()) : ""
              const client = clients.find((c) => c.id === clientId)
              const creditLimit = client?.creditLimit ?? null
              const owed = (openInvoices ?? []).filter((i) => i.clientId === clientId).reduce((sum, i) => sum + Math.max(0, i.balance), 0)
              const late = (openInvoices ?? []).filter((i) => i.clientId === clientId && i.overdue).reduce((sum, i) => sum + Math.max(0, i.balance), 0)
              const after = owed + totalDue
              const row = "flex justify-between gap-3 py-1"
              return (
                <div className="mt-4 space-y-3">
                  <section className="rounded-lg border border-gray-200 p-3 text-sm">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Récapitulatif des produits commandés</h3>
                    {chosen.length === 0 ? (
                      <p className="mt-2 text-gray-500">Aucun produit pour l&apos;instant.</p>
                    ) : (
                      <table className="mt-2 w-full text-left">
                        <thead>
                          <tr className="border-b border-gray-200 text-xs text-gray-500">
                            <th className="py-1 font-medium">Produit</th>
                            <th className="py-1 text-right font-medium">Qté</th>
                            <th className="py-1 text-right font-medium">Montant</th>
                          </tr>
                        </thead>
                        <tbody>
                          {chosen.map((l, i) => {
                            const q = Number(l.quantity) || 0
                            const pu = Number(l.unitPrice) || 0
                            return (
                              <tr key={i} className="border-b border-gray-100 align-top">
                                <td className="py-1.5 pr-2 text-gray-800">
                                  {variants.find((v) => v.id === l.variantId)?.label ?? "Produit"}
                                  <span className="block text-xs text-gray-500">{formatPrice(pu)} l&apos;unité</span>
                                </td>
                                <td className="whitespace-nowrap py-1.5 text-right">{q}</td>
                                <td className="whitespace-nowrap py-1.5 text-right font-medium">{formatPrice(q * pu)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="text-gray-700">
                            <td className="pt-2">{chosen.length} produit{chosen.length > 1 ? "s" : ""}</td>
                            <td className="whitespace-nowrap pt-2 text-right">{units} unité{units > 1 ? "s" : ""}</td>
                            <td className="whitespace-nowrap pt-2 text-right font-semibold">{formatPrice(subtotal)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    )}
                    {(deliveryDate || deliveryTerms) && (
                      <p className="mt-2 border-t border-gray-100 pt-2 text-xs text-gray-600">
                        Livraison{deliveryDate ? ` souhaitée le ${formatDate(`${deliveryDate}T12:00:00+01:00`)}` : ""}{deliveryTerms ? ` · ${deliveryTerms}` : ""}
                      </p>
                    )}
                  </section>

                  <section className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Informations financières</h3>
                    <div className="mt-2 text-gray-700">
                      <p className={row}><span>Sous-total</span><span>{formatPrice(subtotal)}</span></p>
                      {discountValue > 0 && (
                        <p className={row}>
                          <span>{discount === "" ? `Remise du contrat (${activeContract?.discountPercent} %)` : `Remise (${(subtotal > 0 ? Math.round((discountValue / subtotal) * 1000) / 10 : 0).toLocaleString("fr-FR")} %)`}</span>
                          <span>− {formatPrice(discountValue)}</span>
                        </p>
                      )}
                      <p className={`${row} border-t border-gray-300 text-lg font-bold text-gray-900`}><span>Total à payer</span><span>{formatPrice(totalDue)}</span></p>
                      <p className={row}><span>Paiement</span><span className="text-right">à {termsDays} jour{termsDays > 1 ? "s" : ""} après la facture{activeContract ? " (contrat)" : " (sans contrat)"}</span></p>
                      {dueDate && <p className={row}><span>Échéance si facturée aujourd&apos;hui</span><span>{dueDate}</span></p>}
                      {clientId && (
                        <>
                          <p className={`${row} mt-1 border-t border-gray-200`}><span>Plafond de crédit du client</span><span>{creditLimit ? formatPrice(creditLimit) : "non défini"}</span></p>
                          <p className={row}>
                            <span>Encours actuel{late > 0 ? ` (dont ${formatPrice(late)} en retard)` : ""}</span>
                            <span>{openInvoices === null ? "—" : formatPrice(owed)}</span>
                          </p>
                          <p className={`${row} font-semibold`}><span>Encours après cette commande</span><span>{openInvoices === null ? "—" : formatPrice(after)}</span></p>
                          {creditLimit !== null && creditLimit > 0 && openInvoices !== null && after > creditLimit && (
                            <p className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                              Le plafond de crédit est dépassé de {formatPrice(after - creditLimit)}.
                            </p>
                          )}
                          {late > 0 && (
                            <p className="mt-1 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800">Ce client a des factures en retard de paiement.</p>
                          )}
                        </>
                      )}
                    </div>
                  </section>
                </div>
              )
            })()}

            {activeContract && activeContract.minOrderAmount > 0 && subtotal > 0 && subtotal - discountValue < activeContract.minOrderAmount && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Le contrat prévoit une commande minimum de {formatPrice(activeContract.minOrderAmount)} : ce document est en dessous.</p>
            )}
            </>)}

            {formError && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setCreating(false)} disabled={submitting} className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Annuler</button>
              <button type="submit" disabled={submitting} aria-busy={submitting} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-wait disabled:opacity-60">
                {submitting ? "Enregistrement…" : editing ? "Enregistrer les modifications" : "Créer le brouillon"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
