"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Banknote, Boxes, CheckCircle2, ChevronRight, Clock3, Edit3, History, MapPin, Phone, Plus, RefreshCw, Search, Store, Truck, UserRound, XCircle } from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface UserOption { id: string; name: string | null; email: string; role: string }
interface Variant { id: string; format: string; stock: number; product: { name: string } }
interface PointOfSale { id: string; name: string; code: string; address: string; city: string; phone: string | null; managerName: string | null; managerUserId: string | null; managerUser: UserOption | null; isActive: boolean; _count: { orders: number; reservations: number; stocks: number }; cashSessions: CashSession[] }
interface CashSession { id: string; pointOfSaleId: string; openedAt: string; openingBalance: number; closingBalance: number | null; status: string; pointOfSale?: { name: string; code: string } }
interface StockLine { id: string; quantity: number; variant: { id: string; format: string; product: { name: string } } }
interface Detail { point: PointOfSale; orders: { id: string; orderNumber: string; customerName: string | null; total: number; status: string; createdAt: string }[]; reservations: { id: string; client: string; type: string; date: string; heure: string; status: string; pointOfSaleId?: string }[]; stocks: StockLine[]; movements: { id: string; type: string; quantity: number; reason: string | null; createdAt: string; variant: { format: string; product: { name: string } } }[]; openCash: CashSession | null; summary: { revenue: number; orders: number } }

const blankForm = { name: "", code: "", address: "", city: "", phone: "", managerName: "", managerUserId: "" }

