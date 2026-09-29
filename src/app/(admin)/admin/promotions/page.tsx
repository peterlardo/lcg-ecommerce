"use client"
import { useState, useEffect, useCallback } from "react"
import { BadgePercent, Ticket, Plus, Pencil, Trash2, Search, X, Loader2 } from "lucide-react"

interface Promotion {
  id: string
  name: string
  percent: number
  productId: string | null
  productName: string | null
  categoryId: string | null
  categoryName: string | null
  scope: "product" | "category" | "all"
  startsAt: string
  endsAt: string
  isActive: boolean
  createdAt: string
}

interface Coupon {
  id: string
  code: string
  description: string | null
  type: "PERCENT" | "FIXED"
  value: number
  minSubtotal: number
  startsAt: string
  endsAt: string | null
  maxUses: number | null
  usedCount: number
  isActive: boolean
  createdAt: string
}

interface ProductOption {
  id: string
  name: string
  categoryId: string | null
  categoryName: string | null
}

const inputCls =
  "w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
const labelCls = "block text-xs font-medium text-gray-600 mb-1"

const emptyPromoForm = {
  name: "",
  percent: "10",
  scopeType: "all" as "all" | "product" | "category",
  productId: "",
  categoryId: "",
  startsAt: "",
  endsAt: "",
  isActive: true,
}

const emptyCouponForm = {
  code: "",
  description: "",
  type: "PERCENT" as "PERCENT" | "FIXED",
  value: "10",
  minSubtotal: "0",
  startsAt: "",
  endsAt: "",
  maxUses: "",
  isActive: true,
}

function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
  } catch {
    return iso
  }
}

function statusOf(item: { isActive: boolean; startsAt: string; endsAt: string | null }) {
  const now = Date.now()
  if (!item.isActive) return { label: "Désactivée", cls: "bg-gray-100 text-gray-600" }
  if (new Date(item.startsAt).getTime() > now) return { label: "À venir", cls: "bg-amber-100 text-amber-700" }
  if (item.endsAt && new Date(item.endsAt).getTime() < now) return { label: "Terminée", cls: "bg-red-100 text-red-700" }
  return { label: "Active", cls: "bg-green-100 text-green-700" }
}

