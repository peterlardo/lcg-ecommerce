"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { AlertCircle, Check, ChevronDown, FileSignature, Pause, Pencil, Play, Plus, Search, Trash2, X } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { isCommercialRole } from "@/lib/permissions"
import { productOptions } from "@/lib/b2b-contract"

// Contrats commerciaux B2B : conditions négociées avec un client (délai de paiement, remise, prix par article).
// Un seul contrat actif par client. Portage de contrats-b2b.php (lcgapp3).

interface ContractItem {
  productVariantId: string
  name: string
  format: string
  unit: string | null
  publicPrice: number | null
  unitPrice: number
}

interface Contract {
  id: string
  clientId: string
  clientName: string
  status: "ACTIVE" | "SUSPENDED" | "EXPIRED"
  applicable: boolean
  startsAt: string
  endsAt: string | null
  paymentTermsDays: number
  minOrderAmount: number
  deliveryFrequency: string | null
  discountPercent: number
  notes: string | null
  itemCount: number
  items: ContractItem[]
}

interface ClientOption {
  id: string
  companyName: string | null
  tradeName: string | null
  contactName: string | null
}

interface VariantOption {
  id: string
  label: string
  price: number
}

interface PriceLine {
  variantId: string
  unitPrice: string
}

interface ContractForm {
  clientId: string
  status: Contract["status"]
  startsAt: string
  endsAt: string
  paymentTermsDays: string
  minOrderAmount: string
  deliveryFrequency: string
  discountPercent: string
  notes: string
  lines: PriceLine[]
}

const STATUS_LABEL: Record<Contract["status"], string> = { ACTIVE: "Actif", SUSPENDED: "Suspendu", EXPIRED: "Expiré" }

const TZ = "Africa/Brazzaville"
const formatDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ })
/** Jour (AAAA-MM-JJ) d'une date, à l'heure de Brazzaville, pour un champ de type date. */
const toDateInput = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-CA", { timeZone: TZ }) : "")
const today = () => new Date().toLocaleDateString("fr-CA", { timeZone: TZ })

/** État affiché : un contrat actif peut ne pas encore avoir commencé, ou être arrivé à son terme. */
function badge(contract: Contract): { label: string; className: string } {
  if (contract.status === "SUSPENDED") return { label: "Suspendu", className: "bg-amber-100 text-amber-800" }
  if (contract.status === "EXPIRED") return { label: "Expiré", className: "bg-gray-200 text-gray-600" }
  if (contract.applicable) return { label: "Actif", className: "bg-green-100 text-green-700" }
  if (new Date(contract.startsAt).getTime() > Date.now()) return { label: "Actif — pas encore commencé", className: "bg-blue-100 text-blue-700" }
  return { label: "Actif — arrivé à son terme", className: "bg-rose-100 text-rose-700" }
}

const emptyForm = (): ContractForm => ({
  clientId: "", status: "ACTIVE", startsAt: today(), endsAt: "", paymentTermsDays: "30", minOrderAmount: "", deliveryFrequency: "", discountPercent: "", notes: "", lines: [],
})