export default function PointsDeVentePage() {
  const [points, setPoints] = useState<PointOfSale[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [variants, setVariants] = useState<Variant[]>([])
  const [stats, setStats] = useState<Record<string, number>>({})
  const [nextCode, setNextCode] = useState("PDV-001")
  const [selectedId, setSelectedId] = useState("")
  const [detail, setDetail] = useState<Detail | null>(null)
  const [form, setForm] = useState(blankForm)
  const [editing, setEditing] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [tab, setTab] = useState<"overview" | "stock" | "cash" | "history">("overview")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [stockForm, setStockForm] = useState({ variantId: "", quantity: "", sourcePointOfSaleId: "", reason: "" })
  const [cashBalance, setCashBalance] = useState("")
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const load = async (focusId?: string) => {
    setLoading(true)
    try {
      const response = await fetch("/api/points-de-vente")
      if (!response.ok) throw new Error("Impossible de charger les points de vente")
      const payload = await response.json()
      setPoints(payload.points)
      setUsers(payload.users)
      setVariants(payload.variants)
      setStats(Object.fromEntries(payload.stats.map((item: { pointOfSaleId: string; revenue: number }) => [item.pointOfSaleId, item.revenue])))
      setNextCode(payload.nextCode || "PDV-001")
      const nextId = focusId || selectedId || payload.points[0]?.id || ""
      setSelectedId(nextId)
      if (nextId) await loadDetail(nextId)
    } catch (err) { setError(err instanceof Error ? err.message : "Erreur de chargement") } finally { setLoading(false) }
  }

  const loadDetail = async (id: string) => {
    const response = await fetch(`/api/points-de-vente/${id}`)
    if (response.ok) setDetail(await response.json())
  }

  useEffect(() => { void load() }, [])

  const filteredPoints = useMemo(() => points.filter((point) => {
    const matchesSearch = `${point.name} ${point.code} ${point.city} ${point.managerName || ""}`.toLowerCase().includes(search.toLowerCase())
    return matchesSearch && (status === "all" || (status === "active" ? point.isActive : !point.isActive))
  }), [points, search, status])

  const resetMessages = () => { setError(""); setSuccess("") }
  const startCreate = () => { setForm({ ...blankForm, code: nextCode }); setEditing(false); setShowForm(true); resetMessages() }
  const startEdit = (point: PointOfSale) => { setForm({ name: point.name, code: point.code, address: point.address, city: point.city, phone: point.phone || "", managerName: point.managerName || "", managerUserId: point.managerUserId || "" }); setEditing(true); setShowForm(true); resetMessages() }

  const savePoint = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); resetMessages()
    const response = await fetch(editing ? `/api/points-de-vente/${selectedId}` : "/api/points-de-vente", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
    const body = await response.json().catch(() => null)
    if (!response.ok) setError(body?.error || "Impossible d’enregistrer le point de vente")
    else { setSuccess(editing ? "Point de vente modifié" : "Point de vente créé"); setShowForm(false); await load(editing ? selectedId : body.id) }
    setSaving(false)
  }

  const togglePoint = async (point: PointOfSale) => {
    resetMessages()
    const response = await fetch(`/api/points-de-vente/${point.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !point.isActive }) })
    if (!response.ok) setError("Impossible de modifier le statut")
    else { setSuccess(point.isActive ? "Point de vente désactivé" : "Point de vente activé"); await load(point.id) }
  }

  const assignReservation = async (reservationId: string) => {
    const response = await fetch(`/api/reservations/${reservationId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pointOfSaleId: selectedId }) })
    if (response.ok) { setSuccess("Pré-commande rattachée"); await load(selectedId) } else setError("Impossible de rattacher la pré-commande")
  }

  const submitStock = async (event: React.FormEvent) => {
    event.preventDefault(); if (!selectedId) return; setSaving(true); resetMessages()
    const response = await fetch("/api/points-de-vente/stock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pointOfSaleId: selectedId, ...stockForm, quantity: Number(stockForm.quantity) }) })
    const body = await response.json().catch(() => null)
    if (!response.ok) setError(body?.error || "Opération de stock impossible")
    else { setSuccess(stockForm.sourcePointOfSaleId ? "Transfert effectué" : "Stock ajouté"); setStockForm({ ...stockForm, quantity: "", variantId: "" }); await load(selectedId) }
    setSaving(false)
  }

  const openCash = async () => {
    if (!selectedId) return; setSaving(true); resetMessages()
    const response = await fetch("/api/points-de-vente/caisse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pointOfSaleId: selectedId, openingBalance: Number(cashBalance) || 0 }) })
    if (!response.ok) setError((await response.json()).error || "Impossible d’ouvrir la caisse")
    else { setSuccess("Caisse ouverte"); setCashBalance(""); await load(selectedId) }
    setSaving(false)
  }

  const closeCash = async () => {
    if (!detail?.openCash) return; setSaving(true); resetMessages()
    const response = await fetch("/api/points-de-vente/caisse", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: detail.openCash.id, closingBalance: Number(cashBalance) || 0 }) })
    if (!response.ok) setError((await response.json()).error || "Impossible de fermer la caisse")
    else { setSuccess("Caisse fermée"); setCashBalance(""); await load(selectedId) }
    setSaving(false)
  }

  const selectedPoint = points.find((point) => point.id === selectedId)

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm text-muted-foreground">Réseau commercial</p><h1 className="mt-1 text-2xl font-bold text-foreground">Points de vente</h1><p className="mt-1 text-sm text-muted-foreground">Agences, stocks, caisses et performances par emplacement.</p></div><button onClick={startCreate} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"><Plus className="h-4 w-4" /> Nouveau point de vente</button></div>
    {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}{success && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><div className="rounded-xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Points actifs</p><p className="mt-2 text-2xl font-bold text-foreground">{points.filter((point) => point.isActive).length} <span className="text-sm font-normal text-muted-foreground">/ {points.length}</span></p></div><div className="rounded-xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Chiffre d’affaires réseau</p><p className="mt-2 text-2xl font-bold text-foreground">{formatPrice(Object.values(stats).reduce((sum, value) => sum + value, 0))}</p></div><div className="rounded-xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Pré-commandes rattachées</p><p className="mt-2 text-2xl font-bold text-foreground">{points.reduce((sum, point) => sum + point._count.reservations, 0)}</p></div></div>
    {showForm && <form onSubmit={savePoint} className="rounded-xl border border-border bg-card p-5 shadow-card-soft"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold text-foreground">{editing ? "Modifier le point de vente" : "Nouveau point de vente"}</h2><button type="button" onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><XCircle className="h-5 w-5" /></button></div><div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">{([['name','Nom',true],['code','Code automatique',true],['address','Adresse',true],['city','Ville',true],['phone','Téléphone',false],['managerName','Nom du responsable',false]] as const).map(([key,label,required]) => <label key={key} className="text-xs font-medium text-muted-foreground">{label}<input required={required} value={form[key]} readOnly={key === "code" && !editing} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/30" /></label>)}<label className="text-xs font-medium text-muted-foreground">Utilisateur responsable<select value={form.managerUserId} onChange={(event) => setForm({ ...form, managerUserId: event.target.value })} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground"><option value="">Affecter plus tard</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name || user.email} · {user.role}</option>)}</select></label></div><div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground">Annuler</button><button disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving ? "Enregistrement..." : "Enregistrer"}</button></div></form>}
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[330px_minmax(0,1fr)]">
      <section className="space-y-3"><div className="flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher..." className="w-full rounded-lg border border-input bg-background py-2.5 pl-9 pr-3 text-sm text-foreground" /></div><select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-input bg-background px-2 text-sm text-foreground"><option value="all">Tous</option><option value="active">Actifs</option><option value="inactive">Inactifs</option></select></div>{loading && <p className="p-4 text-sm text-muted-foreground">Chargement...</p>}{filteredPoints.map((point) => <button key={point.id} onClick={() => { setSelectedId(point.id); void loadDetail(point.id) }} className={`w-full rounded-xl border bg-card p-4 text-left transition ${selectedId === point.id ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40"}`}><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="rounded-lg bg-primary/10 p-2.5 text-primary"><Store className="h-5 w-5" /></div><div><p className="font-semibold text-foreground">{point.name}</p><p className="mt-1 text-xs text-muted-foreground">{point.code} · {point.city}</p></div></div><span className={`h-2.5 w-2.5 rounded-full ${point.isActive ? "bg-green-500" : "bg-gray-400"}`} /></div><div className="mt-4 flex justify-between text-xs text-muted-foreground"><span>{formatPrice(stats[point.id] || 0)}</span><span>{point._count.orders} vente(s)</span></div></button>)}{!loading && filteredPoints.length === 0 && <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Aucun point trouvé.</div>}</section>
      {selectedPoint && detail && <section className="min-w-0 rounded-xl border border-border bg-card shadow-card-soft"><div className="border-b border-border p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-3"><h2 className="text-xl font-bold text-foreground">{selectedPoint.name}</h2><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${selectedPoint.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{selectedPoint.isActive ? "Actif" : "Inactif"}</span></div><p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{selectedPoint.address}, {selectedPoint.city}</p><p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><UserRound className="h-4 w-4" />{selectedPoint.managerUser?.name || selectedPoint.managerName || "Responsable non affecté"}{selectedPoint.phone && <><Phone className="ml-3 h-4 w-4" />{selectedPoint.phone}</>}</p></div><div className="flex gap-2"><button onClick={() => startEdit(selectedPoint)} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"><Edit3 className="h-4 w-4" /> Modifier</button><button onClick={() => togglePoint(selectedPoint)} className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted">{selectedPoint.isActive ? "Désactiver" : "Activer"}</button></div></div><div className="mt-5 flex gap-1 overflow-x-auto border-b border-border">{([['overview','Vue générale'],['stock','Stock & transferts'],['cash','Caisse'],['history','Historique']] as const).map(([value,label]) => <button key={value} onClick={() => setTab(value)} className={`border-b-2 px-3 py-2 text-sm font-medium ${tab === value ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>{label}</button>)}</div></div>
        {tab === "overview" && <div className="space-y-5 p-5"><div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><div className="rounded-lg bg-muted/50 p-4"><p className="text-xs text-muted-foreground">Chiffre d’affaires</p><p className="mt-2 text-xl font-bold text-foreground">{formatPrice(detail.summary.revenue)}</p></div><div className="rounded-lg bg-muted/50 p-4"><p className="text-xs text-muted-foreground">Ventes</p><p className="mt-2 text-xl font-bold text-foreground">{detail.summary.orders}</p></div><div className="rounded-lg bg-muted/50 p-4"><p className="text-xs text-muted-foreground">Articles en stock</p><p className="mt-2 text-xl font-bold text-foreground">{detail.stocks.reduce((sum, item) => sum + item.quantity, 0)}</p></div></div><div><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-foreground">Dernières ventes</h3><Link href={`/admin/ventes?pointOfSaleId=${selectedId}`} className="text-xs font-semibold text-primary">Ouvrir la caisse <ChevronRight className="inline h-3 w-3" /></Link></div><div className="divide-y divide-border rounded-lg border border-border">{detail.orders.slice(0, 6).map((order) => <div key={order.id} className="flex items-center justify-between gap-3 p-3 text-sm"><div><p className="font-medium text-foreground">{order.orderNumber}</p><p className="text-xs text-muted-foreground">{order.customerName || "Client"}</p></div><div className="text-right"><p className="font-semibold text-foreground">{formatPrice(order.total)}</p><p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString("fr-FR")}</p></div></div>)}{detail.orders.length === 0 && <p className="p-5 text-sm text-muted-foreground">Aucune vente rattachée.</p>}</div></div><div><h3 className="mb-3 font-semibold text-foreground">Pré-commandes rattachées</h3><div className="divide-y divide-border rounded-lg border border-border">{detail.reservations.slice(0, 5).map((reservation) => <div key={reservation.id} className="flex items-center justify-between gap-3 p-3 text-sm"><div><p className="font-medium text-foreground">{reservation.client}</p><p className="text-xs text-muted-foreground">{reservation.date} · {reservation.heure}</p></div>{reservation.pointOfSaleId === selectedId ? <span className="text-xs font-medium text-green-600">Rattachée</span> : <button onClick={() => assignReservation(reservation.id)} className="text-xs font-semibold text-primary hover:underline">Affecter ici</button>}</div>)}{detail.reservations.length === 0 && <p className="p-5 text-sm text-muted-foreground">Aucune réservation rattachée.</p>}</div></div></div>}
        {tab === "stock" && <div className="space-y-5 p-5"><form onSubmit={submitStock} className="rounded-lg border border-border p-4"><div className="mb-3 flex items-center gap-2"><Boxes className="h-4 w-4 text-primary" /><h3 className="font-semibold text-foreground">Ajouter ou transférer du stock</h3></div><div className="grid grid-cols-1 gap-3 md:grid-cols-4"><select required value={stockForm.variantId} onChange={(event) => setStockForm({ ...stockForm, variantId: event.target.value })} className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"><option value="">Produit / format</option>{variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.product.name} · {variant.format}</option>)}</select><input required min="1" type="number" value={stockForm.quantity} onChange={(event) => setStockForm({ ...stockForm, quantity: event.target.value })} placeholder="Quantité" className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground" /><select value={stockForm.sourcePointOfSaleId} onChange={(event) => setStockForm({ ...stockForm, sourcePointOfSaleId: event.target.value })} className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"><option value="">Approvisionnement central</option>{points.filter((point) => point.id !== selectedId && point.isActive).map((point) => <option key={point.id} value={point.id}>Depuis {point.name}</option>)}</select><button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Truck className="h-4 w-4" />{stockForm.sourcePointOfSaleId ? "Transférer" : "Ajouter"}</button></div></form><div className="overflow-x-auto rounded-lg border border-border"><table className="w-full text-left text-sm"><thead className="bg-muted/50 text-xs text-muted-foreground"><tr><th className="px-4 py-3">Produit</th><th className="px-4 py-3">Format</th><th className="px-4 py-3">Quantité</th></tr></thead><tbody className="divide-y divide-border">{detail.stocks.map((item) => <tr key={item.id}><td className="px-4 py-3 font-medium text-foreground">{item.variant.product.name}</td><td className="px-4 py-3 text-muted-foreground">{item.variant.format}</td><td className="px-4 py-3 font-semibold text-foreground">{item.quantity}</td></tr>)}{detail.stocks.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-sm text-muted-foreground">Aucun stock affecté à ce point de vente.</td></tr>}</tbody></table></div></div>}
        {tab === "cash" && <div className="space-y-5 p-5"><div className="flex items-center gap-3 rounded-lg border border-border p-4"><Banknote className="h-6 w-6 text-primary" /><div><p className="font-semibold text-foreground">{detail.openCash ? "Caisse ouverte" : "Aucune caisse ouverte"}</p><p className="text-sm text-muted-foreground">{detail.openCash ? `Ouverte le ${new Date(detail.openCash.openedAt).toLocaleString("fr-FR")}` : "Ouvrez une session avant d’encaisser."}</p></div></div><div className="flex max-w-md gap-3"><input type="number" min="0" value={cashBalance} onChange={(event) => setCashBalance(event.target.value)} placeholder={detail.openCash ? "Solde de clôture" : "Fond de caisse"} className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground" />{detail.openCash ? <button onClick={closeCash} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Fermer la caisse</button> : <button onClick={openCash} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Ouvrir la caisse</button>}</div><Link href={`/admin/caisse?pointOfSaleId=${selectedId}`} className="inline-flex items-center gap-2 text-sm font-semibold text-primary">Voir le rapprochement caisse <ChevronRight className="h-4 w-4" /></Link></div>}
        {tab === "history" && <div className="space-y-4 p-5"><div className="flex items-center gap-2"><History className="h-4 w-4 text-primary" /><h3 className="font-semibold text-foreground">Historique des mouvements</h3></div><div className="divide-y divide-border rounded-lg border border-border">{detail.movements.map((movement) => <div key={movement.id} className="flex items-center justify-between gap-3 p-3 text-sm"><div><p className="font-medium text-foreground">{movement.variant.product.name} · {movement.variant.format}</p><p className="text-xs text-muted-foreground">{movement.reason || movement.type}</p></div><div className="text-right"><p className={`font-semibold ${movement.type.includes("OUT") || movement.type === "SALE" ? "text-red-600" : "text-green-600"}`}>{movement.type.includes("OUT") || movement.type === "SALE" ? "-" : "+"}{movement.quantity}</p><p className="text-xs text-muted-foreground">{new Date(movement.createdAt).toLocaleString("fr-FR")}</p></div></div>)}{detail.movements.length === 0 && <p className="p-5 text-sm text-muted-foreground">Aucun mouvement enregistré.</p>}</div></div>}
      </section>}
    </div>
    {!selectedPoint && !loading && <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Créez ou sélectionnez un point de vente pour afficher ses opérations.</div>}
  </div>
}



