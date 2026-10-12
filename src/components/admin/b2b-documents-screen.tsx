"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { AlertCircle, ArrowRight, Check, ChevronLeft, ChevronRight, FileText, Plus, Printer, Search, Send, Trash2, X } from "lucide-react"
import { formatPrice } from "@/lib/utils"

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

interface VariantOption {
  id: string
  label: string
  price: number
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
  const [lines, setLines] = useState<DraftLine[]>([EMPTY_LINE])
  const [discount, setDiscount] = useState("")
  const [notes, setNotes] = useState("")
  const [formError, setFormError] = useState("")
  const [submitting, setSubmitting] = useState(false)

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
          const products = (await productsRes.json()) as { name: string; variants: { id: string; format: string; price: number }[] }[]
          setVariants(products.flatMap((p) => p.variants.map((v) => ({ id: v.id, label: `${p.name} — ${v.format}`, price: v.price }))))
        }
      } catch {}
    }
    void init()
    return () => controller.abort()
  }, [creating, clients.length, session?.user?.id, session?.user?.role])

  const totalPages = Math.max(1, Math.ceil(total / 20))
  const subtotal = useMemo(() => lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0), [lines])
  const discountValue = Number(discount) || 0

  const changeType = (next: DocType) => { setType(next); setStatus(""); setPage(1); setLoading(true) }
  const updateLine = (index: number, patch: Partial<DraftLine>) => setLines((current) => current.map((l, i) => (i === index ? { ...l, ...patch } : l)))

  const openCreate = () => {
    setCreating(true)
    setClientId("")
    setLines([EMPTY_LINE])
    setDiscount("")
    setNotes("")
    setFormError("")
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
        body: JSON.stringify({ type: creatable, clientId, items, discount: discountValue, notes }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setFormError(data?.error || "Création impossible"); return }
      setMessage(`${TYPE_LABEL[creatable].one} ${data.document.reference} créé en brouillon.`)
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
              const canTransform = Boolean(TYPE_LABEL[doc.type].next) && !next && (doc.status === "CONFIRMED" || doc.status === "DRAFT")
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

            <label className="block text-sm font-medium text-gray-700">
              Client B2B
              <select value={clientId} onChange={(e) => setClientId(e.target.value)} required className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5">
                <option value="">Choisir un client…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.companyName || c.tradeName || c.contactName || "Client"}</option>)}
              </select>
            </label>
            {clients.length === 0 && <p className="mt-1 text-sm text-amber-700">Aucun client B2B disponible : créez-le d&apos;abord dans l&apos;écran Clients B2B.</p>}

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">Articles</p>
                <button type="button" onClick={() => setLines((current) => [...current, EMPTY_LINE])} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-primary-700 hover:bg-gray-50">
                  <Plus className="h-4 w-4" /> Ajouter un article
                </button>
              </div>
              <div className="space-y-2">
                {lines.map((line, index) => (
                  <div key={index} className="grid grid-cols-2 gap-2 rounded-lg border border-gray-100 bg-gray-50 p-2.5 sm:grid-cols-[1fr_6rem_8rem_8rem_auto] sm:items-center">
                    <select
                      value={line.variantId}
                      onChange={(e) => {
                        const variant = variants.find((v) => v.id === e.target.value)
                        updateLine(index, { variantId: e.target.value, unitPrice: variant ? String(variant.price) : "" })
                      }}
                      aria-label="Produit"
                      className="col-span-2 rounded-lg border border-gray-300 bg-white px-3 py-2.5 sm:col-span-1"
                    >
                      <option value="">Produit…</option>
                      {variants.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                    </select>
                    <input type="number" min={1} step={1} value={line.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} aria-label="Quantité" placeholder="Qté" className="rounded-lg border border-gray-300 bg-white px-3 py-2.5" />
                    <input type="number" min={0} step={1} value={line.unitPrice} onChange={(e) => updateLine(index, { unitPrice: e.target.value })} aria-label="Prix unitaire" placeholder="Prix unitaire" className="rounded-lg border border-gray-300 bg-white px-3 py-2.5" />
                    <p className="whitespace-nowrap text-right text-sm font-semibold text-gray-900 sm:text-left">{formatPrice((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0))}</p>
                    <button type="button" onClick={() => setLines((current) => current.filter((_, i) => i !== index))} disabled={lines.length === 1} aria-label="Retirer l'article" className="justify-self-end rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-gray-700">
                Remise (FCFA)
                <input type="number" min={0} step={1} value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5" />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Remarques
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="Conditions, délais…" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5" />
              </label>
            </div>

            <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm">
              <p className="flex justify-between text-gray-600"><span>Sous-total</span><span>{formatPrice(subtotal)}</span></p>
              {discountValue > 0 && <p className="flex justify-between text-gray-600"><span>Remise</span><span>− {formatPrice(discountValue)}</span></p>}
              <p className="mt-1 flex justify-between text-lg font-bold text-gray-900"><span>Total</span><span>{formatPrice(Math.max(0, subtotal - discountValue))}</span></p>
            </div>

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