export default function PromotionsPage() {
  const [tab, setTab] = useState<"promotions" | "coupons">("promotions")
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [error, setError] = useState("")
  const [toast, setToast] = useState("")
  const [saving, setSaving] = useState(false)
  const [modal, setModal] = useState<null | { kind: "promo" | "coupon"; editingId: string | null }>(null)
  const [promoForm, setPromoForm] = useState(emptyPromoForm)
  const [couponForm, setCouponForm] = useState(emptyCouponForm)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [pRes, cRes, prodRes] = await Promise.all([
        fetch("/api/promotions"),
        fetch("/api/coupons"),
        fetch("/api/produits?all=1"),
      ])
      if (pRes.ok) setPromotions(await pRes.json())
      if (cRes.ok) setCoupons(await cRes.json())
      if (prodRes.ok) {
        const list: ProductOption[] = await prodRes.json()
        setProducts(list.map((p) => ({ id: p.id, name: p.name, categoryId: p.categoryId, categoryName: p.categoryName })))
      }
    } catch {
      setError("Impossible de charger les données.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      await loadData()
    }
    void init()
  }, [loadData])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(""), 2500)
    return () => clearTimeout(t)
  }, [toast])

  const categoryOptions = products.reduce<{ id: string; name: string }[]>((acc, p) => {
    if (p.categoryId && p.categoryName && !acc.some((c) => c.id === p.categoryId)) {
      acc.push({ id: p.categoryId, name: p.categoryName })
    }
    return acc
  }, [])

  function openPromo(p?: Promotion) {
    setError("")
    if (p) {
      setPromoForm({
        name: p.name,
        percent: String(p.percent),
        scopeType: p.scope,
        productId: p.productId || "",
        categoryId: p.categoryId || "",
        startsAt: toLocalInput(new Date(p.startsAt)),
        endsAt: toLocalInput(new Date(p.endsAt)),
        isActive: p.isActive,
      })
      setModal({ kind: "promo", editingId: p.id })
    } else {
      const now = new Date()
      const in7 = new Date(now.getTime() + 7 * 86400000)
      setPromoForm({ ...emptyPromoForm, startsAt: toLocalInput(now), endsAt: toLocalInput(in7) })
      setModal({ kind: "promo", editingId: null })
    }
  }

  function openCoupon(c?: Coupon) {
    setError("")
    if (c) {
      setCouponForm({
        code: c.code,
        description: c.description || "",
        type: c.type,
        value: String(c.value),
        minSubtotal: String(c.minSubtotal),
        startsAt: toLocalInput(new Date(c.startsAt)),
        endsAt: c.endsAt ? toLocalInput(new Date(c.endsAt)) : "",
        maxUses: c.maxUses === null ? "" : String(c.maxUses),
        isActive: c.isActive,
      })
      setModal({ kind: "coupon", editingId: c.id })
    } else {
      setCouponForm({ ...emptyCouponForm, startsAt: toLocalInput(new Date()) })
      setModal({ kind: "coupon", editingId: null })
    }
  }

  async function savePromo() {
    setSaving(true)
    setError("")
    try {
      const payload = {
        name: promoForm.name.trim(),
        percent: Number(promoForm.percent),
        productId: promoForm.scopeType === "product" ? promoForm.productId : null,
        categoryId: promoForm.scopeType === "category" ? promoForm.categoryId : null,
        startsAt: new Date(promoForm.startsAt).toISOString(),
        endsAt: new Date(promoForm.endsAt).toISOString(),
        isActive: promoForm.isActive,
      }
      if (!payload.name) return setError("Le nom est requis.")
      if (!promoForm.productId && promoForm.scopeType === "product") return setError("Sélectionnez un produit.")
      if (!promoForm.categoryId && promoForm.scopeType === "category") return setError("Sélectionnez une catégorie.")
      const editingId = modal?.editingId
      const res = editingId
        ? await fetch(`/api/promotions/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/promotions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setError(data.error || "Une erreur est survenue.")
      setToast(editingId ? "Promotion mise à jour." : "Promotion créée.")
      setModal(null)
      loadData()
    } catch {
      setError("Erreur réseau.")
    } finally {
      setSaving(false)
    }
  }

  async function saveCoupon() {
    setSaving(true)
    setError("")
    try {
      const payload = {
        code: couponForm.code.trim().toUpperCase(),
        description: couponForm.description.trim(),
        type: couponForm.type,
        value: Number(couponForm.value),
        minSubtotal: Number(couponForm.minSubtotal) || 0,
        startsAt: couponForm.startsAt ? new Date(couponForm.startsAt).toISOString() : new Date().toISOString(),
        endsAt: couponForm.endsAt ? new Date(couponForm.endsAt).toISOString() : null,
        maxUses: couponForm.maxUses === "" ? null : Number(couponForm.maxUses),
        isActive: couponForm.isActive,
      }
      if (!payload.code) return setError("Le code est requis.")
      if (!Number.isFinite(payload.value) || payload.value <= 0) return setError("La valeur de la remise doit être positive.")
      const editingId = modal?.editingId
      const res = editingId
        ? await fetch(`/api/coupons/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/coupons", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setError(data.error || "Une erreur est survenue.")
      setToast(editingId ? "Coupon mis à jour." : "Coupon créé.")
      setModal(null)
      loadData()
    } catch {
      setError("Erreur réseau.")
    } finally {
      setSaving(false)
    }
  }

  async function remove(kind: "promo" | "coupon", id: string, name: string) {
    if (!window.confirm(`Supprimer « ${name} » ?`)) return
    try {
      const res = await fetch(kind === "promo" ? `/api/promotions/${id}` : `/api/coupons/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || "Suppression impossible.")
        return
      }
      setToast("Supprimé.")
      loadData()
    } catch {
      setError("Erreur réseau.")
    }
  }

  const q = search.trim().toLowerCase()
  const filteredPromos = q
    ? promotions.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.productName || "").toLowerCase().includes(q) ||
          (p.categoryName || "").toLowerCase().includes(q)
      )
    : promotions
  const filteredCoupons = q
    ? coupons.filter((c) => c.code.toLowerCase().includes(q) || (c.description || "").toLowerCase().includes(q))
    : coupons

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Promotions & Coupons</h1>
          <p className="text-sm text-gray-500 mt-1">
            Remises vitrine (prix barré) et codes promo applicables au panier.
          </p>
        </div>
        <button
          onClick={() => (tab === "promotions" ? openPromo() : openCoupon())}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> {tab === "promotions" ? "Nouvelle promotion" : "Nouveau coupon"}
        </button>
      </div>

      <div className="flex items-center gap-2 border-b border-gray-200">
        {(
          [
            { key: "promotions", label: "Promotions", icon: BadgePercent },
            { key: "coupons", label: "Coupons", icon: Ticket },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => { setTab(key); setSearch(""); setError("") }}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 max-w-xs">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "promotions" ? "Rechercher une promotion…" : "Rechercher un code…"}
            className={`${inputCls} pl-9`}
          />
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement…
        </div>
      ) : tab === "promotions" ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nom</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Remise</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Portée</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Période</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPromos.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">Aucune promotion.</td></tr>
                )}
                {filteredPromos.map((p) => {
                  const st = statusOf(p)
                  return (
                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                      <td className="px-4 py-3">−{p.percent} %</td>
                      <td className="px-4 py-3 text-gray-600">
                        {p.scope === "product" ? p.productName : p.scope === "category" ? p.categoryName : "Tout le catalogue"}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{fmtDate(p.startsAt)} → {fmtDate(p.endsAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openPromo(p)} className="p-1.5 text-gray-500 hover:text-primary rounded-lg hover:bg-gray-100" title="Modifier">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => remove("promo", p.id, p.name)} className="p-1.5 text-gray-500 hover:text-red-600 rounded-lg hover:bg-gray-100" title="Supprimer">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="md:hidden divide-y divide-gray-100">
            {filteredPromos.length === 0 && <div className="px-4 py-10 text-center text-sm text-gray-500">Aucune promotion.</div>}
            {filteredPromos.map((p) => {
              const st = statusOf(p)
              return (
                <div key={p.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-words font-medium text-gray-900">{p.name}</p>
                      <p className="break-words text-sm text-gray-500">−{p.percent} % · {p.scope === "product" ? p.productName : p.scope === "category" ? p.categoryName : "Tout le catalogue"}</p>
                      <p className="text-xs text-gray-400 mt-1">{fmtDate(p.startsAt)} → {fmtDate(p.endsAt)}</p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${st.cls}`}>{st.label}</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => openPromo(p)} className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg py-1.5"><Pencil className="h-3.5 w-3.5" /> Modifier</button>
                    <button onClick={() => remove("promo", p.id, p.name)} className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-medium text-red-600 border border-red-200 rounded-lg py-1.5"><Trash2 className="h-3.5 w-3.5" /> Supprimer</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[840px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Code</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Remise</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sous-total min.</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Utilisations</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Période</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCoupons.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">Aucun coupon.</td></tr>
                )}
                {filteredCoupons.map((c) => {
                  const st = statusOf({ isActive: c.isActive, startsAt: c.startsAt, endsAt: c.endsAt })
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-gray-900">{c.code}</td>
                      <td className="px-4 py-3">{c.type === "PERCENT" ? `−${c.value} %` : `${c.value} FCFA`}</td>
                      <td className="px-4 py-3 text-gray-600">{c.minSubtotal > 0 ? `${c.minSubtotal} FCFA` : "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{c.usedCount}{c.maxUses !== null ? ` / ${c.maxUses}` : ""}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{fmtDate(c.startsAt)}{c.endsAt ? ` → ${fmtDate(c.endsAt)}` : " → ouvert"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openCoupon(c)} className="p-1.5 text-gray-500 hover:text-primary rounded-lg hover:bg-gray-100" title="Modifier">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => remove("coupon", c.id, c.code)} className="p-1.5 text-gray-500 hover:text-red-600 rounded-lg hover:bg-gray-100" title="Supprimer">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="md:hidden divide-y divide-gray-100">
            {filteredCoupons.length === 0 && <div className="px-4 py-10 text-center text-sm text-gray-500">Aucun coupon.</div>}
            {filteredCoupons.map((c) => {
              const st = statusOf({ isActive: c.isActive, startsAt: c.startsAt, endsAt: c.endsAt })
              return (
                <div key={c.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-words font-mono font-semibold text-gray-900">{c.code}</p>
                      <p className="break-words text-sm text-gray-500">{c.type === "PERCENT" ? `−${c.value} %` : `${c.value} FCFA`}{c.minSubtotal > 0 ? ` · min. ${c.minSubtotal} FCFA` : ""}</p>
                      <p className="text-xs text-gray-400 mt-1">Utilisé {c.usedCount}{c.maxUses !== null ? ` / ${c.maxUses}` : ""} fois</p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${st.cls}`}>{st.label}</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => openCoupon(c)} className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg py-1.5"><Pencil className="h-3.5 w-3.5" /> Modifier</button>
                    <button onClick={() => remove("coupon", c.id, c.code)} className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-medium text-red-600 border border-red-200 rounded-lg py-1.5"><Trash2 className="h-3.5 w-3.5" /> Supprimer</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg">{toast}</div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 p-2 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {modal.kind === "promo"
                  ? modal.editingId ? "Modifier la promotion" : "Nouvelle promotion"
                  : modal.editingId ? "Modifier le coupon" : "Nouveau coupon"}
              </h2>
              <button onClick={() => { setModal(null); setError("") }} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg">{error}</div>}

              {modal.kind === "promo" ? (
                <>
                  <div>
                    <label className={labelCls}>Nom de la promotion *</label>
                    <input className={inputCls} value={promoForm.name} onChange={(e) => setPromoForm({ ...promoForm, name: e.target.value })} placeholder="Ex : Promo rentrée" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Remise (%) *</label>
                      <input type="number" min={1} max={100} className={inputCls} value={promoForm.percent} onChange={(e) => setPromoForm({ ...promoForm, percent: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelCls}>Portée *</label>
                      <select className={inputCls} value={promoForm.scopeType} onChange={(e) => setPromoForm({ ...promoForm, scopeType: e.target.value as typeof promoForm.scopeType })}>
                        <option value="all">Tout le catalogue</option>
                        <option value="product">Un produit</option>
                        <option value="category">Une catégorie</option>
                      </select>
                    </div>
                  </div>
                  {promoForm.scopeType === "product" && (
                    <div>
                      <label className={labelCls}>Produit *</label>
                      <select className={inputCls} value={promoForm.productId} onChange={(e) => setPromoForm({ ...promoForm, productId: e.target.value })}>
                        <option value="">— Sélectionner —</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  )}
                  {promoForm.scopeType === "category" && (
                    <div>
                      <label className={labelCls}>Catégorie *</label>
                      <select className={inputCls} value={promoForm.categoryId} onChange={(e) => setPromoForm({ ...promoForm, categoryId: e.target.value })}>
                        <option value="">— Sélectionner —</option>
                        {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Début *</label>
                      <input type="datetime-local" className={inputCls} value={promoForm.startsAt} onChange={(e) => setPromoForm({ ...promoForm, startsAt: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelCls}>Fin *</label>
                      <input type="datetime-local" className={inputCls} value={promoForm.endsAt} onChange={(e) => setPromoForm({ ...promoForm, endsAt: e.target.value })} />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={promoForm.isActive} onChange={(e) => setPromoForm({ ...promoForm, isActive: e.target.checked })} className="rounded border-gray-300" />
                    Promotion active
                  </label>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Code *</label>
                      <input className={`${inputCls} font-mono uppercase`} value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })} placeholder="EX : BIENVENUE10" />
                    </div>
                    <div>
                      <label className={labelCls}>Type de remise *</label>
                      <select className={inputCls} value={couponForm.type} onChange={(e) => setCouponForm({ ...couponForm, type: e.target.value as typeof couponForm.type })}>
                        <option value="PERCENT">Pourcentage (%)</option>
                        <option value="FIXED">Montant fixe (FCFA)</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>{couponForm.type === "PERCENT" ? "Remise (%)*" : "Remise (FCFA)*"}</label>
                      <input type="number" min={1} className={inputCls} value={couponForm.value} onChange={(e) => setCouponForm({ ...couponForm, value: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelCls}>Sous-total minimum (FCFA)</label>
                      <input type="number" min={0} className={inputCls} value={couponForm.minSubtotal} onChange={(e) => setCouponForm({ ...couponForm, minSubtotal: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Description</label>
                    <input className={inputCls} value={couponForm.description} onChange={(e) => setCouponForm({ ...couponForm, description: e.target.value })} placeholder="Ex : Offre de bienvenue" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className={labelCls}>Début *</label>
                      <input type="datetime-local" className={inputCls} value={couponForm.startsAt} onChange={(e) => setCouponForm({ ...couponForm, startsAt: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelCls}>Fin</label>
                      <input type="datetime-local" className={inputCls} value={couponForm.endsAt} onChange={(e) => setCouponForm({ ...couponForm, endsAt: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelCls}>Utilisations max.</label>
                      <input type="number" min={1} className={inputCls} value={couponForm.maxUses} onChange={(e) => setCouponForm({ ...couponForm, maxUses: e.target.value })} placeholder="∞" />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={couponForm.isActive} onChange={(e) => setCouponForm({ ...couponForm, isActive: e.target.checked })} className="rounded border-gray-300" />
                    Coupon actif
                  </label>
                </>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-4 sm:p-6 border-t border-gray-200">
              <button onClick={() => { setModal(null); setError("") }} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Annuler
              </button>
              <button
                onClick={() => (modal.kind === "promo" ? savePromo() : saveCoupon())}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Enregistrement…" : modal.editingId ? "Enregistrer" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
