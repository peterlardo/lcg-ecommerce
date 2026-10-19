"use client"
import { useState, useEffect, useCallback, useMemo } from "react"
import { useSession } from "next-auth/react"
import { hasPermission } from "@/lib/permissions"
import { Handshake, Plus, Search, Trash2, X, Loader2, Power, PowerOff, Save } from "lucide-react"


interface Partner {
  id: string
  name: string
  companyName: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  isActive: boolean
  discountPercent: number
}

interface CatalogVariant {
  id: string
  format: string
  price: number
  partnerPrice: number | null
}

interface CatalogProduct {
  id: string
  name: string
  variants: CatalogVariant[]
}


const inputCls =
  "w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
const labelCls = "block text-xs font-medium text-gray-600 mb-1"
const btnPrimary =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
const btnSecondary =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
const btnDanger =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50"

const emptyForm = {
  name: "",
  companyName: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
}

export default function PartenairesPage() {
  const { data: session } = useSession()
  const canEdit = hasPermission(session?.user, ["partenaires"], "edit")
  const canCreate = hasPermission(session?.user, ["partenaires"], "create")
  const canDelete = hasPermission(session?.user, ["partenaires"], "delete")

  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Partner | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [discount, setDiscount] = useState("0")
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [toast, setToast] = useState("")
  const [catalog, setCatalog] = useState<CatalogProduct[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [priceDraft, setPriceDraft] = useState<Record<string, string>>({})
  const [savingVariantId, setSavingVariantId] = useState<string | null>(null)
  const [productSearch, setProductSearch] = useState("")

  const loadPartners = useCallback(async () => {
    try {
      const res = await fetch("/api/partenaires")
      if (!res.ok) {
        setError("Impossible de charger les partenaires.")
        return
      }
      setPartners(await res.json())
    } catch {
      setError("Impossible de charger les partenaires.")
    }
  }, [])


  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await loadPartners()
      setLoading(false)
    }
    void init()
  }, [loadPartners])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(""), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const loadDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/partenaires/${id}`)
      if (!res.ok) {
        setSelected(null)
        setError("Partenaire introuvable.")
        return
      }
      const p: Partner = await res.json()
      setSelected(p)
      setSelectedId(id)
      setForm({
        name: p.name ?? "",
        companyName: p.companyName ?? "",
        phone: p.phone ?? "",
        email: p.email ?? "",
        address: p.address ?? "",
        notes: p.notes ?? "",
      })
      setDiscount(String(p.discountPercent ?? 0))
      setError("")
    } catch {
      setError("Impossible de charger le partenaire.")
    }
  }, [])

  const loadCatalog = useCallback(async (id: string) => {
    setCatalogLoading(true)
    try {
      const res = await fetch(`/api/partenaires/${id}/prix`)
      if (!res.ok) {
        setCatalog([])
        return
      }
      const data = await res.json()
      setCatalog(Array.isArray(data.products) ? data.products : [])
    } catch {
      setCatalog([])
    } finally {
      setCatalogLoading(false)
    }
  }, [])

  const applyCatalog = useCallback(
    (id: string) => {
      void loadDetail(id)
      void loadCatalog(id)
    },
    [loadDetail, loadCatalog]
  )

  async function savePrice(productId: string, variant: CatalogVariant) {
    if (!selected) return
    const raw = priceDraft[variant.id]
    setSavingVariantId(variant.id)
    setError("")
    try {
      const isClear = raw === undefined ? false : raw.trim() === ""
      const price = isClear ? null : Number(raw)
      if (price !== null && (!Number.isFinite(price) || price < 0)) {
        setError("Prix préférentiel invalide.")
        return
      }
      const res = await fetch(`/api/partenaires/${selected.id}/prix`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId: variant.id, price }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error ?? "Erreur lors de l'enregistrement du tarif.")
        return
      }
      setCatalog((prev) =>
        prev.map((p) =>
          p.id !== productId
            ? p
            : {
                ...p,
                variants: p.variants.map((v) => (v.id === variant.id ? { ...v, partnerPrice: price } : v)),
              }
        )
      )
      setPriceDraft((prev) => {
        const next = { ...prev }
        delete next[variant.id]
        return next
      })
      setToast("Tarif préférentiel enregistré.")
    } catch {
      setError("Erreur réseau.")
    } finally {
      setSavingVariantId(null)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return partners.filter((p) => {
      if (activeFilter === "active" && !p.isActive) return false
      if (activeFilter === "inactive" && p.isActive) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        (p.companyName ?? "").toLowerCase().includes(q) ||
        (p.phone ?? "").includes(q)
      )
    })
  }, [partners, search, activeFilter])

  const filteredCatalog = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    if (!q) return catalog
    return catalog
      .map((p) => {
        const nameMatch = p.name.toLowerCase().includes(q)
        const variants = nameMatch ? p.variants : p.variants.filter((v) => v.format.toLowerCase().includes(q))
        return { ...p, variants }
      })
      .filter((p) => p.variants.length > 0)
  }, [catalog, productSearch])

  async function createPartner() {
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/partenaires", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          companyName: form.companyName || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
          address: form.address || undefined,
          notes: form.notes || undefined,
          discountPercent: Number(discount) || 0,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error ?? "Erreur lors de la création.")
        return
      }
      setShowCreate(false)
      setForm(emptyForm)
      setDiscount("0")
      await loadPartners()
      applyCatalog(data.id)
      setToast("Partenaire créé.")
    } catch {
      setError("Erreur réseau.")
    } finally {
      setSaving(false)
    }
  }

  async function saveInfo() {
    if (!selected) return
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/partenaires/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          companyName: form.companyName || null,
          phone: form.phone || null,
          email: form.email || null,
          address: form.address || null,
          notes: form.notes || null,
          discountPercent: Number(discount) || 0,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error ?? "Erreur lors de l'enregistrement.")
        return
      }
      await loadPartners()
      await loadDetail(selected.id)
      setToast("Fiche mise à jour.")    } catch {
      setError("Erreur réseau.")
    } finally {
      setSaving(false)
    }
  }


  async function toggleActive() {
    if (!selected) return
    setSaving(true)
    try {
      const res = await fetch(`/api/partenaires/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !selected.isActive }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? "Erreur.")
        return
      }
      await loadPartners()
      await loadDetail(selected.id)
      setToast(selected.isActive ? "Partenaire désactivé." : "Partenaire réactivé.")
    } catch {
      setError("Erreur réseau.")
    } finally {
      setSaving(false)
    }
  }

  async function removePartner() {
    if (!selected) return
    if (!window.confirm(`Supprimer le partenaire « ${selected.name} » ?`)) return
    setSaving(true)
    try {
      const res = await fetch(`/api/partenaires/${selected.id}`, { method: "DELETE" })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error ?? "Suppression refusée.")
        return
      }
      setSelected(null)
      setSelectedId(null)
      setForm(emptyForm)
      setDiscount("0")
      await loadPartners()
      setToast("Partenaire supprimé.")
    } catch {
      setError("Erreur réseau.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Handshake className="h-5 w-5 text-primary-600" /> Partenaires
        </h1>
        {canCreate && (
          <button onClick={() => { setForm(emptyForm); setDiscount("0"); setShowCreate(true) }} className={btnPrimary}>
            <Plus className="h-4 w-4" /> Nouveau partenaire
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start justify-between gap-2">
          <span>{error}</span>
          <button onClick={() => setError("")} aria-label="Fermer" className="p-1 min-h-[44px] min-w-[44px] -my-2">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {toast && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{toast}</div>}

      {showCreate && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Nouveau partenaire</h2>
            <button onClick={() => setShowCreate(false)} className="p-2 min-h-[44px] min-w-[44px]" aria-label="Annuler">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Nom *</label>
              <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Société</label>
              <input className={inputCls} value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Téléphone</label>
              <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Email</label>
              <input className={inputCls} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Adresse</label>
              <input className={inputCls} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Notes</label>
              <input className={inputCls} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Remise (%)</label>
              <input className={inputCls} type="number" min={0} max={100} value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
          </div>
          <button onClick={createPartner} disabled={saving || !form.name.trim()} className={btnPrimary}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Créer
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            className={inputCls + " pl-9"}
            placeholder="Rechercher (nom, société, téléphone)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex rounded-lg border border-gray-300 overflow-hidden">
          {([["all", "Tous"], ["active", "Actifs"], ["inactive", "Inactifs"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              className={
                "min-h-[44px] px-4 text-sm font-medium " +
                (activeFilter === key ? "bg-primary-600 text-white" : "bg-white text-gray-600")
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="p-6 flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">Aucun partenaire.</div>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => applyCatalog(p.id)}
                className={
                  "w-full text-left px-4 py-3 min-h-[56px] flex items-center justify-between gap-2 " +
                  (selectedId === p.id ? "bg-primary-50" : "hover:bg-gray-50")
                }
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{p.name}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {[p.companyName, p.phone].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                <span
                  className={
                    "shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " +
                    (p.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600")
                  }
                >
                  {p.isActive ? "Actif" : "Inactif"}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          {!selected ? (
            <div className="text-sm text-gray-500 py-8 text-center">Sélectionnez un partenaire pour afficher sa fiche.</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Nom</label>
                  <input className={inputCls} disabled={!canEdit} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Société</label>
                  <input className={inputCls} disabled={!canEdit} value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Téléphone</label>
                  <input className={inputCls} disabled={!canEdit} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input className={inputCls} disabled={!canEdit} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Adresse</label>
                  <input className={inputCls} disabled={!canEdit} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Notes</label>
                  <textarea className={inputCls} disabled={!canEdit} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
              {canEdit && (
                <button onClick={saveInfo} disabled={saving || !form.name.trim()} className={btnPrimary}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer la fiche
                </button>
              )}

              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Remise partenaires</h3>
                <p className="text-xs text-gray-500 mb-2">
                  Pourcentage de remise appliqué aux prix publics lors des ventes à ce partenaire. Les prix sont arrondis au multiple de 25 FCFA. Utilisé seulement pour les produits sans tarif préférentiel ci-dessous.
                </p>
                <div className="max-w-[160px]">
                  <label className={labelCls}>Remise (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    disabled={!canEdit}
                    className={inputCls}
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                  />
                </div>
              </div>

              <div className="border-t border-gray-100 pt-3">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Tarifs préférentiels par produit</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Fixez un prix préférentiel pour chaque produit de ce partenaire. Le prix fixé est appliqué lors des ventes.
                </p>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    className={inputCls + " pl-9"}
                    placeholder="Rechercher un produit…"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                </div>
                {catalogLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500 py-3">
                    <Loader2 className="h-4 w-4 animate-spin" /> Chargement des produits…
                  </div>
                ) : filteredCatalog.length === 0 ? (
                  <div className="text-sm text-gray-500 py-3">Aucun produit.</div>
                ) : (
                  <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                    {filteredCatalog.map((product) => (
                      <div key={product.id} className="rounded-lg border border-gray-200 p-3">
                        <div className="text-sm font-medium text-gray-900 mb-2">{product.name}</div>
                        <div className="space-y-2">
                          {product.variants.map((v) => {
                            const draft = priceDraft[v.id]
                            const value = draft !== undefined ? draft : v.partnerPrice !== null ? String(v.partnerPrice) : ""
                            const dirty = draft !== undefined
                            return (
                              <div key={v.id} className="flex flex-wrap items-end gap-2">
                                <div className="min-w-[110px]">
                                  <div className="text-xs text-gray-500">Format</div>
                                  <div className="text-sm text-gray-800">{v.format}</div>
                                </div>
                                <div className="min-w-[110px]">
                                  <div className="text-xs text-gray-500">Prix public</div>
                                  <div className="text-sm text-gray-800">{v.price} FCFA</div>
                                </div>
                                <div className="w-[150px]">
                                  <label className="block text-xs text-gray-500 mb-1">Prix préférentiel</label>
                                  <input
                                    type="number"
                                    min={0}
                                    disabled={!canEdit || savingVariantId === v.id}
                                    className={inputCls}
                                    placeholder="Non défini"
                                    value={value}
                                    onChange={(e) => setPriceDraft((prev) => ({ ...prev, [v.id]: e.target.value }))}
                                  />
                                </div>
                                {canEdit && (
                                  <button
                                    onClick={() => savePrice(product.id, v)}
                                    disabled={savingVariantId === v.id || !dirty}
                                    className={btnPrimary + " !min-h-[44px]"}
                                  >
                                    {savingVariantId === v.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Save className="h-4 w-4" />
                                    )}
                                    {v.partnerPrice !== null ? "Mettre à jour" : "Définir"}
                                  </button>
                                )}
                                {v.partnerPrice !== null && canEdit && (
                                  <span className="text-xs text-green-700 self-center">
                                    {v.partnerPrice} FCFA
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {canEdit && (
                <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                  <button onClick={toggleActive} disabled={saving} className={btnSecondary}>
                    {selected.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                    {selected.isActive ? "Désactiver" : "Réactiver"}
                  </button>
                  {canDelete && (
                    <button onClick={removePartner} disabled={saving} className={btnDanger}>
                      <Trash2 className="h-4 w-4" /> Supprimer
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