export default function ContratsB2bPage() {
  const { data: session } = useSession()
  const role = session?.user?.role
  // le comptable consulte ; l'administrateur et les commerciaux écrivent
  const canWrite = role === "ADMIN" || isCommercialRole(role)

  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [reload, setReload] = useState(0)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [openId, setOpenId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const [editing, setEditing] = useState<Contract | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<ContractForm>(emptyForm)
  const [formError, setFormError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [clients, setClients] = useState<ClientOption[]>([])
  const [variants, setVariants] = useState<VariantOption[]>([])

  useEffect(() => {
    const controller = new AbortController()
    const init = async () => {
      try {
        const res = await fetch("/api/b2b-contracts", { signal: controller.signal })
        const data = await res.json().catch(() => null)
        if (controller.signal.aborted) return
        if (!res.ok) {
          setError(res.status === 403 ? "Cet écran est réservé à l'administrateur, aux commerciaux et au comptable." : data?.error || "Chargement impossible")
          return
        }
        setError("")
        setContracts(data.contracts ?? [])
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) setError("Connexion au serveur impossible")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void init()
    return () => controller.abort()
  }, [reload])

  // clients et produits du formulaire, chargés à sa première ouverture
  useEffect(() => {
    if (!showForm || variants.length > 0) return
    const controller = new AbortController()
    const init = async () => {
      try {
        // un commercial ne propose que ses clients ; l'administrateur et le responsable commercial les voient tous
        const mine = role === "COMMERCIAL" ? `&commercialId=${session?.user?.id}` : ""
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
  }, [showForm, variants.length, role, session?.user?.id])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return contracts.filter((c) => (!status || c.status === status) && (!q || c.clientName.toLowerCase().includes(q)))
  }, [contracts, search, status])

  const set = (patch: Partial<ContractForm>) => setForm((current) => ({ ...current, ...patch }))
  const setLine = (index: number, patch: Partial<PriceLine>) => setForm((current) => ({ ...current, lines: current.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)) }))

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setFormError("")
    setShowForm(true)
  }

  const openEdit = (contract: Contract) => {
    setEditing(contract)
    setForm({
      clientId: contract.clientId,
      status: contract.status,
      startsAt: toDateInput(contract.startsAt),
      endsAt: toDateInput(contract.endsAt),
      paymentTermsDays: String(contract.paymentTermsDays),
      minOrderAmount: contract.minOrderAmount ? String(contract.minOrderAmount) : "",
      deliveryFrequency: contract.deliveryFrequency ?? "",
      discountPercent: contract.discountPercent ? String(contract.discountPercent) : "",
      notes: contract.notes ?? "",
      lines: contract.items.map((i) => ({ variantId: i.productVariantId, unitPrice: String(i.unitPrice) })),
    })
    setFormError("")
    setShowForm(true)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    const lines = form.lines.filter((l) => l.variantId)
    if (!form.clientId) { setFormError("Choisissez un client"); return }
    if (!form.startsAt) { setFormError("Indiquez la date de début"); return }
    if (form.endsAt && form.endsAt < form.startsAt) { setFormError("La date de fin doit être postérieure à la date de début"); return }
    if (new Set(lines.map((l) => l.variantId)).size !== lines.length) { setFormError("Un article figure deux fois dans la grille de prix"); return }
    if (lines.some((l) => l.unitPrice === "" || Number(l.unitPrice) < 0)) { setFormError("Indiquez le prix de chaque article de la grille"); return }
    const percent = Number(form.discountPercent) || 0
    if (percent < 0 || percent > 100) { setFormError("La remise est un pourcentage entre 0 et 100"); return }

    setSubmitting(true)
    setFormError("")
    try {
      const body = {
        ...(editing ? {} : { clientId: form.clientId }),
        status: form.status,
        // le contrat couvre les journées entières, à l'heure de Brazzaville
        startsAt: `${form.startsAt}T00:00:00+01:00`,
        endsAt: form.endsAt ? `${form.endsAt}T23:59:59+01:00` : null,
        paymentTermsDays: Number(form.paymentTermsDays) || 0,
        minOrderAmount: Number(form.minOrderAmount) || 0,
        discountPercent: percent,
        deliveryFrequency: form.deliveryFrequency,
        notes: form.notes,
        items: lines.map((l) => ({ productVariantId: l.variantId, unitPrice: Number(l.unitPrice) })),
      }
      const res = await fetch(editing ? `/api/b2b-contracts/${editing.id}` : "/api/b2b-contracts", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setFormError(data?.error || "Enregistrement impossible"); return }
      setMessage(editing ? `Contrat de ${editing.clientName} modifié.` : "Contrat créé.")
      setShowForm(false)
      setReload((n) => n + 1)
    } catch {
      setFormError("Connexion au serveur impossible : rien n'a été enregistré")
    } finally {
      setSubmitting(false)
    }
  }

  const changeStatus = async (contract: Contract, next: "ACTIVE" | "SUSPENDED") => {
    if (busy) return
    if (next === "SUSPENDED" && !window.confirm(`Suspendre le contrat de ${contract.clientName} ?\n\nSes prix négociés et sa remise ne s'appliqueront plus aux nouveaux devis.`)) return
    setBusy(contract.id)
    setError("")
    setMessage("")
    try {
      const res = await fetch(`/api/b2b-contracts/${contract.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setError(data?.error || "Action impossible"); return }
      setMessage(next === "ACTIVE" ? `Contrat de ${contract.clientName} réactivé.` : `Contrat de ${contract.clientName} suspendu.`)
      setReload((n) => n + 1)
    } catch {
      setError("Connexion au serveur impossible")
    } finally {
      setBusy(null)
    }
  }

  const field = "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5"
  const actionButton = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900 sm:text-2xl">
            <FileSignature className="h-6 w-6 text-primary" />
            Contrats B2B
          </h1>
          <p className="mt-1 text-sm text-gray-500">Conditions négociées avec un client : délai de paiement, remise et prix par article. Un seul contrat actif par client.</p>
        </div>
        {canWrite && (
          <button type="button" onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">
            <Plus className="h-4 w-4" /> Nouveau contrat
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 sm:flex-row sm:items-center sm:p-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom du client"
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="État du contrat" className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm">
          <option value="">Tous les états</option>
          {Object.entries(STATUS_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <p className="text-sm text-gray-500">{shown.length} contrat{shown.length > 1 ? "s" : ""}</p>
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
        {!loading && shown.length === 0 && (
          <p className="p-8 text-center text-sm text-gray-500">
            {contracts.length === 0 ? "Aucun contrat pour l'instant. Sans contrat, un client paie les prix publics, à 30 jours." : "Aucun contrat pour ces critères."}
          </p>
        )}
        {!loading && shown.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {shown.map((contract) => {
              const state = badge(contract)
              const open = openId === contract.id
              return (
                <li key={contract.id} className="p-3 sm:p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold text-gray-900">{contract.clientName}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${state.className}`}>{state.label}</span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">
                        du {formatDate(contract.startsAt)} {contract.endsAt ? `au ${formatDate(contract.endsAt)}` : "· sans date de fin"}
                      </p>
                      <p className="text-xs text-gray-500">
                        paiement à {contract.paymentTermsDays} jour{contract.paymentTermsDays > 1 ? "s" : ""}
                        {contract.discountPercent > 0 ? ` · remise ${contract.discountPercent} %` : ""}
                        {contract.minOrderAmount > 0 ? ` · commande minimum ${formatPrice(contract.minOrderAmount)}` : ""}
                        {contract.deliveryFrequency ? ` · livraison : ${contract.deliveryFrequency}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <button type="button" onClick={() => setOpenId(open ? null : contract.id)} aria-expanded={open} className={`${actionButton} border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}>
                        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
                        {contract.itemCount} prix négocié{contract.itemCount > 1 ? "s" : ""}
                      </button>
                      {canWrite && (
                        <>
                          <button type="button" onClick={() => openEdit(contract)} disabled={busy !== null} className={`${actionButton} border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}>
                            <Pencil className="h-4 w-4" /> Modifier
                          </button>
                          {contract.status === "ACTIVE" ? (
                            <button type="button" onClick={() => changeStatus(contract, "SUSPENDED")} disabled={busy !== null} className={`${actionButton} border-amber-300 bg-white text-amber-800 hover:bg-amber-50`}>
                              <Pause className="h-4 w-4" /> Suspendre
                            </button>
                          ) : (
                            <button type="button" onClick={() => changeStatus(contract, "ACTIVE")} disabled={busy !== null} className={`${actionButton} border-green-300 bg-white text-green-700 hover:bg-green-50`}>
                              <Play className="h-4 w-4" /> Réactiver
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  {open && (
                    <div className="mt-3 rounded-lg bg-gray-50 p-3">
                      {contract.items.length === 0 && <p className="text-sm text-gray-500">Aucun prix négocié : les prix publics s&apos;appliquent{contract.discountPercent > 0 ? `, avec la remise de ${contract.discountPercent} %` : ""}.</p>}
                      {contract.items.length > 0 && (
                        <ul className="divide-y divide-gray-200 text-sm">
                          {contract.items.map((item) => (
                            <li key={item.productVariantId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
                              <span className="text-gray-800">{item.name} — {item.format}</span>
                              <span className="whitespace-nowrap">
                                <span className="font-semibold text-primary-700">{formatPrice(item.unitPrice)}</span>
                                {item.publicPrice !== null && item.publicPrice !== item.unitPrice && <span className="ml-2 text-gray-500">au lieu de {formatPrice(item.publicPrice)}</span>}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {contract.notes && <p className="mt-2 text-sm text-gray-600">Remarques : {contract.notes}</p>}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 sm:items-center sm:p-4">
          <form onSubmit={submit} className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:max-w-3xl sm:rounded-2xl sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{editing ? `Contrat de ${editing.clientName}` : "Nouveau contrat"}</h2>
                <p className="text-sm text-gray-500">Les prix et la remise du contrat sont proposés dans les nouveaux devis du client.</p>
              </div>
              <button type="button" onClick={() => setShowForm(false)} aria-label="Fermer" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {!editing && (
                <label className="block text-sm font-medium text-gray-700 sm:col-span-2">
                  Client B2B
                  <select value={form.clientId} onChange={(e) => set({ clientId: e.target.value })} required className={field}>
                    <option value="">Choisir un client…</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.companyName || c.tradeName || c.contactName || "Client"}</option>)}
                  </select>
                </label>
              )}
              <label className="block text-sm font-medium text-gray-700">
                Début
                <input type="date" value={form.startsAt} onChange={(e) => set({ startsAt: e.target.value })} required className={field} />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Fin (laisser vide : sans date de fin)
                <input type="date" value={form.endsAt} min={form.startsAt || undefined} onChange={(e) => set({ endsAt: e.target.value })} className={field} />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Délai de paiement (jours)
                <input type="number" min={0} max={365} step={1} value={form.paymentTermsDays} onChange={(e) => set({ paymentTermsDays: e.target.value })} className={field} />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Remise sur les prix publics (%)
                <input type="number" min={0} max={100} step={0.5} value={form.discountPercent} onChange={(e) => set({ discountPercent: e.target.value })} placeholder="0" className={field} />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Commande minimum (FCFA)
                <input type="number" min={0} step={1} value={form.minOrderAmount} onChange={(e) => set({ minOrderAmount: e.target.value })} placeholder="0" className={field} />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Fréquence de livraison
                <input type="text" value={form.deliveryFrequency} onChange={(e) => set({ deliveryFrequency: e.target.value })} maxLength={100} placeholder="Ex. chaque lundi" className={field} />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                État
                <select value={form.status} onChange={(e) => set({ status: e.target.value as Contract["status"] })} className={field}>
                  {Object.entries(STATUS_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Remarques
                <input type="text" value={form.notes} onChange={(e) => set({ notes: e.target.value })} maxLength={500} placeholder="Conditions particulières…" className={field} />
              </label>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">Prix négociés par article</p>
                  <p className="text-xs text-gray-500">Un prix négocié est un prix net : la remise en % ne s&apos;y ajoute pas.</p>
                </div>
                <button type="button" onClick={() => set({ lines: [...form.lines, { variantId: "", unitPrice: "" }] })} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-primary-700 hover:bg-gray-50">
                  <Plus className="h-4 w-4" /> Ajouter un article
                </button>
              </div>
              {form.lines.length === 0 && <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-500">Aucun prix négocié : le client paie les prix publics{Number(form.discountPercent) > 0 ? `, moins ${form.discountPercent} %` : ""}.</p>}
              <div className="space-y-2">
                {/* une ligne par article à partir de 768 px ; en dessous, le produit prend toute la largeur */}
                {form.lines.length > 0 && (
                  <div aria-hidden="true" className="hidden gap-2 px-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 md:grid md:grid-cols-[1fr_8rem_9rem_2.75rem]">
                    <span>Produit</span><span className="text-right">Prix public</span><span>Prix négocié</span><span />
                  </div>
                )}
                {form.lines.map((line, index) => {
                  const variant = variants.find((v) => v.id === line.variantId)
                  return (
                    <div key={index} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border border-gray-100 bg-gray-50 p-2.5 md:grid-cols-[1fr_8rem_9rem_2.75rem] md:items-center">
                      <select
                        value={line.variantId}
                        onChange={(e) => {
                          const next = variants.find((v) => v.id === e.target.value)
                          setLine(index, { variantId: e.target.value, unitPrice: line.unitPrice || (next ? String(next.price) : "") })
                        }}
                        aria-label="Produit"
                        className="col-span-2 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2.5 md:col-span-1"
                      >
                        <option value="">{variants.length ? "Choisir un produit…" : "Chargement des produits…"}</option>
                        {variants.map((v) => <option key={v.id} value={v.id}>{`${v.label} · ${formatPrice(v.price)}`}</option>)}
                        {/* article du contrat qui n'est plus au catalogue (produit désactivé) */}
                        {line.variantId && !variant && <option value={line.variantId}>{editing?.items.find((i) => i.productVariantId === line.variantId)?.name ?? "Produit"}</option>}
                      </select>
                      <p className="hidden text-right text-sm text-gray-500 md:block">{variant ? formatPrice(variant.price) : ""}</p>
                      <label className="text-xs font-medium text-gray-600 md:contents">
                        <span className="md:sr-only">Prix négocié (FCFA){variant ? ` · public ${formatPrice(variant.price)}` : ""}</span>
                        <input type="number" min={0} step={1} value={line.unitPrice} onChange={(e) => setLine(index, { unitPrice: e.target.value })} placeholder="Prix" className="mt-1 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base font-normal text-gray-900 md:mt-0" />
                      </label>
                      <button type="button" onClick={() => set({ lines: form.lines.filter((_, i) => i !== index) })} aria-label="Retirer l'article" className="self-end justify-self-end rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 md:self-center">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            {formError && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} disabled={submitting} className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Annuler</button>
              <button type="submit" disabled={submitting} aria-busy={submitting} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-wait disabled:opacity-60">
                {submitting ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
